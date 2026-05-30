# JS and TS Best Practices

## Structure

```text
best-practices/js-ts-best-practices/
  SKILL.md             # Agent-facing instructions
  README.md            # This package guide
  AGENTS.md            # Lightweight navigation for agents
  agents/openai.yaml   # Display metadata
```

## Role In Winemaker

Use this skill for implementation mechanics after `../winemaker-game/SKILL.md` has established repo boundaries. It complements the more specialized skills:

- `../react-best-practices/SKILL.md` for render behavior and React performance.
- `../shadcn-best-practices/SKILL.md` for ShadCN/Radix component composition.
- `../supabase-best-practices/SKILL.md` for Supabase/Postgres work.

## Maintenance Notes

- Keep `SKILL.md` concise and behavior-focused.
- Add heavier examples or deterministic helpers as separate files only when they become reusable.
- Keep examples aligned with the current stack: React, TypeScript, Vite, Tailwind, ShadCN/Radix, Supabase, and Vitest.
- Do not duplicate full React, ShadCN, or Supabase rules here; link to those skills instead.
