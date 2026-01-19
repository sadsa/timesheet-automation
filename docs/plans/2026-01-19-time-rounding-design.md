# Time Rounding Feature Design

## Overview

Add interactive time entry adjustment to round up under-8h days during the parse phase. Users can select which tasks receive additional time, with the gap distributed evenly across selected tasks.

## Flow

```
npm run parse -- --date 2026-01-14
npm run parse -- --range 2026-01-13:2026-01-15
npm run parse -- --week last
```

All commands follow the same per-day loop:

```
Parse day → Summary → [Interactive adjustment if < 8h] → Adjusted summary → Next day
```

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  npm run parse -- --range 2026-01-13:2026-01-15                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Parse day 1 (2026-01-13)     │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Display summary              │
              │  Total: 5h ⚠️ (Expected: 8h)  │
              └───────────────────────────────┘
                              │
                      total < 8h?
                      ╱           ╲
                   yes             no
                    │               │
                    ▼               │
    ┌─────────────────────────────┐ │
    │  Interactive selection      │ │
    │  [x] Task 1 (2h)            │ │
    │  [ ] Task 2 (0.5h)          │ │
    │  [x] Task 3 (1.5h)          │ │
    │                             │ │
    │  Gap: 3h → +1.5h each       │ │
    │  (q to skip)                │ │
    └─────────────────────────────┘ │
                    │               │
                    ▼               │
    ┌─────────────────────────────┐ │
    │  Display adjusted summary   │ │
    │  Total: 8h ✓                │◄┘
    └─────────────────────────────┘
                    │
                    ▼
           Continue to day 2...
```

## Interactive Selection UI

When total < 8h, the checkbox prompt appears:

```
=== 2026-01-14 ===

R - Canva - Agile Team
  OneDrive
    ✓ ENTELECT-1934 - Extract form fields and add Zod validation... (2h)
  Meetings
    ✓ [meeting] - DSU Zoom (Daily Stand Up)... (0.5h)

R - Canva Maintenance
  Google Drive
    ✓ ENTELECT-1864 - Scaffold New Intent... (2.5h)

Total: 5h ⚠️  (Expected: 8h)

? Select tasks to round up (3h to distribute): (Press <space> to toggle, <enter> to confirm, <q> to skip)
❯ ◯ ENTELECT-1934 - Extract form fields... (2h → 3h)
  ◯ [meeting] - DSU Zoom... (0.5h → 1h)
  ◯ ENTELECT-1864 - Scaffold New Intent... (2.5h → 3.5h)
```

### UI Behaviors

- Shows current summary first (existing behavior)
- Gap calculated: `8 - total`
- Each task shows preview of new duration if selected alone
- Preview updates dynamically as selections change
- Tasks displayed in same Project → Category order as summary

### Dynamic Preview

```
Selected: 2 tasks | Gap: 3h | +1.5h each
❯ ◉ ENTELECT-1934 - Extract form fields... (2h → 3.5h)
  ◯ [meeting] - DSU Zoom... (0.5h)
  ◉ ENTELECT-1864 - Scaffold New Intent... (2.5h → 4h)
```

### Skip Options

- Press `q` or `Esc` to skip adjustment
- Confirm with no selection to skip
- Day proceeds to next with original durations

## Distribution Logic

### Basic Calculation

```javascript
gap = 8 - totalHours           // e.g., 8 - 5 = 3
perTask = gap / selectedCount  // e.g., 3 / 2 = 1.5

// Each selected task:
task.duration += perTask       // 2h → 3.5h, 2.5h → 4h
```

### Handling Remainders

When gap doesn't divide evenly, round to nearest 0.25h (15 min increments) and assign leftover to the first selected task.

Example: 1h gap, 3 tasks selected:
- Per task: 0.33h → rounds to 0.25h
- Leftover: 1 - (0.25 × 3) = 0.25h
- Result: Task 1 gets +0.5h, Tasks 2 & 3 get +0.25h each

## Data Flow

```
Parse notes → tasks[] (original durations)
                │
                ▼
        Interactive adjustment (in memory)
                │
                ▼
        tasks[] (adjusted durations)
                │
                ▼
        Write to output/timesheet-data.json
```

- Adjustment happens in memory after parsing, before writing JSON
- Source Obsidian notes are never modified
- Original times preserved in notes as "truth" of actual work
- Adjusted times in JSON reflect billable hours

## Implementation

### New Dependency

```json
"@inquirer/prompts": "^7.0.0"
```

Modern ESM-compatible prompts package.

### Files to Modify

**`src/timesheet-parser.js`** - Main orchestration
- Import new `promptForAdjustment` function
- Change loop to process one day at a time (parse → summary → adjust → next)
- Pass adjusted tasks to JSON output

**`src/lib/review-ui.js`** - Add adjustment prompt
- New `promptForAdjustment(tasks, date)` function
- Returns adjusted tasks array (or original if skipped)
- Handles the checkbox UI with `@inquirer/prompts`

### New File

**`src/lib/duration-adjuster.js`**
- `calculateGap(tasks)` - returns hours needed to reach 8h
- `distributeGap(tasks, selectedIndices, gap)` - returns new tasks array with adjusted durations
- Handles 0.25h rounding and remainder distribution

### No Changes Required

- `note-parser.js` - parsing unchanged
- `task-filter.js` - filtering unchanged
- `timesheet-submit.js` - consumes JSON as before
