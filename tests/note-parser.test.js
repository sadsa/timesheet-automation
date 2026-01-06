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
