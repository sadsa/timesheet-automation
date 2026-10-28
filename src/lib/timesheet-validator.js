/**
 * Validates output/timesheet-data.json, the contract between the generate-timesheet
 * skill (which writes it) and timesheet-submit.js (which reads it).
 *
 * Every function returns a list of human-readable errors; an empty list means valid.
 */

import { OVERFLOW_LABEL } from './catalogue.js';

const FIELDS = ['date', 'project', 'category', 'duration', 'description', 'ticket', 'type', 'submitted'];
const TYPES = ['ticket', 'meeting', 'other'];
const HOURS_PER_DAY = 8;

/**
 * Shape and Project/Category pairing of each Entry. Submission runs this before
 * touching the portal: an invalid pairing would otherwise fail at the Playwright
 * selector and fall through to a manual-recovery prompt.
 */
export function validateEntries(entries, projectsCategories) {
  if (!Array.isArray(entries)) return ['Expected a JSON array of Entries'];

  const errors = [];
  entries.forEach((entry, i) => {
    const at = `Entry ${i} (${entry?.date ?? 'no date'}, ${entry?.description ?? 'no description'})`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`Entry ${i}: expected an object`);
      return;
    }

    for (const key of Object.keys(entry)) {
      if (!FIELDS.includes(key)) errors.push(`${at}: unknown field "${key}"`);
    }

    if (typeof entry.date !== 'string' || !isIsoDate(entry.date)) {
      errors.push(`${at}: date must be a real YYYY-MM-DD date`);
    } else if (isWeekend(entry.date)) {
      errors.push(`${at}: ${entry.date} is a weekend`);
    }

    const categories = projectsCategories[entry.project];
    if (entry.category === OVERFLOW_LABEL) {
      // Clicking it only opens the overflow dropdown; the Entry would save under
      // whichever Category was already selected.
      errors.push(`${at}: "${OVERFLOW_LABEL}" is the portal's overflow dropdown, not a Category`);
    } else if (entry.submitted === true) {
      // Already in the portal; its pairing may since have been retired.
    } else if (!categories) {
      errors.push(`${at}: project "${entry.project}" is not in config/projects-categories.json`);
    } else if (!categories.includes(entry.category)) {
      errors.push(`${at}: category "${entry.category}" is not listed under project "${entry.project}"`);
    }

    // A string here reaches formatTime() and fills the portal with "NaNhNaN".
    if (typeof entry.duration !== 'number' || !Number.isFinite(entry.duration) || entry.duration <= 0) {
      errors.push(`${at}: duration must be a positive number of hours, got ${JSON.stringify(entry.duration)}`);
    }

    if (typeof entry.description !== 'string' || entry.description.trim() === '') {
      errors.push(`${at}: description must be a non-empty string`);
    }

    if ('ticket' in entry && (typeof entry.ticket !== 'string' || !/^[A-Z]+-\d+$/.test(entry.ticket))) {
      errors.push(`${at}: ticket must look like ABC-123, or be omitted entirely; got ${JSON.stringify(entry.ticket)}`);
    }

    if (!TYPES.includes(entry.type)) {
      errors.push(`${at}: type must be one of ${TYPES.join(', ')}; got ${JSON.stringify(entry.type)}`);
    }

    if ('submitted' in entry && typeof entry.submitted !== 'boolean') {
      errors.push(`${at}: submitted must be a boolean`);
    }
  });
  return errors;
}

/**
 * The generate-timesheet day rules: every worked day carries at least 2 Entries
 * totalling exactly 8h. Generation must meet these; submission does not enforce
 * them, so a user who hand-edits a day can still submit it.
 */
export function validateDays(entries) {
  const days = new Map();
  for (const entry of entries) {
    const day = days.get(entry.date) ?? { count: 0, hours: 0 };
    day.count += 1;
    day.hours += typeof entry.duration === 'number' ? entry.duration : 0;
    days.set(entry.date, day);
  }

  const errors = [];
  for (const [date, { count, hours }] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    if (Math.abs(hours - HOURS_PER_DAY) > 1e-9) errors.push(`${date}: totals ${hours}h, expected ${HOURS_PER_DAY}h`);
    if (count < 2) errors.push(`${date}: has ${count} Entry, expected at least 2`);
  }
  return errors;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isWeekend(value) {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}
