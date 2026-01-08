import { test } from 'node:test';
import assert from 'node:assert';
import { parseNoteFile } from '../src/lib/note-parser.js';

test('parseNoteFile - extract task lines from markdown', () => {
  const content = `## TODAY
- [ ] 9:00 AM - 10:00 AM | ENTELECT-1834 - Test Harness
- [ ] 10:00 AM - 11:00 AM | Fix POC build
- [ ] 12:00 PM - 1:00 PM | Lunch break`;

  const result = parseNoteFile(content);

  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].description, 'ENTELECT-1834 - Test Harness');
});

test('parseNoteFile - calculate duration in hours', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | Task A
- [ ] 1:00 PM - 3:00 PM | Task B`;

  const result = parseNoteFile(content);

  assert.strictEqual(result[0].duration, 1.0);
  assert.strictEqual(result[1].duration, 2.0);
});

test('parseNoteFile - extract ticket number', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | ENTELECT-1834 - Test Harness`;

  const result = parseNoteFile(content);

  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].type, 'ticket');
});

test('parseNoteFile - NEW FORMAT: parse pipe format with ticket (4 parts)', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Hubspot Data App Software Dev | ENTELECT-1834 | Test Harness`;

  const result = parseNoteFile(content);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].project, 'R - Canva - Agile Team');
  assert.strictEqual(result[0].category, 'Hubspot Data App Software Dev');
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].description, 'Test Harness');
  assert.strictEqual(result[0].type, 'ticket');
  assert.strictEqual(result[0].duration, 1.0);
});

test('parseNoteFile - NEW FORMAT: parse pipe format without ticket (3 parts)', () => {
  const content = `- [ ] 2:00 PM - 3:00 PM | R - Canva - Agile Team | Hubspot Data App Software Dev | Daily standup meeting`;

  const result = parseNoteFile(content);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].project, 'R - Canva - Agile Team');
  assert.strictEqual(result[0].category, 'Hubspot Data App Software Dev');
  assert.strictEqual(result[0].ticket, null);
  assert.strictEqual(result[0].description, 'Daily standup meeting');
  assert.strictEqual(result[0].type, 'other');
  assert.strictEqual(result[0].duration, 1.0);
});

test('parseNoteFile - NEW FORMAT: trim whitespace from fields', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM |  R - Canva - Agile Team  | Hubspot Data App Software Dev  | ENTELECT-1834  | Test Harness  `;

  const result = parseNoteFile(content);

  assert.strictEqual(result[0].project, 'R - Canva - Agile Team');
  assert.strictEqual(result[0].category, 'Hubspot Data App Software Dev');
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].description, 'Test Harness');
});

test('parseNoteFile - BACKWARDS COMPATIBILITY: old format sets project and category to null', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | ENTELECT-1834 - Test Harness`;

  const result = parseNoteFile(content);

  assert.strictEqual(result[0].project, null);
  assert.strictEqual(result[0].category, null);
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].description, 'ENTELECT-1834 - Test Harness');
  assert.strictEqual(result[0].type, 'ticket');
});
