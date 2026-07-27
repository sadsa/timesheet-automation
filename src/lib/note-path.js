import fs from 'node:fs/promises';
import path from 'node:path';

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Candidate locations for a daily note, in lookup order.
 *
 * `Daily Plans/{year}/{spanish_month}/` is canonical — it is what the
 * generate-timesheet skill writes. The flat vault root is LEGACY: notes
 * written before that layout existed still live there. Nested wins if a date
 * somehow has both. Once the flat notes are migrated, that branch can go.
 * See docs/adr/0001-daily-note-location.md
 */
export function noteCandidates(notesDir, date) {
  const [year, month] = date.split('-');
  const spanishMonth = SPANISH_MONTHS[Number(month) - 1];

  return [
    path.join(notesDir, 'Daily Plans', year, spanishMonth, `${date}.md`),
    path.join(notesDir, `${date}.md`)
  ];
}

/**
 * Resolve a date to an existing note file, or null if none exists.
 */
export async function resolveNotePath(notesDir, date) {
  for (const candidate of noteCandidates(notesDir, date)) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}
