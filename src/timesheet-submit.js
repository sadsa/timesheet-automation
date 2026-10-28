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
import { openPortal, readCatalogue, readSelection } from './lib/portal.js';
import { ask, waitForEnter } from './lib/prompt.js';

/**
 * Convert YYYY-MM-DD date to timeline label format
 * Example: "2026-01-06" -> "Monday - 6 Jan"
 */
function getDayLabel(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = dayNames[date.getDay()];
  const day = date.getDate();
  const monthName = monthNames[date.getMonth()];
  return `${dayName} - ${day} ${monthName}`;
}

/**
 * Format duration (hours) to Entelect portal format
 * Example: 1.5 -> "1h30", 2 -> "2h"
 */
function formatTime(duration) {
  const hours = Math.floor(duration);
  const minutes = Math.round((duration - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes.toString().padStart(2, '0')}`;
}

/** Exact-match pattern for a portal label. "Meetings and Reviews (NZ)" has regex metacharacters. */
function exactly(text) {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

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

  console.log(chalk.green('\n✓ Starting automated form filling\n'));

  // Track current state to minimize UI interactions
  let currentProject = null;
  let currentCategory = null;

  // Process each task
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    if (task.submitted) {
      const label = task.ticket || task.description.substring(0, 40);
      console.log(chalk.gray(`\n[${i + 1}/${tasks.length}] Skipping ${label} — already submitted`));
      continue;
    }
    if (preSkipped.has(i)) {
      console.log(chalk.gray(`\n[${i + 1}/${tasks.length}] Skipping ${task.project} / ${task.category} — not in the portal`));
      continue;
    }

    console.log(chalk.blue(`\n[${i + 1}/${tasks.length}] Processing task:`));
    console.log(chalk.gray(`  Date: ${task.date}`));
    console.log(chalk.gray(`  Project: ${task.project}`));
    console.log(chalk.gray(`  Category: ${task.category}`));
    console.log(chalk.gray(`  ${task.ticket || task.type} | ${task.description} | ${formatTime(task.duration)}`));

    const skip = async reason => {
      skipped.push({ index: i, task, reason });
      // Selection is unknown after a skip, and an open form would swallow the next
      // Entry's timeline click.
      currentProject = null;
      currentCategory = null;
      await page.locator('button.cancel').click({ timeout: 2000 }).catch(() => {});
      console.log(chalk.gray(`  ↷ Skipped — stays unsubmitted`));
    };

    // Step 1: Select project if it changed
    if (currentProject !== task.project) {
      console.log(chalk.yellow(`  → Selecting project: ${task.project}`));

      try {
        // Use exact match to avoid matching partial project names
        const projectButton = page.locator('.timesheetlistitem').filter({ hasText: exactly(task.project) });
        await projectButton.click();
        await page.waitForTimeout(500); // Wait for category list to update
        console.log(chalk.green(`  ✓ Project selected`));
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to select project: ${error.message}`));
        const fixed = await recover(`Please manually select project "${task.project}"`, async () => {
          const { project } = await readSelection(page);
          return project === task.project ? null : `Portal still shows project "${project}"`;
        });
        if (!fixed) { await skip('project not selectable'); continue; }
      }
      currentProject = task.project;
      currentCategory = null; // Reset category when project changes
    }

    // Step 2: Select category if it changed
    if (currentCategory !== task.category) {
      console.log(chalk.yellow(`  → Selecting category: ${task.category}`));

      try {
        // Try visible category first (use exact match to avoid matching project names)
        const visibleCategory = page.locator('.row-fluid.timesheet-section .timesheetlistitem').filter({ hasText: exactly(task.category) });
        const isVisible = await visibleCategory.count() > 0;

        if (isVisible) {
          await visibleCategory.click();
          console.log(chalk.green(`  ✓ Category selected (visible)`));
        } else {
          // Category is in dropdown
          const dropdownToggle = page.locator('.dropdown-toggle.timesheetlistitem');
          await dropdownToggle.click();
          await page.waitForTimeout(200);

          // Use exact match for dropdown categories
          const dropdownCategory = page.locator('ul.dropdown-menu[role="menu"] li a').filter({ hasText: exactly(task.category) });
          await dropdownCategory.click();
          console.log(chalk.green(`  ✓ Category selected (dropdown)`));
        }

        await page.waitForTimeout(300); // Wait for UI to update
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to select category: ${error.message}`));
        const fixed = await recover(`Please manually select category "${task.category}"`, async () => {
          const { project, category } = await readSelection(page);
          return project === task.project && category === task.category
            ? null
            : `Portal still shows "${project} / ${category}"`;
        });
        if (!fixed) { await skip('category not selectable'); continue; }
      }
      currentCategory = task.category;
    }

    // Step 3: Open timeline form for the specific date
    console.log(chalk.yellow(`  → Opening timeline for ${task.date}`));
    const dayLabel = getDayLabel(task.date);

    try {
      // Find the .timeEntry container for this day and click on its timeline bar
      // The .timeEntry-infoHeader element blocks clicks, so we must click .timeEntry-entry
      const timeEntryContainer = page.locator('.timeEntry', { hasText: dayLabel });
      const timelineBar = timeEntryContainer.locator('.timeEntry-entry');
      await timelineBar.click();
      await page.waitForTimeout(500); // Wait for form to appear
      console.log(chalk.green(`  ✓ Timeline opened`));
    } catch (error) {
      console.error(chalk.red(`  ✗ Failed to open timeline: ${error.message}`));
      if (!await recover(`Please manually click on ${dayLabel} timeline`)) { await skip('timeline not opened'); continue; }
    }

    // Step 4: Fill form fields
    console.log(chalk.yellow(`  → Filling form...`));

    try {
      // Ticket number (if present)
      if (task.ticket) {
        const ticketInput = page.locator('input[data-bind*="ticketNumber"]');
        await ticketInput.fill(task.ticket);
      }

      // Description
      const descriptionTextarea = page.locator('textarea[placeholder="Description"]');
      await descriptionTextarea.fill(task.description);

      // Time (formatted as "Xh" or "XhYY")
      const timeInput = page.locator('input[data-bind="value: time"]');
      await timeInput.fill(formatTime(task.duration));

      // Worked From: Home (value="2")
      const workedFromHome = page.locator('input.timeEntry-radio-button-label[value="2"]');
      await workedFromHome.click();

      console.log(chalk.green(`  ✓ Form filled`));
    } catch (error) {
      console.error(chalk.red(`  ✗ Failed to fill form: ${error.message}`));
      if (!await recover('Please manually fill the form')) { await skip('form not filled'); continue; }
    }

    // Step 5: Save entry
    console.log(chalk.yellow(`  → Saving entry...`));

    try {
      const saveButton = page.locator('button.save');
      await saveButton.click();
      await page.waitForTimeout(500); // Wait for save to complete
      console.log(chalk.green(`  ✓ Entry saved`));
    } catch (error) {
      console.error(chalk.red(`  ✗ Failed to save entry: ${error.message}`));
      if (!await recover('Please manually click Save')) { await skip('not saved'); continue; }
    }

    tasks[i] = { ...task, submitted: true };
    await fs.writeFile(dataPath, JSON.stringify(tasks, null, 2));
  }

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
