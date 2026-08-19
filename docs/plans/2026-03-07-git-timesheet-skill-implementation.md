# git-timesheet Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `git-timesheet` Claude Code skill that detects incomplete daily timesheets and generates time entries from GitHub activity history.

**Architecture:** A Node.js helper script (`scripts/gh-activity.js`) fetches GitHub Events API data and outputs structured JSON; a Claude Code skill file (`~/.claude/skills/git-timesheet.md`) orchestrates detection of incomplete days, runs the script, and writes generated time entries into daily plan markdown files.

**Tech Stack:** Node.js (ESM, node:test), GitHub CLI (`gh api`), Markdown file I/O

---

## Task 1: Scaffold `scripts/gh-activity.js`

**Files:**
- Create: `scripts/gh-activity.js`

**Step 1: Create the file with CLI arg parsing and help text**

```js
#!/usr/bin/env node
// Usage: node scripts/gh-activity.js <YYYY-MM-DD>

const date = process.argv[2];

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: node scripts/gh-activity.js <YYYY-MM-DD>');
  process.exit(1);
}

console.log(JSON.stringify([])); // placeholder
```

**Step 2: Verify it runs**

```bash
node scripts/gh-activity.js 2026-03-05
# Expected: []

node scripts/gh-activity.js
# Expected: Usage error, exit code 1
```

**Step 3: Commit**

```bash
git add scripts/gh-activity.js
git commit -m "feat: scaffold gh-activity script with CLI arg parsing"
```

---

## Task 2: Implement GitHub Events API fetching

**Files:**
- Modify: `scripts/gh-activity.js`

The script must:
- Get the authenticated GitHub username via `gh api /user`
- Fetch events from `/users/{username}/events` with pagination (30 events per page)
- Stop paginating when events are older than the target date (events are returned newest-first)
- Filter to only events on the target date (compare UTC date)

**Step 1: Replace placeholder with fetching logic**

```js
#!/usr/bin/env node
import { execSync } from 'node:child_process';

const date = process.argv[2];

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('Usage: node scripts/gh-activity.js <YYYY-MM-DD>');
  process.exit(1);
}

function ghApi(path) {
  const result = execSync(`gh api "${path}"`, { encoding: 'utf8' });
  return JSON.parse(result);
}

function fetchEventsForDate(username, targetDate) {
  const events = [];
  let page = 1;

  while (true) {
    const page_events = ghApi(`/users/${username}/events?per_page=100&page=${page}`);
    if (page_events.length === 0) break;

    for (const event of page_events) {
      const eventDate = event.created_at.slice(0, 10); // YYYY-MM-DD
      if (eventDate === targetDate) {
        events.push(event);
      } else if (eventDate < targetDate) {
        // Events are newest-first; once we're past the target date, stop
        return events;
      }
    }

    page++;
  }

  return events;
}

const user = ghApi('/user');
const rawEvents = fetchEventsForDate(user.login, date);

console.log(JSON.stringify(rawEvents, null, 2));
```

**Step 2: Test against a real date you worked**

```bash
node scripts/gh-activity.js 2026-03-05
# Expected: JSON array of raw GitHub event objects (or [] if no activity)
```

**Step 3: Commit**

```bash
git add scripts/gh-activity.js
git commit -m "feat: implement GitHub Events API fetching with pagination"
```

---

## Task 3: Implement event parsing

**Files:**
- Create: `src/lib/gh-event-parser.js`
- Modify: `scripts/gh-activity.js`

Extract structured activity from raw GitHub events. The parser handles each relevant event type and extracts ticket numbers.

**Step 1: Create `src/lib/gh-event-parser.js`**

```js
const TICKET_RE = /ENTELECT-\d+/i;

function extractTicket(...strings) {
  for (const s of strings) {
    if (!s) continue;
    const match = s.match(TICKET_RE);
    if (match) return match[0].toUpperCase();
  }
  return null;
}

export function parseEvent(event) {
  const base = {
    time: event.created_at,
    repo: event.repo?.name ?? 'unknown',
    ticket: null,
    description: null,
    type: null,
  };

  switch (event.type) {
    case 'PushEvent': {
      const commits = event.payload?.commits ?? [];
      const messages = commits.map(c => c.message).join(' ');
      const ticket = extractTicket(messages, event.repo?.name);
      const description = commits.map(c => c.message.split('\n')[0]).join('; ');
      return { ...base, type: 'commit', ticket, description };
    }

    case 'PullRequestEvent': {
      const pr = event.payload?.pull_request;
      const ticket = extractTicket(pr?.title, pr?.head?.ref, pr?.body);
      const action = event.payload?.action; // opened, closed, merged
      const description = `${action === 'closed' && pr?.merged ? 'Merged' : action} PR: ${pr?.title}`;
      return { ...base, type: 'pr', ticket, description };
    }

    case 'PullRequestReviewEvent': {
      const pr = event.payload?.pull_request;
      const ticket = extractTicket(pr?.title, pr?.head?.ref);
      const description = `Reviewed PR: ${pr?.title}`;
      return { ...base, type: 'review', ticket, description };
    }

    case 'IssueCommentEvent': {
      const issue = event.payload?.issue;
      const ticket = extractTicket(issue?.title, String(issue?.number ?? ''));
      const description = `Comment on: ${issue?.title}`;
      return { ...base, type: 'comment', ticket, description };
    }

    case 'PullRequestReviewCommentEvent': {
      const pr = event.payload?.pull_request;
      const ticket = extractTicket(pr?.title, pr?.head?.ref);
      const description = `Review comment on PR: ${pr?.title}`;
      return { ...base, type: 'review-comment', ticket, description };
    }

    default:
      return null; // ignore CreateEvent, WatchEvent, etc.
  }
}

export function parseEvents(rawEvents) {
  return rawEvents
    .map(parseEvent)
    .filter(Boolean)
    .sort((a, b) => a.time.localeCompare(b.time));
}
```

**Step 2: Wire parser into `scripts/gh-activity.js`**

Replace the final `console.log` with:

```js
import { parseEvents } from '../src/lib/gh-event-parser.js';

// ... (existing fetching code) ...

const structured = parseEvents(rawEvents);
console.log(JSON.stringify(structured, null, 2));
```

Also add `"type": "module"` to `package.json` if not already present (check first).

**Step 3: Run against a real date**

```bash
node scripts/gh-activity.js 2026-03-05
# Expected: structured array like:
# [{ time: "2026-03-05T09:12:00Z", type: "commit", repo: "canva-vendors/...", ticket: "ENTELECT-2018", description: "Fix folder picker..." }]
```

**Step 4: Commit**

```bash
git add src/lib/gh-event-parser.js scripts/gh-activity.js
git commit -m "feat: implement GitHub event parser with ticket extraction"
```

---

## Task 4: Write unit tests for event parsing

**Files:**
- Create: `tests/gh-event-parser.test.js`

**Step 1: Write tests covering each event type and ticket extraction**

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { parseEvent, parseEvents } from '../src/lib/gh-event-parser.js';

function makeEvent(type, payload, repo = 'canva-vendors/onedrive-app', time = '2026-03-05T09:00:00Z') {
  return { type, payload, repo: { name: repo }, created_at: time };
}

test('parseEvent - PushEvent extracts ticket from commit message', () => {
  const event = makeEvent('PushEvent', {
    commits: [{ message: 'fix: ENTELECT-2018 resolve folder picker error' }],
  });
  const result = parseEvent(event);
  assert.strictEqual(result.type, 'commit');
  assert.strictEqual(result.ticket, 'ENTELECT-2018');
  assert.ok(result.description.includes('resolve folder picker error'));
});

test('parseEvent - PushEvent with no ticket returns null ticket', () => {
  const event = makeEvent('PushEvent', {
    commits: [{ message: 'chore: update deps' }],
  });
  const result = parseEvent(event);
  assert.strictEqual(result.ticket, null);
});

test('parseEvent - PullRequestEvent extracts ticket from PR title', () => {
  const event = makeEvent('PullRequestEvent', {
    action: 'opened',
    pull_request: { title: 'ENTELECT-2068 fix publish button overlap', head: { ref: 'feature/fix' }, body: '' },
  });
  const result = parseEvent(event);
  assert.strictEqual(result.type, 'pr');
  assert.strictEqual(result.ticket, 'ENTELECT-2068');
});

test('parseEvent - PullRequestReviewEvent extracts ticket from branch name', () => {
  const event = makeEvent('PullRequestReviewEvent', {
    pull_request: { title: 'Fix export', head: { ref: 'ENTELECT-2099-fix-export' } },
  });
  const result = parseEvent(event);
  assert.strictEqual(result.type, 'review');
  assert.strictEqual(result.ticket, 'ENTELECT-2099');
});

test('parseEvent - unknown event type returns null', () => {
  const event = makeEvent('WatchEvent', {});
  const result = parseEvent(event);
  assert.strictEqual(result, null);
});

test('parseEvents - filters nulls and sorts by time', () => {
  const events = [
    makeEvent('PushEvent', { commits: [{ message: 'fix' }] }, 'repo', '2026-03-05T11:00:00Z'),
    makeEvent('WatchEvent', {}, 'repo', '2026-03-05T09:00:00Z'),
    makeEvent('PullRequestEvent', { action: 'opened', pull_request: { title: 'PR', head: { ref: 'branch' }, body: '' } }, 'repo', '2026-03-05T10:00:00Z'),
  ];
  const result = parseEvents(events);
  assert.strictEqual(result.length, 2);
  assert.ok(result[0].time < result[1].time);
});
```

**Step 2: Run tests**

```bash
node --test tests/gh-event-parser.test.js
# Expected: all tests pass
```

**Step 3: Commit**

```bash
git add tests/gh-event-parser.test.js
git commit -m "test: add unit tests for GitHub event parser"
```

---

## Task 5: Write the skill file

**Files:**
- Create: `~/.claude/skills/git-timesheet.md`

**Step 1: Create the skill file**

```markdown
---
name: git-timesheet
description: Detect incomplete daily timesheets from the last 7 days and generate time entries from GitHub activity. Use when user wants to fill in missing timesheet entries.
---

# git-timesheet Skill

You are helping fill in missing timesheet entries in daily plan markdown files by analyzing GitHub activity.

## Setup

- Timesheet automation repo: `/Users/entelect-jbiddick/Projects/timesheet-automation`
- Daily plans directory: `/Users/entelect-jbiddick/Documents/Personal/Daily Plans`
- Valid projects/categories: `/Users/entelect-jbiddick/Projects/timesheet-automation/config/projects-categories.json`

## Step 1: Detect Incomplete Days

For each of the last 7 calendar days (skip weekends):

1. Resolve the daily plan file path:
   - Month names in Spanish: enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre
   - Path: `{Daily Plans dir}/{year}/{spanish_month}/{YYYY-MM-DD}.md`

2. Read the file (if it exists). Parse lines matching:
   `- [ ] H:MM AM/PM - H:MM AM/PM | ...`

3. Sum durations of existing entries. Flag as incomplete if:
   - File doesn't exist, OR
   - Total hours < 8

Report which days need entries before proceeding.

## Step 2: Generate Entries for Each Incomplete Day

For each incomplete day, run:

```bash
node /Users/entelect-jbiddick/Projects/timesheet-automation/scripts/gh-activity.js <YYYY-MM-DD>
```

This outputs a JSON array of activity events: `{ time, type, repo, ticket, description }`.

### Build the time entry list

1. Group events into work blocks: events within 30 minutes of each other form one block.
2. Use earliest event time as block start, latest as block end. Round to nearest 30 minutes.
3. Always include DSU: `- [ ] 11:00 AM - 11:30 AM | R - Canva - Agile Team | Meetings | DSU Zoom (Daily Stand Up)`
4. Insert DSU in its correct chronological position.
5. For each block, generate a time entry:
   - Project: `R - Canva - Agile Team`
   - Category: infer from repo name and event types:
     - repo contains `onedrive` → `OneDrive`
     - repo contains `hubspot` → `Hubspot Data App Software Dev`
     - repo contains `bigquery` or `bq` → `BigQuery`
     - review/comment with no obvious feature → `Meetings`
     - default → `Other`
   - Include ticket if found; omit if not (add `# TODO: add ticket` inline comment)
   - Description: use the event description(s) for the block

### Entry format

With ticket:
```
- [ ] 9:00 AM - 11:00 AM | R - Canva - Agile Team | OneDrive | ENTELECT-2018 | Fix folder picker error on new account login
```

Without ticket:
```
- [ ] 2:00 PM - 3:30 PM | R - Canva - Agile Team | Other | Code review session # TODO: add ticket
```

Time estimates are rough — the user will manually adjust them.

## Step 3: Write to Daily Plan Files

### If file doesn't exist:
Create it with the entries at the top (no confirmation needed).

### If file exists (with or without existing entries):
Show a preview:

```
# Preview for YYYY-MM-DD
# Existing entries sum to Xh. Adding:

+ - [ ] 9:00 AM - 11:00 AM | R - Canva - Agile Team | OneDrive | ENTELECT-2018 | ...
+ - [ ] 11:00 AM - 11:30 AM | R - Canva - Agile Team | Meetings | DSU Zoom (Daily Stand Up)
+ - [ ] 12:30 PM - 5:00 PM | R - Canva - Agile Team | OneDrive | ENTELECT-2068 | ...

Insert these entries? [y/n]
```

On confirmation:
- Prepend the new entries to the TOP of the file, before any existing content
- Never delete or overwrite existing lines
- Separate new entries from existing content with a blank line

## Rules

- Never commit changes to git
- Never delete or modify existing file content
- DSU is always `11:00 AM - 11:30 AM` regardless of other activity
- If a day has zero GitHub activity, still add the DSU entry and note the gap
- Time estimates are intentionally rough — don't overthink them
```

**Step 2: Verify the skill file is readable**

```bash
cat ~/.claude/skills/git-timesheet.md
# Expected: skill content displayed correctly
```

**Step 3: Commit (skill file is outside the repo — just verify it exists)**

```bash
ls -la ~/.claude/skills/git-timesheet.md
# Expected: file exists with recent timestamp
```

Commit the helper script changes:

```bash
git add scripts/gh-activity.js src/lib/gh-event-parser.js
git status
git commit -m "feat: complete gh-activity script and event parser for git-timesheet skill"
```

---

## Task 6: End-to-end smoke test

**Step 1: Run the full script against a recent date you worked**

```bash
node scripts/gh-activity.js 2026-03-05
# Expected: structured JSON with commits, PRs, reviews from that day
```

**Step 2: Invoke the skill in Claude Code**

```
/git-timesheet
```

Expected behavior:
1. Claude reports which of the last 7 weekdays have incomplete entries
2. For each, runs the script and shows generated entries
3. Prompts for confirmation before writing to any existing file
4. Creates/updates files correctly

**Step 3: Spot-check a written file**

Open one of the updated daily plan files and verify:
- New entries are at the top
- DSU entry is present at 11:00 AM
- Existing content is untouched below
- Format matches: `- [ ] H:MM AM/PM - H:MM AM/PM | Project | Category | ...`
