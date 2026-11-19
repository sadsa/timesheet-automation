/**
 * `npm run submit -- --verify`: exercise the real submit flow against the live portal
 * with fake Entries, read back what was saved, then delete them through the UI.
 *
 * Unlike `npm run submit` this never prompts. A step that would need a human aborts the
 * run as a failure, so no one (agent or person) asserts that a manual fix happened.
 * It never reads or writes output/timesheet-data.json. See docs/adr/0005.
 *
 * Output ends with exactly one of:
 *   VERIFY PASSED | VERIFY FAILED: <reason>
 * and one of:
 *   CLEANUP OK | CLEANUP INCOMPLETE: <leftover Entries>
 * Exit code is 0 only when both are the good ones.
 */
import chalk from 'chalk';
import { openPortal, readCatalogue, readEntries, selectWindow, deleteEntry } from './lib/portal.js';
import { planWindows } from './lib/calendar-windows.js';
import { fillEntries } from './lib/submit-flow.js';
import {
  VERIFY_PREFIX, pickPairing, buildFixture, fixtureDates, monthStartAfter, compareEntries
} from './lib/verify-fixture.js';

const LOGIN_WAIT_MS = 30_000;   // the saved sign-in completes on its own within this
const MONTHS_TO_TRY = [3, 4, 5, 6, 7, 8]; // months ahead, until one has empty fixture days

class VerifyAbort extends Error {}

/** Verify mode has no human to ask: any recovery prompt is a failure. */
const recover = async instruction => {
  throw new VerifyAbort(`a step failed and would need a manual fix: ${instruction}`);
};

const today = () => new Date().toISOString().slice(0, 10);

/** Entries on the fixture dates, after selecting each window so its days are on screen. */
async function entriesOnFixtureDates(page, dates) {
  const found = [];
  for (const window of planWindows(dates)) {
    await selectWindow(page, window);
    await page.waitForTimeout(1000); // the view model fills just after the timeline renders
    found.push(...(await readEntries(page)).filter(e => dates.includes(e.date)));
  }
  return found;
}

/** First candidate fixture whose dates hold no Entries at all, so real hours are never touched. */
async function findFreeFixture(page, pairing) {
  for (const months of MONTHS_TO_TRY) {
    const fixture = buildFixture(monthStartAfter(today(), months), pairing);
    const taken = await entriesOnFixtureDates(page, fixtureDates(fixture));
    if (taken.length === 0) return fixture;
    console.log(chalk.gray(`  ${months} months ahead already has Entries on ${[...new Set(taken.map(e => e.date))].join(', ')} — trying later`));
  }
  throw new VerifyAbort(`no free fixture dates in the next ${MONTHS_TO_TRY.at(-1)} months`);
}

/**
 * Delete every prefixed Entry on the fixture dates, then reload and re-read to confirm
 * none survived. Returns the leftovers (empty means clean). Never throws.
 */
async function cleanUp(page, dates) {
  try {
    await page.locator('button.cancel').click({ timeout: 1500 }).catch(() => {}); // an open form
    for (const window of planWindows(dates)) {
      await selectWindow(page, window);
      await page.waitForTimeout(1000);
      // Delete from the last slot backwards so earlier bars keep their positions.
      const mine = (await readEntries(page))
        .filter(e => dates.includes(e.date) && e.description?.startsWith(VERIFY_PREFIX))
        .sort((a, b) => b.day - a.day || b.slot - a.slot);
      for (const entry of mine) {
        try {
          await deleteEntry(page, entry);
          console.log(chalk.gray(`  ✓ deleted ${entry.date} "${entry.description}"`));
        } catch (error) {
          console.error(chalk.red(`  ✗ ${error.message.split('\n')[0]}`));
        }
      }
    }
    // Trust the server, not the page that just did the deleting.
    await page.reload();
    await page.waitForTimeout(2000);
    return (await entriesOnFixtureDates(page, dates)).filter(e => e.description?.startsWith(VERIFY_PREFIX));
  } catch (error) {
    console.error(chalk.red(`  ✗ cleanup error: ${error.message.split('\n')[0]}`));
    return null; // unknown
  }
}

export async function runVerify() {
  console.log(chalk.blue('Portal UI verification (fake Entries, deleted afterwards)\n'));
  const { context, page } = await openPortal();
  let dates = [];
  let failure = null;
  let touchedPortal = false;

  try {
    // The saved sign-in completes by itself; if it doesn't, there is no one to ask.
    let catalogue = null;
    for (const start = Date.now(); !catalogue && Date.now() - start < LOGIN_WAIT_MS;) {
      await page.waitForTimeout(2000);
      catalogue = await readCatalogue(page).catch(() => null);
    }
    if (!catalogue) throw new VerifyAbort('not logged in — log in once via the automation profile, then rerun');

    const pairing = pickPairing(catalogue);
    if (!pairing) throw new VerifyAbort('the portal catalogue is empty');
    console.log(chalk.gray(`Using ${pairing.project} / ${pairing.category}`));

    const fixture = await findFreeFixture(page, pairing);
    dates = fixtureDates(fixture);
    console.log(chalk.gray(`Fixture: ${fixture.length} Entries on ${dates.join(', ')}`));

    touchedPortal = true;
    const skipped = await fillEntries(page, fixture, { windows: planWindows(dates), recover });
    if (skipped.length > 0) throw new VerifyAbort(`${skipped.length} Entries were skipped`);

    console.log(chalk.blue('\nReading back what the portal saved...'));
    await page.waitForTimeout(1500);
    const problems = compareEntries(fixture, await entriesOnFixtureDates(page, dates));
    if (problems.length > 0) throw new VerifyAbort(`read-back differs from the fixture:\n  ${problems.join('\n  ')}`);
    console.log(chalk.green('✓ every Entry saved with the right date, Project, Category, hours and ticket'));
  } catch (error) {
    failure = error.message;
  }

  let leftovers = [];
  if (touchedPortal) {
    console.log(chalk.blue('\nCleaning up...'));
    leftovers = await cleanUp(page, dates);
  }
  await context.close().catch(() => {});

  console.log('');
  console.log(failure ? chalk.red(`VERIFY FAILED: ${failure}`) : chalk.green('VERIFY PASSED'));
  if (leftovers === null) {
    console.log(chalk.red(`CLEANUP INCOMPLETE: could not check for leftovers; look for "${VERIFY_PREFIX}" Entries on ${dates.join(', ')}`));
  } else if (leftovers.length > 0) {
    console.log(chalk.red(`CLEANUP INCOMPLETE: delete these by hand — ${leftovers.map(e => `${e.date} EntryId ${e.id}`).join('; ')}`));
  } else {
    console.log(chalk.green('CLEANUP OK'));
  }
  process.exitCode = failure || leftovers === null || leftovers.length > 0 ? 1 : 0;
}
