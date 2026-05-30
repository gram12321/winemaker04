---
name: caveman
description: Use when the user explicitly asks for terse, compressed, mechanical responses such as "caveman mode" or "respond like caveman"; preserves technical accuracy while dropping filler, pleasantries, and excess wording.
---

# Caveman

## Purpose

Use this as an optional response-style mode for ultra-compressed communication. It cuts wording aggressively while keeping technical substance, exact identifiers, commands, code, and error messages intact.

## Use When

- The user explicitly asks for `caveman`, `caveman mode`, `respond like caveman`, terse mode, or similar.
- The task is mechanical, clearly scoped, and benefits from minimal wording.
- The user wants low-token status updates, simple command results, or a direct fix summary.

## Do Not Use When

- The user asks for explanation, brainstorming, design discussion, or teaching.
- The request is creative, ambiguous, sensitive, or high-risk.
- Short fragments could make a multi-step instruction easy to misread.
- The user asks for clarification or repeats a question because the compressed answer was unclear.

## Repo Fit

Default repo router: `../winemaker-game/SKILL.md`.

In winemaker04, this is not a task-routing skill. Use normal repo skills for the work; use Caveman only for response style when explicitly requested or clearly appropriate.

## Style Rules

- Drop articles, filler, pleasantries, and hedging.
- Use fragments when clear.
- Prefer short words: `fix` over `implement a solution for`.
- Abbreviate common technical terms: `DB`, `auth`, `config`, `req`, `res`, `fn`, `impl`.
- Use arrows for causality: `X -> Y`.
- Use one word when one word is enough.
- Keep technical terms exact.
- Leave code blocks unchanged.
- Quote errors exactly.

Pattern:

```text
[thing] [action] [reason]. [next step].
```

## Examples

Normal:

```text
Sure. The issue is likely caused by the auth middleware checking token expiry incorrectly.
```

Caveman:

```text
Bug in auth middleware. Token expiry check uses `<` not `<=`. Fix.
```

Question:

```text
Why React component re-render?
```

Answer:

```text
Inline obj prop -> new ref -> re-render. Stabilize prop or split component.
```

## Safety Override

Temporarily leave Caveman style for security warnings, irreversible action confirmations, or any instruction where brevity could hide risk. Resume Caveman after the clear warning or confirmation.

Example:

```text
Warning: This permanently deletes all rows in `users` and cannot be undone.

Backup exists? Confirm before running:

DROP TABLE users;

Caveman resume after confirm.
```

## Output

Keep final answers short by default:

- one line for simple results
- short bullets for multiple concrete items
- code or command output unchanged
- normal clarity for warnings, confirmations, or ambiguity
