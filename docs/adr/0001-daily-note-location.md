# Daily notes live in `Daily Plans/{year}/{spanish-month}/`

**Superseded by [0004](0004-github-activity-replaces-the-vault.md).** This project no longer
reads the Obsidian vault at all, so where a note lives in it is no longer a question this
repo has an opinion about. `src/lib/note-path.js` has been deleted.

One correction worth recording, because the decision below rested on it: the flat vault root
was described here as frozen legacy holding "roughly fifteen older notes". That had stopped
being true. The user's personal journal — unrelated to timesheets — is written to exactly that
path by Obsidian and is added to daily, so the fallback branch was resolving work dates against
a live private journal. The hazard this ADR anticipated ("a real hazard if both locations were
actively written to") had already arrived unnoticed.

---

Daily notes were originally written flat at the vault root (`~/Documents/Personal/2026-07-02.md`),
but the vault now organises them as `Daily Plans/{year}/{spanish-month}/{YYYY-MM-DD}.md` —
Spanish month names, because that is the existing convention in the vault. The
`generate-timesheet` skill writes only to the nested layout, while the parser originally
read only the flat one, so generated notes were invisible to the parser and every run
needed a manual `NOTES_DIR` override.

`src/lib/note-path.js` now resolves a date against both, nested first. Nested is canonical;
flat is legacy and exists only because roughly fifteen older notes still sit there. Once
those are migrated, the fallback branch should be deleted.

## Consequences

If a date somehow has a note in both locations, the nested one wins silently. That is
acceptable while flat is frozen legacy, but it would be a real hazard if both locations
were actively written to — which is the main reason flat is not being kept permanently.

The Spanish month list is hardcoded in `note-path.js` rather than derived from `Intl`.
These are directory names on disk that must match exactly; making them a function of the
runtime's locale data would let an ICU difference break note resolution.
