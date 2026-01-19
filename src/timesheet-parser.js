#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { parseDateInput } from './lib/date-parser.js';
import { parseNoteFile } from './lib/note-parser.js';
import { filterBillableTasks } from './lib/task-filter.js';
import { displayDurationSummary, promptForAdjustment } from './lib/review-ui.js';
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

  // Process each day sequentially with adjustment
  for (const date of dates) {
    const filePath = path.join(notesDir, `${date}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const tasks = await parseNoteFile(content);
      let billableTasks = filterBillableTasks(tasks);

      if (billableTasks.length === 0) {
        console.log(chalk.yellow(`Warning: No billable tasks found for ${date}`));
        continue;
      }

      // Add date to each task
      billableTasks.forEach(task => {
        task.date = date;
      });

      // Validate tasks have project and category
      const missingData = billableTasks.filter(task => !task.project || !task.category);
      if (missingData.length > 0) {
        console.error(chalk.red(`\nError: Tasks missing Project or Category for ${date}:`));
        missingData.forEach(task => {
          console.error(chalk.yellow(`  ${task.description.substring(0, 50)}...`));
        });
        console.error(chalk.gray('Format: - [ ] TIME - TIME | Project | Category | Ticket | Description'));
        process.exit(1);
      }

      // Display summary
      console.log(chalk.blue(`\n--- Duration Summary ---`));
      displayDurationSummary(billableTasks, date);

      // Interactive adjustment (skips if >= 8h)
      billableTasks = await promptForAdjustment(billableTasks, date);

      allTasks.push(...billableTasks);

      console.log(chalk.green(`\n✓ Processed ${date}`));

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow(`Warning: No daily note found for ${date}, skipping...`));
      } else {
        console.error(chalk.red(`Error parsing ${date}:`), error.message);
        throw error;
      }
    }
  }

  if (allTasks.length === 0) {
    console.log(chalk.red('No billable tasks found in any dates.'));
    process.exit(0);
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
