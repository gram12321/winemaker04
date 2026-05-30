---
name: grill-me
description: Use when the user explicitly asks to be grilled, challenged, or interviewed about a plan, design, domain model, terminology, boundaries, ADRs, or major update before implementation.
---

# Grill Me

## Purpose

Drive a rigorous design interview until the plan is precise enough to act on. The goal is shared understanding, not a broad brainstorm.

## Use When

- The user explicitly asks for `grill-me`, grilling, relentless questions, or a design challenge.
- A major update needs terminology, domain boundaries, dependencies, or tradeoffs sharpened.
- Existing docs, ADRs, code, or domain models need to be reconciled before implementation.
- Ambiguity or disagreement would make direct implementation risky.

## Do Not Use When

- The user asks for direct implementation, a quick answer, or routine code cleanup.
- The answer can be found by reading the codebase or docs.
- A lighter clarification question is enough.

## Repo Fit

Default repo router: `../winemaker-game/SKILL.md`.

In winemaker04, this is non-default. Use it only when the user explicitly requests grilling or when the request is clearly a design interrogation. Prefer this skill over `grill-with-docs` unless there is a specific reason to update docs during the grilling session.

## Workflow

1. Identify the plan, domain area, and decision surface.
2. Explore the codebase or docs first when they can answer a question.
3. Ask one question at a time.
4. For each question, include your recommended answer.
5. Walk dependencies in order: upstream assumptions, domain terms, data shape, behavior, UI, persistence, tests, rollout.
6. Continue until decisions are explicit enough to write a plan or implement safely.

## Question Style

- Be direct and specific.
- Challenge vague terms and hidden assumptions.
- Separate facts from preferences.
- Ask about consequences, not just desired behavior.
- Prefer binary or concrete choices when possible.
- Do not ask questions already answered by the codebase.

## Output

End the session with a compact decision summary when the user has answered enough questions:

- settled decisions
- open decisions
- risks or contradictions
- next artifact to create, such as implementation plan, ADR, issue, or code change
