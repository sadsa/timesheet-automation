import { test } from 'node:test';
import assert from 'node:assert';
import { filterBillableTasks } from '../src/lib/task-filter.js';

test('filterBillableTasks - include ENTELECT tickets', () => {
  const tasks = [
    { description: 'ENTELECT-1834 - Test', type: 'ticket', ticket: 'ENTELECT-1834' },
    { description: 'Personal task', type: 'other', ticket: null }
  ];

  const result = filterBillableTasks(tasks);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
});

test('filterBillableTasks - include meeting keywords', () => {
  const tasks = [
    { description: 'DSU Zoom', type: 'other', ticket: null },
    { description: 'MEETING with client', type: 'other', ticket: null },
    { description: 'Standup call', type: 'other', ticket: null },
    { description: 'Personal task', type: 'other', ticket: null }
  ];

  const result = filterBillableTasks(tasks);

  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].type, 'meeting');
});

test('filterBillableTasks - exclude lunch and breaks', () => {
  const tasks = [
    { description: 'ENTELECT-1834', type: 'ticket', ticket: 'ENTELECT-1834' },
    { description: 'Lunch break', type: 'other', ticket: null },
    { description: 'Coffee break', type: 'other', ticket: null }
  ];

  const result = filterBillableTasks(tasks);

  assert.strictEqual(result.length, 1);
});
