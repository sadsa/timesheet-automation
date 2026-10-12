import { test } from 'node:test';
import assert from 'node:assert';
import { toLocal, extractTicket, cleanTitle, addDays } from '../src/lib/activity.js';

const NZ = 'Pacific/Auckland';

test('late-evening UTC activity lands on the next NZ day', () => {
  assert.deepStrictEqual(toLocal('2026-08-31T23:34:32Z', NZ), { date: '2026-09-01', time: '11:34' });
});

test('local time follows NZ daylight saving', () => {
  // NZST (+12) before 27 Sep 2026, NZDT (+13) after.
  assert.deepStrictEqual(toLocal('2026-09-25T20:00:00Z', NZ), { date: '2026-09-26', time: '08:00' });
  assert.deepStrictEqual(toLocal('2026-09-29T20:00:00Z', NZ), { date: '2026-09-30', time: '09:00' });
});

test('extractTicket takes the first source with a ticket', () => {
  assert.strictEqual(extractTicket('Bump deps', 'fix/ENTELECT-2696/whitespace', 'ECOPIE-1'), 'ENTELECT-2696');
  assert.strictEqual(extractTicket('Bump deps', undefined, null), undefined);
});

test('extractTicket reads a lowercase ticket from a conventional-commit scope', () => {
  assert.strictEqual(extractTicket('fix(entelect-2666): use latest drag functions'), 'ENTELECT-2666');
  assert.strictEqual(extractTicket('chore(deps): bump qs'), undefined);
});

test('extractTicket ignores standards that look like tickets', () => {
  assert.strictEqual(extractTicket('Decode UTF-8 and SHA-256 names for ENTELECT-12'), 'ENTELECT-12');
  assert.strictEqual(extractTicket('Decode UTF-8 names'), undefined);
});

test('cleanTitle strips ticket keys and conventional-commit prefixes', () => {
  assert.strictEqual(cleanTitle('ENTELECT-587 | fix: add build:staging scripts'), 'Add build:staging scripts');
  assert.strictEqual(cleanTitle('feat(ci): add RICE deploy workflows (ECOPIE-3059)'), 'Add RICE deploy workflows');
  assert.strictEqual(cleanTitle('ENTELECT-2582 - Configurable meeting-stage tab'), 'Configurable meeting-stage tab');
  assert.strictEqual(cleanTitle('chore(deps): bump pacote'), 'Bump pacote');
});

test('cleanTitle truncates long titles to 80 characters', () => {
  const cleaned = cleanTitle(`fix: ${'a'.repeat(100)}`);
  assert.strictEqual(cleaned.length, 80);
  assert.ok(cleaned.endsWith('…'));
});

test('addDays crosses month boundaries', () => {
  assert.strictEqual(addDays('2026-09-01', -1), '2026-08-31');
  assert.strictEqual(addDays('2026-09-30', 1), '2026-10-01');
});
