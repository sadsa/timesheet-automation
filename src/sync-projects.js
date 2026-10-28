#!/usr/bin/env node
/**
 * Refreshes config/projects-categories.json from the live Portal Catalogue.
 *
 * Overwrites it completely — the file is a copy of the portal, and keeping retired
 * pairings is exactly how submission ended up timing out on them. Records when it
 * ran in config/catalogue-sync.json so the generate-timesheet skill can nudge when
 * the copy is old. Never edits repo-categories.json; warns about repos it strands.
 *
 * Usage: npm run sync-projects   (opens the portal; log in if asked)
 */
import fs from 'fs/promises';
import chalk from 'chalk';
import { diffCatalogues, staleRepoMappings } from './lib/catalogue.js';
import { openPortal, readCatalogue } from './lib/portal.js';
import { waitForEnter } from './lib/prompt.js';

const configUrl = name => new URL(`../config/${name}`, import.meta.url);
const readConfig = async name => JSON.parse(await fs.readFile(configUrl(name), 'utf-8'));
const writeConfig = (name, value) => fs.writeFile(configUrl(name), JSON.stringify(value, null, 2) + '\n');

const { context, page } = await openPortal();
await waitForEnter('Log in if needed, then press Enter to read the Portal Catalogue...');

let catalogue;
while (!(catalogue = await readCatalogue(page))) {
  await waitForEnter('Could not read the Portal Catalogue — is the timesheet page loaded and logged in?');
}
await context.close();

const { added, removed } = diffCatalogues(await readConfig('projects-categories.json'), catalogue);
await writeConfig('projects-categories.json', catalogue);
await writeConfig('catalogue-sync.json', { syncedAt: new Date().toISOString() });

if (added.length === 0 && removed.length === 0) {
  console.log(chalk.green('✓ config/projects-categories.json already matches the portal'));
} else {
  console.log(chalk.green(`✓ config/projects-categories.json updated`));
  for (const pairing of added) console.log(chalk.green(`  + ${pairing}`));
  for (const pairing of removed) console.log(chalk.red(`  - ${pairing}`));
}

const stale = staleRepoMappings(await readConfig('repo-categories.json'), catalogue);
if (stale.length > 0) {
  console.log(chalk.yellow('\nconfig/repo-categories.json maps repos to pairings the portal no longer has:'));
  for (const line of stale) console.log(chalk.yellow(`  ✗ ${line}`));
}
