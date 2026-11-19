/**
 * Playwright access to the Entelect timesheet portal, shared by submission and
 * `npm run sync-projects`. The page is a Knockout.js app; its root view model holds
 * the Portal Catalogue and the current selection, which is more reliable to read
 * than the rendered buttons (half the Categories sit in a closed dropdown).
 */
import { chromium } from 'playwright';
import { toCatalogue } from './catalogue.js';
import { clickableWindow, dayEpoch, monthDelta, parseMonthTitle, windowDays } from './calendar-windows.js';

export const PORTAL_URL = 'https://employee.entelect.co.nz/Timesheet';

/**
 * Dedicated automation profile, separate from the user's real Chrome profile so
 * this can run alongside a browser they already have open. Relative by default:
 * the previous absolute macOS path broke outright once the repo moved to Linux.
 */
export async function openPortal() {
  const userDataDir = process.env.CHROME_USER_DATA || './playwright-profile';
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome'
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(PORTAL_URL);
  return { context, page };
}

/** The Portal Catalogue, or null when the timesheet page isn't loaded (e.g. logged out). */
export async function readCatalogue(page) {
  const projects = await page.evaluate(() => {
    const el = document.querySelector('.timesheetlistitem');
    if (!window.ko || !el) return null;
    const root = ko.contextFor(el).$root;
    return [...ko.toJS(root.visibleProjects), ...ko.toJS(root.hiddenProjects)];
  });
  return projects && toCatalogue(projects);
}

/** The Project and Category the portal currently has selected. */
export async function readSelection(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.timesheetlistitem');
    if (!window.ko || !el) return { project: null, category: null };
    const root = ko.contextFor(el).$root;
    return {
      project: ko.unwrap(root.selectedProject())?.Name ?? null,
      category: ko.unwrap(root.selectedCategory())?.Name ?? null
    };
  });
}

/**
 * The mini calendar (bootstrap-datepicker) selects the date range the timeline shows.
 * Days are addressed by `data-date` (UTC midnight epoch ms); `.old` / `.new` cells are
 * the neighbouring months' days and are never clicked.
 */
const DAYS_VIEW = '#datepicker .datepicker-days';

async function clickDay(page, date) {
  for (let i = 0; i < 36; i++) {
    const shown = parseMonthTitle(await page.locator(`${DAYS_VIEW} th.datepicker-switch`).textContent());
    const delta = monthDelta(shown, date);
    if (delta === 0) break;
    const arrow = page.locator(`${DAYS_VIEW} th.${delta > 0 ? 'next' : 'prev'}`);
    if (await arrow.evaluate(el => el.classList.contains('disabled'))) {
      throw new Error(`the calendar can't navigate ${delta > 0 ? 'forward' : 'back'} to ${date}`);
    }
    await arrow.click();
  }
  const cell = page.locator(`${DAYS_VIEW} td.day:not(.old):not(.new)[data-date="${dayEpoch(date)}"]`);
  if (await cell.evaluate(el => el.classList.contains('disabled'))) {
    throw new Error(`${date} is disabled in the calendar`);
  }
  await cell.click({ timeout: 5000 });
}

/** Whether the timeline currently has a block for this day label (e.g. "Monday - 16 Nov"). */
export async function isDayVisible(page, label) {
  return (await page.locator('.timeEntry', { hasText: label }).count()) > 0;
}

/**
 * Select the start and end days of a window, then wait until the timeline renders
 * exactly that many days. Waiting on one label would pass early on a stale window.
 * Throws when it can't navigate, a day is disabled, or the timeline doesn't settle.
 */
export async function selectWindow(page, window) {
  const range = clickableWindow(window);
  await clickDay(page, range.start);
  await clickDay(page, range.end);
  await page.waitForFunction(
    n => document.querySelectorAll('.timeEntry').length === n,
    windowDays(range),
    { timeout: 10000 }
  );
}

/**
 * Every saved Entry the timeline currently holds, from the view model rather than the
 * DOM. `day` is the day's index among the rendered `.timeEntry` blocks and `slot` the
 * Entry's index within it (the bars appear in the same order), which deleteEntry needs.
 */
export async function readEntries(page) {
  return page.evaluate(() => {
    const root = ko.contextFor(document.querySelector('.timesheetlistitem')).$root;
    return ko.toJS(root.timesheetDays).flatMap((day, dayIndex) =>
      day.TimesheetEntries.map((e, slot) => ({
        id: e.EntryId,
        date: e.Date.slice(0, 10),
        project: e.ProjectName,
        category: e.CategoryName,
        hours: e.DurationInHours,
        description: e.Description,
        ticket: e.TicketReference || undefined,
        day: dayIndex,
        slot
      })));
  });
}

/**
 * Delete one saved Entry through the UI: hover its bar, click the trash icon, accept
 * the native "Delete Entry?" confirm, and wait for the portal's delete request to
 * succeed. The view model does not refresh afterwards (verified live), so the caller
 * must reload to see the result. The Entry's day must be on screen.
 */
export async function deleteEntry(page, entry, timeout = 10000) {
  const bar = page.locator('.timeEntry').nth(entry.day).locator('.timeEntry-capturedTime').nth(entry.slot);
  await bar.hover({ timeout: 5000 });
  page.once('dialog', dialog => dialog.accept());
  const response = page.waitForResponse(r => r.url().includes('/DeleteTimesheetEntry'), { timeout });
  await bar.locator('.timeEntry-capturedTimeAction .icon-trash').click({ timeout: 5000 });
  const { status } = await response.then(r => ({ status: r.status() }));
  if (status >= 400) throw new Error(`deleting Entry ${entry.id} on ${entry.date} returned HTTP ${status}`);
}
