# Timesheet Automation

Reconstruct timesheet entries from GitHub activity and submit them to the Entelect portal.

## Usage

Two phases. The first is a Claude Code skill, the second is a script you run yourself.

```bash
# 1. Generate — in Claude Code, from this repo:
#    /generate-timesheet last week
#    Asks about non-working days and work GitHub can't see, then writes
#    output/timesheet-data.json and prints a summary.

# 2. Review output/timesheet-data.json, then submit:
npm run submit
```

Submission is interactive — it opens a browser, waits for you to log in on first run, and
stops to ask for help if the portal's UI doesn't match. Don't leave it unattended.

## Setup

```bash
npm install
npx playwright install chromium
gh auth login    # the skill uses the GitHub CLI
```

Configure projects and repo mappings in `config/`. See `CONTEXT.md` for terminology and
`docs/adr/` for why things are the way they are.
