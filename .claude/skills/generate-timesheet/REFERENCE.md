# Generate Timesheet — Reference

## Redistribution algorithm

Goal: every weekday has ≥ 2 work items.

A one-item day is almost always an artifact of using PR timestamps as a proxy for
work, not a real half-empty day. Redistribution corrects the proxy. It does not
invent work that never happened — it relocates evidenced work to the days the user
was actually at their desk. Anything it produces is for the user to review.

1. Count items per day. Identify **thin days** (< 2) and **donor days** (≥ 3).
2. For each thin day, pick the nearest donor day (prefer same week, then adjacent week).
3. Move one item from the donor to the thin day. Prefer moving items that are part of a multi-PR ticket (so the same ticket appearing on two days looks like natural spillover work).
4. Repeat until all days have ≥ 2 items or no donors remain.
5. If a thin day still has < 2 items after redistribution, allow the same ticket to appear on that day AND the adjacent day as a spillover (split the work block across both days).

## Scheduling algorithm

Each day has these fixed slots:
```
08:00 ─────────────────── A (before standup)
11:00 ── STANDUP ─────── 11:30
         ─────────────── B (between standup and lunch)
LUNCH (1h gap, no entry)
         ─────────────── C (after lunch)
17:00
```

Slot durations vary by lunch start. Every combination totals **8h** including the
0.5h standup — that is the contract with the parser, not a target to approximate:

| Lunch start | A | B | C | A+B+C+standup |
|-------------|---|---|---|---------------|
| 12:00 PM | 3h | 0.5h | 4.0h | 8h |
| 12:30 PM | 3h | 1.0h | 3.5h | 8h |
| 1:00 PM | 3h | 1.5h | 3.0h | 8h |

With 2 tasks per day, use one of these splits (vary across days — real days differ
in shape, so a run of identical schedules would be the inaccurate outcome):
- Task 1 fills A, Task 2 fills B+C (most common)
- Task 1 fills A+B, Task 2 fills C
- Task 1 fills A, Task 2 fills B, same task continues into C (lunch-split entry)

With 3 tasks per day (spillover day):
- Continued task fills part of A, Task 2 fills rest of A or B, Task 3 fills C

**Spillover pattern** (task carries from previous afternoon into next morning):
- Day N: `... | 2:00 PM - 5:00 PM | ... | ENTELECT-XXX | Description`
- Day N+1: `... | 8:00 AM - 10:00 AM | ... | ENTELECT-XXX | Description`

## PR title cleaning

Strip conventional commit prefixes from PR titles when used as descriptions:
- Remove leading `feat:`, `fix:`, `chore:`, `build:`, `ci:`, `refactor:`, `test:`, `docs:`, `style:`, `perf:`, `revert:`
- Remove ticket numbers that appear at the start: `ENTELECT-XXXX |` or `ENTELECT-XXXX -`
- Capitalise the first letter of the result
- Keep the description concise — truncate at 80 chars if needed

Examples:
- `ENTELECT-587 | fix: add build:staging scripts` → `Add build:staging and build:prod scripts`
- `feat(ci): add RICE deploy workflows (ECOPIE-3059)` → `Add RICE deploy workflows mirroring slack-integration`

## Ticket extraction

Ticket number regex: `/[A-Z]+-\d+/` (covers ENTELECT-XXX, ECOPIE-XXX, etc.)

Search in order: PR title → branch name → PR body (first match wins). If no ticket found, omit the field — do not write `N/A`.

## Config schemas

### config/github.json
```json
{
  "username": "sadsa",
  "org": "canva-vendors"
}
```

### config/repo-categories.json
```json
{
  "canva-teams-integration": {
    "project": "R - Canva - Agile Team",
    "category": "Teams App Software Dev"
  },
  "google-photos": {
    "project": "R - Canva Maintenance",
    "category": "Google Photos"
  },
  "google-drive": {
    "project": "R - Canva Maintenance",
    "category": "Google Drive"
  }
}
```

Add new repos to this file as you work across more repositories.

## Daily Plans path

```
~/Documents/Personal/Daily Plans/{year}/{spanish_month}/{YYYY-MM-DD}.md
```

| Month | Spanish |
|-------|---------|
| January | enero |
| February | febrero |
| March | marzo |
| April | abril |
| May | mayo |
| June | junio |
| July | julio |
| August | agosto |
| September | septiembre |
| October | octubre |
| November | noviembre |
| December | diciembre |

Example: `2026-06-15.md` → `Daily Plans/2026/junio/2026-06-15.md`
