# Design: git-timesheet Skill

## Overview

A Claude Code skill that analyzes GitHub activity to generate missing timesheet entries in daily plan markdown files. It detects which days in the last 7 days are incomplete (<8h of time entries) and generates entries from GitHub event history.

## Files to Build

### `scripts/gh-activity.js`
Node.js script that fetches GitHub activity for a given date and outputs structured JSON.

**Input:** A date string (`YYYY-MM-DD`) as CLI argument
**Output:** JSON array of activity events sorted by timestamp

**Data sources (GitHub Events API):**
- `GET /users/{username}/events` — filtered by date
- Event types extracted:
  - `PushEvent` → commits (timestamp, message, repo)
  - `PullRequestEvent` → PR opened/merged (timestamp, title, branch)
  - `PullRequestReviewEvent` → reviews (timestamp, PR title)
  - `IssueCommentEvent` / `PullRequestReviewCommentEvent` → comments (timestamp)
- Repos are primarily in `canva-vendors` org
- Ticket extraction: regex `ENTELECT-\d+` searched in commit message, PR title, branch name

**Output JSON shape:**
```json
[
  {
    "time": "2026-03-05T09:12:00Z",
    "type": "commit",
    "repo": "canva-vendors/onedrive-app",
    "ticket": "ENTELECT-2018",
    "description": "Fix folder picker error on new account login"
  }
]
```

### `~/.claude/skills/git-timesheet.md`
Claude Code skill that orchestrates detection and generation.

## Skill Flow

1. **Detection** — For each of the last 7 calendar days:
   - Resolve the daily plan path: `/Users/entelect-jbiddick/Documents/Personal/Daily Plans/{year}/{spanish_month}/{YYYY-MM-DD}.md`
   - Parse existing time entries (lines matching `- [ ] HH:MM AM/PM - HH:MM AM/PM | ...`)
   - Sum total hours; flag day as incomplete if total < 8h or no entries exist
   - Skip weekends

2. **Generation** — For each incomplete day:
   - Run `node scripts/gh-activity.js {date}` from the timesheet-automation repo
   - Reason about the activity timeline:
     - Events within ~30 min → grouped into one work block
     - Gaps >30 min → separate entries
     - Timestamps are rough estimates; user will manually adjust
   - Always insert DSU: `- [ ] 11:00 AM - 11:30 AM | R - Canva - Agile Team | Meetings | DSU Zoom (Daily Stand Up)`
   - Default project: `R - Canva - Agile Team`
   - Category inferred from activity type and repo (Claude's judgment)
   - If no ticket found → omit ticket field, add `# TODO: add ticket` comment

3. **Writing**
   - If file doesn't exist → create it with entries at top
   - If file exists with partial entries → show preview diff, ask `[y/n/edit]` before inserting
   - Never overwrite existing content — prepend new entries only
   - Entries written in chronological order: pre-DSU blocks, DSU, post-DSU blocks

## Daily Plan Path Resolution

| Month | Spanish name |
|-------|-------------|
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

Path: `/Users/entelect-jbiddick/Documents/Personal/Daily Plans/{year}/{spanish_month}/{YYYY-MM-DD}.md`

## Entry Format

```
- [ ] {HH:MM AM/PM} - {HH:MM AM/PM} | R - Canva - Agile Team | {category} | {ENTELECT-XXXX} | {description}
- [ ] {HH:MM AM/PM} - {HH:MM AM/PM} | R - Canva - Agile Team | {category} | {description}
```

Valid categories (from `config/projects-categories.json` for `R - Canva - Agile Team`):
- Meetings, Hubspot Data App Software Dev, Hubspot Data App Analysis, Hubspot Data App Dev Support
- Snowflake Dev support, Salesforce Data App Analysis, Google Analytics Software Dev
- World Bank Data App Dev Support, OneDrive, BigQuery, Other

## Constraints

- GitHub Events API only returns ~90 days of history and paginates at 30 events/page — script must paginate
- DSU is always `11:00 AM - 11:30 AM`
- Time estimates are intentionally rough — user tweaks manually
- Skill never commits changes to git
