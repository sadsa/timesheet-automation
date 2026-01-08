import { test } from 'node:test';
import assert from 'node:assert';
import { parseNoteFile } from '../src/lib/note-parser.js';

test('parseNoteFile - extract task lines from markdown', async () => {
  const content = `## TODAY
- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Meetings | ENTELECT-1834 | Test Harness
- [ ] 10:00 AM - 11:00 AM | Training (NZ) | Training Attendance | Fix POC build
- [ ] 12:00 PM - 1:00 PM | Social Events (NZ) | Team Lunch Attendance | Lunch break`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].description, 'Test Harness');
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
});

test('parseNoteFile - calculate duration in hours', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Meetings | Task A
- [ ] 1:00 PM - 3:00 PM | Training (NZ) | Training Attendance | Task B`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result[0].duration, 1.0);
  assert.strictEqual(result[1].duration, 2.0);
});

test('parseNoteFile - extract ticket number', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Meetings | ENTELECT-1834 | Test Harness`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].type, 'ticket');
});

test('parseNoteFile - NEW FORMAT: parse pipe format with ticket (4 parts)', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Hubspot Data App Software Dev | ENTELECT-1834 | Test Harness`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].project, 'R - Canva - Agile Team');
  assert.strictEqual(result[0].category, 'Hubspot Data App Software Dev');
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].description, 'Test Harness');
  assert.strictEqual(result[0].type, 'ticket');
  assert.strictEqual(result[0].duration, 1.0);
});

test('parseNoteFile - NEW FORMAT: parse pipe format without ticket (3 parts)', async () => {
  const content = `- [ ] 2:00 PM - 3:00 PM | R - Canva - Agile Team | Hubspot Data App Software Dev | Daily standup meeting`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].project, 'R - Canva - Agile Team');
  assert.strictEqual(result[0].category, 'Hubspot Data App Software Dev');
  assert.strictEqual(result[0].ticket, null);
  assert.strictEqual(result[0].description, 'Daily standup meeting');
  assert.strictEqual(result[0].type, 'meeting'); // Should detect 'standup' keyword
  assert.strictEqual(result[0].duration, 1.0);
});

test('parseNoteFile - NEW FORMAT: trim whitespace from fields', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM |  R - Canva - Agile Team  | Hubspot Data App Software Dev  | ENTELECT-1834  | Test Harness  `;

  const result = await parseNoteFile(content);

  assert.strictEqual(result[0].project, 'R - Canva - Agile Team');
  assert.strictEqual(result[0].category, 'Hubspot Data App Software Dev');
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].description, 'Test Harness');
});

test('parseNoteFile - detect meeting type from keywords', async () => {
  const testCases = [
    'Daily standup',
    'Team MEETING',
    'Client zoom call',
    'DSU notes',
    'Sprint sync'
  ];

  for (const desc of testCases) {
    const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Meetings | ${desc}`;
    const result = await parseNoteFile(content);
    assert.strictEqual(result[0].type, 'meeting', `Failed for: ${desc}`);
    assert.strictEqual(result[0].ticket, null);
  }
});

test('parseNoteFile - invalid ticket format treated as description (4 parts but not ENTELECT-XXXX)', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Meetings | INVALID-123 | Description`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result[0].ticket, null);
  assert.strictEqual(result[0].description, 'INVALID-123'); // parts[2] becomes description
  assert.strictEqual(result[0].type, 'other');
});

test('parseNoteFile - error on old format (missing project and category)', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | ENTELECT-1834 - Test Harness`;

  await assert.rejects(
    async () => await parseNoteFile(content),
    /Invalid task format/,
    'Should throw error for old format'
  );
});

test('parseNoteFile - VALIDATION: error on unknown project', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | Unknown Project | Category A | ENTELECT-1234 | Task`;

  await assert.rejects(
    async () => await parseNoteFile(content),
    /Line 1: Unknown project "Unknown Project"/,
    'Should throw error for unknown project'
  );
});

test('parseNoteFile - VALIDATION: error on invalid category for project', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Invalid Category | ENTELECT-1234 | Task`;

  await assert.rejects(
    async () => await parseNoteFile(content),
    /Line 1: Invalid category "Invalid Category" for project "R - Canva - Agile Team"/,
    'Should throw error for invalid category'
  );
});

test('parseNoteFile - VALIDATION: error on empty project field', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | | Meetings | Task description`;

  await assert.rejects(
    async () => await parseNoteFile(content),
    /Line 1: Project field cannot be empty/,
    'Should throw error for empty project'
  );
});

test('parseNoteFile - VALIDATION: error on empty category field', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | | Task description`;

  await assert.rejects(
    async () => await parseNoteFile(content),
    /Line 1: Category field cannot be empty/,
    'Should throw error for empty category'
  );
});

test('parseNoteFile - VALIDATION: error on empty description field', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Meetings | `;

  await assert.rejects(
    async () => await parseNoteFile(content),
    /Line 1: Description field cannot be empty/,
    'Should throw error for empty description'
  );
});

test('parseNoteFile - VALIDATION: valid project and category passes', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Meetings | Daily standup`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].project, 'R - Canva - Agile Team');
  assert.strictEqual(result[0].category, 'Meetings');
  assert.strictEqual(result[0].description, 'Daily standup');
});
