---
name: react-best-practices
description: Use for React performance and refactor guidance in winemaker04 when improving component behavior, render performance, async data flow, bundle size, and UI responsiveness.
metadata:
  author: vercel
  version: "1.0.0"
---

# React Best Practices

## Purpose

Apply React performance and data-flow guidance to Winemaker UI work. Use `../winemaker-game/SKILL.md` as the default repo router; this skill is advisory and repo conventions win when there is a conflict.

## Use When

- Writing or refactoring React components, hooks, page orchestration, or UI state.
- Investigating slow renders, expensive derived values, unnecessary effects, or unstable callbacks.
- Improving async data flow, request parallelism, or client-side fetch behavior.
- Reviewing bundle-size concerns, heavy conditional UI, or third-party component loading.
- Checking a React change before claiming completion.

## Repo Fit

Current stack: React 19, Vite 7, TypeScript 5, Tailwind 3, ShadCN/Radix UI, Supabase JS 2, and Vitest.

- Winemaker is a Vite SPA, not a Next.js App Router project. Next.js/RSC/server-action rules are reference material unless a future task introduces those surfaces.
- Do not replace established barrel import patterns (`@/components/ui`, `@/hooks`, `@/lib/services`, `@/lib/utils`, `@/lib/constants`) solely to satisfy generic bundle-import rules.
- Keep page components orchestration-focused. Business logic belongs in `src/lib/services/`; Supabase access belongs in `src/lib/database/`.
- Prefer existing hooks such as `useLoadingState()`, `useGameStateWithData()`, and `useGameState()` where they match the local pattern.
- Coordinate ShadCN/Radix composition with `../shadcn-best-practices/SKILL.md`.

## Workflow

1. Identify the user-visible interaction, data source, and state owner.
2. Read the component plus the hook/service/database modules it calls.
3. Remove incorrect effects first: derive during render, move interaction work to events, and keep async flow explicit.
4. Optimize only after correctness is clear: memoize expensive work, split state subscriptions, defer non-urgent updates, and parallelize independent async work.
5. Keep repo import and ownership conventions intact.
6. Verify with targeted tests or a focused UI check when behavior changes.

## Rule Categories by Priority

| Priority | Category | Impact | Prefix | Winemaker note |
|---|---|---|---|---|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` | Applies to independent service/database calls and UI loaders. |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` | Preserve repo barrel imports unless a measured issue needs direct imports. |
| 3 | Server-Side Performance | HIGH | `server-` | Reference only for current Vite SPA unless server helpers are touched. |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` | Applies to browser event listeners, local storage, and request deduping. |
| 5 | Re-render Optimization | MEDIUM | `rerender-` | Primary category for most component refactors. |
| 6 | Rendering Performance | MEDIUM | `rendering-` | Applies to large lists, SVGs, hydration-like flicker, and loading UX. |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` | Use for hot paths after simpler clarity fixes. |
| 8 | Advanced Patterns | LOW | `advanced-` | Use sparingly and document why. |

## Core Rules

### 1. Eliminating Waterfalls (CRITICAL)

- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- `server-auth-actions` - Authenticate server actions like API routes
- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-dedup-props` - Avoid duplicate serialization in RSC props
- `server-hoist-static-io` - Hoist static I/O (fonts, logos) to module level
- `server-serialization` - Minimize data passed to client components
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-after-nonblocking` - Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-swr-dedup` - Use SWR for automatic request deduplication
- `client-event-listeners` - Deduplicate global event listeners
- `client-passive-event-listeners` - Use passive listeners for scroll
- `client-localstorage-schema` - Version and minimize localStorage data

### 5. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-memo-with-default-value` - Hoist default non-primitive props
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-derived-state-no-effect` - Derive state during render, not effects
- `rerender-functional-setstate` - Use functional setState for stable callbacks
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-simple-expression-in-memo` - Avoid memo for simple primitives
- `rerender-split-combined-hooks` - Split hooks with independent dependencies
- `rerender-move-effect-to-event` - Put interaction logic in event handlers
- `rerender-transitions` - Use startTransition for non-urgent updates
- `rerender-use-deferred-value` - Defer expensive renders to keep input responsive
- `rerender-use-ref-transient-values` - Use refs for transient frequent values
- `rerender-no-inline-components` - Don't define components inside components

### 6. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-hydration-suppress-warning` - Suppress expected mismatches
- `rendering-activity` - Use Activity component for show/hide
- `rendering-conditional-render` - Use ternary, not && for conditionals
- `rendering-usetransition-loading` - Prefer useTransition for loading state
- `rendering-resource-hints` - Use React DOM resource hints for preloading
- `rendering-script-defer-async` - Use defer or async on script tags

### 7. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability
- `js-flatmap-filter` - Use flatMap to map and filter in one pass

### 8. Advanced Patterns (LOW)

- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-init-once` - Initialize app once per app load
- `advanced-use-latest` - useLatest for stable callback refs

## Reference Map

Read individual rule files for detailed explanations and code examples:

```text
rules/async-parallel.md
rules/bundle-barrel-imports.md
rules/rerender-derived-state-no-effect.md
rules/rerender-functional-setstate.md
rules/rendering-content-visibility.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

The full compiled guide is preserved in `AGENTS.md`.

## Verification

Use the smallest useful checks for the change. For finished code work, default to:

```bash
npm test
git diff --check
```

For UI behavior changes, add a focused browser/manual check when tests do not cover the interaction.
