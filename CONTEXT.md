# Timesheet Automation

Turns a day's work into hours logged against Entelect projects. Work is described in
Obsidian daily notes, parsed into a reviewable summary, and submitted to the Entelect
portal by browser automation.

## Language

### The note

**Daily Note**:
One markdown file describing one calendar day's work, named `YYYY-MM-DD.md`.
_Avoid_: Daily Plan (the vault folder is named that, but the file is a note), journal

**Entry**:
A single line in a Daily Note claiming a contiguous block of time. The atomic unit
everything downstream operates on.
_Avoid_: Line, item, row

**Work Item**:
A distinct piece of work — typically one pull request. One Work Item may become
several Entries when it is split across slots or days.
_Avoid_: Task (overloaded: the parser calls its in-memory Entry a `task`)

### Classification

**Billable**:
Property of an Entry whose time is logged to the portal. Everything is Billable
except lunch and breaks; a ticket number is not required.
_Avoid_: Chargeable, claimable

**Project**:
The top-level Entelect cost code an Entry is logged against, e.g.
`R - Canva - Agile Team`. Enumerated in `config/projects-categories.json`.

**Category**:
The subdivision of a Project, e.g. `Teams App Software Dev`. Only valid within its
own Project — the pairing is what gets validated.
_Avoid_: Subproject, activity type

**Ticket**:
A JIRA reference such as `ENTELECT-2497`, matching `/[A-Z]+-\d+/`. Optional. An Entry
without one is still Billable.
_Avoid_: Issue, story, card

**Standup**:
The fixed daily meeting Entry. Distinguished because it is the one Entry that never
absorbs redistributed time.
_Avoid_: DSU, scrum (both appear in note text; Standup is the term here)

### Reconstruction

**Reconstruction**:
A Daily Note generated from evidence of work rather than transcribed from memory.
It is an approximation for the user to review and correct — never a system of record.

**Redistribution**:
Moving a Work Item onto a day it was not evidenced on, to correct for the fact that
pull request timestamps only loosely track when work happened.

**Spillover**:
One Work Item appearing at the end of one day and the start of the next, representing
work that genuinely carried over. Only valid between consecutive weekdays.

**Gap**:
The shortfall between a day's Entries and the expected 8 hours. A well-formed
generated day has no Gap; a Gap means either the schedule is wrong or the day was
genuinely irregular.
_Avoid_: Shortfall, deficit
