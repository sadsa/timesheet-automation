---
name: generate-timesheet
description: Reconstructs timesheet entries from GitHub PR activity over a date range and writes output/timesheet-data.json for submission to the Entelect portal. Asks the user for non-working days and work GitHub cannot see, fetches PRs created and reviewed, maps repos to Entelect project/category, distributes work across weekdays with standup and lunch factored in, and prints a summary for review. Use when backfilling timesheets for a past week or fortnight, catching up on timesheet entries, or retrospectively generating a timesheet from PR history.
---

# Generate Timesheet

Reconstructs Entries from GitHub PR activity for a date range and writes
`output/timesheet-data.json`. Read `CONTEXT.md` for the vocabulary used here.

This skill does **not** submit. It stops at a reviewed JSON file and tells the user to run
`npm run submit` themselves.

This skill does **not** read or write the user's Obsidian vault. Timesheet data no longer
lives there — see `docs/adr/0004-github-activity-replaces-the-vault.md`.

## Config (~/Projects/timesheet-automation/config/)

| File | Purpose |
|------|---------|
| `github.json` | GitHub username and org |
| `repo-categories.json` | Repo name → `{ project, category }` |
| `projects-categories.json` | Valid project/category pairs |

## Workflow

### 1. Resolve date range
Accept natural language (`last week`, `last fortnight`) or explicit dates (`2026-06-01 to
2026-06-16`). If no args, ask. Expand to a list of **weekdays only (Monday–Friday)**. Never
include Saturday or Sunday — even if the user's date range covers them.

### 2. Ask the user, before fetching anything

Show the weekday list and ask two things in one prompt:

1. **Non-Working Days** — any of these days not worked at all (leave, public holiday, sick)?
2. **Uncovered Work** — anything worked on that GitHub will not show? Meetings, pairing,
   support, in-person review, investigation that never reached a branch. For each, roughly
   which day and how long.

Ask this **before** fetching, not after reconstructing. Reconstruction that has already
redistributed work into a day has to be unpicked if the user then says they were on leave;
real input is cheaper applied first than corrected afterwards.

Drop Non-Working Days from the weekday list entirely. They get no Entries, are not held to
eight hours, and take no part in Redistribution in either direction.

Treat Uncovered Work as Work Items alongside the ones fetched from GitHub, pinned to the day
the user gave. For each, pick the Project/Category from `projects-categories.json` — the
pairing must exist in that file, and nothing downstream will check it, so check it here.

### 3. Fetch PRs created by user
For each repo in `repo-categories.json`:
```bash
gh pr list --repo <org>/<repo> --state all \
  --json number,title,createdAt,author,url \
  --limit 50
```
Filter by `author.login == username` and `createdAt` within range.

### 4. Fetch PRs reviewed by user
```bash
gh api "search/issues?q=is:pr+reviewed-by:<username>+created:<from>..<to>&per_page=50"
```
For each result, fetch the actual review date (not PR creation date):
```bash
gh api repos/<org>/<repo>/pulls/<num>/reviews \
  --jq '[.[] | select(.user.login == "<username>")] | first | .submitted_at'
```
Use `submitted_at` as the activity date.

### 5. Map to project/category
Look up each PR's repo name in `repo-categories.json`. For any unrecognised repo, ask the
user before continuing.

### 6. Build the day roster

A reconstruction is not a record. PR timestamps are a lossy proxy for hours actually
worked, so worked days with thin or no PR activity are filled from neighbouring days. The
output is an approximation for the user to review before submitting. See
`docs/adr/0003-generated-plans-are-reconstructions.md`.

- Assign each item to its activity date (created date for authored PRs, review date for
  reviewed PRs, the user's stated day for Uncovered Work)
- **Convert UTC timestamps to the user's local timezone before deriving the date** — a PR
  created at 23:29 UTC belongs to the next local day in NZ
- Each worked weekday needs **≥ 2 work items** — redistribute from days with 3+ into days
  with < 2
- **Never redistribute onto or off a Non-Working Day**
- Spillovers are allowed: the same ticket can appear at EOD on day N and SOD on day N+1
  (consecutive weekdays only, not across weekends or Non-Working Days)
- See [REFERENCE.md](REFERENCE.md) for redistribution and scheduling rules

### 7. Schedule each day
Fixed constraints:
- **Day span:** 8:00 AM – 5:00 PM
- **Standup:** 11:00 AM – 11:30 AM every day (never move this)
- **Lunch:** 1-hour silent gap — vary start across days (12:00, 12:30, or 1:00 PM)

This span yields **exactly 8h** per worked day, which is what the portal expects. A day
that sums to anything else means the schedule is wrong. Vary the before/after-standup split
across days, because real working days vary in shape. Lunch is a gap between Entries, not
an Entry.

### 8. Write output/timesheet-data.json

Write the Entries to `output/timesheet-data.json` in the repo root, sorted by date then
start time. This overwrites any existing file.

**Before overwriting, check whether the existing file contains entries with
`"submitted": true` whose dates overlap the range being generated.** If so, stop and tell
the user — those hours are already in the portal and regenerating them risks filing them
twice. Otherwise overwrite without ceremony.

### 9. Show the summary and stop

Print the Entries grouped **Project → Category → Entry**, with a total per day and a `✓` for
8h or `⚠️` otherwise. Then tell the user:

> Review `output/timesheet-data.json`, then run `npm run submit`.

Do not run `npm run submit`. Submission writes to the Entelect portal, and
`timesheet-submit.js` is interactive — on any failure it prints `Please manually select
project "X" and press Enter` and waits. Pressing that Enter asserts that a human fixed
something by hand. The user runs it.

## Output schema

`output/timesheet-data.json` is a flat JSON array. `timesheet-submit.js` consumes it
directly; nothing validates it first, so the shape must be exactly right.

| Field | Type | Notes |
|-------|------|-------|
| `date` | string | `YYYY-MM-DD` |
| `project` | string | Must exist as a key in `config/projects-categories.json` |
| `category` | string | Must be listed under that project — the **pairing** is what matters |
| `duration` | **number** | Decimal hours. `1.5` means 1h30. Not a string, not a time range |
| `description` | string | Non-empty |
| `ticket` | string | Optional — **omit the field entirely** when there is none, never `null` or `"N/A"` |
| `type` | string | `ticket`, `meeting`, or `other` |

`duration` is the field most easily got wrong. It is a number of hours, not `"9:00 AM -
10:30 AM"` and not `"1h30"` — submission does that conversion itself, and a string here
fills the portal with `NaNhNaN`.

Do not write `submitted`; submission adds it per Entry as it saves.

```json
[
  {
    "date": "2026-08-20",
    "project": "FP - Canva - Agile",
    "category": "Teams App Software Dev",
    "duration": 3,
    "ticket": "ENTELECT-2554",
    "description": "Return navigation from the Canva editor back into Teams",
    "type": "ticket"
  },
  {
    "date": "2026-08-20",
    "project": "FP - Canva - Agile",
    "category": "Meetings",
    "duration": 0.5,
    "description": "DSU Zoom (Daily Stand Up)",
    "type": "meeting"
  },
  {
    "date": "2026-08-20",
    "project": "FP - Canva - Agile",
    "category": "Teams App Software Dev",
    "duration": 4.5,
    "ticket": "ENTELECT-2559",
    "description": "Handle Canva auth failures centrally via error boundary",
    "type": "ticket"
  }
]
```
