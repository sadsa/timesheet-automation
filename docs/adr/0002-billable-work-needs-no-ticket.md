# Billable work does not require a ticket number

`filterBillableTasks` used to keep an entry only if it had a JIRA ticket or matched a
meeting keyword, dropping everything else by returning `null`. Entries are now kept
unless they are lunch or a break.

The old rule silently destroyed real work. Backfilling 17–24 July 2026 produced two
entries from pull requests that have no ticket anywhere in their title, branch, or body —
`cap jira jql searches to cut mcp token usage` (3.5h) and `Keep a single coverage comment
per PR` (1.5h). Both were dropped with no warning, and `--auto` then redistributed their
five hours onto ENTELECT-2496 and ENTELECT-601. The day still totalled 8h and looked
correct, while the portal would have reported 4.5h against a manifest cutover that took
2.5h. Misattributing hours across tickets is worse than logging an entry with an empty
ticket field.

An Entry is a deliberate claim that the time was worked. Requiring a ticket to
corroborate that claim adds nothing, since plenty of legitimate work — documentation, CI
fixes, spikes — never gets one.

## Consequences

Entries can now reach `timesheet-submit.js` with `ticket: null`. Whether the Entelect
portal accepts an empty Ticket # field is **unverified** — the submit script has always
filled it unconditionally, so the constraint has never been tested. If the portal rejects
them, the fix belongs in the skill (route ticketless work to a catch-all category such as
`R - Canva - Agile Team / Other`), not in reinstating a silent filter.

One premise has weakened since this was written. The claim above rested on an Entry being
hand-written by the user into a daily note. Entries are now reconstructed from GitHub
activity and reviewed rather than authored
([0004](0004-github-activity-replaces-the-vault.md)), so the deliberate claim is the
user's review, not the typing. The decision stands — dropping ticketless work still
misattributes hours, which is the actual harm — but the review step now carries weight
this reasoning originally assigned to the writing.
