---
name: writeskills-gram
description: Use when writing, editing, consolidating, or verifying agent skills; packaging reusable agent knowledge; or improving skill triggers, instructions, references, scripts, tests, or skill directory structure.
---

# Write Skills Gram

## Purpose

Create or improve reusable agent skills. A skill is guidance for a technique, pattern, tool, or reference, not a story about one solved problem.

## Use When

- Writing a new `SKILL.md`.
- Editing, consolidating, or aligning existing skills.
- Improving skill triggers, frontmatter, instructions, examples, references, scripts, tests, or directory shape.
- Packaging reusable agent knowledge that is non-obvious and broader than one project.

## Do Not Use When

- The work is a one-off fix.
- The guidance is generic practice with no specific trigger.
- The rule is project-only and belongs in a repo router skill.
- The check should be automated instead of documented.

## Repo Fit

Default repo router: `../winemaker-game/SKILL.md`.

For winemaker04 skill work, preserve existing repo routing, keep specialist skills one level deep when practical, and avoid duplicating large content already held in sibling rule/reference files.

## Workflow

1. Gather requirements: task or domain, target users or agents, trigger situations, use cases, required scripts, and reference material.
2. Test need: for behavior-enforcing skills, run or define pressure scenarios that show the agent failing without the skill.
3. Draft the smallest useful `SKILL.md`.
4. Add supporting files only for heavy reference, examples, templates, or deterministic scripts.
5. Test with real or pressure scenarios.
6. Revise only to fix observed failures, unclear triggers, missing context, or gaps.
7. Present the draft and ask what is missing, unclear, too strict, or too detailed.

## Package Shape

```text
skill-name/
  SKILL.md
  reference.md      # optional heavy docs
  examples.md       # optional substantial examples
  scripts/helper.js # optional deterministic utility
```

Keep `SKILL.md` under 200 lines when practical and under 1000 lines as a hard budget. Keep references one level deep from `SKILL.md`. Use forward-slash paths even on Windows.

Split files when content is long, distinct by domain, rarely needed, or executable. Keep principles, short workflows, and small examples inline.

## Frontmatter

```yaml
---
name: skill-name
description: Use when specific triggers, symptoms, files, tools, or contexts appear.
---
```

- `name`: letters, numbers, and hyphens only; prefer active gerunds or clear action names.
- `description`: third-person, max 1024 chars, specific enough for discovery.
- Include trigger words users and agents will search for.
- Do not summarize the workflow in the description or agents may skip the body.
- Avoid vague descriptions like `helps with documents`.

## Content Rules

Start with the core principle in one or two sentences. Then include only what changes agent behavior:

- when to use or not use
- required workflow
- one concrete example when useful
- common mistakes
- verification checklist
- links to optional files

Use tables for reference data, numbered lists for linear workflows, and a small flowchart only for non-obvious decisions or loops. Flowchart labels should be semantic actions, questions, commands, states, or warnings; never generic `step1` labels or code snippets.

## Scripts

Add scripts when work is deterministic, repeated, fragile, or validation-heavy. Scripts should solve the problem, handle errors clearly, document dependencies, justify constants, and produce verifiable output. State whether the agent should run the script or read it as reference.

For MCP or connector tools, use fully qualified names. Do not assume packages or tools are installed unless the local environment guarantees them.

## Testing

Skill writing is TDD for process documentation:

- RED: run or describe a baseline scenario without the skill and capture exact failures.
- GREEN: write minimal guidance that prevents those failures.
- REFACTOR: test again, capture new loopholes, and tighten the skill.

Match tests to skill type:

- Discipline: pressure scenarios with time, sunk cost, authority, exhaustion, or speed bias.
- Technique: application scenarios and edge variations.
- Pattern: recognition, application, and counter-examples.
- Reference: retrieval, correct use, and gap checks.

If subagents or fresh-agent tests are unavailable, document that limitation and still review against concrete scenarios.

## Discipline Skills

Use bright-line rules only when compliance matters. Close loopholes explicitly: no hidden exceptions, no `spirit over letter` escape, no `just this once`.

Capture recurring excuses in a rationalization table and add red flags that force the agent to stop. Use authority and commitment ethically to serve the user's goal. Avoid guilt, flattery, fake urgency, or manipulation.

## Anti-Patterns

Avoid narrative session history, too many options without a default, multiple languages for one example, deep reference chains, time-sensitive claims without stale warnings, test-only or project-only rules in general skills, repeated content from another skill, and Windows-style paths.

## Verification

Before finishing skill work, check:

- Description has concrete triggers and no workflow shortcut.
- `SKILL.md` is concise, consistent, and searchable.
- References are one level deep and necessary.
- Examples are concrete.
- Scripts are deterministic and documented.
- No stale, project-specific, or duplicated guidance remains.
- Skill was tested or the testing gap is stated.
