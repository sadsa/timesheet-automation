#!/usr/bin/env node
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

  console.log(chalk.green('\n✓ Ready to fill timesheet'));

  await context.close();
}

main().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
