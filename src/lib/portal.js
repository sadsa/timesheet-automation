/**
 * Playwright access to the Entelect timesheet portal, shared by submission and
 * `npm run sync-projects`. The page is a Knockout.js app; its root view model holds
 * the Portal Catalogue and the current selection, which is more reliable to read
 * than the rendered buttons (half the Categories sit in a closed dropdown).
 */
import { chromium } from 'playwright';
import { toCatalogue } from './catalogue.js';

export const PORTAL_URL = 'https://employee.entelect.co.za/Timesheet';

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
