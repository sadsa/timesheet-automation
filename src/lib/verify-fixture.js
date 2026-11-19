/**
 * Fake Entries for `npm run submit -- --verify`. Pure and deterministic given a start
 * month, so the date logic can be unit-tested; src/verify.js does the portal work.
 *
 * The dates are chosen to exercise the mini-calendar code in lib/portal.js:
 *   - two dates in different months, close enough to share one window (month navigation)
 *   - a third date more than WINDOW_DAYS later (a second window)
 *   - two Entries on one day (the day's block is reused), one with a ticket and one without
 */
import { addDays } from './activity.js';
import { WINDOW_DAYS } from './calendar-windows.js';

/** Every fake Entry's description starts with this; cleanup deletes only what carries it. */
export const VERIFY_PREFIX = '[UI-VERIFY]';

/** Preferred pairing: the most inert one in the catalogue. */
const PREFERRED = { project: 'Meetings and Reviews (NZ)', category: 'Admin & Other' };

/** The most inert pairing the live catalogue offers; null when it is empty. */
export function pickPairing(catalogue) {
  if (catalogue[PREFERRED.project]?.includes(PREFERRED.category)) return { ...PREFERRED };
  const project = Object.keys(catalogue).find(p => catalogue[p].length > 0);
  return project ? { project, category: catalogue[project][0] } : null;
}

function isWeekend(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function firstWeekdayOnOrAfter(date) {
  while (isWeekend(date)) date = addDays(date, 1);
  return date;
}

export function lastWeekdayOnOrBefore(date) {
  while (isWeekend(date)) date = addDays(date, -1);
  return date;
}

/** First day of the month `months` after the month of `date` (YYYY-MM-DD). */
export function monthStartAfter(date, months) {
  const [year, month] = date.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + months, 1));
  return d.toISOString().slice(0, 10);
}

/** The distinct dates a fixture touches, sorted. */
export function fixtureDates(entries) {
  return [...new Set(entries.map(e => e.date))].sort();
}

/**
 * Four Entries. `monthStart` (YYYY-MM-DD, first of a month) is the month whose last
 * weekday is the first date; the second date is the next month's first weekday.
 */
export function buildFixture(monthStart, { project, category }) {
  const first = lastWeekdayOnOrBefore(addDays(monthStartAfter(monthStart, 1), -1));
  const second = firstWeekdayOnOrAfter(monthStartAfter(monthStart, 1));
  // Past the first window (which starts at `first`), so a second window is needed.
  const third = firstWeekdayOnOrAfter(addDays(first, WINDOW_DAYS + 6));

  const entry = (date, duration, description, ticket) => ({
    date, project, category, duration,
    description: `${VERIFY_PREFIX} ${description}`,
    ...(ticket && { ticket }),
    type: ticket ? 'ticket' : 'other'
  });

  return [
    entry(first, 1.5, 'month-end with ticket', 'VERIFY-1'),
    entry(first, 0.5, 'same day, no ticket'),
    entry(second, 1, 'crosses the month boundary'),
    entry(third, 2.25, 'needs a second window', 'VERIFY-2')
  ];
}

/**
 * Differences between the fixture and what the portal saved (`readEntries` shape), as
 * human-readable problems; empty means every fixture Entry was saved exactly once and
 * nothing else carrying the prefix appeared. Entries without the prefix are ignored.
 */
export function compareEntries(fixture, saved) {
  const ours = saved.filter(e => e.description?.startsWith(VERIFY_PREFIX));
  const unmatched = [...ours];
  const problems = [];
  for (const want of fixture) {
    const at = unmatched.findIndex(e =>
      e.date === want.date && e.description === want.description);
    if (at === -1) { problems.push(`missing: ${want.date} "${want.description}"`); continue; }
    const [got] = unmatched.splice(at, 1);
    const check = (field, a, b) => { if (a !== b) problems.push(`${want.date} "${want.description}": ${field} saved as ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); };
    check('project', got.project, want.project);
    check('category', got.category, want.category);
    check('hours', got.hours, want.duration);
    check('ticket', got.ticket, want.ticket);
  }
  for (const extra of unmatched) problems.push(`unexpected: ${extra.date} "${extra.description}" (EntryId ${extra.id})`);
  return problems;
}
