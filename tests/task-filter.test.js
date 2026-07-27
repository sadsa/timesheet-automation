import { test } from 'node:test';
import assert from 'node:assert';
import { filterBillableTasks } from '../src/lib/task-filter.js';

test('filterBillableTasks - include ENTELECT tickets', () => {
  const tasks = [
    { description: 'ENTELECT-1834 - Test', type: 'ticket', ticket: 'ENTELECT-1834' }
  ];

  const result = filterBillableTasks(tasks);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
});

test('filterBillableTasks - tag meetings by keyword', () => {
  const tasks = [
    { description: 'DSU Zoom', type: 'other', ticket: null },
    { description: 'MEETING with client', type: 'other', ticket: null },
    { description: 'Standup call', type: 'other', ticket: null }
  ];

  const result = filterBillableTasks(tasks);

  assert.strictEqual(result.length, 3);
  assert.ok(result.every(task => task.type === 'meeting'));
});

test('filterBillableTasks - keep ticketless, non-meeting work', () => {
  const tasks = [
    { description: 'Cap Jira JQL searches to cut MCP token usage', type: 'other', ticket: null },
    { description: 'Keep a single coverage comment per PR', type: 'other', ticket: null }
  ];

  const result = filterBillableTasks(tasks);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].type, 'other');
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
