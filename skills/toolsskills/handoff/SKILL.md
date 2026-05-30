---
name: handoff
description: Use when compacting the current conversation into a handoff document so another agent or future session can continue with the right context, artifacts, skills, and next steps.
argument-hint: "What will the next session be used for?"
---

# Handoff

## Purpose

Create a compact continuation document for a fresh agent. The handoff should preserve the state of the work without duplicating artifacts that already exist elsewhere.

## Use When

- The user asks for a handoff, continuation note, session summary, or context transfer.
- Work is paused and another agent or future session should resume it.
- The current conversation contains decisions, constraints, blockers, or partial progress that are not fully captured in files.

## Do Not Use When

- A short final response is enough.
- The needed context already exists in a plan, PRD, ADR, issue, commit, diff, or doc.
- The user asks for a user-facing summary rather than an agent continuation document.

## Repo Fit

Default repo router: `../winemaker-game/SKILL.md`.

Suggest relevant next-session skills when useful, especially `../winemaker-game/SKILL.md`, `../writeskills-gram/SKILL.md`, or the applicable specialist skill.

## Workflow

1. Determine what the next session is meant to do. If the user passed arguments, treat them as that focus.
2. Create a temporary markdown file. Prefer `mktemp -t handoff-XXXXXX.md`; if unavailable, use a clear temp path such as `C:/tmp/handoff-<topic>.md`.
3. Read the empty file/path before writing to avoid overwriting something unexpected.
4. Write only the context needed to resume.
5. Reference existing artifacts by path or URL instead of duplicating them.
6. Include verification status, blockers, and exact next steps.
7. Report the handoff path to the user.

## Handoff Shape

Use this structure unless the request calls for something smaller:

```markdown
# Handoff: <topic>

## Goal
<what the next session should accomplish>

## Current State
<what has been done and where>

## Key Context
<decisions, constraints, repo conventions, relevant files>

## Suggested Skills
<skills the next session should use, if any>

## Verification
<commands run, results, and known gaps>

## Next Steps
<ordered continuation steps>
```
