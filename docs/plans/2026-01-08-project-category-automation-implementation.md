# Project and Category Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate manual Project selection by embedding explicit Project and Category assignments in Obsidian notes, fully automating timesheet submission.

**Architecture:** Replace single-delimiter note format with pipe-delimited format supporting Project and Category. Add validation against config file. Remove interactive prompts. Automate Project selection in browser.

**Tech Stack:** Node.js, Playwright, date-fns, chalk, node:test

**Design Document:** See `docs/plans/2026-01-08-project-category-automation-design.md` for complete specification.

---

## Implementation Tasks

This plan follows TDD principles: Write test → Run (fail) → Implement → Run (pass) → Commit.

---

## Phase 1: Config & Parser (Foundation)

### Task 1: Create Config File

Create `config/projects-categories.json` with Project→Category mappings.

**Step 1: Create config file**

**Step 2: Commit**
```bash
git add config/projects-categories.json && git commit -m "feat: add projects-categories config"
```

---

### Task 2: Add Config Validation Tests

Test that config file is valid and well-formed.

**Step 1: Create test file** `tests/config-validator.test.js`

**Step 2: Write validation tests**

**Step 3: Run tests** - Should pass

**Step 4: Commit**
```bash
git add tests/config-validator.test.js && git commit -m "test: add config validation"
```

---

### Task 3: Update Parser for Pipe Format (TDD)

Update note-parser.js to parse pipe-delimited format.

**Step 1: Write failing test** in `tests/note-parser.test.js`
Test pipe format: `| Project | Category | Ticket | Description`

**Step 2: Run test** - Should FAIL

**Step 3: Implement pipe parsing** in `src/lib/note-parser.js`
- Split on `|` delimiter
- Extract project, category, ticket, description
- Handle optional ticket

**Step 4: Run test** - Should PASS

**Step 5: Commit**
```bash
git add src/lib/note-parser.js tests/note-parser.test.js && git commit -m "feat: parse pipe-delimited format"
```

---

### Task 4: Add Validation Logic (TDD)

Add validation against projects-categories.json.

**Step 1: Write failing tests** for validation errors
- Unknown project
- Invalid category for project
- Missing required fields

**Step 2: Run tests** - Should FAIL

**Step 3: Implement validation** in `src/lib/note-parser.js`
- Load projects-categories.json
- Validate project exists
- Validate category belongs to project
- Make parseNoteFile async

**Step 4: Run tests** - Should PASS

**Step 5: Update all tests to async** in `tests/note-parser.test.js`

**Step 6: Run all tests** - Should PASS

**Step 7: Commit**
```bash
git add src/lib/note-parser.js tests/note-parser.test.js && git commit -m "feat: add project/category validation"
```

---

### Task 5: Update Main Parser for Async

Update timesheet-parser.js to handle async parseNoteFile.

**Step 1: Add await to parseNoteFile call**

**Step 2: Improve error handling** for validation errors

**Step 3: Test manually** with sample note

**Step 4: Commit**
```bash
git add src/timesheet-parser.js && git commit -m "fix: handle async parseNoteFile"
```

---

## Phase 2: Review UI (Simplification)

### Task 6: Remove Interactive Prompts

Remove category selection and duration editing.

**Step 1: Remove category selection loop** from `src/timesheet-parser.js`

**Step 2: Add validation check** - Verify all tasks have project/category

**Step 3: Remove duration editing** - Replace with read-only summary

**Step 4: Update displayDurationSummary** in `src/lib/review-ui.js`
- Group by Project → Category
- Show hierarchical display

**Step 5: Remove unused functions** from `src/lib/review-ui.js`
- promptForCategory()
- editTaskDuration()
- etc.

**Step 6: Test manually** with sample data

**Step 7: Commit**
```bash
git add src/timesheet-parser.js src/lib/review-ui.js && git commit -m "feat: remove interactive prompts, add hierarchical display"
```

---

## Phase 3: Browser Automation

### Task 7: Add Project Auto-Selection

Add automatic Project selection in browser automation.

**Step 1: Remove manual selection prompt** from `src/timesheet-submit.js`

**Step 2: Add project tracking variable** `let currentProject = null;`

**Step 3: Add project selection logic**
- Check if project changed
- Find project button by text
- Click and wait

**Step 4: Reset category** when project changes

**Step 5: Update console output**

**Step 6: Test manually** with browser (if available)

**Step 7: Commit**
```bash
git add src/timesheet-submit.js && git commit -m "feat: automate project selection"
```

---

## Phase 4: Documentation & Cleanup

### Task 8: Update Documentation

Update CLAUDE.md with new format and workflow.

**Step 1: Update task format section**
- Document pipe-delimited format
- Show examples with/without ticket

**Step 2: Update data flow section**

**Step 3: Update configuration section**

**Step 4: Update browser automation section**

**Step 5: Remove old references** to interactive selection

**Step 6: Commit**
```bash
git add CLAUDE.md && git commit -m "docs: update for automated project/category"
```

---

### Task 9: Remove Old Config

Delete obsolete categories.json file.

**Step 1: Verify new workflow works**

**Step 2: Remove old config**
```bash
git rm config/categories.json
```

**Step 3: Commit**
```bash
git commit -m "chore: remove obsolete categories.json"
```

---

### Task 10: Add Example Note

Create example daily note showing new format.

**Step 1: Create docs/examples directory**

**Step 2: Write example note** with multiple projects/categories

**Step 3: Commit**
```bash
git add docs/examples/ && git commit -m "docs: add example daily note"
```

---

## Verification

### Task 11: End-to-End Testing

Verify complete workflow works as expected.

**Step 1: Create test note** with new format

**Step 2: Run parser**
```bash
npm run parse -- --date 2026-01-08
```
Expected: Validation passes, hierarchical display shows

**Step 3: Verify JSON output** has project/category fields

**Step 4: Test validation** with invalid data
Expected: Clear error messages

**Step 5: Test browser automation** (if available)
```bash
npm run submit
```
Expected: Auto-selects projects and categories

**Step 6: Run all tests**
```bash
npm test
```
Expected: All tests pass

**Step 7: Document results**

---

## Summary

**Total Tasks:** 11 tasks across 4 phases

**Key Deliverables:**
- ✅ Pipe-delimited format with Project/Category
- ✅ Validation with helpful errors  
- ✅ No interactive prompts
- ✅ Fully automated browser submission
- ✅ Hierarchical Project→Category display

**Success Criteria:**
- All tests pass
- Parser validates and fails fast
- Browser automation completes without manual steps
- Documentation updated

**Next Steps:**
Use @superpowers:finishing-a-development-branch to review and merge.
