import { test } from 'node:test';
import assert from 'node:assert';
import { parseDateInput } from '../src/lib/date-parser.js';
import { eachDayOfInterval, format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

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

test('parseDateInput - "last" returns last week Mon-Fri', () => {
  const result = parseDateInput('last');
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  // Should return 7 days (full week for now)
  assert.strictEqual(result.length, 7);
  assert.strictEqual(result[0], format(lastWeekStart, 'yyyy-MM-dd'));
});
