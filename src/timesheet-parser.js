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
  console.log(`Date input: ${dateInput}`);
}

main().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
