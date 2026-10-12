/**
 * Pure helpers for turning GitHub PR activity into Work Items. The gh calls live in
 * src/fetch-activity.js; everything here is deterministic so it can be tested.
 */

// Same shape as a ticket key, but these are standards and encodings, not tickets.
const TICKET = /\b(?!(?:UTF|SHA|ISO|RFC|AES|RSA|HTTP|TLS|CVE)-)[A-Z]+-\d+\b/;
// Conventional-commit scopes often carry the ticket in lowercase: "fix(entelect-2666): ...".
const SCOPE_TICKET = /^\w+\(([a-z]+-\d+)\)!?:/i;
const CONVENTIONAL_PREFIX = /^(feat|fix|chore|build|ci|refactor|test|docs|style|perf|revert)(\([^)]*\))?!?:\s*/i;
const LEADING_TICKET = /^[A-Z]+-\d+\s*[|:-]\s*/;
const TRAILING_TICKET = /\s*\(([A-Z]+-\d+)\)\s*$/;

/**
 * Local date and time of a UTC timestamp, e.g. "2026-08-31T23:34:32Z" in
 * Pacific/Auckland → { date: "2026-09-01", time: "11:34" }. Deriving the date
 * from the UTC string instead moves late-evening activity onto the wrong day.
 */
export function toLocal(timestamp, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(timestamp)).map(p => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** First ticket key found across the sources, in order; undefined when none has one. */
export function extractTicket(...sources) {
  for (const source of sources) {
    const match = source?.match(TICKET);
    if (match) return match[0];
    const scope = source?.match(SCOPE_TICKET);
    if (scope) return scope[1].toUpperCase();
  }
  return undefined;
}

/** PR title → Entry description: drop ticket keys and conventional-commit prefixes. */
export function cleanTitle(title) {
  let text = title.trim();
  let previous;
  do {
    previous = text;
    text = text.replace(LEADING_TICKET, '').replace(CONVENTIONAL_PREFIX, '').replace(TRAILING_TICKET, '');
  } while (text !== previous);
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text;
}

/** YYYY-MM-DD shifted by a whole number of days. */
export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
