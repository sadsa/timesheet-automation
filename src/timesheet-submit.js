#!/usr/bin/env node
/**
 * Timesheet Submission Automation
 *
 * TO COMPLETE IMPLEMENTATION:
 * 1. Run this script once: node src/timesheet-submit.js
 * 2. When browser opens, right-click timesheet form elements and "Inspect"
 * 3. Note the selectors for: date input, category dropdown, hours input, description textarea, submit button
 * 4. Update the TODO sections below with actual selectors
 *
 * Example selectors to look for:
 * - input[name="date"] or #dateField
 * - select[name="category"] or #categorySelect
 * - input[name="hours"] or .hours-input
 * - textarea[name="description"] or #descriptionField
 * - button[type="submit"] or .submit-button
 */
import { chromium } from 'playwright';
import fs from 'fs/promises';
import chalk from 'chalk';
import readline from 'readline';

async function waitForEnter(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(chalk.yellow(`${message} [Press Enter]`), () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  console.log(chalk.blue('Timesheet Submission\n'));

  // Load data
  const data = await fs.readFile('output/timesheet-data.json', 'utf-8');
  const tasks = JSON.parse(data);

  console.log(`Loaded ${tasks.length} task(s)`);

  // Launch browser
  const userDataDir = process.env.CHROME_USER_DATA ||
    '/Users/entelect-jbiddick/Library/Application Support/Google/Chrome';

  console.log(chalk.gray('Launching browser with existing session...'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome'
  });

  const page = context.pages()[0] || await context.newPage();

  // Navigate
  await page.goto('https://employee.entelect.co.nz/Timesheet');

  await waitForEnter('Navigate to the timesheet page and press Enter when ready to start...');

  console.log(chalk.green('\n✓ Starting form fill'));

  // Group by date
  const tasksByDate = {};
  tasks.forEach(task => {
    if (!tasksByDate[task.date]) {
      tasksByDate[task.date] = [];
    }
    tasksByDate[task.date].push(task);
  });

  // Fill each entry
  for (const date of Object.keys(tasksByDate)) {
    for (const task of tasksByDate[date]) {
      console.log(chalk.blue(`\n→ Filling: ${date} | ${task.category} | ${task.ticket || task.type} | ${task.duration}h`));
      console.log(chalk.gray(`  ${task.description}`));

      // TODO: Implement actual form filling
      // This requires inspecting the portal's form structure
      // Placeholder selectors - update after inspecting the page:
      // await page.fill('input[name="date"]', date);
      // await page.selectOption('select[name="category"]', task.category);
      // await page.fill('input[name="hours"]', String(task.duration));
      // await page.fill('textarea[name="description"]', task.description);

      await waitForEnter('Entry filled. Verify and press Enter to continue...');
    }
  }

  console.log(chalk.yellow('\n⚠️ All entries filled. Review the timesheet in the browser.'));
  await waitForEnter('Press Enter to submit, or Ctrl+C to cancel...');

  // TODO: Implement submit button click
  // await page.click('button[type="submit"]');

  console.log(chalk.green('\n✓ Timesheet submitted!'));

  await waitForEnter('Press Enter to close browser...');

  await context.close();
}

main().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
