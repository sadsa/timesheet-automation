import { test } from 'node:test';
import assert from 'node:assert';
import { validateEntries, validateDays } from '../src/lib/timesheet-validator.js';

const config = {
  'FP - Canva - Agile': ['Teams App Software Dev', 'Meetings']
};

const entry = (overrides = {}) => ({
  date: '2026-09-01',
  project: 'FP - Canva - Agile',
  category: 'Teams App Software Dev',
  duration: 4,
  ticket: 'ENTELECT-2636',
  description: 'Fix thumbnail aspect ratios',
  type: 'ticket',
  ...overrides
});

const errorsFor = overrides => validateEntries([entry(overrides)], config);

test('a well-formed Entry passes', () => {
  assert.deepStrictEqual(errorsFor({}), []);
  assert.deepStrictEqual(errorsFor({ submitted: true }), []);
});

test('ticket may be omitted entirely', () => {
  const { ticket, ...noTicket } = entry();
  assert.deepStrictEqual(validateEntries([noTicket], config), []);
});

test('ticket written as null or N/A is rejected', () => {
  assert.strictEqual(errorsFor({ ticket: null }).length, 1);
  assert.strictEqual(errorsFor({ ticket: 'N/A' }).length, 1);
});

test('duration as a string is rejected', () => {
  assert.match(errorsFor({ duration: '1.5' })[0], /duration/);
  assert.match(errorsFor({ duration: '9:00 AM - 10:30 AM' })[0], /duration/);
  assert.match(errorsFor({ duration: 0 })[0], /duration/);
});

test('an unknown project is rejected', () => {
  assert.match(errorsFor({ project: 'Nope' })[0], /project "Nope"/);
});

test('a category from another project is rejected', () => {
  assert.match(errorsFor({ category: 'Google Drive' })[0], /category "Google Drive"/);
});

test('weekend and impossible dates are rejected', () => {
  assert.match(errorsFor({ date: '2026-09-05' })[0], /weekend/);
  assert.match(errorsFor({ date: '2026-02-30' })[0], /real YYYY-MM-DD/);
  assert.match(errorsFor({ date: '2026-13-01' })[0], /real YYYY-MM-DD/);
});

test('unknown fields and types are rejected', () => {
  assert.match(errorsFor({ start: '08:00' })[0], /unknown field "start"/);
  assert.match(errorsFor({ type: 'review' })[0], /type/);
  assert.match(errorsFor({ description: ' ' })[0], /description/);
});

test('a non-array file is rejected', () => {
  assert.deepStrictEqual(validateEntries({}, config), ['Expected a JSON array of Entries']);
});

test('a day of 2+ Entries totalling 8h passes', () => {
  assert.deepStrictEqual(validateDays([entry({ duration: 3 }), entry({ duration: 0.5 }), entry({ duration: 4.5 })]), []);
});

test('a day not totalling 8h is rejected', () => {
  assert.deepStrictEqual(validateDays([entry({ duration: 4 }), entry({ duration: 3.5 })]), [
    '2026-09-01: totals 7.5h, expected 8h'
  ]);
});

test('a day with one Entry is rejected', () => {
  assert.deepStrictEqual(validateDays([entry({ duration: 8 })]), [
    '2026-09-01: has 1 Entry, expected at least 2'
  ]);
});

test('"Other" is rejected as a Category even when the config lists it', () => {
  const errors = validateEntries([entry({ category: 'Other' })], { 'FP - Canva - Agile': ['Other'] });
  assert.match(errors[0], /overflow dropdown/);
});

test('a submitted Entry may carry a pairing the portal has since retired', () => {
  assert.deepStrictEqual(errorsFor({ project: 'R - Canva - Agile Team', submitted: true }), []);
  assert.strictEqual(errorsFor({ project: 'R - Canva - Agile Team' }).length, 1);
});
