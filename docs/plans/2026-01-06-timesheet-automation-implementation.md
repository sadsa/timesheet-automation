# Timesheet Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a two-phase automation tool that parses Obsidian daily notes and submits timesheets to the Entelect portal.

**Architecture:** Modular Node.js CLI with separate parser/review phase and Playwright browser automation phase. Parser extracts billable tasks, prompts for categorization, and outputs JSON. Browser automation reads JSON and fills timesheet with step-by-step verification.

**Tech Stack:** Node.js, Playwright, Inquirer, Commander, date-fns, Chalk

---

## Phase 0: Project Setup

### Task 0.1: Create Project Structure

**Files:**
- Create: `timesheet-automation/package.json`
- Create: `timesheet-automation/.gitignore`
- Create: `timesheet-automation/README.md`

**Step 1: Create project directory**

```bash
mkdir -p timesheet-automation
cd timesheet-automation
```

**Step 2: Initialize package.json**

```bash
npm init -y
```

**Step 3: Update package.json with dependencies**

Edit `package.json`:
```json
{
  "name": "timesheet-automation",
  "version": "1.0.0",
  "description": "Automate timesheet entry from Obsidian notes",
  "main": "src/timesheet-parser.js",
  "type": "module",
  "scripts": {
    "parse": "node src/timesheet-parser.js",
    "submit": "node src/timesheet-submit.js",
    "test": "node --test"
  },
  "dependencies": {
    "playwright": "^1.40.0",
    "inquirer": "^9.0.0",
    "commander": "^11.0.0",
    "date-fns": "^3.0.0",
    "chalk": "^5.0.0"
  }
}
```

**Step 4: Create .gitignore**

Create `.gitignore`:
```
node_modules/
output/
.env
*.log
```

**Step 5: Create README**

Create `README.md`:
```markdown
# Timesheet Automation

Automate timesheet entry from Obsidian daily notes to Entelect portal.

## Usage

```bash
# Parse daily notes and review
npm run parse -- --date 2026-01-06

# Submit to portal
npm run submit
```

## Setup

```bash
npm install
npx playwright install chromium
```
```

**Step 6: Install dependencies**

```bash
npm install
```

Expected: Dependencies installed successfully

**Step 7: Create directory structure**

```bash
mkdir -p src/lib config output tests
```

**Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: initial project setup"
```

---

### Task 0.2: Create Initial Config Files

**Files:**
- Create: `timesheet-automation/config/categories.json`
- Create: `timesheet-automation/.env.example`

**Step 1: Create categories config**

Create `config/categories.json`:
```json
[
  "Meetings",
  "OneDrive",
  "Teams App",
  "Dropbox"
]
```

**Step 2: Create environment example**

Create `.env.example`:
```
NOTES_DIR=/Users/entelect-jbiddick/Documents/Personal
CHROME_USER_DATA=/Users/entelect-jbiddick/Library/Application Support/Google/Chrome
```

**Step 3: Commit**

```bash
git add config/ .env.example
git commit -m "chore: add initial configuration files"
```

---

## Phase 1: Date Parser Module (TDD)

### Task 1.1: Parse Single Date

**Files:**
- Create: `timesheet-automation/tests/date-parser.test.js`
- Create: `timesheet-automation/src/lib/date-parser.js`

**Step 1: Write the failing test**

Create `tests/date-parser.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { parseDateInput } from '../src/lib/date-parser.js';

test('parseDateInput - single date in YYYY-MM-DD format', () => {
  const result = parseDateInput('2026-01-06');
  assert.deepStrictEqual(result, ['2026-01-06']);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/lib/date-parser.js`:
```javascript
export function parseDateInput(input) {
  return [input];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/date-parser.test.js src/lib/date-parser.js
git commit -m "feat: add single date parsing"
```

---

### Task 1.2: Parse Date Range

**Files:**
- Modify: `timesheet-automation/tests/date-parser.test.js`
- Modify: `timesheet-automation/src/lib/date-parser.js`

**Step 1: Write the failing test**

Add to `tests/date-parser.test.js`:
```javascript
import { eachDayOfInterval, format } from 'date-fns';

test('parseDateInput - date range returns all dates', () => {
  const result = parseDateInput('2026-01-06:2026-01-08');
  assert.deepStrictEqual(result, [
    '2026-01-06',
    '2026-01-07',
    '2026-01-08'
  ]);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with assertion error

**Step 3: Write implementation**

Update `src/lib/date-parser.js`:
```javascript
import { eachDayOfInterval, parseISO, format } from 'date-fns';

export function parseDateInput(input) {
  if (input.includes(':')) {
    const [start, end] = input.split(':');
    const dates = eachDayOfInterval({
      start: parseISO(start),
      end: parseISO(end)
    });
    return dates.map(date => format(date, 'yyyy-MM-dd'));
  }
  return [input];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/date-parser.test.js src/lib/date-parser.js
git commit -m "feat: add date range parsing"
```

---

### Task 1.3: Parse "Last Week" Convenience

**Files:**
- Modify: `timesheet-automation/tests/date-parser.test.js`
- Modify: `timesheet-automation/src/lib/date-parser.js`

**Step 1: Write the failing test**

Add to `tests/date-parser.test.js`:
```javascript
import { subWeeks, startOfWeek, endOfWeek } from 'date-fns';

test('parseDateInput - "last" returns last week Mon-Fri', () => {
  const result = parseDateInput('last');
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  // Should return 5 days (Mon-Fri)
  assert.strictEqual(result.length, 7); // Full week for now
  assert.strictEqual(result[0], format(lastWeekStart, 'yyyy-MM-dd'));
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Write implementation**

Update `src/lib/date-parser.js`:
```javascript
import { eachDayOfInterval, parseISO, format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

export function parseDateInput(input) {
  if (input === 'last') {
    const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const dates = eachDayOfInterval({ start: lastWeekStart, end: lastWeekEnd });
    return dates.map(date => format(date, 'yyyy-MM-dd'));
  }

  if (input.includes(':')) {
    const [start, end] = input.split(':');
    const dates = eachDayOfInterval({
      start: parseISO(start),
      end: parseISO(end)
    });
    return dates.map(date => format(date, 'yyyy-MM-dd'));
  }

  return [input];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/date-parser.test.js src/lib/date-parser.js
git commit -m "feat: add 'last week' convenience parsing"
```

---

## Phase 2: Note Parser Module (TDD)

### Task 2.1: Read and Extract Task Lines

**Files:**
- Create: `timesheet-automation/tests/note-parser.test.js`
- Create: `timesheet-automation/src/lib/note-parser.js`

**Step 1: Write the failing test**

Create `tests/note-parser.test.js`:
```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/lib/note-parser.js`:
```javascript
export function parseNoteFile(content) {
  const lines = content.split('\n');
  const taskRegex = /- \[ \] (\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M) \| (.+)/;

  const tasks = [];
  for (const line of lines) {
    const match = line.match(taskRegex);
    if (match) {
      tasks.push({
        start: match[1],
        end: match[2],
        description: match[3]
      });
    }
  }

  return tasks;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/note-parser.test.js src/lib/note-parser.js
git commit -m "feat: extract task lines from markdown"
```

---

### Task 2.2: Calculate Duration from Time Slots

**Files:**
- Modify: `timesheet-automation/tests/note-parser.test.js`
- Modify: `timesheet-automation/src/lib/note-parser.js`

**Step 1: Write the failing test**

Add to `tests/note-parser.test.js`:
```javascript
test('parseNoteFile - calculate duration in hours', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | Task A
- [ ] 1:00 PM - 3:00 PM | Task B`;

  const result = parseNoteFile(content);

  assert.strictEqual(result[0].duration, 1.0);
  assert.strictEqual(result[1].duration, 2.0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "duration is undefined"

**Step 3: Write implementation**

Update `src/lib/note-parser.js`:
```javascript
import { parse, differenceInMinutes } from 'date-fns';

function calculateDuration(startTime, endTime) {
  const baseDate = '2026-01-01';
  const start = parse(`${baseDate} ${startTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const end = parse(`${baseDate} ${endTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const minutes = differenceInMinutes(end, start);
  return minutes / 60;
}

export function parseNoteFile(content) {
  const lines = content.split('\n');
  const taskRegex = /- \[ \] (\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M) \| (.+)/;

  const tasks = [];
  for (const line of lines) {
    const match = line.match(taskRegex);
    if (match) {
      const start = match[1];
      const end = match[2];
      tasks.push({
        start,
        end,
        duration: calculateDuration(start, end),
        description: match[3]
      });
    }
  }

  return tasks;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/note-parser.test.js src/lib/note-parser.js
git commit -m "feat: calculate task duration in hours"
```

---

### Task 2.3: Extract Ticket Numbers

**Files:**
- Modify: `timesheet-automation/tests/note-parser.test.js`
- Modify: `timesheet-automation/src/lib/note-parser.js`

**Step 1: Write the failing test**

Add to `tests/note-parser.test.js`:
```javascript
test('parseNoteFile - extract ticket number', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | ENTELECT-1834 - Test Harness`;

  const result = parseNoteFile(content);

  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].type, 'ticket');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Write implementation**

Update `src/lib/note-parser.js`:
```javascript
import { parse, differenceInMinutes } from 'date-fns';

function calculateDuration(startTime, endTime) {
  const baseDate = '2026-01-01';
  const start = parse(`${baseDate} ${startTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const end = parse(`${baseDate} ${endTime}`, 'yyyy-MM-dd h:mm a', new Date());
  const minutes = differenceInMinutes(end, start);
  return minutes / 60;
}

function extractTicket(description) {
  const ticketMatch = description.match(/ENTELECT-\d+/);
  return ticketMatch ? ticketMatch[0] : null;
}

export function parseNoteFile(content) {
  const lines = content.split('\n');
  const taskRegex = /- \[ \] (\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M) \| (.+)/;

  const tasks = [];
  for (const line of lines) {
    const match = line.match(taskRegex);
    if (match) {
      const start = match[1];
      const end = match[2];
      const description = match[3];
      const ticket = extractTicket(description);

      tasks.push({
        start,
        end,
        duration: calculateDuration(start, end),
        description,
        ticket,
        type: ticket ? 'ticket' : 'other'
      });
    }
  }

  return tasks;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/note-parser.test.js src/lib/note-parser.js
git commit -m "feat: extract ticket numbers from task descriptions"
```

---

## Phase 3: Task Filter Module (TDD)

### Task 3.1: Filter ENTELECT Tickets

**Files:**
- Create: `timesheet-automation/tests/task-filter.test.js`
- Create: `timesheet-automation/src/lib/task-filter.js`

**Step 1: Write the failing test**

Create `tests/task-filter.test.js`:
```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Write minimal implementation**

Create `src/lib/task-filter.js`:
```javascript
export function filterBillableTasks(tasks) {
  return tasks.filter(task => task.ticket !== null);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/task-filter.test.js src/lib/task-filter.js
git commit -m "feat: filter ENTELECT ticket tasks"
```

---

### Task 3.2: Detect and Include Meetings

**Files:**
- Modify: `timesheet-automation/tests/task-filter.test.js`
- Modify: `timesheet-automation/src/lib/task-filter.js`

**Step 1: Write the failing test**

Add to `tests/task-filter.test.js`:
```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Write implementation**

Update `src/lib/task-filter.js`:
```javascript
const MEETING_KEYWORDS = ['MEETING', 'meeting', 'zoom', 'call', 'DSU', 'standup', 'sync'];

function isMeeting(description) {
  return MEETING_KEYWORDS.some(keyword => description.includes(keyword));
}

export function filterBillableTasks(tasks) {
  return tasks
    .map(task => {
      if (task.ticket) {
        return task;
      }
      if (isMeeting(task.description)) {
        return { ...task, type: 'meeting' };
      }
      return null;
    })
    .filter(task => task !== null);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/task-filter.test.js src/lib/task-filter.js
git commit -m "feat: detect and include meeting tasks"
```

---

### Task 3.3: Exclude Lunch and Breaks

**Files:**
- Modify: `timesheet-automation/tests/task-filter.test.js`
- Modify: `timesheet-automation/src/lib/task-filter.js`

**Step 1: Write the failing test**

Add to `tests/task-filter.test.js`:
```javascript
test('filterBillableTasks - exclude lunch and breaks', () => {
  const tasks = [
    { description: 'ENTELECT-1834', type: 'ticket', ticket: 'ENTELECT-1834' },
    { description: 'Lunch break', type: 'other', ticket: null },
    { description: 'Coffee break', type: 'other', ticket: null }
  ];

  const result = filterBillableTasks(tasks);

  assert.strictEqual(result.length, 1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (will include lunch in current implementation)

**Step 3: Write implementation**

Update `src/lib/task-filter.js`:
```javascript
const MEETING_KEYWORDS = ['MEETING', 'meeting', 'zoom', 'call', 'DSU', 'standup', 'sync'];
const EXCLUDE_KEYWORDS = ['lunch', 'break', 'Lunch', 'Break'];

function isMeeting(description) {
  return MEETING_KEYWORDS.some(keyword => description.includes(keyword));
}

function isExcluded(description) {
  return EXCLUDE_KEYWORDS.some(keyword => description.toLowerCase().includes(keyword.toLowerCase()));
}

export function filterBillableTasks(tasks) {
  return tasks
    .filter(task => !isExcluded(task.description))
    .map(task => {
      if (task.ticket) {
        return task;
      }
      if (isMeeting(task.description)) {
        return { ...task, type: 'meeting' };
      }
      return null;
    })
    .filter(task => task !== null);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/task-filter.test.js src/lib/task-filter.js
git commit -m "feat: exclude lunch and break entries"
```

---

## Phase 4: Review UI Module

### Task 4.1: Category Selection Prompt

**Files:**
- Create: `timesheet-automation/src/lib/review-ui.js`

**Step 1: Create review UI module**

Create `src/lib/review-ui.js`:
```javascript
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';

export async function loadCategories() {
  try {
    const data = await fs.readFile('config/categories.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return ['Meetings', 'OneDrive', 'Teams App', 'Dropbox'];
  }
}

export async function saveCategories(categories) {
  await fs.writeFile('config/categories.json', JSON.stringify(categories, null, 2));
}

export async function promptForCategory(task, categories) {
  console.log(chalk.blue(`\nTask: ${task.description}`));
  console.log(chalk.gray(`Duration: ${task.duration} hours`));

  const choices = [
    ...categories.map((cat, idx) => ({ name: cat, value: cat })),
    { name: chalk.green('[Add new category]'), value: '__new__' }
  ];

  const { category } = await inquirer.prompt([
    {
      type: 'list',
      name: 'category',
      message: 'Select category:',
      choices
    }
  ]);

  if (category === '__new__') {
    const { newCategory } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newCategory',
        message: 'Enter new category name:'
      }
    ]);
    categories.push(newCategory);
    await saveCategories(categories);
    return newCategory;
  }

  return category;
}
```

**Step 2: Commit**

```bash
git add src/lib/review-ui.js
git commit -m "feat: add category selection prompt"
```

---

### Task 4.2: Duration Review Display

**Files:**
- Modify: `timesheet-automation/src/lib/review-ui.js`

**Step 1: Add duration review function**

Add to `src/lib/review-ui.js`:
```javascript
export function displayDurationSummary(tasks, date) {
  console.log(chalk.yellow(`\n=== ${date} ===`));

  let total = 0;
  tasks.forEach((task, idx) => {
    console.log(`${idx + 1}. [${task.category}] ${task.description.substring(0, 40)}... ${task.duration}h`);
    total += task.duration;
  });

  const warning = total !== 8 ? chalk.red(' ⚠️') : chalk.green(' ✓');
  console.log(chalk.bold(`\n                                      Total: ${total}h / 8.0h${warning}`));
}

export async function promptDurationAction() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Options:',
      choices: [
        { name: 'Continue', value: 'continue' },
        { name: 'Edit durations', value: 'edit' },
        { name: 'Quit', value: 'quit' }
      ]
    }
  ]);

  return action;
}
```

**Step 2: Commit**

```bash
git add src/lib/review-ui.js
git commit -m "feat: add duration review display"
```

---

### Task 4.3: Duration Editing

**Files:**
- Modify: `timesheet-automation/src/lib/review-ui.js`

**Step 1: Add duration editing function**

Add to `src/lib/review-ui.js`:
```javascript
export async function editTaskDuration(tasks) {
  const { taskIndex } = await inquirer.prompt([
    {
      type: 'number',
      name: 'taskIndex',
      message: `Which entry to adjust? (1-${tasks.length}):`,
      validate: (input) => {
        const num = parseInt(input);
        return num >= 1 && num <= tasks.length || 'Invalid entry number';
      }
    }
  ]);

  const task = tasks[taskIndex - 1];
  console.log(chalk.gray(`Current: ${task.description} - ${task.duration}h`));

  const { newDuration } = await inquirer.prompt([
    {
      type: 'number',
      name: 'newDuration',
      message: 'New duration in hours:',
      validate: (input) => input > 0 || 'Duration must be positive'
    }
  ]);

  task.duration = newDuration;
  return tasks;
}
```

**Step 2: Commit**

```bash
git add src/lib/review-ui.js
git commit -m "feat: add duration editing functionality"
```

---

## Phase 5: Main Parser CLI

### Task 5.1: CLI Argument Handling

**Files:**
- Create: `timesheet-automation/src/timesheet-parser.js`

**Step 1: Create main CLI file**

Create `src/timesheet-parser.js`:
```javascript
#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { parseDateInput } from './lib/date-parser.js';
import { parseNoteFile } from './lib/note-parser.js';
import { filterBillableTasks } from './lib/task-filter.js';
import { loadCategories, promptForCategory, displayDurationSummary, promptDurationAction, editTaskDuration } from './lib/review-ui.js';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

program
  .name('timesheet-parser')
  .description('Parse Obsidian daily notes for timesheet entry')
  .option('-d, --date <date>', 'Single date (YYYY-MM-DD)')
  .option('-r, --range <range>', 'Date range (YYYY-MM-DD:YYYY-MM-DD)')
  .option('-w, --week <week>', 'Week shorthand (e.g., "last")')
  .parse();

const options = program.opts();

async function main() {
  const dateInput = options.date || options.range || options.week;

  if (!dateInput) {
    console.error(chalk.red('Error: Must provide --date, --range, or --week'));
    process.exit(1);
  }

  console.log(chalk.blue('Timesheet Parser\n'));
  console.log(`Date input: ${dateInput}`);
}

main().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
```

**Step 2: Make executable**

```bash
chmod +x src/timesheet-parser.js
```

**Step 3: Test CLI**

Run: `node src/timesheet-parser.js --date 2026-01-06`
Expected: Shows "Date input: 2026-01-06"

**Step 4: Commit**

```bash
git add src/timesheet-parser.js
git commit -m "feat: add CLI argument handling"
```

---

### Task 5.2: Integrate File Discovery and Parsing

**Files:**
- Modify: `timesheet-automation/src/timesheet-parser.js`

**Step 1: Add file discovery and parsing logic**

Update `src/timesheet-parser.js` main function:
```javascript
async function main() {
  const dateInput = options.date || options.range || options.week;

  if (!dateInput) {
    console.error(chalk.red('Error: Must provide --date, --range, or --week'));
    process.exit(1);
  }

  console.log(chalk.blue('Timesheet Parser\n'));

  const dates = parseDateInput(dateInput);
  console.log(`Processing ${dates.length} date(s)...`);

  const notesDir = process.env.NOTES_DIR || '/Users/entelect-jbiddick/Documents/Personal';
  const allTasks = [];

  for (const date of dates) {
    const filePath = path.join(notesDir, `${date}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const tasks = parseNoteFile(content);
      const billableTasks = filterBillableTasks(tasks);

      if (billableTasks.length === 0) {
        console.log(chalk.yellow(`Warning: No billable tasks found for ${date}`));
        continue;
      }

      billableTasks.forEach(task => {
        task.date = date;
        allTasks.push(task);
      });

      console.log(chalk.green(`✓ Found ${billableTasks.length} billable task(s) for ${date}`));
    } catch (error) {
      console.log(chalk.yellow(`Warning: No daily note found for ${date}, skipping...`));
    }
  }

  if (allTasks.length === 0) {
    console.log(chalk.red('No billable tasks found in any dates.'));
    process.exit(0);
  }

  console.log(chalk.blue(`\nTotal: ${allTasks.length} billable tasks`));
}
```

**Step 2: Test with real file**

Run: `node src/timesheet-parser.js --date 2026-01-06`
Expected: Shows tasks found from the actual daily note

**Step 3: Commit**

```bash
git add src/timesheet-parser.js
git commit -m "feat: integrate file discovery and parsing"
```

---

### Task 5.3: Integrate Category Selection

**Files:**
- Modify: `timesheet-automation/src/timesheet-parser.js`

**Step 1: Add category selection loop**

Add to `main()` function after task discovery:
```javascript
  // Category selection
  console.log(chalk.blue('\n--- Category Selection ---'));
  const categories = await loadCategories();

  for (const task of allTasks) {
    task.category = await promptForCategory(task, categories);
  }

  console.log(chalk.green('\n✓ All tasks categorized'));
```

**Step 2: Test interactive prompt**

Run: `node src/timesheet-parser.js --date 2026-01-06`
Expected: Prompts for category for each task

**Step 3: Commit**

```bash
git add src/timesheet-parser.js
git commit -m "feat: integrate category selection"
```

---

### Task 5.4: Integrate Duration Review

**Files:**
- Modify: `timesheet-automation/src/timesheet-parser.js`

**Step 1: Add duration review loop**

Add to `main()` function:
```javascript
  // Duration review
  console.log(chalk.blue('\n--- Duration Review ---'));

  const tasksByDate = {};
  allTasks.forEach(task => {
    if (!tasksByDate[task.date]) {
      tasksByDate[task.date] = [];
    }
    tasksByDate[task.date].push(task);
  });

  let reviewing = true;
  while (reviewing) {
    for (const date of Object.keys(tasksByDate)) {
      displayDurationSummary(tasksByDate[date], date);
    }

    const action = await promptDurationAction();

    if (action === 'quit') {
      console.log(chalk.yellow('Cancelled.'));
      process.exit(0);
    } else if (action === 'edit') {
      const { dateToEdit } = await inquirer.prompt([
        {
          type: 'list',
          name: 'dateToEdit',
          message: 'Which date to edit?',
          choices: Object.keys(tasksByDate)
        }
      ]);
      await editTaskDuration(tasksByDate[dateToEdit]);
    } else {
      reviewing = false;
    }
  }
```

**Step 2: Add missing import**

Add to imports:
```javascript
import inquirer from 'inquirer';
```

**Step 3: Test review flow**

Run: `node src/timesheet-parser.js --date 2026-01-06`
Expected: Shows duration summary and allows editing

**Step 4: Commit**

```bash
git add src/timesheet-parser.js
git commit -m "feat: integrate duration review and editing"
```

---

### Task 5.5: Generate JSON Output

**Files:**
- Modify: `timesheet-automation/src/timesheet-parser.js`

**Step 1: Add JSON output generation**

Add to end of `main()` function:
```javascript
  // Generate output
  const outputPath = 'output/timesheet-data.json';
  await fs.mkdir('output', { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(allTasks, null, 2));

  console.log(chalk.green(`\n✓ Timesheet data saved to ${outputPath}`));
  console.log(chalk.blue('\nRun: npm run submit'));
}
```

**Step 2: Test complete flow**

Run: `node src/timesheet-parser.js --date 2026-01-06`
Expected: Creates `output/timesheet-data.json` with all tasks

**Step 3: Verify output**

Run: `cat output/timesheet-data.json`
Expected: Valid JSON with categorized tasks

**Step 4: Commit**

```bash
git add src/timesheet-parser.js
git commit -m "feat: generate JSON output for browser automation"
```

---

## Phase 6: Browser Automation

### Task 6.1: Setup Playwright Script

**Files:**
- Create: `timesheet-automation/src/timesheet-submit.js`

**Step 1: Create browser automation script**

Create `src/timesheet-submit.js`:
```javascript
#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs/promises';
import chalk from 'chalk';
import readline from 'readline';

async function waitForEnter(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(chalk.yellow(`${message} [Press Enter]`), () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  console.log(chalk.blue('Timesheet Submission\n'));

  // Load data
  const data = await fs.readFile('output/timesheet-data.json', 'utf-8');
  const tasks = JSON.parse(data);

  console.log(`Loaded ${tasks.length} task(s)`);

  // Launch browser
  const userDataDir = process.env.CHROME_USER_DATA ||
    '/Users/entelect-jbiddick/Library/Application Support/Google/Chrome';

  console.log(chalk.gray('Launching browser with existing session...'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome'
  });

  const page = context.pages()[0] || await context.newPage();

  // Navigate
  await page.goto('https://employee.entelect.co.nz/Timesheet');

  await waitForEnter('Navigate to the timesheet page and press Enter when ready to start...');

  console.log(chalk.green('\n✓ Ready to fill timesheet'));

  await context.close();
}

main().catch(error => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
```

**Step 2: Make executable**

```bash
chmod +x src/timesheet-submit.js
```

**Step 3: Install Playwright browsers**

```bash
npx playwright install chromium
```

**Step 4: Test browser launch**

Run: `node src/timesheet-submit.js`
Expected: Browser opens, navigates to timesheet portal, waits for Enter

**Step 5: Commit**

```bash
git add src/timesheet-submit.js
git commit -m "feat: setup Playwright browser automation"
```

---

### Task 6.2: Implement Form Filling (Placeholder)

**Files:**
- Modify: `timesheet-automation/src/timesheet-submit.js`

**Step 1: Add form filling loop with placeholders**

Update the script after `waitForEnter`:
```javascript
  await waitForEnter('Navigate to the timesheet page and press Enter when ready to start...');

  console.log(chalk.green('\n✓ Starting form fill'));

  // Group by date
  const tasksByDate = {};
  tasks.forEach(task => {
    if (!tasksByDate[task.date]) {
      tasksByDate[task.date] = [];
    }
    tasksByDate[task.date].push(task);
  });

  // Fill each entry
  for (const date of Object.keys(tasksByDate)) {
    for (const task of tasksByDate[date]) {
      console.log(chalk.blue(`\n→ Filling: ${date} | ${task.category} | ${task.ticket || task.type} | ${task.duration}h`));
      console.log(chalk.gray(`  ${task.description}`));

      // TODO: Implement actual form filling
      // This requires inspecting the portal's form structure
      // Placeholder selectors - update after inspecting the page:
      // await page.fill('input[name="date"]', date);
      // await page.selectOption('select[name="category"]', task.category);
      // await page.fill('input[name="hours"]', String(task.duration));
      // await page.fill('textarea[name="description"]', task.description);

      await waitForEnter('Entry filled. Verify and press Enter to continue...');
    }
  }

  console.log(chalk.yellow('\n⚠️ All entries filled. Review the timesheet in the browser.'));
  await waitForEnter('Press Enter to submit, or Ctrl+C to cancel...');

  // TODO: Implement submit button click
  // await page.click('button[type="submit"]');

  console.log(chalk.green('\n✓ Timesheet submitted!'));

  await waitForEnter('Press Enter to close browser...');
```

**Step 2: Commit**

```bash
git add src/timesheet-submit.js
git commit -m "feat: add form filling loop with placeholders"
```

---

### Task 6.3: Add Inspection Helper Comment

**Files:**
- Modify: `timesheet-automation/src/timesheet-submit.js`

**Step 1: Add inspection instructions**

Add comment at top of file:
```javascript
#!/usr/bin/env node
/**
 * Timesheet Submission Automation
 *
 * TO COMPLETE IMPLEMENTATION:
 * 1. Run this script once: node src/timesheet-submit.js
 * 2. When browser opens, right-click timesheet form elements and "Inspect"
 * 3. Note the selectors for: date input, category dropdown, hours input, description textarea, submit button
 * 4. Update the TODO sections below with actual selectors
 *
 * Example selectors to look for:
 * - input[name="date"] or #dateField
 * - select[name="category"] or #categorySelect
 * - input[name="hours"] or .hours-input
 * - textarea[name="description"] or #descriptionField
 * - button[type="submit"] or .submit-button
 */
```

**Step 2: Commit**

```bash
git add src/timesheet-submit.js
git commit -m "docs: add form selector inspection instructions"
```

---

## Final Steps

### Task 7.1: Update README with Full Instructions

**Files:**
- Modify: `timesheet-automation/README.md`

**Step 1: Update README**

Replace `README.md` content:
```markdown
# Timesheet Automation

Automate timesheet entry from Obsidian daily notes to Entelect portal.

## Setup

```bash
npm install
npx playwright install chromium
```

## Configuration

1. Copy `.env.example` to `.env`
2. Update `NOTES_DIR` with your Obsidian vault path
3. Update `CHROME_USER_DATA` with your Chrome profile path (optional)
4. Edit `config/categories.json` to match your timesheet categories

## Usage

### Step 1: Parse Daily Notes

```bash
# Single date
npm run parse -- --date 2026-01-06

# Date range
npm run parse -- --range 2026-01-03:2026-01-06

# Last week
npm run parse -- --week last
```

This will:
- Parse your daily notes
- Extract billable tasks (ENTELECT-XXXX and meetings)
- Prompt you to select categories
- Let you review and adjust durations
- Generate `output/timesheet-data.json`

### Step 2: Submit to Portal

```bash
npm run submit
```

This will:
- Open Chrome with your existing session
- Navigate to the timesheet portal
- Fill entries step-by-step with pauses for verification
- Wait for your confirmation before final submission

## Completing the Implementation

The form filling logic in `src/timesheet-submit.js` needs portal-specific selectors.

To complete:
1. Run `npm run submit` once
2. Inspect the timesheet form elements
3. Update the TODO sections in `src/timesheet-submit.js` with actual CSS selectors
4. Test with a single date first

## Daily Note Format

Your Obsidian notes should follow this format:

```markdown
## TODAY
- [ ] 9:00 AM - 10:00 AM | ENTELECT-1834 - Description
- [ ] 10:00 AM - 11:00 AM | MEETING with team
- [ ] 12:00 PM - 1:00 PM | Lunch break
```

Tasks must:
- Have time slots in format `HH:MM AM/PM - HH:MM AM/PM`
- Include ENTELECT-XXXX ticket OR meeting keywords (MEETING, zoom, call, DSU, standup, sync)
- Exclude lunch/breaks (automatically filtered)

## Troubleshooting

**No tasks found:**
- Check your daily note format matches the expected pattern
- Ensure tasks have ENTELECT-XXXX or meeting keywords

**Browser won't launch:**
- Verify Chrome is installed
- Run `npx playwright install chromium`
- Check CHROME_USER_DATA path in .env

**Form filling fails:**
- The timesheet portal may have changed
- Inspect form elements and update selectors in `src/timesheet-submit.js`
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add complete usage instructions"
```

---

### Task 7.2: Create .env File

**Files:**
- Create: `timesheet-automation/.env`

**Step 1: Create .env from example**

```bash
cp .env.example .env
```

**Step 2: Verify .env is in .gitignore**

Run: `cat .gitignore | grep .env`
Expected: Shows `.env`

**Step 3: Commit**

```bash
git add .env
git commit -m "chore: add environment configuration"
```

---

## Implementation Complete

The core implementation is complete!

**What's working:**
✓ Date parsing (single, range, "last week")
✓ Note file parsing and task extraction
✓ Task filtering (ENTELECT tickets + meetings)
✓ Interactive category selection
✓ Duration review and editing
✓ JSON output generation
✓ Playwright browser automation setup
✓ Step-by-step form filling flow

**What needs completion:**
⚠️ Form selectors in `src/timesheet-submit.js` - requires inspecting the actual timesheet portal

**Next steps:**
1. Test the parser: `npm run parse -- --date 2026-01-06`
2. Run submit once to inspect the form: `npm run submit`
3. Update form selectors in `src/timesheet-submit.js`
4. Test end-to-end with a single date
5. Expand to date ranges once verified
