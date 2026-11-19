import { test } from 'node:test';
import assert from 'node:assert';
import { planWindows, clickableWindow, windowFor, windowDays, dayEpoch, parseMonthTitle, monthDelta } from '../src/lib/calendar-windows.js';

test('windowDays counts days inclusive, across months', () => {
  assert.strictEqual(windowDays({ start: '2026-11-30', end: '2026-11-30' }), 1);
  assert.strictEqual(windowDays({ start: '2026-11-24', end: '2026-12-07' }), 14);
});

test('planWindows chunks sorted distinct dates into windows of at most 14 days', () => {
  const dates = ['2026-11-30', '2026-11-02', '2026-11-02', '2026-11-03', '2026-11-17', '2026-11-16'];
  assert.deepStrictEqual(planWindows(dates), [
    { start: '2026-11-02', end: '2026-11-03' },
    { start: '2026-11-16', end: '2026-11-17' },
    { start: '2026-11-30', end: '2026-11-30' }
  ]);
});

test('a window starts at its first date and spans 14 days inclusive', () => {
  // 2 Nov + 13 days = 15 Nov is still in the first window; 16 Nov starts the next.
  assert.deepStrictEqual(planWindows(['2026-11-02', '2026-11-15', '2026-11-16']), [
    { start: '2026-11-02', end: '2026-11-15' },
    { start: '2026-11-16', end: '2026-11-16' }
  ]);
});

test('windows cross month boundaries', () => {
  assert.deepStrictEqual(planWindows(['2026-11-24', '2026-12-07']), [{ start: '2026-11-24', end: '2026-12-07' }]);
});

test('planWindows of nothing is nothing', () => {
  assert.deepStrictEqual(planWindows([]), []);
});

test('the window size is configurable', () => {
  assert.deepStrictEqual(planWindows(['2026-11-02', '2026-11-03', '2026-11-04'], 2), [
    { start: '2026-11-02', end: '2026-11-03' },
    { start: '2026-11-04', end: '2026-11-04' }
  ]);
});

test('a window ends on its last real date, not the full span', () => {
  assert.deepStrictEqual(planWindows(['2026-11-02', '2026-11-04']), [{ start: '2026-11-02', end: '2026-11-04' }]);
});

test('windowFor finds the window containing a date', () => {
  const windows = planWindows(['2026-11-02', '2026-11-30']);
  assert.deepStrictEqual(windowFor(windows, '2026-11-30'), { start: '2026-11-30', end: '2026-11-30' });
  assert.strictEqual(windowFor(windows, '2026-11-20'), undefined);
});

test('dayEpoch is UTC midnight, matching the calendar data-date attribute', () => {
  // Taken from the portal: 1 Nov 2026 and 22 Nov 2026.
  assert.strictEqual(dayEpoch('2026-11-01'), 1793491200000);
  assert.strictEqual(dayEpoch('2026-11-22'), 1795305600000);
});

test('parseMonthTitle reads the calendar header', () => {
  assert.deepStrictEqual(parseMonthTitle('November 2026'), { year: 2026, month: 10 });
  assert.deepStrictEqual(parseMonthTitle('January 2027'), { year: 2027, month: 0 });
  assert.throws(() => parseMonthTitle('Nonsense'));
});

test('monthDelta is the signed number of next (+) / prev (-) clicks to reach a date', () => {
  const nov = { year: 2026, month: 10 };
  assert.strictEqual(monthDelta(nov, '2026-11-19'), 0);
  assert.strictEqual(monthDelta(nov, '2026-12-01'), 1);
  assert.strictEqual(monthDelta(nov, '2027-02-10'), 3);
  assert.strictEqual(monthDelta(nov, '2026-09-30'), -2);
});

test('a one-day window is widened to two days, because the calendar needs a distinct end', () => {
  assert.deepEqual(clickableWindow({ start: '2027-02-26', end: '2027-02-26' }), { start: '2027-02-26', end: '2027-02-27' });
  assert.deepEqual(clickableWindow({ start: '2026-12-31', end: '2026-12-31' }), { start: '2026-12-31', end: '2027-01-01' });
  assert.deepEqual(clickableWindow({ start: '2027-02-26', end: '2027-03-02' }), { start: '2027-02-26', end: '2027-03-02' });
});
