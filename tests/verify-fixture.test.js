import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFY_PREFIX, pickPairing, buildFixture, fixtureDates, monthStartAfter
} from '../src/lib/verify-fixture.js';
import { planWindows, WINDOW_DAYS } from '../src/lib/calendar-windows.js';
import { validateEntries } from '../src/lib/timesheet-validator.js';

const pairing = { project: 'Meetings and Reviews (NZ)', category: 'Admin & Other' };
const catalogue = { [pairing.project]: [pairing.category] };

test('pickPairing prefers the inert pairing', () => {
  assert.deepEqual(pickPairing({ 'A': ['x'], ...catalogue }), pairing);
});

test('pickPairing falls back to any pairing, and to null for an empty catalogue', () => {
  assert.deepEqual(pickPairing({ A: [], B: ['y'] }), { project: 'B', category: 'y' });
  assert.equal(pickPairing({}), null);
});

test('monthStartAfter rolls over the year', () => {
  assert.equal(monthStartAfter('2026-11-19', 1), '2026-12-01');
  assert.equal(monthStartAfter('2026-11-19', 3), '2027-02-01');
});

test('fixture is valid input for the submit flow', () => {
  const entries = buildFixture('2027-02-01', pairing);
  assert.deepEqual(validateEntries(entries, { [pairing.project]: [pairing.category] }), []);
  for (const e of entries) assert.ok(e.description.startsWith(VERIFY_PREFIX));
});

test('fixture crosses a month boundary inside one window, then needs a second window', () => {
  for (const start of ['2027-02-01', '2027-05-01', '2027-07-01', '2028-02-01']) {
    const dates = fixtureDates(buildFixture(start, pairing));
    assert.equal(dates.length, 3, start);
    const [first, second, third] = dates;
    assert.notEqual(first.slice(0, 7), second.slice(0, 7), `${start}: months differ`);

    const windows = planWindows(dates);
    assert.equal(windows.length, 2, `${start}: two windows`);
    assert.ok(windows[0].start <= first && second <= windows[0].end, `${start}: first window holds both months`);
    assert.ok(windows[1].start === third, `${start}: third date opens its own window`);
    assert.ok(WINDOW_DAYS > 0);
  }
});

test('fixture has one ticketless and one ticketed Entry on the same day', () => {
  const entries = buildFixture('2027-02-01', pairing);
  const [a, b] = entries;
  assert.equal(a.date, b.date);
  assert.ok(a.ticket && !('ticket' in b));
});

import { compareEntries } from '../src/lib/verify-fixture.js';

const savedFrom = fixture => fixture.map((e, i) => ({
  id: i + 1, date: e.date, project: e.project, category: e.category,
  hours: e.duration, description: e.description, ticket: e.ticket
}));

test('compareEntries accepts exactly what was submitted', () => {
  const fixture = buildFixture('2027-02-01', pairing);
  assert.deepEqual(compareEntries(fixture, savedFrom(fixture)), []);
});

test('compareEntries reports a missing Entry, a wrong date or hours, and a stray prefixed Entry', () => {
  const fixture = buildFixture('2027-02-01', pairing);
  const saved = savedFrom(fixture);
  saved.pop();
  saved[0].hours = 2;
  saved.push({ id: 99, date: '2027-02-01', project: 'x', category: 'y', hours: 1, description: `${VERIFY_PREFIX} stray` });
  const problems = compareEntries(fixture, saved);
  assert.equal(problems.length, 3);
  assert.match(problems.join('\n'), /missing/);
  assert.match(problems.join('\n'), /hours saved as 2/);
  assert.match(problems.join('\n'), /unexpected.*stray/);
});

test('compareEntries ignores real Entries without the prefix', () => {
  const fixture = buildFixture('2027-02-01', pairing);
  const real = { id: 5, date: fixture[0].date, project: 'p', category: 'c', hours: 8, description: 'real work' };
  assert.deepEqual(compareEntries(fixture, [...savedFrom(fixture), real]), []);
});
