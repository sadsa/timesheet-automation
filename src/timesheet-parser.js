#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { parseDateInput } from './lib/date-parser.js';
import { parseNoteFile } from './lib/note-parser.js';
import { filterBillableTasks } from './lib/task-filter.js';
import { loadCategories, promptForCategory, displayDurationSummary, promptDurationAction, editTaskDuration } from './lib/review-ui.js';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

program
  .name('timesheet-parser')
  .description('Parse Obsidian daily notes for timesheet entry')
  .option('-d, --date <date>', 'Single date (YYYY-MM-DD)')
  .option('-r, --range <range>', 'Date range (YYYY-MM-DD:YYYY-MM-DD)')
  .option('-w, --week <week>', 'Week shorthand (e.g., "last")')
  .parse();

const options = program.opts();

async function main() {
  const dateInput = options.date || options.range || options.week;

  if (!dateInput) {
    console.error(chalk.red('Error: Must provide --date, --range, or --week'));
    process.exit(1);
  }

  console.log(chalk.blue('Timesheet Parser\n'));

  const dates = parseDateInput(dateInput);
  console.log(`Processing ${dates.length} date(s)...`);

  const notesDir = process.env.NOTES_DIR || '/Users/entelect-jbiddick/Documents/Personal';
  const allTasks = [];

  for (const date of dates) {
    const filePath = path.join(notesDir, `${date}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const tasks = parseNoteFile(content);
      const billableTasks = filterBillableTasks(tasks);

      if (billableTasks.length === 0) {
        console.log(chalk.yellow(`Warning: No billable tasks found for ${date}`));
        continue;
      }

      billableTasks.forEach(task => {
        task.date = date;
        allTasks.push(task);
      });

      console.log(chalk.green(`✓ Found ${billableTasks.length} billable task(s) for ${date}`));
    } catch (error) {
      console.log(chalk.yellow(`Warning: No daily note found for ${date}, skipping...`));
    }
  }

  if (allTasks.length === 0) {
    console.log(chalk.red('No billable tasks found in any dates.'));
    process.exit(0);
  }

  console.log(chalk.blue(`\nTotal: ${allTasks.length} billable tasks`));

  // Category selection
  console.log(chalk.blue('\n--- Category Selection ---'));
  const categories = await loadCategories();

  for (const task of allTasks) {
    task.category = await promptForCategory(task, categories);
  }

  console.log(chalk.green('\n✓ All tasks categorized'));
}

main().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
