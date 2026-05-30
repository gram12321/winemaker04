# Supabase Best Practices

Read `SKILL.md` first. This directory contains Supabase/Postgres performance, schema, security, and data-access guidance adapted to Winemaker's database layer.

## Quick Navigation

| Task | Use |
|---|---|
| Agent-facing workflow and repo boundaries | `SKILL.md` |
| Category order and impact levels | `references/_sections.md` |
| New reference template | `references/_template.md` |
| Reference writing guidance | `references/_contributing.md` |
| Missing or poor indexes | `references/query-missing-indexes.md`, `references/query-composite-indexes.md`, `references/query-partial-indexes.md` |
| Foreign keys, constraints, identifiers, data types | `references/schema-*.md` |
| RLS and privileges | `references/security-*.md` |
| N+1 queries, batching, pagination, upsert | `references/data-*.md` |
| Locking and transactions | `references/lock-*.md` |
| Explain plans, statistics, vacuum/analyze | `references/monitor-*.md` |
| JSONB and full-text search | `references/advanced-*.md` |

## Current Repo Bias

Keep Supabase access in `src/lib/database/`, business logic in `src/lib/services/`, schema changes in `migrations/`, and all persisted gameplay reads/writes company-scoped.
