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

# Generate (in Claude Code): /generate-timesheet last week

# Submit the generated data to the portal
npm run submit

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

Steps 1–4 are the skill's job and live in `SKILL.md` / `REFERENCE.md`, not in code.

### Output contract

`output/timesheet-data.json` is the only interface between the two phases, and it is
written by an agent rather than by code. The schema is documented in
`.claude/skills/generate-timesheet/SKILL.md`. Two things bite:

- `duration` is a **number of decimal hours** (`1.5` = 1h30). A string reaches
  `formatTime()` and fills the portal with `NaNhNaN`. Submission now rejects non-numbers.
- `ticket` is **omitted entirely** when absent — never `null`, never `"N/A"`.

`submitted: true` is written back per Entry as each one saves, so an interrupted run
resumes where it stopped. `output/` is gitignored.

### Validation

There is no code validating that a Project/Category **pairing** exists in
`config/projects-categories.json`. `validateTask()` used to do this and was deleted with
the note parser. An invalid pairing now fails at the Playwright selector and falls through
to the manual-recovery prompt. That is only safe because a human runs submission. **If you
ever automate `npm run submit`, restore pairing validation first** — the recovery prompts
assert that a person intervened, and an agent answering them would be lying to itself.
See ADR 0004.

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

Node's built-in test runner (`node:test`), tests in `tests/`. Only `config-validator.test.js`
remains — the parsing tests went with the parser. The generate phase is a skill and isn't
unit-testable here; its correctness rests on the schema in `SKILL.md` and the user's review.

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
