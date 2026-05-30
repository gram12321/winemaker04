# ShadCN Best Practices

## Structure

```text
shadcn-best-practices/
  SKILL.md             # Agent-facing instructions
  README.md            # This package guide
  AGENTS.md            # Lightweight navigation for agents
  agents/openai.yaml   # Display metadata
  assets/              # Display icons
  rules/               # Detailed ShadCN/Radix composition rules
  cli.md               # CLI commands and flags
  customization.md     # Theming and CSS-variable guidance
  mcp.md               # MCP server reference
  evals/               # Evaluation data retained from the source package
```

## Role In Winemaker

Use this skill for UI composition after `../winemaker-game/SKILL.md` establishes repo boundaries. It complements:

- `../javascript-typescript/SKILL.md` for TypeScript and module organization.
- `../react-best-practices/SKILL.md` for render behavior and hooks.

## Current Project Context

Winemaker uses a Vite SPA with ShadCN/Radix source components, Tailwind 3, style `new-york`, Lucide icons, and aliases from `components.json`.

## Maintenance Notes

1. Keep `SKILL.md` focused on workflow, repo overrides, and critical rules.
2. Keep detailed incorrect/correct examples in `rules/`.
3. Keep CLI specifics in `cli.md`, theming details in `customization.md`, and MCP details in `mcp.md`.
4. Preserve existing assets and eval files unless the source package changes.
5. Do not turn project-init or preset-switching guidance into a default workflow for this repo.
