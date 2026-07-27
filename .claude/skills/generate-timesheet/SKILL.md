---
name: generate-timesheet
description: Retrospectively generates daily timesheet markdown files from GitHub PR activity over a given date range. Fetches PRs created and reviewed by the user, maps repos to Entelect project/category using config files, distributes work across weekdays with standup and lunch factored in, and writes YYYY-MM-DD.md files to the Daily Plans vault. Use when backfilling timesheets for a past week or fortnight, catching up on timesheet entries, or retrospectively generating a timesheet from PR history.
---

# Generate Timesheet

Generates Daily Plan markdown files from GitHub PR activity for a date range.

## Config (~/Documents/Personal/timesheet-automation/config/)

| File | Purpose |
|------|---------|
| `github.json` | GitHub username and org |
| `repo-categories.json` | Repo name → `{ project, category }` |
| `projects-categories.json` | Valid project/category pairs (for validation) |

## Workflow

### 1. Resolve date range
Accept natural language (`last week`, `last fortnight`) or explicit dates (`2026-06-01 to 2026-06-16`). If no args, ask. Expand to a list of **weekdays only (Monday–Friday)**. Never include Saturday or Sunday — even if the user's date range covers them.

### 2. Fetch PRs created by user
For each repo in `repo-categories.json`:
```bash
gh pr list --repo <org>/<repo> --state all \
  --json number,title,createdAt,author,url \
  --limit 50
```
Filter by `author.login == username` and `createdAt` within range.

### 3. Fetch PRs reviewed by user
```bash
gh api "search/issues?q=is:pr+reviewed-by:<username>+created:<from>..<to>&per_page=50"
```
For each result, fetch the actual review date (not PR creation date):
```bash
gh api repos/<org>/<repo>/pulls/<num>/reviews \
  --jq '[.[] | select(.user.login == "<username>")] | first | .submitted_at'
```
Use `submitted_at` as the activity date.

### 4. Map to project/category
Look up each PR's repo name in `repo-categories.json`. For any unrecognised repo, ask the user before continuing.

### 5. Build the day roster

A generated plan is a **reconstruction**, not a record. PR timestamps are a lossy
proxy for hours actually worked, so days with thin or no PR activity are filled from
neighbouring days. The output is an approximation for the user to review before
submitting. See `docs/adr/0003-generated-plans-are-reconstructions.md`.

- Assign each item to its activity date (created date for authored PRs, review date for reviewed PRs)
- **Convert UTC timestamps to the user's local timezone before deriving the date** — a PR created at 23:29 UTC belongs to the next local day in NZ
- Each weekday needs **≥ 2 work items** — redistribute from days with 3+ into days with < 2
- Spillovers are allowed: the same ticket can appear at EOD on day N and SOD on day N+1 (consecutive weekdays only, not across weekends)
- See [REFERENCE.md](REFERENCE.md) for redistribution and scheduling rules

### 6. Schedule each day
Fixed constraints:
- **Day span:** 8:00 AM – 5:00 PM
- **Standup:** 11:00 AM – 11:30 AM every day (never move this)
- **Lunch:** 1-hour silent gap — vary start across days (12:00, 12:30, or 1:00 PM)

This span yields **exactly 8h of entries** per day, which is what the parser expects
(`TARGET_HOURS` in `src/lib/duration-adjuster.js`). A day that sums to anything else
means the schedule is wrong — do not rely on `--auto` to make up the difference.

Distribute tasks to fill all remaining time. Vary the before/after-standup split
across days, because real working days vary in shape. Do not add a lunch line — it
is a gap between entries.

### 7. Write output files
- Path: `~/Documents/Personal/Daily Plans/{year}/{spanish_month}/{YYYY-MM-DD}.md`
- Spanish month names: enero feb marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre
- **Only write files for weekdays (Monday–Friday).** Never write a file for a Saturday or Sunday.
- Show a confirmation summary (days and entry counts) before writing any files
- Do not overwrite an existing file that already has ≥ 8h of entries

## Entry format

```
- [ ] 9:00 AM - 11:00 AM | R - Canva - Agile Team | Teams App Software Dev | ENTELECT-587 | Magic Design - Teams feature parity
- [ ] 11:00 AM - 11:30 AM | R - Canva - Agile Team | Meetings | DSU Zoom (Daily Stand Up)
- [ ] 12:30 PM - 5:00 PM | R - Canva Maintenance | Google Drive | ENTELECT-2419 | prevent metadata title overwriting user filename input
```

For PRs with no extractable ticket number, omit the ticket field entirely.
