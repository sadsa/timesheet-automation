# Project and Category Automation Design

**Date:** 2026-01-08
**Goal:** Eliminate manual Project selection during timesheet submission by embedding explicit Project and Category assignments in Obsidian notes.

## Overview

Transform the timesheet automation from semi-automated (manual Project selection) to fully automated by making Obsidian notes the complete source of truth. All required information (Project, Category, Ticket, Description) must be present in notes. Missing data causes immediate failure with clear error messages.

## Key Principles

1. **Notes are source of truth** - All timesheet data comes from explicit note entries
2. **Fail fast** - Missing or invalid data stops the script immediately
3. **No interactive fallbacks** - No prompting for missing information
4. **Config for validation** - `projects-categories.json` validates note entries against portal reality

## Note Format

### Required Format
```
- [ ] 9:00 AM - 10:00 AM | R - Canva - Agile Team | Hubspot Data App Software Dev | ENTELECT-1234 | Description
      └──────┬──────────┘   └─────────────┬─────────────┘ └────────────────┬─────────────────┘ └────┬────┘   └─────┬─────┘
      Start/End times              Project                        Category                    Ticket (optional)  Description
```

### Without Ticket
```
- [ ] 9:00 AM - 10:00 AM | Meetings and Reviews (NZ) | One On One Attendance | Weekly 1:1 with manager
```

### Delimiter Strategy
- Use pipe `|` to separate sections (unambiguous, since Projects/Categories may contain hyphens)
- Sections: `Times | Project | Category | Ticket | Description`
- Ticket is optional (detected by `ENTELECT-\d+` pattern)

## Configuration Structure

### New File: `config/projects-categories.json`

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

**Purpose:**
- Document valid Projects and their Categories
- Validate note entries against portal reality
- Reference when writing new notes

**Replaces:**
- `config/categories.json` (deleted)

## Data Structure Changes

### Updated Task Object

**Before:**
```json
{
  "start": "10:00 AM",
  "end": "11:00 AM",
  "duration": 1,
  "description": "ENTELECT-1834 - Test Harness",
  "ticket": "ENTELECT-1834",
  "type": "ticket",
  "date": "2026-01-05",
  "category": "OneDrive"
}
```

**After:**
```json
{
  "start": "10:00 AM",
  "end": "11:00 AM",
  "duration": 1,
  "description": "Test Harness for e2e tests",
  "ticket": "ENTELECT-1834",
  "type": "ticket",
  "date": "2026-01-05",
  "project": "R - Canva - Agile Team",
  "category": "Hubspot Data App Software Dev"
}
```

**Changes:**
- Add `project` field (required)
- Update `category` to use full portal names
- Keep `type` field for distinguishing tickets/meetings

## Component Changes

### 1. Note Parser (`src/note-parser.js`)

**Parsing strategy:**
```javascript
// Split on pipe delimiter
const parts = noteEntry.split('|').map(p => p.trim());

// parts[0] = "- [ ] 9:00 AM - 10:00 AM" (extract times)
// parts[1] = "R - Canva - Agile Team" (project)
// parts[2] = "Hubspot Data App Software Dev" (category)
// parts[3] = "ENTELECT-1234" OR "Description" (check pattern)
// parts[4] = "Description" (if ticket present in parts[3])

const ticketPattern = /^ENTELECT-\d+$/;
const hasTicket = parts[3] && ticketPattern.test(parts[3]);

const task = {
  project: parts[1],
  category: parts[2],
  ticket: hasTicket ? parts[3] : null,
  description: hasTicket ? parts[4] : parts[3],
  // ... times, duration, date, type
};
```

**Validation (fail fast):**
```javascript
// 1. Check minimum fields
if (parts.length < 4) {
  throw new Error(`Invalid format: Expected at least 4 pipe-separated sections`);
}

// 2. Validate Project exists
if (!projectsCategories[task.project]) {
  throw new Error(`Unknown project: "${task.project}"`);
}

// 3. Validate Category belongs to Project
if (!projectsCategories[task.project].includes(task.category)) {
  throw new Error(`Category "${task.category}" not valid for project "${task.project}"`);
}

// 4. Validate description exists
if (!task.description || task.description.trim() === '') {
  throw new Error(`Description is required`);
}
```

**Error reporting:**
- Include file path and line number
- Show the actual note entry
- Specify which validation failed
- Suggest checking `projects-categories.json`

### 2. Review UI (`src/review-ui.js`)

**Simplified to read-only display:**

**Remove:**
- `promptForCategory()` - no interactive selection
- `editTaskDuration()` - no duration editing
- All readline prompts for data entry

**Keep:**
- `displaySummary()` - read-only grouped by Project → Category
- Daily total calculations and warnings
- Simple confirmation to continue

**Example output:**
```
Timesheet Summary for 2026-01-06
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

R - Canva - Agile Team
  Hubspot Data App Software Dev
    ✓ ENTELECT-1834 - Test Harness for e2e tests (1h)
    ✓ ENTELECT-1842 - Fix POC build (2h)

  Meetings
    ✓ DSU Standup (0.5h)

Meetings and Reviews (NZ)
  One On One Attendance
    ✓ Weekly 1:1 with manager (0.5h)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 4.0 hours ⚠️  (Expected: 8h)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ All tasks validated successfully
→ Output written to: output/timesheet-data.json
→ Run 'npm run submit' to automate browser submission
```

### 3. Browser Automation (`src/timesheet-submit.js`)

**Current flow:**
1. Launch browser → Navigate → **WAIT for manual Project selection** → Loop tasks

**New flow:**
1. Launch browser → Navigate → **Auto-select Project per task** → Loop tasks

**Implementation:**
```javascript
let currentProject = null;
let currentCategory = null;

for (const task of tasks) {
  // Step 1: Select Project if different from current
  if (currentProject !== task.project) {
    console.log(`Switching to project: ${task.project}`);

    const projectButton = page.locator('.timesheetlistitem', { hasText: task.project });
    await projectButton.click();

    currentProject = task.project;
    currentCategory = null; // Reset category when project changes
    await page.waitForTimeout(500);
  }

  // Step 2: Select Category (existing logic)
  if (currentCategory !== task.category) {
    // ... existing category selection code ...
  }

  // Step 3: Fill form (existing logic)
}
```

**Remove:**
- Manual Project selection prompt (lines 82-85)
- `waitForEnter()` call for Project selection

**Benefits:**
- Fully automated end-to-end
- Handles multi-project timesheets
- Minimizes DOM interactions

## Testing Strategy

### Unit Tests

**1. Update `tests/note-parser.test.js`:**
- Test pipe-delimited parsing
- Test with/without ticket
- Test Project and Category extraction
- Test validation errors (unknown project, invalid category, missing fields)
- Test error messages include line numbers

**2. New `tests/config-validator.test.js`:**
- Validate `projects-categories.json` is valid JSON
- Test all Projects have non-empty category arrays
- Test no duplicate categories within Projects

**3. `tests/task-filter.test.js`:**
- May become obsolete (filtering now happens at parse time)
- Evaluate if still needed

### Integration Testing

**Test fixtures in `tests/fixtures/`:**
- `valid-note-multi-project.md` - Multiple Projects
- `invalid-note-missing-project.md` - Should fail
- `invalid-note-wrong-category.md` - Should fail

### Manual Testing Workflow

1. Create `projects-categories.json` with four Projects
2. Create sample daily note with new pipe format
3. Run `npm run parse -- --date 2026-01-08`
4. Verify validation catches errors
5. Run `npm run submit`
6. Verify Project auto-selection works

**Success criteria:**
- All tests pass
- Parse phase rejects invalid notes with clear errors
- Submit phase completes without manual intervention

## Implementation Plan

### Phase 1: Config & Parser (Foundation)
- Create `config/projects-categories.json`
- Update `src/note-parser.js` for pipe-delimited format
- Add validation logic
- Update unit tests
- Test with sample notes

### Phase 2: Review UI (Simplification)
- Remove interactive category selection
- Remove duration editing
- Update display for Project → Category hierarchy
- Keep read-only summary

### Phase 3: Browser Automation (Automation)
- Add Project tracking and auto-selection
- Remove manual Project selection prompt
- Test with multi-project timesheets

### Phase 4: Documentation & Cleanup
- Update `CLAUDE.md` with new format
- Remove `config/categories.json`
- Add example notes to documentation

## Files Modified

**Create:**
- `config/projects-categories.json`

**Modify:**
- `src/note-parser.js`
- `src/review-ui.js`
- `src/timesheet-submit.js`
- `tests/note-parser.test.js`
- `CLAUDE.md`

**Remove:**
- `config/categories.json`
- `src/task-filter.js` (optional, if no longer needed)

## Verification Steps

1. Create test note for 2026-01-08 with new format
2. Run `npm run parse -- --date 2026-01-08`
   - Should parse successfully
   - Should display read-only summary grouped by Project
   - Should write `output/timesheet-data.json` with project field
3. Run `npm run submit`
   - Should launch browser
   - Should auto-select Projects and Categories
   - Should fill forms without manual intervention
4. Verify entries in portal match notes exactly

## Rollback Plan

- Keep `config/categories.json` temporarily until validated
- Use Git branch for this work (easy revert if needed)
