# Agents may run verify mode, never real submission

`npm run submit` is interactive by design: each failure prints `Please manually select ...`
and waits, and pressing Enter asserts a human fixed the step by hand. That is why agents
were told never to run it on the user's behalf.

Unit tests cannot see the portal, so a change to the calendar, selectors or form flow was
only ever proven by the user running a real submission. The first live check of the
calendar code found a bug that tests had passed: a one-day window leaves the date range
unset, so the timeline never changes.

`npm run submit -- --verify` gives agents a way to test their own work. It runs the same
flow (`src/lib/submit-flow.js`) against a generated fixture of fake Entries, reads back what
the portal saved, and deletes them. It is safe for an agent to run because it never asserts
anything on a human's behalf:

- A recovery prompt does not ask. It aborts the run as a failure.
- It never reads or writes `output/timesheet-data.json`, so no real Entry is touched or
  marked `submitted`.
- It refuses fixture dates that already hold Entries, and deletes only Entries whose
  description starts `[UI-VERIFY]` on those dates.
- It fails fast when logged out instead of waiting at a prompt.

## Consequences

The rule in CLAUDE.md narrows rather than lifts: agents may run `--verify`, never real
`submit`, and never answer a recovery prompt.

Verify writes to the real portal; there is no test environment. Fake hours exist for the
length of a run, and if cleanup fails they stay until someone deletes them. The run prints
exactly which Entries, and the skill tells the agent to hand that list to the user.
