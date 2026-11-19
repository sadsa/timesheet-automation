/**
 * The per-Entry portal flow shared by `npm run submit` and `npm run submit -- --verify`:
 * select Project and Category, open the day, fill the form, save.
 *
 * Whoever calls it supplies `recover`, which decides what happens when a step fails.
 * Real submission asks a human; verify mode throws, so no one ever asserts that a
 * manual fix happened.
 */
import chalk from 'chalk';
import { readSelection, isDayVisible, selectWindow } from './portal.js';
import { windowFor } from './calendar-windows.js';

/**
 * Convert YYYY-MM-DD date to timeline label format
 * Example: "2026-01-06" -> "Monday - 6 Jan"
 */
export function getDayLabel(dateString) {
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
export function formatTime(duration) {
  const hours = Math.floor(duration);
  const minutes = Math.round((duration - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes.toString().padStart(2, '0')}`;
}

/** Exact-match pattern for a portal label. "Meetings and Reviews (NZ)" has regex metacharacters. */
export function exactly(text) {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

/**
 * Fill and save each unsubmitted Entry. Mutates `tasks[i]` to `submitted: true` as each
 * one saves and calls `onSaved(tasks)` so the caller can persist progress.
 *
 * `recover(instruction, verify?)` resolves true when the step is fixed, false to skip
 * the Entry, or throws to abort the whole run.
 * Returns the Skipped Entries as `{ index, task, reason }`.
 */
export async function fillEntries(page, tasks, { windows, preSkipped = new Set(), recover, onSaved }) {
  const skipped = [];

  // Track current state to minimize UI interactions
  let currentProject = null;
  let currentCategory = null;

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

    // The timeline only shows the range selected in the mini calendar. Select the
    // planned window containing this date when it isn't on screen.
    if (!await isDayVisible(page, dayLabel)) {
      const window = windowFor(windows, task.date);
      console.log(chalk.yellow(`  → ${dayLabel} isn't on screen — selecting ${window.start} to ${window.end} in the calendar`));
      try {
        await selectWindow(page, window);
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to select dates: ${error.message.split('\n')[0]}`));
        const fixed = await recover(
          `Please manually select ${window.start} to ${window.end} in the calendar`,
          async () => await isDayVisible(page, dayLabel) ? null : `${dayLabel} still isn't on the timeline`
        );
        if (!fixed) { await skip('date range not selectable'); continue; }
      }
    }

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
    await onSaved?.(tasks);
  }

  return skipped;
}
