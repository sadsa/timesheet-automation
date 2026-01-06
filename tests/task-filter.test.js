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
