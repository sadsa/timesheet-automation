import { test } from 'node:test';
import assert from 'node:assert';
import { parseDateInput } from '../src/lib/date-parser.js';
import { eachDayOfInterval, format } from 'date-fns';

test('parseDateInput - single date in YYYY-MM-DD format', () => {
  const result = parseDateInput('2026-01-06');
  assert.deepStrictEqual(result, ['2026-01-06']);
});

test('parseDateInput - date range returns all dates', () => {
  const result = parseDateInput('2026-01-06:2026-01-08');
  assert.deepStrictEqual(result, [
    '2026-01-06',
    '2026-01-07',
    '2026-01-08'
  ]);
});
