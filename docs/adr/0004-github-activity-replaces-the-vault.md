# GitHub activity replaces the Obsidian vault as the timesheet source

Timesheet data used to be typed by hand, as pipe-delimited lines in Obsidian daily notes
under `Daily Plans/{year}/{spanish-month}/{YYYY-MM-DD}.md`. `npm run parse` read those
files, validated them, and wrote `output/timesheet-data.json` for submission. The user has
stopped writing them; in practice the `generate-timesheet` skill had already become the
thing that produced them, from GitHub pull request activity.

So the vault had become a round trip the tool took to talk to itself: the skill wrote
markdown, the parser read the same markdown back. It maintained a text format, a parser,
and four test files purely to cross that gap.

It also collided. The user's personal journal — unrelated to work — uses the same
`YYYY-MM-DD.md` naming, and moving those journals into `Daily Plans/` produced a dozen
`YYYY-MM-DD 1.md` duplicates where a generated timesheet already held the name. The
parser's legacy fallback path, meanwhile, pointed at the live journal directory.

The skill is now the whole collection phase. It resolves a date range, asks for
Non-Working Days and Uncovered Work, fetches PR activity, reconstructs and schedules the
days, writes `output/timesheet-data.json`, prints a summary for review, and stops. The
user runs `npm run submit`. This repo no longer reads or writes the vault by any path.

## Consequences

The trade is a hand-written record for a lossy proxy plus a prompt. The old note was a
contemporaneous account of what the user did; GitHub is evidence of what the user pushed.
Everything [0003](0003-generated-plans-are-reconstructions.md) says about reconstruction
being an approximation now applies to the entire pipeline, with no hand-written layer
underneath it.

The Project/Category pairing is no longer validated by code. `validateTask()` in
`note-parser.js` was the only thing enforcing it against `config/projects-categories.json`,
and it went with the parser. An agent now chooses the pairing, and an invalid one reaches
Playwright, which fails to find the selector and falls back to its manual-recovery prompt —
`Please manually select project "X" and press Enter`. That is a working recovery path
**only because a human runs submit**. Those prompts assert that a person intervened, so if
submission is ever automated, restoring validation stops being optional: an agent pressing
Enter there would be claiming a fix it did not make, and the Entry would be saved under
whichever project happened to be selected.

`output/timesheet-data.json` is both the skill's output and submission's progress ledger —
`submitted: true` is written back per Entry — and `output/` is gitignored. Regenerating
overwrites it. That is safe as long as a regenerated range does not cover already-submitted
dates: overwriting removes old Entries rather than resurrecting them unsubmitted. The
unhandled case is a submission run that ends early, leaving unsubmitted Entries that a
later regeneration silently discards. Accepted for now as an omission the user would catch
at month end, not a duplication.

The eight-hour schedule in `REFERENCE.md` was justified as "the contract with the parser".
That parser is gone; the constraint survives because the portal expects full days.
