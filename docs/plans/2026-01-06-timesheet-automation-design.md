# Timesheet Automation Tool - Design Document

**Date:** 2026-01-06
**Purpose:** Automate timesheet entry from Obsidian daily notes to Entelect timesheet portal

## Overview

A two-phase automation tool that:
1. Parses Obsidian daily notes to extract billable tasks and meetings
2. Provides an interactive review interface to categorize and adjust time entries
3. Automates browser-based timesheet submission using Playwright

## Requirements

### Functional Requirements
- Parse daily notes in format: `- [ ] HH:MM AM/PM - HH:MM AM/PM | Task description`
- Extract tasks with ENTELECT-XXXX tickets and meetings
- Exclude lunch breaks, personal tasks, and empty time slots
- Support single date or date range processing
- Prompt for category selection for all tasks
- Allow duration adjustment to reach 8 hours per day
- Automate timesheet portal form filling with step-by-step verification
- Use existing browser session for authentication

### Non-Functional Requirements
- Step-by-step execution with pauses for user verification
- Clear error messages for edge cases
- Persistent category configuration
- Graceful handling of portal changes or failures

## Architecture

### High-Level Data Flow

```
Daily Notes (*.md)
    ↓
[Parser CLI] → Parse tasks, calculate durations, detect categories
    ↓
[Interactive Review] → Prompt for categories, adjust times
    ↓
timesheet-data.json (structured output)
    ↓
[Playwright Automation] → Read JSON, fill timesheet with pauses
    ↓
Submission complete
```

### Components

#### Component 1: Parser & Review CLI (`timesheet-parser.js`)

**Responsibilities:**
- CLI argument parsing (date/range)
- File discovery and parsing
- Task extraction and filtering
- Interactive review UI
- JSON output generation

**CLI Interface:**
```bash
node src/timesheet-parser.js --date 2026-01-06
node src/timesheet-parser.js --range 2026-01-03:2026-01-06
node src/timesheet-parser.js --week last
```

**Parsing Logic:**

1. **File Discovery**: Find `YYYY-MM-DD.md` files in `/Users/entelect-jbiddick/Documents/Personal/`

2. **Task Extraction**:
   - Pattern: `- [ ] HH:MM AM/PM - HH:MM AM/PM | Task description`
   - Extract: start time, end time, description
   - Calculate duration in hours

3. **Filtering**:
   - **Include**: Tasks matching `ENTELECT-\d+` OR keywords (MEETING, meeting, zoom, call, DSU, standup, sync)
   - **Exclude**: "lunch", "break", empty descriptions

4. **Data Structure** (per task):
```json
{
  "date": "2026-01-06",
  "start": "09:00",
  "end": "10:00",
  "duration": 1.0,
  "description": "ENTELECT-1834 - Test Harness for e2e tests",
  "ticket": "ENTELECT-1834",
  "category": "Teams App",
  "type": "ticket"
}
```

**Interactive Review UI:**

*Step 1: Category Selection*
- For each task, prompt with numbered category list
- Support adding new categories on the fly
- Persist categories in `config/categories.json`

*Step 2: Duration Review*
- Show summary grouped by day
- Display total hours vs. 8-hour target
- Options: Edit durations, Continue, Quit

*Step 3: Duration Editing*
- Select entry by number
- Enter new duration
- Recalculate and show updated summary

#### Component 2: Browser Automation (`timesheet-submit.js`)

**Responsibilities:**
- Read `timesheet-data.json`
- Launch Playwright with existing Chrome session
- Navigate to timesheet portal
- Fill form fields with step-by-step pauses
- Submit timesheet

**Playwright Setup:**
```javascript
const browser = await chromium.launchPersistentContext(
  '/Users/entelect-jbiddick/Library/Application Support/Google/Chrome',
  {
    headless: false,
    channel: 'chrome'
  }
);
```

**Submission Flow:**
1. Load `timesheet-data.json`
2. Navigate to `https://employee.entelect.co.nz/Timesheet`
3. Pause: "Press Enter when ready to start..."
4. For each entry:
   - Display: "Filling: [date] | [category] | [ticket] | [hours]"
   - Fill form fields (date, category, ticket, hours, description)
   - Pause for verification
5. Final confirmation before submit
6. Click submit button

## Error Handling

### Parser Errors

| Scenario | Handling |
|----------|----------|
| Missing daily note | Warn and skip, continue with other dates |
| Malformed entry | Skip and log the invalid line |
| No billable tasks | Prompt to skip the day |
| Invalid time range | Prompt for manual duration entry |

### Browser Automation Errors

| Scenario | Handling |
|----------|----------|
| Portal unreachable | Timeout after 30s, show network error, exit |
| Form structure changed | Pause, notify user, keep browser open |
| Session expired | Pause, prompt for manual login, wait for Enter |
| Submission failure | Keep browser open, prompt manual verification |

## Project Structure

```
timesheet-automation/
├── package.json
├── .gitignore
├── config/
│   └── categories.json          # Persisted category list
├── src/
│   ├── timesheet-parser.js      # Main parser CLI
│   ├── timesheet-submit.js      # Playwright automation
│   ├── lib/
│   │   ├── date-parser.js       # Date range parsing logic
│   │   ├── note-parser.js       # Parse .md files
│   │   ├── task-filter.js       # Filter ENTELECT/meetings
│   │   └── review-ui.js         # Interactive review interface
└── output/
    └── timesheet-data.json      # Generated data (gitignored)
```

## Dependencies

```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "inquirer": "^9.0.0",
    "commander": "^11.0.0",
    "date-fns": "^3.0.0",
    "chalk": "^5.0.0"
  }
}
```

## Configuration

### categories.json
```json
[
  "Meetings",
  "OneDrive",
  "Teams App",
  "Dropbox"
]
```

Can be manually edited or reseeded with a separate script.

### .env (optional)
```
NOTES_DIR=/Users/entelect-jbiddick/Documents/Personal
CHROME_USER_DATA=/Users/entelect-jbiddick/Library/Application Support/Google/Chrome
```

## Implementation Notes

1. **Form Selectors**: Will need to inspect the actual timesheet portal during implementation to identify correct CSS selectors for form fields

2. **Meeting Keywords**: Initial list includes: MEETING, meeting, zoom, call, DSU, standup, sync. User will update notes to use "MEETING" prefix for consistency.

3. **Category Selection**: Always prompt for category (no auto-mapping from previous runs) to maintain full control

4. **Date Range Processing**: All days in range are consolidated into one review session and submitted together

5. **Browser Profile**: Uses existing Chrome profile to avoid authentication handling

## Usage Example

```bash
# Parse and review timesheets for last week
node src/timesheet-parser.js --range 2026-01-03:2026-01-06

# [Interactive prompts for categories and duration adjustments]
# Outputs: output/timesheet-data.json

# Submit to portal
node src/timesheet-submit.js

# [Step-by-step browser automation with pauses]
# Final confirmation before submission
```

## Future Enhancements

- Add `--dry-run` flag to preview without generating JSON
- Support for half-day timesheets (4-hour target)
- Export to CSV for record-keeping
- Category reseed script to fetch from portal
- Ticket-to-project auto-mapping based on task description keywords
