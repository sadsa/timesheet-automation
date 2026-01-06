import { test } from 'node:test';
import assert from 'node:assert';
import { parseDateInput } from '../src/lib/date-parser.js';

test('parseDateInput - single date in YYYY-MM-DD format', () => {
  const result = parseDateInput('2026-01-06');
  assert.deepStrictEqual(result, ['2026-01-06']);
});
