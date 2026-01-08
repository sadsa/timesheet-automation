#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { parseDateInput } from './lib/date-parser.js';
import { parseNoteFile } from './lib/note-parser.js';
import { filterBillableTasks } from './lib/task-filter.js';
import { displayDurationSummary } from './lib/review-ui.js';
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

  // Validate all tasks have project and category
  console.log(chalk.blue('\n--- Validating Task Data ---'));

  const missingData = allTasks.filter(task => !task.project || !task.category);

  if (missingData.length > 0) {
    console.error(chalk.red('\nError: Some tasks are missing Project or Category:'));
    missingData.forEach(task => {
      console.error(chalk.yellow(`  ${task.date}: ${task.description.substring(0, 50)}...`));
    });
    console.error(chalk.red('\nPlease update your notes to include Project and Category in pipe-delimited format.'));
    console.error(chalk.gray('Format: - [ ] TIME - TIME | Project | Category | Ticket | Description'));
    process.exit(1);
  }

  console.log(chalk.green(`✓ All ${allTasks.length} tasks have Project and Category`));

  // Duration review (read-only)
  console.log(chalk.blue('\n--- Duration Summary ---'));

  const tasksByDate = {};
  allTasks.forEach(task => {
    if (!tasksByDate[task.date]) {
      tasksByDate[task.date] = [];
    }
    tasksByDate[task.date].push(task);
  });

  for (const date of Object.keys(tasksByDate)) {
    displayDurationSummary(tasksByDate[date], date);
  }

  console.log(chalk.gray('\nNote: To adjust durations, edit your daily notes and re-run the parser.'));

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
