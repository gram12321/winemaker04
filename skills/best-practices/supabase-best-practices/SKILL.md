---
name: supabase-best-practices
description: Use for winemaker04 database work involving Supabase/Postgres queries, schema changes, indexing, RLS, company-scoped persistence, migrations, and performance tuning.
metadata:
  author: supabase
  version: "1.1.0"
  organization: Supabase
  date: January 2026
  abstract: Comprehensive Postgres performance optimization guide for developers using Supabase and Postgres. Contains performance rules across 8 categories, prioritized by impact from critical query performance and connection management to advanced features. Each rule includes detailed explanations, incorrect vs. correct SQL examples, query plan analysis, and specific performance metrics to guide automated optimization and code generation.
---

# Supabase Best Practices

## Purpose

Apply Supabase and Postgres query, schema, indexing, RLS, and migration guidance to Winemaker database work. Use `../winemaker-game/SKILL.md` as the default repo router; this skill owns database-specific decisions after repo boundaries are clear.

## Use When

- Writing or reviewing Supabase database modules in `src/lib/database/`.
- Designing or changing SQL under `migrations/`.
- Adding or tuning indexes, constraints, RLS policies, or query filters.
- Diagnosing slow queries, N+1 access patterns, lock contention, or connection issues.
- Checking company-scoped persistence and least-privilege access.

## Repo Fit

Current stack: Supabase JS 2, Postgres, company-scoped game data, SQL migrations, TypeScript database mappers, and Vitest coverage.

- Keep app-level database reads and writes in `src/lib/database/`.
- Keep business calculations and progression rules in `src/lib/services/`.
- Keep page and component code free of direct Supabase access.
- Use explicit company/current-company scoping for persisted gameplay data.
- For schema changes, update SQL under `migrations/` after validating the intended database change.
- Preserve compact current data shapes; do not add legacy fallbacks unless explicitly requested.

## Workflow

1. Find the database module that owns the read/write path.
2. Verify company scoping, filters, joins, and mapper behavior before optimizing.
3. Check whether the issue is query shape, missing index, RLS policy, schema design, or call-site behavior.
4. Prefer minimal SQL/schema changes with clear rollback or migration safety.
5. Keep data access in `src/lib/database/` and call it from services.
6. Add or update focused tests for behavior; use explain plans or Supabase diagnostics for performance claims when available.

## Priority Focus For This Repo

1. Query correctness and indexing.
2. Company-scoped data isolation.
3. RLS safety and least-privilege behavior.
4. Migration safety and reversibility.
5. Measured optimization using explain plans.

## Rule Categories By Priority

| Priority | Category | Impact | Prefix |
|---|---|---|---|
| 1 | Query Performance | CRITICAL | `query-` |
| 2 | Connection Management | CRITICAL | `conn-` |
| 3 | Security and RLS | CRITICAL | `security-` |
| 4 | Schema Design | HIGH | `schema-` |
| 5 | Concurrency and Locking | MEDIUM-HIGH | `lock-` |
| 6 | Data Access Patterns | MEDIUM | `data-` |
| 7 | Monitoring and Diagnostics | LOW-MEDIUM | `monitor-` |
| 8 | Advanced Features | LOW | `advanced-` |

## Reference Map

Read individual reference files for detailed explanations and SQL examples:

```text
references/query-missing-indexes.md
references/query-composite-indexes.md
references/schema-foreign-key-indexes.md
references/security-rls-basics.md
references/security-rls-performance.md
references/data-n-plus-one.md
references/monitor-explain-analyze.md
references/_sections.md
```

Each reference file contains:

- Brief explanation of why it matters.
- Incorrect SQL example with explanation.
- Correct SQL example with explanation.
- Optional explain output or metrics.
- Additional context and references.
- Supabase-specific notes when applicable.

## Verification

Use the smallest useful checks for the change. For finished code work, default to:

```bash
npm test
git diff --check
```

For schema/index changes, also confirm the matching SQL migration file is updated and the intended query/path remains company-scoped.
