#!/usr/bin/env node
/**
 * Timesheet Submission Automation
 *
 * Automates timesheet entry to the Entelect portal using Playwright.
 * Reads structured task data from output/timesheet-data.json (written by the
 * generate-timesheet skill) and fills the web form automatically.
 *
 * Interactive by design: every failure path stops and asks a human to fix the
 * step by hand or skip the Entry. Do not run this unattended — pressing Enter at
 * those prompts asserts that someone intervened.
 *
 * Features:
 * - Pre-flight check of every pairing against the live Portal Catalogue
 * - Project auto-selection (switches when task.project changes)
 * - Category auto-selection (visible or dropdown)
 * - Form filling (ticket, description, time, worked from, billable)
 * - Skipped Entries stay unsubmitted and are retried on the next run
 * - Uses persistent browser context to preserve login state
 */
import fs from 'fs/promises';
import chalk from 'chalk';
import { validateEntries } from './lib/timesheet-validator.js';
import { entriesOutsideCatalogue } from './lib/catalogue.js';
import { openPortal, readCatalogue } from './lib/portal.js';
import { planWindows } from './lib/calendar-windows.js';
import { fillEntries, formatTime } from './lib/submit-flow.js';
import { ask, waitForEnter } from './lib/prompt.js';

/**
 * Prompt after a failed step: Enter means it was done by hand, "s" skips the Entry.
 * `verify` (optional) returns a description of what is still wrong, or null; while
 * it complains, Enter is not accepted. Returns false when the user skips.
 */
async function recover(instruction, verify) {
  console.log(chalk.yellow(`  ${instruction}`));
  while (true) {
    const answer = await ask('Press Enter once done by hand, or type s to skip this Entry: ');
    if (answer.toLowerCase() === 's') return false;
    const problem = verify && await verify();
    if (!problem) return true;
    console.log(chalk.red(`  ✗ ${problem}`));
  }
}

async function main() {
  // Verify mode never reads or writes output/timesheet-data.json; see docs/adr/0005.
  if (process.argv.includes('--verify')) {
    const { runVerify } = await import('./verify.js');
    return runVerify();
  }

  console.log(chalk.blue('Timesheet Submission Automation\n'));

  // Load timesheet data
  const dataPath = 'output/timesheet-data.json';
  let tasks;
  try {
    const data = await fs.readFile(dataPath, 'utf-8');
    tasks = JSON.parse(data);
  } catch (error) {
    console.error(chalk.red('Error loading timesheet data:'), error.message);
    console.log(chalk.yellow('\nGenerate it first with the generate-timesheet skill.'));
    process.exit(1);
  }

  const alreadySubmitted = tasks.filter(t => t.submitted).length;
  if (alreadySubmitted > 0) {
    console.log(chalk.gray(`${alreadySubmitted} task(s) already submitted — will skip`));
  }
  console.log(`Loaded ${tasks.length} task(s)`);

  // Reject bad shapes and Project/Category pairings before opening the portal,
  // so the manual-recovery prompts below only ever cover genuine UI failures.
  const projectsCategories = JSON.parse(
    await fs.readFile(new URL('../config/projects-categories.json', import.meta.url), 'utf-8')
  );
  const errors = validateEntries(tasks, projectsCategories);
  if (errors.length > 0) {
    console.error(chalk.red(`${dataPath} is invalid:`));
    for (const error of errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }

  console.log(chalk.gray('Launching browser with automation profile...'));
  const { context, page } = await openPortal();

  await waitForEnter('Log in if needed, then press Enter to start automation...');

  // The config can lag the portal (Projects get retired, Categories move). Check every
  // pairing against the live Portal Catalogue before submitting anything, rather than
  // finding out at a selector timeout halfway through.
  let catalogue;
  while (!(catalogue = await readCatalogue(page))) {
    await waitForEnter('Could not read the Portal Catalogue — is the timesheet page loaded and logged in?');
  }

  // Skipped Entries stay unsubmitted, so the next run retries them.
  const skipped = [];
  const outside = entriesOutsideCatalogue(tasks, catalogue);
  if (outside.length > 0) {
    console.log(chalk.red(`\n${outside.length} Entr${outside.length === 1 ? 'y uses a pairing' : 'ies use pairings'} the portal no longer accepts:`));
    for (const i of outside) {
      const t = tasks[i];
      console.log(`  ✗ [${i + 1}] ${t.date}  ${t.project} / ${t.category}  (${formatTime(t.duration)})`);
    }
    console.log(chalk.gray('  Run `npm run sync-projects` and re-pair them, or skip them for now.'));

    const unsubmitted = tasks.filter(t => !t.submitted).length;
    const answer = await ask(`Skip these ${outside.length} and submit the other ${unsubmitted - outside.length}? [y/N] `);
    if (answer.toLowerCase() !== 'y') {
      console.log(chalk.yellow('Nothing submitted.'));
      await context.close();
      process.exit(1);
    }
    for (const i of outside) skipped.push({ index: i, task: tasks[i], reason: 'pairing not in the portal' });
  }
  const preSkipped = new Set(outside);

  // The mini calendar picks the date range the timeline shows. Plan the ranges up front
  // from the dates still to submit, so navigation doesn't depend on Entry order.
  const windows = planWindows(
    tasks.filter((t, i) => !t.submitted && !preSkipped.has(i)).map(t => t.date)
  );

  console.log(chalk.green('\n✓ Starting automated form filling\n'));

  skipped.push(...await fillEntries(page, tasks, {
    windows,
    preSkipped,
    recover,
    onSaved: all => fs.writeFile(dataPath, JSON.stringify(all, null, 2))
  }));

  if (skipped.length === 0) {
    console.log(chalk.green('\n✓ All tasks processed!'));
  } else {
    console.log(chalk.yellow(`\n${skipped.length} Skipped Entr${skipped.length === 1 ? 'y' : 'ies'} — still unsubmitted, retried on the next run:`));
    for (const { index, task, reason } of skipped.sort((a, b) => a.index - b.index)) {
      console.log(`  ↷ [${index + 1}] ${task.date}  ${task.project} / ${task.category}  ${formatTime(task.duration)}  — ${reason}`);
    }
  }
  console.log(chalk.yellow('\nReview the timesheet in the browser before finalizing.'));

  await waitForEnter('Press Enter to close browser...');

  await context.close();
}

main().catch(error => {
  console.error(chalk.red('\nError:'), error.message);
  console.error(chalk.gray(error.stack));
  process.exit(1);
});
