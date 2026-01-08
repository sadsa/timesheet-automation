#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
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
      const tasks = await parseNoteFile(content);
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
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow(`Warning: No daily note found for ${date}, skipping...`));
      } else {
        // Validation errors or other errors - show message and stop
        console.error(chalk.red(`Error parsing ${date}:`), error.message);
        throw error;
      }
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

  // Duration review
  console.log(chalk.blue('\n--- Duration Review ---'));

  const tasksByDate = {};
  allTasks.forEach(task => {
    if (!tasksByDate[task.date]) {
      tasksByDate[task.date] = [];
    }
    tasksByDate[task.date].push(task);
  });

  let reviewing = true;
  while (reviewing) {
    for (const date of Object.keys(tasksByDate)) {
      displayDurationSummary(tasksByDate[date], date);
    }

    const action = await promptDurationAction();

    if (action === 'quit') {
      console.log(chalk.yellow('Cancelled.'));
      process.exit(0);
    } else if (action === 'edit') {
      const { dateToEdit } = await inquirer.prompt([
        {
          type: 'list',
          name: 'dateToEdit',
          message: 'Which date to edit?',
          choices: Object.keys(tasksByDate)
        }
      ]);
      await editTaskDuration(tasksByDate[dateToEdit]);
    } else {
      reviewing = false;
    }
  }

  // Generate output
  const outputPath = 'output/timesheet-data.json';
  await fs.mkdir('output', { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(allTasks, null, 2));

  console.log(chalk.green(`\n✓ Timesheet data saved to ${outputPath}`));
  console.log(chalk.blue('\nRun: npm run submit'));
}

main().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
