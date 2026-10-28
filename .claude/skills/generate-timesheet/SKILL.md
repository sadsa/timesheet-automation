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
| `projects-categories.json` | Valid project/category pairs — a copy of the Portal Catalogue |
| `catalogue-sync.json` | When `projects-categories.json` was last synced from the portal |

## Workflow

### 0. Check the catalogue is fresh
The portal retires Projects and moves Categories without notice, and a pairing that is
gone fails at submit time. Read `syncedAt` from `config/catalogue-sync.json`. If it is
missing or more than 7 days old, tell the user how old it is and suggest they run
`npm run sync-projects` before you continue (it opens the portal, so they run it, not
you). Continue either way once they answer.

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
the user gave. For each, pick the Project/Category pairing from `projects-categories.json`.
Never use `Other` as a Category: in the portal it is the overflow dropdown button, not a
Category, and the validator rejects it.

### 3. Fetch PR activity
```bash
npm run -s fetch-activity -- <from> <to>
```
Prints every PR the user authored or reviewed in range as Work Items, one per line:
`date` and `time` already in local time, `ticket` extracted (absent when none),
`description` cleaned from the title, and `project`/`category` mapped from
`repo-categories.json`. A PR reviewed on two days appears once per day. It takes up to a
minute, since it reads each reviewed PR's reviews.

The fetched Work Items are complete. Build from them without querying `gh` again.

### 4. Resolve unmapped repos
Items from repos missing in `repo-categories.json` have `project: null` and are listed
under `unmappedRepos`. Ask the user where each one should be booked, or whether to skip
it, before continuing.

### 5. Refine descriptions
`description` is the PR title with ticket keys and conventional-commit prefixes stripped.
Reword where it still reads like a commit message rather than work done; `title` holds
the original.

### 6. Build the day roster

A reconstruction is not a record. PR timestamps are a lossy proxy for hours actually
worked, so worked days with thin or no PR activity are filled from neighbouring days. The
output is an approximation for the user to review before submitting. See
`docs/adr/0003-generated-plans-are-reconstructions.md`.

- Assign each item to its `date` (Uncovered Work to the user's stated day)
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

Then run:

```bash
npm run -s check
```

It checks every Entry against the schema below, every Project/Category pairing against
`config/projects-categories.json`, and every day for ≥ 2 Entries totalling exactly 8h.
This step is done when it prints `✓`. Fix each error it lists and rerun.

### 9. Show the summary and stop

Print the Entries grouped **Project → Category → Entry**, with a total per day and a `✓` for
8h or `⚠️` otherwise. Then tell the user:

> Review `output/timesheet-data.json`, then run `npm run submit`.

Do not run `npm run submit`. Submission writes to the Entelect portal, and
`timesheet-submit.js` is interactive — on any failure it prints `Please manually select
project "X" and press Enter` and waits. Pressing that Enter asserts that a human fixed
something by hand. The user runs it.

Before submitting anything it checks every pairing against the live Portal Catalogue and
offers to skip any the portal no longer accepts. Skipped Entries stay unsubmitted, so the
next run retries them once they are re-paired.

## Output schema

`output/timesheet-data.json` is a flat JSON array, validated by
`src/lib/timesheet-validator.js`. Submission refuses a file that fails it.

| Field | Type | Notes |
|-------|------|-------|
| `date` | string | `YYYY-MM-DD` |
| `project` | string | Must exist as a key in `config/projects-categories.json` (not checked once `submitted`) |
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
