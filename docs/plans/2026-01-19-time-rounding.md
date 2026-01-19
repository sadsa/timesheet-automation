# Time Rounding Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add interactive time entry adjustment to round up under-8h days during the parse phase.

**Architecture:** Create a pure `duration-adjuster.js` module for gap calculation and distribution logic (testable). Add `promptForAdjustment()` to `review-ui.js` using inquirer checkboxes. Modify `timesheet-parser.js` to process days sequentially with adjustment prompts between summary and JSON output.

**Tech Stack:** Node.js, inquirer (already installed), chalk

---

## Task 1: Create Duration Adjuster Module (Pure Functions)

**Files:**
- Create: `src/lib/duration-adjuster.js`
- Create: `tests/duration-adjuster.test.js`

### Step 1: Write failing test for `calculateGap`

Create `tests/duration-adjuster.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { calculateGap } from '../src/lib/duration-adjuster.js';

test('calculateGap - returns hours needed to reach 8h', () => {
  const tasks = [
    { duration: 2 },
    { duration: 0.5 },
    { duration: 2.5 }
  ];
  assert.strictEqual(calculateGap(tasks), 3);
});

test('calculateGap - returns 0 when at 8h', () => {
  const tasks = [{ duration: 5 }, { duration: 3 }];
  assert.strictEqual(calculateGap(tasks), 0);
});

test('calculateGap - returns 0 when over 8h', () => {
  const tasks = [{ duration: 5 }, { duration: 4 }];
  assert.strictEqual(calculateGap(tasks), 0);
});
```

### Step 2: Run test to verify it fails

```bash
node --test tests/duration-adjuster.test.js
```

Expected: FAIL with "Cannot find module"

### Step 3: Implement `calculateGap`

Create `src/lib/duration-adjuster.js`:

```javascript
const TARGET_HOURS = 8;

export function calculateGap(tasks) {
  const total = tasks.reduce((sum, t) => sum + t.duration, 0);
  const gap = TARGET_HOURS - total;
  return gap > 0 ? gap : 0;
}
```

### Step 4: Run test to verify it passes

```bash
node --test tests/duration-adjuster.test.js
```

Expected: 3 tests PASS

### Step 5: Commit

```bash
git add src/lib/duration-adjuster.js tests/duration-adjuster.test.js
git commit -m "feat: add calculateGap function for duration adjustment"
```

---

## Task 2: Add `distributeGap` Function

**Files:**
- Modify: `src/lib/duration-adjuster.js`
- Modify: `tests/duration-adjuster.test.js`

### Step 1: Write failing test for `distributeGap`

Add to `tests/duration-adjuster.test.js`:

```javascript
import { calculateGap, distributeGap } from '../src/lib/duration-adjuster.js';

test('distributeGap - distributes evenly across selected tasks', () => {
  const tasks = [
    { duration: 2, description: 'Task A' },
    { duration: 0.5, description: 'Task B' },
    { duration: 2.5, description: 'Task C' }
  ];
  const selectedIndices = [0, 2]; // Select Task A and C
  const gap = 3; // 3h to distribute

  const result = distributeGap(tasks, selectedIndices, gap);

  assert.strictEqual(result[0].duration, 3.5); // 2 + 1.5
  assert.strictEqual(result[1].duration, 0.5); // unchanged
  assert.strictEqual(result[2].duration, 4);   // 2.5 + 1.5
});

test('distributeGap - handles single task selection', () => {
  const tasks = [
    { duration: 2, description: 'Task A' },
    { duration: 1, description: 'Task B' }
  ];
  const selectedIndices = [0];
  const gap = 5;

  const result = distributeGap(tasks, selectedIndices, gap);

  assert.strictEqual(result[0].duration, 7); // 2 + 5
  assert.strictEqual(result[1].duration, 1); // unchanged
});

test('distributeGap - returns original tasks when no selection', () => {
  const tasks = [{ duration: 2 }, { duration: 3 }];
  const result = distributeGap(tasks, [], 3);

  assert.strictEqual(result[0].duration, 2);
  assert.strictEqual(result[1].duration, 3);
});
```

### Step 2: Run test to verify it fails

```bash
node --test tests/duration-adjuster.test.js
```

Expected: FAIL - distributeGap not exported

### Step 3: Implement `distributeGap`

Add to `src/lib/duration-adjuster.js`:

```javascript
export function distributeGap(tasks, selectedIndices, gap) {
  if (selectedIndices.length === 0 || gap <= 0) {
    return tasks;
  }

  const perTask = gap / selectedIndices.length;

  return tasks.map((task, index) => {
    if (selectedIndices.includes(index)) {
      return { ...task, duration: task.duration + perTask };
    }
    return { ...task };
  });
}
```

### Step 4: Run test to verify it passes

```bash
node --test tests/duration-adjuster.test.js
```

Expected: 6 tests PASS

### Step 5: Commit

```bash
git add src/lib/duration-adjuster.js tests/duration-adjuster.test.js
git commit -m "feat: add distributeGap function to evenly distribute hours"
```

---

## Task 3: Add Remainder Handling with 0.25h Rounding

**Files:**
- Modify: `src/lib/duration-adjuster.js`
- Modify: `tests/duration-adjuster.test.js`

### Step 1: Write failing test for remainder handling

Add to `tests/duration-adjuster.test.js`:

```javascript
test('distributeGap - rounds to 0.25h and assigns remainder to first task', () => {
  const tasks = [
    { duration: 2, description: 'Task A' },
    { duration: 2, description: 'Task B' },
    { duration: 2, description: 'Task C' }
  ];
  const selectedIndices = [0, 1, 2];
  const gap = 1; // 1h / 3 = 0.333... → rounds to 0.25 each, 0.25 remainder

  const result = distributeGap(tasks, selectedIndices, gap);

  // First task gets extra remainder: 0.25 + 0.25 = 0.5
  assert.strictEqual(result[0].duration, 2.5);
  assert.strictEqual(result[1].duration, 2.25);
  assert.strictEqual(result[2].duration, 2.25);

  // Total should still equal 8h
  const total = result.reduce((sum, t) => sum + t.duration, 0);
  assert.strictEqual(total, 7); // 6 original + 1 gap
});

test('distributeGap - handles exact division without remainder', () => {
  const tasks = [
    { duration: 3, description: 'Task A' },
    { duration: 3, description: 'Task B' }
  ];
  const selectedIndices = [0, 1];
  const gap = 2; // 2h / 2 = 1h each, no remainder

  const result = distributeGap(tasks, selectedIndices, gap);

  assert.strictEqual(result[0].duration, 4);
  assert.strictEqual(result[1].duration, 4);
});
```

### Step 2: Run test to verify it fails

```bash
node --test tests/duration-adjuster.test.js
```

Expected: FAIL - first task gets 2.333... not 2.5

### Step 3: Update `distributeGap` with rounding logic

Replace `distributeGap` in `src/lib/duration-adjuster.js`:

```javascript
export function distributeGap(tasks, selectedIndices, gap) {
  if (selectedIndices.length === 0 || gap <= 0) {
    return tasks;
  }

  const rawPerTask = gap / selectedIndices.length;
  const roundedPerTask = Math.floor(rawPerTask * 4) / 4; // Round down to 0.25
  const distributed = roundedPerTask * selectedIndices.length;
  const remainder = gap - distributed;

  return tasks.map((task, index) => {
    if (!selectedIndices.includes(index)) {
      return { ...task };
    }

    // First selected task gets the remainder
    const isFirstSelected = index === selectedIndices[0];
    const addition = isFirstSelected ? roundedPerTask + remainder : roundedPerTask;

    return { ...task, duration: task.duration + addition };
  });
}
```

### Step 4: Run test to verify it passes

```bash
node --test tests/duration-adjuster.test.js
```

Expected: 8 tests PASS

### Step 5: Commit

```bash
git add src/lib/duration-adjuster.js tests/duration-adjuster.test.js
git commit -m "feat: add 0.25h rounding with remainder to first task"
```

---

## Task 4: Add `calculateTotal` Helper

**Files:**
- Modify: `src/lib/duration-adjuster.js`
- Modify: `tests/duration-adjuster.test.js`

### Step 1: Write failing test

Add to `tests/duration-adjuster.test.js`:

```javascript
import { calculateGap, distributeGap, calculateTotal } from '../src/lib/duration-adjuster.js';

test('calculateTotal - sums task durations', () => {
  const tasks = [{ duration: 2 }, { duration: 0.5 }, { duration: 3 }];
  assert.strictEqual(calculateTotal(tasks), 5.5);
});

test('calculateTotal - returns 0 for empty array', () => {
  assert.strictEqual(calculateTotal([]), 0);
});
```

### Step 2: Run test to verify it fails

```bash
node --test tests/duration-adjuster.test.js
```

Expected: FAIL - calculateTotal not exported

### Step 3: Implement `calculateTotal`

Add to `src/lib/duration-adjuster.js`:

```javascript
export function calculateTotal(tasks) {
  return tasks.reduce((sum, t) => sum + t.duration, 0);
}
```

### Step 4: Run test to verify it passes

```bash
node --test tests/duration-adjuster.test.js
```

Expected: 10 tests PASS

### Step 5: Commit

```bash
git add src/lib/duration-adjuster.js tests/duration-adjuster.test.js
git commit -m "feat: add calculateTotal helper function"
```

---

## Task 5: Add Interactive Prompt to review-ui.js

**Files:**
- Modify: `src/lib/review-ui.js`

### Step 1: Add imports and `promptForAdjustment` function

Update `src/lib/review-ui.js`:

```javascript
import chalk from 'chalk';
import checkbox from '@inquirer/checkbox';
import { calculateGap, distributeGap, calculateTotal } from './duration-adjuster.js';

export function displayDurationSummary(tasks, date) {
  console.log(chalk.yellow(`\n=== ${date} ===`));

  // Group by project, then category
  const byProject = {};
  tasks.forEach(task => {
    if (!byProject[task.project]) byProject[task.project] = {};
    if (!byProject[task.project][task.category]) byProject[task.project][task.category] = [];
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

  return total;
}

export async function promptForAdjustment(tasks, date) {
  const total = calculateTotal(tasks);
  const gap = calculateGap(tasks);

  // Skip if already at or over 8h
  if (gap === 0) {
    return tasks;
  }

  console.log(chalk.yellow(`\n${gap}h to distribute to reach 8h`));

  const choices = tasks.map((task, index) => {
    const ticketOrType = task.ticket || `[${task.type}]`;
    const preview = task.duration + gap; // Preview if only this task selected
    return {
      name: `${ticketOrType} - ${task.description.substring(0, 40)}... (${task.duration}h → ${preview}h)`,
      value: index
    };
  });

  try {
    const selectedIndices = await checkbox({
      message: `Select tasks to round up (q to skip):`,
      choices,
      instructions: false
    });

    if (selectedIndices.length === 0) {
      console.log(chalk.gray('Skipped adjustment'));
      return tasks;
    }

    const adjustedTasks = distributeGap(tasks, selectedIndices, gap);

    // Show adjusted summary
    console.log(chalk.green('\n--- Adjusted ---'));
    displayDurationSummary(adjustedTasks, date);

    return adjustedTasks;

  } catch (error) {
    // User pressed q or Ctrl+C
    if (error.message?.includes('User force closed')) {
      console.log(chalk.gray('\nSkipped adjustment'));
      return tasks;
    }
    throw error;
  }
}
```

### Step 2: Install @inquirer/checkbox

```bash
npm install @inquirer/checkbox
```

### Step 3: Manual test

```bash
npm run parse -- --date 2026-01-14
```

Verify: Prompt appears if under 8h, can select tasks, shows adjusted summary.

### Step 4: Commit

```bash
git add src/lib/review-ui.js package.json package-lock.json
git commit -m "feat: add interactive promptForAdjustment with checkbox UI"
```

---

## Task 6: Update timesheet-parser.js for Per-Day Processing

**Files:**
- Modify: `src/timesheet-parser.js`

### Step 1: Update imports

Add to imports in `src/timesheet-parser.js`:

```javascript
import { displayDurationSummary, promptForAdjustment } from './lib/review-ui.js';
```

### Step 2: Refactor main loop for per-day processing

Replace the main function in `src/timesheet-parser.js`:

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

  // Process each day sequentially with adjustment
  for (const date of dates) {
    const filePath = path.join(notesDir, `${date}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const tasks = await parseNoteFile(content);
      let billableTasks = filterBillableTasks(tasks);

      if (billableTasks.length === 0) {
        console.log(chalk.yellow(`Warning: No billable tasks found for ${date}`));
        continue;
      }

      // Add date to each task
      billableTasks.forEach(task => {
        task.date = date;
      });

      // Validate tasks have project and category
      const missingData = billableTasks.filter(task => !task.project || !task.category);
      if (missingData.length > 0) {
        console.error(chalk.red(`\nError: Tasks missing Project or Category for ${date}:`));
        missingData.forEach(task => {
          console.error(chalk.yellow(`  ${task.description.substring(0, 50)}...`));
        });
        console.error(chalk.gray('Format: - [ ] TIME - TIME | Project | Category | Ticket | Description'));
        process.exit(1);
      }

      // Display summary
      console.log(chalk.blue(`\n--- Duration Summary ---`));
      displayDurationSummary(billableTasks, date);

      // Interactive adjustment (skips if >= 8h)
      billableTasks = await promptForAdjustment(billableTasks, date);

      allTasks.push(...billableTasks);

      console.log(chalk.green(`\n✓ Processed ${date}`));

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow(`Warning: No daily note found for ${date}, skipping...`));
      } else {
        console.error(chalk.red(`Error parsing ${date}:`), error.message);
        throw error;
      }
    }
  }

  if (allTasks.length === 0) {
    console.log(chalk.red('No billable tasks found in any dates.'));
    process.exit(0);
  }

  // Generate output
  const outputPath = 'output/timesheet-data.json';
  await fs.mkdir('output', { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(allTasks, null, 2));

  console.log(chalk.green(`\n✓ Timesheet data saved to ${outputPath}`));
  console.log(chalk.blue('\nRun: npm run submit'));
}
```

### Step 3: Manual test with single date

```bash
npm run parse -- --date 2026-01-14
```

Verify: Summary shown, prompt appears if under 8h, adjusted tasks saved.

### Step 4: Manual test with date range

```bash
npm run parse -- --range 2026-01-13:2026-01-14
```

Verify: Each day processed sequentially with its own adjustment prompt.

### Step 5: Commit

```bash
git add src/timesheet-parser.js
git commit -m "feat: add per-day interactive time adjustment to parse flow"
```

---

## Task 7: Update Dynamic Preview in Selection UI

**Files:**
- Modify: `src/lib/review-ui.js`

### Step 1: Enhance checkbox to show even distribution preview

The current implementation shows preview assuming only that task is selected. Update to show actual distributed value. This requires a custom render or using inquirer's theme/transformer.

For simplicity, update the choice name to show the base addition:

```javascript
export async function promptForAdjustment(tasks, date) {
  const total = calculateTotal(tasks);
  const gap = calculateGap(tasks);

  if (gap === 0) {
    return tasks;
  }

  console.log(chalk.yellow(`\n${gap}h to distribute to reach 8h`));
  console.log(chalk.gray('(Time added per task depends on number selected)\n'));

  const choices = tasks.map((task, index) => {
    const ticketOrType = task.ticket || `[${task.type}]`;
    return {
      name: `${ticketOrType} - ${task.description.substring(0, 40)}... (${task.duration}h)`,
      value: index
    };
  });

  try {
    const selectedIndices = await checkbox({
      message: `Select tasks to round up (${gap}h to distribute):`,
      choices,
      instructions: false
    });

    if (selectedIndices.length === 0) {
      console.log(chalk.gray('Skipped adjustment'));
      return tasks;
    }

    const adjustedTasks = distributeGap(tasks, selectedIndices, gap);
    const perTask = gap / selectedIndices.length;

    console.log(chalk.green(`\n+${perTask.toFixed(2)}h added to ${selectedIndices.length} task(s)`));
    console.log(chalk.green('\n--- Adjusted Summary ---'));
    displayDurationSummary(adjustedTasks, date);

    return adjustedTasks;

  } catch (error) {
    if (error.message?.includes('User force closed') || error.name === 'ExitPromptError') {
      console.log(chalk.gray('\nSkipped adjustment'));
      return tasks;
    }
    throw error;
  }
}
```

### Step 2: Manual test

```bash
npm run parse -- --date 2026-01-14
```

Verify: Shows hours being distributed and adjusted summary.

### Step 3: Commit

```bash
git add src/lib/review-ui.js
git commit -m "feat: improve adjustment UI feedback with distribution info"
```

---

## Task 8: Run Full Test Suite and Final Verification

### Step 1: Run all tests

```bash
npm test
```

Expected: 22+ tests passing (plus new duration-adjuster tests)

### Step 2: Manual end-to-end test

```bash
# Single date under 8h
npm run parse -- --date 2026-01-14

# Date range
npm run parse -- --range 2026-01-13:2026-01-15

# Verify output
cat output/timesheet-data.json
```

### Step 3: Final commit if any cleanup needed

```bash
git status
# If clean, done. Otherwise commit any remaining changes.
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Create `calculateGap` | 3 |
| 2 | Add `distributeGap` | 3 |
| 3 | Add remainder rounding | 2 |
| 4 | Add `calculateTotal` | 2 |
| 5 | Add interactive prompt | manual |
| 6 | Update parser flow | manual |
| 7 | Improve UI feedback | manual |
| 8 | Final verification | all |

**Total new unit tests:** 10
**Commits:** 7-8 atomic commits
