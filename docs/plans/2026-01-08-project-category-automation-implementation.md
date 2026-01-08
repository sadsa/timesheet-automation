# Project and Category Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate manual Project selection by embedding explicit Project and Category assignments in Obsidian notes, fully automating timesheet submission.

**Architecture:** Replace single-delimiter note format with pipe-delimited format supporting Project and Category. Add validation against config file. Remove interactive prompts. Automate Project selection in browser.

**Tech Stack:** Node.js, Playwright, date-fns, chalk, inquirer (minimal usage), node:test

---

## Phase 1: Config & Parser Foundation

### Task 1: Create Projects-Categories Config

**Files:**
- Create: `config/projects-categories.json`

**Step 1: Create the config file**

```bash
mkdir -p config
```

```json
{
  "R - Canva - Agile Team": [
    "Meetings",
    "Hubspot Data App Software Dev",
    "Hubspot Data App Analysis",
    "Hubspot Data App Dev Support",
    "Salesforce Data App Analysis",
    "Other"
  ],
  "Meetings and Reviews (NZ)": [
    "Client Interview",
    "Client Interview Preparation",
    "Entelect Knowledge Sharing Meeting",
    "New Employee Induction",
    "One On One Attendance",
    "Other"
  ],
  "Social Events (NZ)": [
    "Social Club Attendance",
    "Team Building Attendance",
    "Team Lunch Attendance",
    "Company Function Attendance",
    "Community Contribution"
  ],
  "Training (NZ)": [
    "Training Attendance",
    "Training Preparation",
    "Training Presentation",
    "Beer & Tech Attendance",
    "Beer & Tech Presentation",
    "Other"
  ]
}
```

**Step 2: Commit**

```bash
git add config/projects-categories.json
git commit -m "feat: add projects-categories config"
```

---

### Task 2: Add Config Validation Tests

**Files:**
- Create: `tests/config-validator.test.js`

**Step 1: Write test for valid JSON structure**

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';

test('projects-categories.json is valid JSON', async () => {
  const data = await fs.readFile('config/projects-categories.json', 'utf-8');
  const config = JSON.parse(data); // Should not throw
  assert.ok(config);
});
```

**Step 2: Run test to verify it passes**

Run: `node --test tests/config-validator.test.js`
Expected: PASS

**Step 3: Write test for non-empty categories**

```javascript
test('all projects have non-empty category arrays', async () => {
  const data = await fs.readFile('config/projects-categories.json', 'utf-8');
  const config = JSON.parse(data);

  for (const [project, categories] of Object.entries(config)) {
    assert.ok(Array.isArray(categories), `${project} categories must be an array`);
    assert.ok(categories.length > 0, `${project} must have at least one category`);
  }
});
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/config-validator.test.js`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add tests/config-validator.test.js
git commit -m "test: add config validation tests"
```

---

### Task 3: Update Note Parser - Add Pipe Parsing (TDD)

**Files:**
- Modify: `src/lib/note-parser.js`
- Modify: `tests/note-parser.test.js`

**Step 1: Write failing test for pipe-delimited format**

Add to `tests/note-parser.test.js`:

```javascript
test('parseNoteFile - parse pipe-delimited format with project and category', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Hubspot Data App Software Dev | ENTELECT-1834 | Test Harness`;

  const result = parseNoteFile(content);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].project, 'R - Canva - Agile Team');
  assert.strictEqual(result[0].category, 'Hubspot Data App Software Dev');
  assert.strictEqual(result[0].ticket, 'ENTELECT-1834');
  assert.strictEqual(result[0].description, 'Test Harness');
  assert.strictEqual(result[0].duration, 1.0);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/note-parser.test.js`
Expected: FAIL with "project is undefined" or similar

**Step 3: Update regex and parsing logic**

In `src/lib/note-parser.js`, update the `parseNoteFile` function:

```javascript
export function parseNoteFile(content) {
  const lines = content.split('\n');
  // Updated regex to capture everything after times up to first pipe
  const taskRegex = /- \[ \] (\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M) \| (.+)/;

  const tasks = [];
  for (const line of lines) {
    const match = line.match(taskRegex);
    if (match) {
      const start = match[1];
      const end = match[2];
      const remainder = match[3]; // Everything after the first pipe

      // Split by pipe delimiter
      const parts = remainder.split('|').map(p => p.trim());

      // parts[0] = Project OR old-format description
      // parts[1] = Category (if new format)
      // parts[2] = Ticket OR Description
      // parts[3] = Description (if ticket present)

      let project, category, ticket, description;

      // Detect format: if we have at least 3 parts, it's new format
      if (parts.length >= 3) {
        // New pipe-delimited format
        project = parts[0];
        category = parts[1];

        // Check if parts[2] is a ticket
        const ticketPattern = /^ENTELECT-\d+$/;
        const hasTicket = ticketPattern.test(parts[2]);

        if (hasTicket) {
          ticket = parts[2];
          description = parts[3] || '';
        } else {
          ticket = null;
          description = parts[2];
        }
      } else {
        // Old format: just description after first pipe
        project = null;
        category = null;
        description = parts[0];
        ticket = extractTicket(description);
      }

      tasks.push({
        start,
        end,
        duration: calculateDuration(start, end),
        description,
        ticket,
        project,
        category,
        type: ticket ? 'ticket' : 'other'
      });
    }
  }

  return tasks;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/note-parser.test.js`
Expected: PASS (new test passes, old tests still pass)

**Step 5: Commit**

```bash
git add src/lib/note-parser.js tests/note-parser.test.js
git commit -m "feat: parse pipe-delimited project and category"
```

---

### Task 4: Add Note Parser Validation (TDD)

**Files:**
- Modify: `src/lib/note-parser.js`
- Modify: `tests/note-parser.test.js`

**Step 1: Write failing test for missing project validation**

Add to `tests/note-parser.test.js`:

```javascript
test('parseNoteFile - throws error for missing project in new format', () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | | Hubspot Data App Software Dev | ENTELECT-1234 | Test`;

  assert.throws(
    () => parseNoteFile(content),
    /Invalid format.*project required/i
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/note-parser.test.js`
Expected: FAIL (no error thrown yet)

**Step 3: Add validation helper function**

Add to `src/lib/note-parser.js` before `parseNoteFile`:

```javascript
async function loadProjectsCategories() {
  try {
    const data = await fs.readFile('config/projects-categories.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null; // Allow old format to work if config missing
  }
}

function validateTask(task, projectsCategories, lineNumber) {
  // Only validate if new format (has project/category)
  if (!task.project && !task.category) {
    return; // Old format, skip validation
  }

  // New format validations
  if (!task.project || task.project.trim() === '') {
    throw new Error(`Line ${lineNumber}: Invalid format - Project required in new format`);
  }

  if (!task.category || task.category.trim() === '') {
    throw new Error(`Line ${lineNumber}: Invalid format - Category required in new format`);
  }

  if (!task.description || task.description.trim() === '') {
    throw new Error(`Line ${lineNumber}: Invalid format - Description required`);
  }

  // Validate against config if available
  if (projectsCategories) {
    if (!projectsCategories[task.project]) {
      throw new Error(
        `Line ${lineNumber}: Unknown project "${task.project}". Check config/projects-categories.json for valid projects.`
      );
    }

    if (!projectsCategories[task.project].includes(task.category)) {
      throw new Error(
        `Line ${lineNumber}: Category "${task.category}" not valid for project "${task.project}". Check config/projects-categories.json.`
      );
    }
  }
}
```

**Step 4: Update parseNoteFile to be async and validate**

```javascript
import fs from 'fs/promises';

export async function parseNoteFile(content) {
  const lines = content.split('\n');
  const taskRegex = /- \[ \] (\d{1,2}:\d{2} [AP]M) - (\d{1,2}:\d{2} [AP]M) \| (.+)/;

  const projectsCategories = await loadProjectsCategories();
  const tasks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(taskRegex);
    if (match) {
      const start = match[1];
      const end = match[2];
      const remainder = match[3];

      const parts = remainder.split('|').map(p => p.trim());

      let project, category, ticket, description;

      if (parts.length >= 3) {
        // New pipe-delimited format
        project = parts[0];
        category = parts[1];

        const ticketPattern = /^ENTELECT-\d+$/;
        const hasTicket = ticketPattern.test(parts[2]);

        if (hasTicket) {
          ticket = parts[2];
          description = parts[3] || '';
        } else {
          ticket = null;
          description = parts[2];
        }
      } else {
        // Old format
        project = null;
        category = null;
        description = parts[0];
        ticket = extractTicket(description);
      }

      const task = {
        start,
        end,
        duration: calculateDuration(start, end),
        description,
        ticket,
        project,
        category,
        type: ticket ? 'ticket' : 'other'
      };

      // Validate task
      validateTask(task, projectsCategories, i + 1);

      tasks.push(task);
    }
  }

  return tasks;
}
```

**Step 5: Update tests to use async/await**

Update all test functions in `tests/note-parser.test.js` to be async:

```javascript
test('parseNoteFile - extract task lines from markdown', async () => {
  const content = `## TODAY
- [ ] 9:00 AM - 10:00 AM | ENTELECT-1834 - Test Harness
- [ ] 10:00 AM - 11:00 AM | Fix POC build
- [ ] 12:00 PM - 1:00 PM | Lunch break`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].description, 'ENTELECT-1834 - Test Harness');
});

// Update all other tests similarly...
```

**Step 6: Run tests to verify they pass**

Run: `node --test tests/note-parser.test.js`
Expected: PASS (all tests including validation test)

**Step 7: Add more validation tests**

Add to `tests/note-parser.test.js`:

```javascript
test('parseNoteFile - throws error for unknown project', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | Unknown Project | Some Category | ENTELECT-1234 | Test`;

  await assert.rejects(
    async () => await parseNoteFile(content),
    /Unknown project "Unknown Project"/
  );
});

test('parseNoteFile - throws error for invalid category', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Invalid Category | ENTELECT-1234 | Test`;

  await assert.rejects(
    async () => await parseNoteFile(content),
    /Category "Invalid Category" not valid/
  );
});

test('parseNoteFile - allows old format without validation errors', async () => {
  const content = `- [ ] 9:00 AM - 10:00 AM | ENTELECT-1834 - Test Harness`;

  const result = await parseNoteFile(content);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].project, null);
  assert.strictEqual(result[0].category, null);
});
```

**Step 8: Run tests to verify all pass**

Run: `node --test tests/note-parser.test.js`
Expected: PASS (all validation tests)

**Step 9: Commit**

```bash
git add src/lib/note-parser.js tests/note-parser.test.js
git commit -m "feat: add validation for project and category"
```

---

### Task 5: Update Main Parser to Handle Async

**Files:**
- Modify: `src/timesheet-parser.js`

**Step 1: Update parseNoteFile call to await**

In `src/timesheet-parser.js`, update the loop at line 40-61:

```javascript
for (const date of dates) {
  const filePath = path.join(notesDir, `${date}.md`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const tasks = await parseNoteFile(content); // Add await here
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
    if (error.code === 'ENOENT') {
      console.log(chalk.yellow(`Warning: No daily note found for ${date}, skipping...`));
    } else {
      // Re-throw validation errors with context
      console.error(chalk.red(`Error parsing ${date}:`), error.message);
      throw error;
    }
  }
}
```

**Step 2: Test manually with a test note**

Create a test note file and run the parser to ensure async works.

**Step 3: Commit**

```bash
git add src/timesheet-parser.js
git commit -m "fix: handle async parseNoteFile"
```

---

## Phase 2: Review UI Simplification

### Task 6: Remove Interactive Category Selection

**Files:**
- Modify: `src/timesheet-parser.js`
- Modify: `src/lib/review-ui.js`

**Step 1: Remove category selection loop**

In `src/timesheet-parser.js`, remove lines 71-78:

```javascript
// DELETE THIS SECTION:
// Category selection
console.log(chalk.blue('\n--- Category Selection ---'));
const categories = await loadCategories();

for (const task of allTasks) {
  task.category = await promptForCategory(task, categories);
}

console.log(chalk.green('\n✓ All tasks categorized'));
```

**Step 2: Add validation that all tasks have categories**

Replace the deleted section with:

```javascript
// Validate all tasks have project and category
console.log(chalk.blue('\n--- Validating Task Data ---'));

const missingData = allTasks.filter(task => !task.project || !task.category);

if (missingData.length > 0) {
  console.error(chalk.red('\nError: Some tasks are missing Project or Category:'));
  missingData.forEach(task => {
    console.error(chalk.yellow(`  ${task.date}: ${task.description.substring(0, 50)}...`));
  });
  console.error(chalk.red('\nPlease update your notes to include Project and Category in pipe-delimited format.'));
  console.error(chalk.gray('Format: - [ ] TIME - TIME | Project | Category | Ticket | Description'));
  process.exit(1);
}

console.log(chalk.green(`✓ All ${allTasks.length} tasks have Project and Category`));
```

**Step 3: Remove duration editing from the loop**

In `src/timesheet-parser.js`, replace the duration review section (lines 82-116) with:

```javascript
// Duration review (read-only)
console.log(chalk.blue('\n--- Duration Summary ---'));

const tasksByDate = {};
allTasks.forEach(task => {
  if (!tasksByDate[task.date]) {
    tasksByDate[task.date] = [];
  }
  tasksByDate[task.date].push(task);
});

for (const date of Object.keys(tasksByDate)) {
  displayDurationSummary(tasksByDate[date], date);
}

console.log(chalk.gray('\nNote: To adjust durations, edit your daily notes and re-run the parser.'));
```

**Step 4: Update review-ui.js to display Project grouping**

In `src/lib/review-ui.js`, update `displayDurationSummary`:

```javascript
export function displayDurationSummary(tasks, date) {
  console.log(chalk.yellow(`\n=== ${date} ===`));

  // Group by project, then category
  const byProject = {};
  tasks.forEach(task => {
    if (!byProject[task.project]) {
      byProject[task.project] = {};
    }
    if (!byProject[task.project][task.category]) {
      byProject[task.project][task.category] = [];
    }
    byProject[task.project][task.category].push(task);
  });

  let total = 0;

  for (const [project, categories] of Object.entries(byProject)) {
    console.log(chalk.cyan(`\n${project}`));

    for (const [category, categoryTasks] of Object.entries(categories)) {
      console.log(chalk.blue(`  ${category}`));

      categoryTasks.forEach(task => {
        const ticketOrType = task.ticket || `[${task.type}]`;
        console.log(chalk.gray(`    ✓ ${ticketOrType} - ${task.description.substring(0, 60)}... (${task.duration}h)`));
        total += task.duration;
      });
    }
  }

  const warning = total !== 8 ? chalk.red(' ⚠️  (Expected: 8h)') : chalk.green(' ✓');
  console.log(chalk.bold(`\nTotal: ${total}h${warning}`));
}
```

**Step 5: Remove unused functions**

In `src/lib/review-ui.js`, delete these functions (they're no longer used):
- `loadCategories()`
- `saveCategories()`
- `promptForCategory()`
- `promptDurationAction()`
- `editTaskDuration()`

**Step 6: Remove unused import**

Update import in `src/timesheet-parser.js`:

```javascript
import { displayDurationSummary } from './lib/review-ui.js';
```

**Step 7: Run the parser manually to test**

Create a test note with new format and verify the output displays correctly.

**Step 8: Commit**

```bash
git add src/timesheet-parser.js src/lib/review-ui.js
git commit -m "feat: remove interactive prompts, show read-only summary"
```

---

## Phase 3: Browser Automation

### Task 7: Add Project Auto-Selection

**Files:**
- Modify: `src/timesheet-submit.js`

**Step 1: Remove manual project selection prompt**

In `src/timesheet-submit.js`, delete lines 82-85:

```javascript
// DELETE THIS:
console.log(chalk.yellow('\n⚠️  IMPORTANT: Before continuing, manually select your Project in the browser.'));
console.log(chalk.gray('   (The script will handle Category selection automatically)\n'));

await waitForEnter('Once you\'ve selected the Project, press Enter to start automation...');
```

**Step 2: Add project tracking variables**

In `src/timesheet-submit.js`, update line 99-100:

```javascript
// Track currently selected project and category to avoid unnecessary clicks
let currentProject = null;
let currentCategory = null;
```

**Step 3: Add project selection logic**

In `src/timesheet-submit.js`, add project selection before category selection (around line 108):

```javascript
for (const task of tasksByDate[date]) {
  console.log(chalk.blue(`\n→ Filling: ${date} | ${task.project} | ${task.category} | ${task.ticket || task.type} | ${task.duration}h`));
  console.log(chalk.gray(`  ${task.description}`));

  try {
    // Step 1: Select project if different from current
    if (currentProject !== task.project) {
      console.log(chalk.gray(`  Selecting project: ${task.project}...`));

      // Click the project button by text content
      const projectButton = page.locator('.timesheetlistitem', { hasText: task.project });

      if (await projectButton.count() === 0) {
        console.log(chalk.red(`  ✗ Could not find project: ${task.project}`));
        await waitForEnter('Press Enter to continue or Ctrl+C to abort...');
        continue;
      }

      await projectButton.click();
      currentProject = task.project;
      currentCategory = null; // Reset category when project changes
      await page.waitForTimeout(500); // Wait for categories to load
    }

    // Step 2: Select category if different from current
    if (currentCategory !== task.category) {
      // ... existing category selection code ...
```

**Step 4: Update log message**

Change line 87 to:

```javascript
console.log(chalk.green('\n✓ Starting automated form fill'));
```

**Step 5: Test manually with browser**

Run `npm run submit` with test data to verify project auto-selection works.

**Step 6: Commit**

```bash
git add src/timesheet-submit.js
git commit -m "feat: automate project selection in browser"
```

---

## Phase 4: Documentation & Cleanup

### Task 8: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update note format section**

Find the "Task Format" section and update it:

```markdown
### Task Format

Obsidian daily notes must contain tasks in this exact format:

**New format (required):**
```
- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Hubspot Data App Software Dev | ENTELECT-1234 | Description
      └──────┬──────────┘   └─────────────┬─────────────┘ └────────────────┬─────────────────┘ └────┬────┘   └─────┬─────┘
      Start/End times              Project                        Category                    Ticket (optional)  Description
```

**Without ticket:**
```
- [ ] 9:00 AM - 10:00 AM | Meetings and Reviews (NZ) | One On One Attendance | Weekly 1:1 with manager
```

**Format rules:**
- Pipe `|` separates sections
- Sections: `Times | Project | Category | Ticket | Description`
- Ticket is optional (must match `ENTELECT-\d+` pattern)
- Project and Category are validated against `config/projects-categories.json`

Tasks are parsed into objects with:
- `start`, `end`, `duration` (calculated in hours)
- `project` (exact portal name, validated)
- `category` (exact portal name, validated against project)
- `description`, `ticket` (extracted from ENTELECT-XXXX pattern, optional)
- `type` (ticket/meeting/other)
- `date` (YYYY-MM-DD)
```

**Step 2: Update workflow description**

Update the data flow section:

```markdown
### Data Flow

1. **Obsidian notes** (markdown files) → `note-parser.js` → Task objects with Project, Category, times
2. **Task objects** → Validation against `config/projects-categories.json` → Fail fast if invalid
3. **Validated tasks** → `review-ui.js` → Read-only summary grouped by Project → Category
4. **Validated tasks** → `output/timesheet-data.json` → Structured JSON output
5. **JSON output** → `timesheet-submit.js` → Playwright automation fills portal form (fully automated)
```

**Step 3: Update environment variables section**

Update the "Environment Variables" section to reference the new config:

```markdown
## Environment Variables

Configure via `.env` file (see `.env.example`):
- `NOTES_DIR`: Path to Obsidian vault (default: `/Users/entelect-jbiddick/Documents/Personal`)
- `CHROME_USER_DATA`: Path to Chrome user data directory for session reuse

## Configuration

- `config/projects-categories.json`: Maps Projects to their valid Categories (validates note entries)
```

**Step 4: Remove references to interactive selection**

Remove this bullet from "Filtering Logic" or "Interactive Review" sections:
- ~~Category assignment: User selects category for each task~~

Update to:
- Category assignment: Specified explicitly in note entries, validated against config

**Step 5: Update browser automation description**

Update the "Browser Automation" section:

```markdown
### Browser Automation (timesheet-submit.js)

**COMPLETE**: Fully automates timesheet form filling using Playwright. The script:
1. Opens the Entelect portal and waits for login (one-time)
2. For each task:
   - Auto-selects the Project (from task data)
   - Auto-selects the Category (from task data)
   - Opens the time entry form for the specific date
   - Fills in: Ticket #, Description, Time (in "Xh" or "XhYY" format)
   - Sets "Worked From" to "Home" by default
   - Saves the entry

**No manual intervention required** - Project and Category are both automated.
```

**Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update for automated project/category selection"
```

---

### Task 9: Remove Old Config File

**Files:**
- Remove: `config/categories.json`

**Step 1: Verify new config is working**

Run the full workflow once to ensure `projects-categories.json` is being used correctly.

**Step 2: Remove old config**

```bash
git rm config/categories.json
```

**Step 3: Commit**

```bash
git commit -m "chore: remove obsolete categories.json config"
```

---

### Task 10: Add Example Note to Documentation

**Files:**
- Create: `docs/examples/daily-note-example.md`

**Step 1: Create examples directory**

```bash
mkdir -p docs/examples
```

**Step 2: Create example note**

```markdown
# 2026-01-08

## TODAY

### Work Tasks

- [ ] 9:00 AM - 11:00 AM | R - Canva - Agile Team | Hubspot Data App Software Dev | ENTELECT-1834 | Test Harness for e2e tests
- [ ] 11:00 AM - 11:30 AM | R - Canva - Agile Team | Meetings | DSU Standup
- [ ] 11:30 AM - 12:00 PM | Meetings and Reviews (NZ) | One On One Attendance | Weekly 1:1 with manager
- [ ] 1:00 PM - 3:00 PM | R - Canva - Agile Team | Hubspot Data App Software Dev | ENTELECT-1842 | Fix POC build
- [ ] 3:00 PM - 4:30 PM | R - Canva - Agile Team | Salesforce Data App Analysis | ENTELECT-1851 | Investigate data sync issues
- [ ] 4:30 PM - 5:00 PM | Training (NZ) | Beer & Tech Attendance | Monthly Beer & Tech session

### Personal

- [ ] 12:00 PM - 1:00 PM | Lunch break (not tracked)
- [ ] Evening: Gym
```

**Step 3: Commit**

```bash
git add docs/examples/daily-note-example.md
git commit -m "docs: add example daily note with new format"
```

---

## Verification & Testing

### Task 11: End-to-End Manual Verification

**Steps to verify the complete workflow:**

**Step 1: Create a test daily note**

Create a file at `$NOTES_DIR/2026-01-08.md` with the example format:

```markdown
## TODAY

- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Hubspot Data App Software Dev | ENTELECT-1234 | Test task one
- [ ] 10:00 AM - 11:00 AM | Meetings and Reviews (NZ) | One On One Attendance | Weekly meeting
- [ ] 11:00 AM - 12:00 PM | R - Canva - Agile Team | Meetings | Team standup
```

**Step 2: Run the parser**

```bash
npm run parse -- --date 2026-01-08
```

Expected output:
- ✓ Validates all tasks
- ✓ Displays grouped summary by Project → Category
- ✓ Shows 3 tasks, 3h total with warning
- ✓ Writes to `output/timesheet-data.json`

**Step 3: Verify JSON output**

```bash
cat output/timesheet-data.json
```

Expected: Each task has `project` and `category` fields

**Step 4: Test validation with invalid data**

Create a note with invalid project:

```markdown
- [ ] 9:00 AM - 10:00 AM | Invalid Project | Some Category | Test task
```

Run parser - Expected: Error message with line number and helpful hint

**Step 5: Test browser automation (if portal available)**

```bash
npm run submit
```

Expected:
- ✓ Launches browser
- ✓ No manual project selection prompt
- ✓ Auto-selects projects
- ✓ Auto-selects categories
- ✓ Fills forms
- ✓ Saves entries

**Step 6: Document test results**

Create verification report:

```bash
echo "# Verification Report - $(date)" > docs/verification-report.md
echo "" >> docs/verification-report.md
echo "## Tests Passed" >> docs/verification-report.md
echo "- [ ] Parse with valid new format" >> docs/verification-report.md
echo "- [ ] Validation rejects invalid project" >> docs/verification-report.md
echo "- [ ] Validation rejects invalid category" >> docs/verification-report.md
echo "- [ ] Summary displays Project → Category hierarchy" >> docs/verification-report.md
echo "- [ ] Browser automation auto-selects projects" >> docs/verification-report.md
echo "- [ ] Browser automation auto-selects categories" >> docs/verification-report.md
echo "- [ ] End-to-end workflow completes without manual intervention" >> docs/verification-report.md
```

**Step 7: Final commit**

```bash
git add -A
git commit -m "test: verify end-to-end automation workflow"
```

---

## Summary

**Total tasks:** 11 tasks across 4 phases

**Estimated time:** 2-3 hours for complete implementation and testing

**Key achievements:**
- ✅ Pipe-delimited note format with Project and Category
- ✅ Validation against config file with helpful error messages
- ✅ Removed all interactive prompts
- ✅ Fully automated browser submission (no manual steps)
- ✅ Read-only summary grouped by Project → Category
- ✅ Comprehensive tests and documentation

**Next steps after implementation:**
1. Use @superpowers:finishing-a-development-branch to review and merge
2. Update your Obsidian notes to use the new format
3. Enjoy fully automated timesheet submissions!
