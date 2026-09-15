# Timesheet Automation

Turns a period of work into hours logged against Entelect projects. Work is reconstructed
from GitHub activity plus whatever the user reports that GitHub cannot see, reviewed by
the user, and submitted to the Entelect portal by browser automation.

## Language

### The work

**Entry**:
A claim on a contiguous block of one day's time — a Project, a Category, a duration, a
description, and optionally a Ticket. The atomic unit everything operates on.
_Avoid_: Line, item, row

**Work Item**:
A distinct piece of work — typically one pull request. One Work Item may become several
Entries when it is split across slots or days.
_Avoid_: Task (the JSON handed to submission calls an Entry a `task`)

**Uncovered Work**:
Work the user reports directly because GitHub holds no evidence of it — meetings,
pairing, support, in-person review, investigation that never reached a branch. Gathered
by asking, before reconstruction runs.
_Avoid_: Manual entry, extra work

**Non-Working Day**:
A weekday the user did not work at all — leave, a public holiday, sickness. Excluded from
reconstruction entirely: it receives no Entries, takes no part in Redistribution in either
direction, and is not held to the eight-hour expectation. Distinct from a day that merely
has no GitHub evidence, which _was_ worked and must still be filled.
_Avoid_: Empty day, off day, zero day

### Classification

**Billable**:
Property of an Entry whose time is logged to the portal. Everything is Billable except
lunch and breaks; a ticket number is not required.
_Avoid_: Chargeable, claimable

**Project**:
The top-level Entelect cost code an Entry is logged against, e.g.
`R - Canva - Agile Team`. Enumerated in `config/projects-categories.json`.

**Category**:
The subdivision of a Project, e.g. `Teams App Software Dev`. Only valid within its own
Project — the pairing is what matters.
_Avoid_: Subproject, activity type

**Ticket**:
A JIRA reference such as `ENTELECT-2497`, matching `/[A-Z]+-\d+/`. Optional. An Entry
without one is still Billable.
_Avoid_: Issue, story, card

**Standup**:
The fixed daily meeting Entry. Distinguished because it is the one Entry that never
absorbs redistributed time.
_Avoid_: DSU, scrum (both appear in PR and meeting text; Standup is the term here)

### Reconstruction

**Reconstruction**:
A set of Entries derived from evidence of work rather than transcribed from memory. It is
an approximation for the user to review and correct — never a system of record.

**Redistribution**:
Moving a Work Item onto a day it was not evidenced on, to correct for the fact that pull
request timestamps only loosely track when work happened. Never onto a Non-Working Day.

**Spillover**:
One Work Item appearing at the end of one day and the start of the next, representing work
that genuinely carried over. Only valid between consecutive weekdays.

**Gap**:
The shortfall between a day's Entries and the expected eight hours. A well-formed
reconstructed day has no Gap; a Gap means either the schedule is wrong or the day was
genuinely irregular.
_Avoid_: Shortfall, deficit

### Not terms here

**Daily note**:
Not a concept in this project. The user keeps a personal journal in an Obsidian vault
whose files are named `YYYY-MM-DD.md`; it has nothing to do with timesheets, and this
project never reads or writes the vault. The word is listed only because timesheet data
once lived in files of that name and shape, and the collision caused real confusion.
