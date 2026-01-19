import { test } from 'node:test';
import assert from 'node:assert';
import { calculateGap } from '../src/lib/duration-adjuster.js';

test('calculateGap - returns hours needed to reach 8h', () => {
  const tasks = [
    { duration: 2 },
    { duration: 0.5 },
    { duration: 2.5 }
  ];
  assert.strictEqual(calculateGap(tasks), 3);
});

test('calculateGap - returns 0 when at 8h', () => {
  const tasks = [{ duration: 5 }, { duration: 3 }];
  assert.strictEqual(calculateGap(tasks), 0);
});

test('calculateGap - returns 0 when over 8h', () => {
  const tasks = [{ duration: 5 }, { duration: 4 }];
  assert.strictEqual(calculateGap(tasks), 0);
});
