# Generated timesheets are reconstructions, not records

The `generate-timesheet` skill derives Entries from GitHub pull request activity. It
requires every worked weekday to carry at least two Work Items, and where a day falls
short it moves items off the day they were evidenced on, or splits one ticket across two
consecutive days as a spillover. Backfilling 17–24 July 2026 produced a full eight-hour
Tuesday from a day with no GitHub activity at all.

This is deliberate. Pull request timestamps are a lossy proxy for hours worked: a day
spent pairing, reviewing in person, debugging, or on a branch that landed later leaves
little or no trace. A day that looks empty in the API was still worked. Redistribution
corrects the proxy rather than inventing work — but it produces an approximation, and the
output is explicitly for the user to review and correct before submission. It is not a
system of record.

## Consequences

The skill must never present reconstructed output as evidenced fact, and the review step
before `npm run submit` is load-bearing rather than a formality.

Scheduling variation — lunch starting at 12:00, 12:30, or 1:00, and differing splits
either side of standup — exists because real working days vary in shape. It was
originally documented as being there "so days don't look uniform", which justified a
sound rule by how the output would appear to a reader. The behaviour is unchanged; the
reasoning is now the honest one.

Redistribution's premise — "an empty day was still worked" — is false for leave, public
holidays, and sickness, and GitHub cannot distinguish those from a quiet day. Applied to
them it would bill hours for days not worked. Non-Working Days are therefore asked for
before reconstruction runs and excluded from it entirely: no Entries, no eight-hour
expectation, and no part in Redistribution as either donor or recipient. This is the one
input the reconstruction cannot derive and cannot safely guess.

Originally the skill wrote its output as markdown into the user's Obsidian vault. It now
writes `output/timesheet-data.json` directly; see
[0004](0004-github-activity-replaces-the-vault.md).
