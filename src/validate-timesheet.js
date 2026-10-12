#!/usr/bin/env node
/**
 * Checks output/timesheet-data.json against the output contract and the
 * generate-timesheet day rules. Exits non-zero on any error.
 *
 * Usage: npm run check [-- path/to/timesheet-data.json]
 */
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { validateEntries, validateDays } from './lib/timesheet-validator.js';

const repoRoot = new URL('..', import.meta.url);
const dataPath = process.argv[2] || fileURLToPath(new URL('output/timesheet-data.json', repoRoot));

const entries = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
const projectsCategories = JSON.parse(
  await fs.readFile(new URL('config/projects-categories.json', repoRoot), 'utf-8')
);

const errors = validateEntries(entries, projectsCategories);
if (errors.length === 0) errors.push(...validateDays(entries));

if (errors.length > 0) {
  console.error(chalk.red(`${dataPath}: ${errors.length} error(s)`));
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

const days = new Set(entries.map(e => e.date)).size;
console.log(chalk.green(`✓ ${dataPath}: ${entries.length} Entries over ${days} days, all valid`));
