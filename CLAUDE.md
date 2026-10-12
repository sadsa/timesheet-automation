# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Domain

`CONTEXT.md` is the glossary for this project — read it before introducing new terms.
Architectural decisions live in `docs/adr/`.

## Project Overview

Reconstructs timesheet entries from GitHub pull request activity and submits them to the
Entelect portal. The workflow is two-phase:

1. **Generate phase** (`.claude/skills/generate-timesheet/`): a skill, not a script. Asks
   the user for Non-Working Days and Uncovered Work, fetches PR activity via `gh`, maps
   repos to Project/Category, reconstructs and schedules the days, and writes
   `output/timesheet-data.json`.
2. **Submit phase** (`src/timesheet-submit.js`): Playwright automation that fills the
   portal form from that JSON. The **user** runs this, not an agent — see below.

This project does **not** read or write the user's Obsidian vault. It used to parse daily
notes from it; that whole phase was deleted. See
`docs/adr/0004-github-activity-replaces-the-vault.md`.

## Commands

```bash
# Install dependencies
npm install
npx playwright install chromium
# submit uses channel: 'chrome' — real Google Chrome must also be installed

# Generate (in Claude Code): /generate-timesheet last week

# Submit the generated data to the portal
npm run submit

# Fetch PR activity as Work Items (used by the skill)
npm run fetch-activity -- 2026-09-01 2026-09-15

# Validate output/timesheet-data.json
npm run check

# Run tests
npm test
```

## Architecture

### Data Flow

1. **GitHub PR activity** (`gh` CLI) + **Uncovered Work** (asked of the user) → Work Items
2. **Work Items** → Redistribution → every worked weekday carries ≥ 2 items
3. **Work Items** → Scheduling → Entries totalling exactly 8h per worked day
4. **Entries** → `output/timesheet-data.json`
5. **JSON** → `src/timesheet-submit.js` → Playwright fills the portal form

Steps 1–4 are the skill's job. The deterministic ends are code: `src/fetch-activity.js`
fetches and dates the Work Items, `src/lib/timesheet-validator.js` checks the result.
Redistribution and scheduling are judgement and live in `SKILL.md` / `REFERENCE.md`.

### Output contract

`output/timesheet-data.json` is the only interface between the two phases, and it is
written by an agent rather than by code. The schema is documented in
`.claude/skills/generate-timesheet/SKILL.md`. Two things bite:

- `duration` is a **number of decimal hours** (`1.5` = 1h30). A string reaches
  `formatTime()` and fills the portal with `NaNhNaN`.
- `ticket` is **omitted entirely** when absent — never `null`, never `"N/A"`.

`submitted: true` is written back per Entry as each one saves, so an interrupted run
resumes where it stopped. `output/` is gitignored.

### Validation

`src/lib/timesheet-validator.js` is the single source of truth for the output contract.
`validateEntries()` checks shape and the Project/Category **pairing** against
`config/projects-categories.json`; submission runs it before opening the portal, so its
manual-recovery prompts only cover genuine UI failures. `validateDays()` adds the
generation rules (≥ 2 Entries, exactly 8h per day); only `npm run check` runs it, so a
hand-edited day can still be submitted. When the schema changes, change the validator.

### Configuration

**`config/projects-categories.json`** — Project → valid Categories. The pairing is what
matters:
```json
{
  "Project Name": ["Category 1", "Category 2"]
}
```

**`config/repo-categories.json`** — repo name → `{ project, category }`.

**`config/github.json`** — GitHub username and org.

### Browser Automation (`src/timesheet-submit.js`)

Fills the portal form with Playwright. For each Entry it selects the Project and Category
(only when they change), opens the time entry form for the date, fills ticket, description,
time (`"Xh"` / `"XhYY"`), sets "Worked From" to Home, and saves.

**Interactive by design.** Every failure path prints `Please manually select ... and press
Enter` and blocks on stdin. Do not run it unattended and do not run it on the user's
behalf — pressing those prompts asserts a human fixed something by hand.

Uses a Playwright persistent context with a **dedicated automation profile** (separate from
the main Chrome profile), so it can run alongside Chrome and keep the portal login between
runs. First run requires logging in once.

**Form Selectors**: see `FORM_SELECTORS.md`.

**Key details**:
- Knockout.js data-binding selectors (e.g. `data-bind="value: time"`)
- "Billable" is a custom DIV checkbox — use `.textcheckbox`, not `input[type="checkbox"]`
- "Worked From" radios: 2=Home, 3=Entelect, 4=Client, 5=Other

## Environment Variables

Configure via `.env` (see `.env.example`):
- `CHROME_USER_DATA`: Playwright automation profile directory

## Testing

Node's built-in test runner (`node:test`), tests in `tests/`. The validator and the
activity helpers (`src/lib/activity.js`: local dating, ticket extraction, title cleaning)
are unit-tested. Redistribution and scheduling are skill judgement, not code; the
validator is what holds their output to the contract.

## Common Issues

- **Duplicate hours**: regenerating a range that overlaps already-submitted dates. The skill
  checks for overlapping `submitted: true` entries before overwriting; heed the warning.
- **A day you didn't work shows 8 hours**: you weren't asked, or didn't say, that it was a
  Non-Working Day. Redistribution assumes an empty day was still worked (ADR 0003).
- **`NaNhNaN` in the portal**: `duration` was written as a string.
- **Portal element not found**: the UI may have changed, or the Project/Category pairing
  doesn't exist. Check `config/projects-categories.json`.
- **Timeline interaction**: click `.timeEntry-entry` (the gray bar), NOT the date label.
  `.timeEntry-infoHeader` intercepts pointer events and causes timeouts.
  `page.locator('.timeEntry', { hasText: dayLabel }).locator('.timeEntry-entry').click()`
