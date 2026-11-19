---
name: verify-portal-ui
description: Verifies the Playwright portal automation against the live Entelect portal by submitting fake Entries, reading back what was saved, and deleting them. Use after changing src/timesheet-submit.js, src/lib/submit-flow.js, src/lib/portal.js, src/lib/calendar-windows.js, or anything that touches portal selectors, the mini calendar, or the form flow. Not needed for validator, activity, or skill-prose changes; the unit tests cover those.
---

# Verify the portal UI

Unit tests cannot see the portal. This runs the real submit flow end to end against the
live portal, so a UI change is proven rather than assumed.

```bash
npm run submit -- --verify
```

This is the **only** way an agent may run `submit`. It uses a fixture, never
`output/timesheet-data.json`, and never answers a manual-recovery prompt. See
`docs/adr/0005-agents-may-run-verify-mode.md`.

## What it does

1. Opens Chrome (visibly, on the user's machine) with the automation profile and waits up
   to 30s for the saved sign-in. It never prompts.
2. Picks the most inert pairing in the live catalogue (`Meetings and Reviews (NZ)` /
   `Admin & Other`) and a fixture of 4 Entries, all described `[UI-VERIFY] ...`, on
   weekdays 3+ months ahead. It refuses any dates that already hold Entries, and moves
   later.
3. Submits them through the shared flow in `src/lib/submit-flow.js`. The dates force
   month navigation in the mini calendar and a second window.
4. Reads the saved Entries back from the portal's view model and compares date, Project,
   Category, hours and ticket.
5. Deletes every `[UI-VERIFY]` Entry on the fixture dates through the trash icon, then
   reloads and re-reads to confirm none survived.

## Reading the result

The output ends with two lines.

| Line | Meaning |
|---|---|
| `VERIFY PASSED` | The flow worked and the read-back matched. |
| `VERIFY FAILED: <reason>` | Something broke, or a step would have needed a human. Fix the code and rerun. |
| `CLEANUP OK` | No fake Entries remain. |
| `CLEANUP INCOMPLETE: ...` | Fake Entries are still in the user's real timesheet. |

Exit code 0 means `PASSED` and `CLEANUP OK`. Cleanup runs even when verification fails.

## When things go wrong

- **`not logged in`**: stop. Tell the user to sign in via the automation profile, then
  rerun. Do not try to sign in.
- **`CLEANUP INCOMPLETE`**: stop and report the printed dates and EntryIds to the user
  verbatim. They are real fake hours on a real timesheet. Do not retry the delete, rerun
  verify to "clean up", or delete anything by hand.
- **`VERIFY FAILED` with a `would need a manual fix` reason**: a selector or flow broke.
  That is the signal verify exists to give. Fix it, don't work around it.
- **The profile is locked** (`ProcessSingleton`): another Chrome is using the automation
  profile, probably the user's. Ask them to close it.

## Reporting

State the result plainly: both lines, and which calendar paths were exercised. If you
changed code and did not run verify, say so; do not imply it was verified.
