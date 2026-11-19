/**
 * Pure date logic for driving the portal's mini calendar (a bootstrap-datepicker
 * range). The timeline shows exactly the selected range, so to open an Entry's day
 * we select a window of dates that contains it. Windows are planned up front so the
 * result doesn't depend on the order of Entries in the JSON.
 */
import { addDays } from './activity.js';

/** Longest range verified to render fully on the portal's timeline. */
export const WINDOW_DAYS = 14;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** Chunk distinct dates (YYYY-MM-DD) into windows of at most `size` days, each starting at its first date. */
export function planWindows(dates, size = WINDOW_DAYS) {
  const windows = [];
  let limit = null; // last date the open window may cover
  for (const date of [...new Set(dates)].sort()) {
    if (limit && date <= limit) {
      // End on the last real date: nothing past it needs to be selected.
      windows.at(-1).end = date;
    } else {
      windows.push({ start: date, end: date });
      limit = addDays(date, size - 1);
    }
  }
  return windows;
}

export function windowFor(windows, date) {
  return windows.find(w => date >= w.start && date <= w.end);
}

/** Days in a window, inclusive. The timeline renders one block per day, weekends included. */
export function windowDays({ start, end }) {
  return Math.round((dayEpoch(end) - dayEpoch(start)) / 864e5) + 1;
}

/** The calendar's `data-date` attribute: UTC midnight in epoch milliseconds. */
export function dayEpoch(date) {
  return Date.parse(`${date}T00:00:00Z`);
}

/** "November 2026" → { year: 2026, month: 10 } (month is 0-based). */
export function parseMonthTitle(title) {
  const [name, year] = title.trim().split(/\s+/);
  const month = MONTHS.indexOf(name);
  if (month === -1 || !/^\d{4}$/.test(year ?? '')) throw new Error(`Unrecognised calendar title "${title}"`);
  return { year: Number(year), month };
}

/** Signed `next` (+) / `prev` (-) clicks from the shown month to the month of `date`. */
export function monthDelta(shown, date) {
  const [year, month] = date.split('-').map(Number);
  return (year - shown.year) * 12 + (month - 1 - shown.month);
}
