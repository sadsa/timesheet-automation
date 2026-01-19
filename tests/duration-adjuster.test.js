import { test } from 'node:test';
import assert from 'node:assert';
import { calculateGap, distributeGap } from '../src/lib/duration-adjuster.js';

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

test('distributeGap - distributes evenly across selected tasks', () => {
  const tasks = [
    { duration: 2, description: 'Task A' },
    { duration: 0.5, description: 'Task B' },
    { duration: 2.5, description: 'Task C' }
  ];
  const selectedIndices = [0, 2]; // Select Task A and C
  const gap = 3; // 3h to distribute

  const result = distributeGap(tasks, selectedIndices, gap);

  assert.strictEqual(result[0].duration, 3.5); // 2 + 1.5
  assert.strictEqual(result[1].duration, 0.5); // unchanged
  assert.strictEqual(result[2].duration, 4);   // 2.5 + 1.5
});

test('distributeGap - handles single task selection', () => {
  const tasks = [
    { duration: 2, description: 'Task A' },
    { duration: 1, description: 'Task B' }
  ];
  const selectedIndices = [0];
  const gap = 5;

  const result = distributeGap(tasks, selectedIndices, gap);

  assert.strictEqual(result[0].duration, 7); // 2 + 5
  assert.strictEqual(result[1].duration, 1); // unchanged
});

test('distributeGap - returns original tasks when no selection', () => {
  const tasks = [{ duration: 2 }, { duration: 3 }];
  const result = distributeGap(tasks, [], 3);

  assert.strictEqual(result[0].duration, 2);
  assert.strictEqual(result[1].duration, 3);
});
