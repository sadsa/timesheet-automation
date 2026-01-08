#!/usr/bin/env node
/**
 * Timesheet Submission Automation
 *
 * Automates timesheet entry to the Entelect portal using Playwright.
 * Reads structured task data from output/timesheet-data.json and fills
 * the web form automatically.
 *
 * Features:
 * - Project auto-selection (switches when task.project changes)
 * - Category auto-selection (visible or dropdown)
 * - Form filling (ticket, description, time, worked from, billable)
 * - Uses persistent browser context to preserve login state
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

async function main() {
  console.log(chalk.blue('Timesheet Submission Automation\n'));

  // Load timesheet data
  let tasks;
  try {
    const data = await fs.readFile('output/timesheet-data.json', 'utf-8');
    tasks = JSON.parse(data);
  } catch (error) {
    console.error(chalk.red('Error loading timesheet data:'), error.message);
    console.log(chalk.yellow('\nMake sure you have run: npm run parse'));
    process.exit(1);
  }

  console.log(`Loaded ${tasks.length} task(s)`);

  // Validate task structure
  for (const task of tasks) {
    if (!task.project) {
      console.error(chalk.red('Error: Task missing project field:'), task);
      process.exit(1);
    }
    if (!task.category) {
      console.error(chalk.red('Error: Task missing category field:'), task);
      process.exit(1);
    }
  }

  // Launch browser with persistent context (dedicated automation profile)
  const userDataDir = process.env.CHROME_USER_DATA ||
    '/Users/entelect-jbiddick/Library/Application Support/Google/Chrome/playwright-profile';

  console.log(chalk.gray('Launching browser with automation profile...'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome'
  });

  const page = context.pages()[0] || await context.newPage();

  // Navigate to timesheet portal
  await page.goto('https://employee.entelect.co.nz/Timesheet');

  await waitForEnter('Log in if needed, then press Enter to start automation...');

  console.log(chalk.green('\n✓ Starting automated form filling\n'));

  // Track current state to minimize UI interactions
  let currentProject = null;
  let currentCategory = null;

  // Process each task
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(chalk.blue(`\n[${i + 1}/${tasks.length}] Processing task:`));
    console.log(chalk.gray(`  Date: ${task.date}`));
    console.log(chalk.gray(`  Project: ${task.project}`));
    console.log(chalk.gray(`  Category: ${task.category}`));
    console.log(chalk.gray(`  ${task.ticket || task.type} | ${task.description} | ${formatTime(task.duration)}`));

    // Step 1: Select project if it changed
    if (currentProject !== task.project) {
      console.log(chalk.yellow(`  → Selecting project: ${task.project}`));

      try {
        // Use exact match to avoid matching partial project names
        const projectButton = page.locator('.timesheetlistitem').filter({ hasText: new RegExp(`^${task.project}$`) });
        await projectButton.click();
        currentProject = task.project;
        currentCategory = null; // Reset category when project changes
        await page.waitForTimeout(500); // Wait for category list to update
        console.log(chalk.green(`  ✓ Project selected`));
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to select project: ${error.message}`));
        console.log(chalk.yellow(`  Please manually select project "${task.project}" and press Enter`));
        await waitForEnter('Press Enter after selecting project...');
        currentProject = task.project;
        currentCategory = null;
      }
    }

    // Step 2: Select category if it changed
    if (currentCategory !== task.category) {
      console.log(chalk.yellow(`  → Selecting category: ${task.category}`));

      try {
        // Try visible category first (use exact match to avoid matching project names)
        const visibleCategory = page.locator('.row-fluid.timesheet-section .timesheetlistitem').filter({ hasText: new RegExp(`^${task.category}$`) });
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
          const dropdownCategory = page.locator('ul.dropdown-menu[role="menu"] li a').filter({ hasText: new RegExp(`^${task.category}$`) });
          await dropdownCategory.click();
          console.log(chalk.green(`  ✓ Category selected (dropdown)`));
        }

        currentCategory = task.category;
        await page.waitForTimeout(300); // Wait for UI to update
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to select category: ${error.message}`));
        console.log(chalk.yellow(`  Please manually select category "${task.category}" and press Enter`));
        await waitForEnter('Press Enter after selecting category...');
        currentCategory = task.category;
      }
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
      console.log(chalk.yellow(`  Please manually click on ${dayLabel} timeline and press Enter`));
      await waitForEnter('Press Enter after opening timeline...');
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
      console.log(chalk.yellow(`  Please manually fill the form and press Enter`));
      await waitForEnter('Press Enter after filling form...');
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
      console.log(chalk.yellow(`  Please manually click Save and press Enter`));
      await waitForEnter('Press Enter after saving...');
    }
  }

  console.log(chalk.green('\n✓ All tasks processed!'));
  console.log(chalk.yellow('\nReview the timesheet in the browser before finalizing.'));

  await waitForEnter('Press Enter to close browser...');

  await context.close();
}

main().catch(error => {
  console.error(chalk.red('\nError:'), error.message);
  console.error(chalk.gray(error.stack));
  process.exit(1);
});
