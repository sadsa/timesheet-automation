# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Node.js CLI tool that automates timesheet entry to the Entelect portal by parsing Obsidian daily note files. The workflow is two-phase:
1. **Parse phase** (`timesheet-parser.js`): Extract tasks from Obsidian notes with embedded Project/Category, validate against config, display summary
2. **Submit phase** (`timesheet-submit.js`): Use Playwright to automate browser form submission to the portal

## Commands

```bash
# Install dependencies
npm install
npx playwright install chromium

# Parse daily notes for a specific date
npm run parse -- --date 2026-01-06

# Parse a date range
npm run parse -- --range 2026-01-01:2026-01-05

# Parse last week
npm run parse -- --week last

# Submit parsed timesheet data to portal
npm run submit

# Run all tests
npm test

# Run specific test file
node --test tests/note-parser.test.js
```

## Architecture

### Data Flow

1. **Obsidian notes** (markdown files) → `note-parser.js` → Task objects with start/end times, Project, and Category
2. **Task objects** → `task-filter.js` → Filtered billable tasks (excludes lunch/breaks, keeps tickets/meetings)
3. **Filtered tasks** → Validation → Fail fast if Project/Category missing or invalid
4. **Validated tasks** → `review-ui.js` → Display hierarchical summary (Project → Category → Tasks)
5. **Validated tasks** → `output/timesheet-data.json` → Structured JSON output
6. **JSON output** → `timesheet-submit.js` → Playwright automation fills portal form

### Task Format

Obsidian daily notes must contain tasks in pipe-delimited format:

**With ticket:**
```
- [ ] 9:00 AM - 10:00 AM | Project Name | Category Name | ENTELECT-1234 | Description
```

**Without ticket:**
```
- [ ] 9:00 AM - 10:00 AM | Project Name | Category Name | Description
```

The parser automatically detects ticket numbers (ENTELECT-XXXX pattern) anywhere in the task. Tasks are parsed into objects with:
- `start`, `end`, `duration` (calculated in hours)
- `project` (from pipe-delimited format, validated against `config/projects-categories.json`)
- `category` (from pipe-delimited format, validated against project's categories)
- `ticket` (extracted from ENTELECT-XXXX pattern, optional)
- `description` (remaining text after parsing)
- `type` (ticket/meeting/other, auto-detected)
- `date` (YYYY-MM-DD, added during parsing)

### Filtering Logic (task-filter.js)

Billable tasks are identified by:
- **Include**: Tasks with JIRA tickets (ENTELECT-XXXX) or meeting keywords (MEETING, zoom, call, DSU, standup, sync)
- **Exclude**: Tasks with lunch/break keywords

### Review Summary (review-ui.js)

The parse phase displays a read-only hierarchical summary of parsed tasks:
- Tasks are grouped by **Project** → **Category**
- Shows each task with ticket/type, description (truncated), and duration
- Displays total hours per day with visual indicator (✓ for 8h, ⚠️ otherwise)
- No interactive editing - durations must be adjusted in source notes and re-parsed

**Note**: To adjust Project, Category, or durations, edit the daily notes and re-run the parser.

### Configuration

**Projects and Categories** (`config/projects-categories.json`):
- Hierarchical structure mapping Projects to their valid Categories
- Used for validation during parsing (fail fast on invalid Project/Category)
- Format:
  ```json
  {
    "Project Name": ["Category 1", "Category 2"],
    "Another Project": ["Category A", "Category B"]
  }
  ```

### Browser Automation (timesheet-submit.js)

**COMPLETE**: Automates timesheet form filling using Playwright. The script:
1. Opens the Entelect portal and waits for login
2. For each task:
   - Auto-selects the Project (based on `task.project` field)
   - Auto-selects the Category (based on `task.category` field, handles visible or dropdown)
   - Opens the time entry form for the specific date
   - Fills in: Ticket #, Description, Time (in "Xh" or "XhYY" format)
   - Sets "Worked From" to "Home" by default
   - Saves the entry
3. Optimizes UI interactions by tracking state (only clicks when project/category changes)

**Form Selectors**: See `FORM_SELECTORS.md` for complete documentation of all selectors and interaction patterns.

**Key Details**:
- Uses Knockout.js data-binding selectors (e.g., `data-bind="value: time"`)
- Custom checkbox for "Billable" (DIV element, not standard checkbox)
- Radio buttons for "Worked From" location (values: 2=Home, 3=Entelect, 4=Client, 5=Other)
- Timeline interaction requires clicking on the gray bar area, not just the day label

Uses Playwright persistent context with a **dedicated automation profile** (separate from your main Chrome profile). This allows the script to:
- Run while Chrome is open without conflicts
- Preserve login state between runs in the automation profile
- First run requires logging into the Entelect portal once

## Environment Variables

Configure via `.env` file (see `.env.example`):
- `NOTES_DIR`: Path to Obsidian vault (default: `/Users/entelect-jbiddick/Documents/Personal`)
- `CHROME_USER_DATA`: Path to Chrome user data directory for session reuse

## Testing

Uses Node.js built-in test runner (`node:test`). Test files in `tests/` directory test individual parsing functions with assert-based assertions. No testing framework dependencies required.

## Common Issues

- If no tasks are found, verify the Obsidian task format matches the pipe-delimited format (see Task Format section)
- If validation fails with "missing Project or Category", ensure all tasks use the pipe-delimited format with Project and Category
- If validation fails with "invalid Project or Category", verify the values exist in `config/projects-categories.json`
- If duration totals are incorrect, check time parsing in `calculateDuration()` (uses date-fns)
- If browser automation fails to find elements, the portal's UI may have changed
- **Timeline interaction**: Must click on `.timeEntry-entry` element (the gray timeline bar), NOT the date label
  - DOM structure: `DIV.timeEntry` contains `DIV.timeEntry-infoHeader` (blocks clicks!) and `DIV.timeEntry-entry` (clickable)
  - The `.timeEntry-infoHeader` element intercepts pointer events, causing timeouts if you click the date label
  - Correct approach: `page.locator('.timeEntry', { hasText: dayLabel }).locator('.timeEntry-entry').click()`
- Custom "Billable" checkbox is a DIV element - use `.textcheckbox` selector, not `input[type="checkbox"]`
