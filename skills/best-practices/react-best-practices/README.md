# React Best Practices

## Structure

```text
best-practices/react-best-practices/
  SKILL.md             # Agent-facing instructions
  README.md            # This package guide
  AGENTS.md            # Preserved compiled Vercel guide with all rules expanded
  metadata.json        # Source metadata
  agents/openai.yaml   # Display metadata
  rules/               # Individual rule files
    _sections.md       # Category ordering and impact definitions
    _template.md       # Rule authoring template
    *.md               # Detailed rules with incorrect/correct examples
```

## Role In Winemaker

Use this skill after `../winemaker-game/SKILL.md` establishes repo boundaries. The rules are performance guidance for React and Next.js, adapted here for a Vite SPA. Next.js-specific rules remain preserved as reference material, but current Winemaker work should prioritize React component behavior, hooks, async flow, bundle impact, and UI responsiveness.

## Rule Categories

| Prefix | Category |
|---|---|
| `async-` | Eliminating waterfalls |
| `bundle-` | Bundle size optimization |
| `server-` | Server-side performance |
| `client-` | Client-side data fetching |
| `rerender-` | Re-render optimization |
| `rendering-` | Rendering performance |
| `js-` | JavaScript performance |
| `advanced-` | Advanced patterns |

## Maintenance Notes

1. Keep `SKILL.md` concise and repo-aware.
2. Keep detailed examples in `rules/`.
3. Preserve `AGENTS.md` as the full compiled source guide.
4. When adding a rule, copy `rules/_template.md` to `rules/<prefix>-<name>.md`.
5. Use impact levels from `rules/_sections.md`.
6. If build scripts are restored later, use the original source-package flow: `pnpm validate`, `pnpm build`, and `pnpm extract-tests`.
7. Regenerate `AGENTS.md` from rule files instead of hand-editing the compiled document.

## Original Source

Originally created by Vercel Engineering. Source metadata and references are retained in `metadata.json`.
