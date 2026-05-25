# Research UI Redesign - Compact Grouped Progression + Tech-Tree Support
**Date:** 2026-05-24  
**Status:** Design proposal (no implementation changes in this slice)

---

## 1. Why This Redesign

The current Research page uses:
- High-density summary cards in `Research.tsx`
- A tabbed `ResearchPanel` with large per-project cards in `ResearchPanel.tsx`

This creates three problems as the catalog grows:
1. Tabs hide cross-category progression and make chain research harder to understand.
2. Large cards consume too much vertical space for long ladders.
3. Completed and benefit states are visible, but not optimized for at-a-glance planning.

The catalog now includes many gated chains (`requiredPrestige`, `prerequisites`, unlock ladders), and future direction is a deeper tech-tree style progression. The UI should move from category tabs + large cards to a compact progression-first structure.

---

## 2. Current-State Findings (from code)

### 2.1 Current Composition
- `Research.tsx` renders hero + KPI cards + active bonuses + `ResearchPanel`.
- `ResearchPanel.tsx` owns project interaction and project rendering.

### 2.2 Current Grouping
- Grouped by fixed categories via 7 tabs: administration/projects/technology/agriculture/efficiency/marketing/staff.
- Projects are filtered with `getVisibleResearchProjects()` to show chain frontier behavior for selected unlock ladders.

### 2.3 Current State Logic
- Status states: `available | in-progress | completed | locked`.
- Active status from current activities.
- Completed status from `researchUnlocksDB`.
- Locked status from `isResearchProjectEligible()` and requirement reasons.

### 2.4 Dependency Support Already Present
- `prerequisites` on each project.
- Multiple gates beyond prestige: company value, buyer loyalty, achievements.
- Chained unlock ladders for staff/vineyard capacities are partially surfaced through visibility filtering.

### 2.5 Useful Existing Pattern
- `Winepedia/ResearchTab.tsx` already demonstrates compact table rows and data-dense filtering/sorting, useful as a structural UI reference for compactness.

---

## 3. Goals

1. Replace tabs and large cards with a compact overview-first layout.
2. Make dependencies and chain progress obvious without opening each project.
3. Separate research into meaningful groups that can scale with a bigger tree.
4. Improve completed-state readability (not just disabled cards).
5. Provide a clearer aggregate benefits overview of active research effects.
6. Keep business logic and DB logic in existing service/database layers.

---

## 4. Non-Goals (This Design Slice)

1. No backend/schema changes.
2. No change to research economy formulas.
3. No change to unlock semantics.
4. No full node-link graph canvas in the first implementation slice.

---

## 5. IA Options (Brainstorm)

## Option A - Compact Grouped Ladder List (Recommended)
A single scrollable page with grouped sections. Each section is a compact row list (table-like) with gate chips, prerequisite pills, and progress state.

Pros:
- Fast to scan, low vertical cost.
- Easy mobile fallback using stacked rows.
- Reuses current data model cleanly.
- Best near-term replacement for tabs/cards.

Cons:
- Not a full visual graph.
- Cross-group dependency lines are text-only.

## Option B - Hybrid: Compact List + Side Tech Map
Left side: compact list. Right side: focused dependency mini-graph for selected item.

Pros:
- Better dependency comprehension.
- Keeps compact list productivity.

Cons:
- More implementation complexity.
- Harder responsive behavior on smaller screens.

## Option C - Full Interactive Tree Canvas
Node-link graph with pan/zoom and node states.

Pros:
- Strong tech-tree fantasy and clarity for deep chains.

Cons:
- Highest complexity and maintenance.
- Slower to build and tune accessibility/mobile.
- Overkill for current near-term needs.

**Recommendation:** Option A now, with explicit extension seam toward Option B later.

---

## 6. Proposed Information Architecture

## 6.1 Replace Tabs with Grouped Progression Sections
Replace category tabs with sections that match progression mental models:

1. Foundation & Governance
- admin, grants, onboarding baseline

2. Vineyard & Capacity Growth
- vineyard size, total hectares, vineyard count, staff limit ladders

3. Winemaking Technology
- fermentation and process technology

4. Market & Commercial Expansion
- contract type unlocks, buyer progression, export chains

5. Varietal Research
- grape unlocks, sortable by complexity and gates

These are display groups, not schema groups. Mapping comes from current `category` + unlock/gate signatures.

## 6.2 Within each group: two modes
1. Focus Mode (default):
- Shows only relevant next-step nodes (frontier + active + completed in chain context).
- Minimizes noise.

2. Full Tree Mode:
- Shows all projects in that group with collapsed completed rows by default.

---

## 7. Compact Project Row Design

Each project row becomes a compressed strip (not a card):

Columns/blocks:
1. State Icon + Title
- completed check, in-progress pulse, locked icon, available marker

2. Gate and Dependency Chips
- prestige chip
- prerequisite count chip (expand for titles)
- optional company value / loyalty / achievement chips

3. Impact Summary (1 line)
- primary unlock/effect summary (normalized wording)
- optional +N additional impacts indicator

4. Cost/Work/Complexity
- small numeric triplet (currency, work units, Cx/10)

5. CTA
- Start / In Progress / Completed

Row expansion (inline details) reveals:
- full benefits list
- lock reason details
- full unlock payload + permanent effects

This gives strong compactness while preserving detail on demand.

---

## 8. Dependency and Chain UX

## 8.1 Explicit chain indicators
Each row shows:
- `Depends on: X` (collapsed count or first title)
- `Unlocks next: Y` (when determinable from graph)
- Ladder badge for known chains (staff cap, vineyard size/count/hectares)

## 8.2 Frontier clarity
For chained ladders, visually mark:
- Completed past steps (muted + check)
- Current frontier (highlighted actionable row)
- Future hidden/collapsed rows (optional in Focus Mode)

## 8.3 Group-level mini timeline
Each section header includes:
- `completed / total`
- `frontier available`
- current highest unlocked tier for key ladders (example: staff cap 12, vineyard size 4ha)

---

## 9. Completed Research UX

Completed state should be visible but compact:

1. Completed rows remain in place for context, but use reduced height and muted styling.
2. Section-level toggle: `Hide completed` / `Show completed`.
3. Completed row badges include completion timestamp if available later (future-ready, optional now).
4. Completed no longer relies on large green card blocks.

---

## 10. Benefits Overview UX

Create a dedicated benefits area above groups (replacing scattered benefit discovery):

1. Active Effects Summary (already partially exists)
- Keep current permanent effects panel but convert to compact grouped bullets.

2. Unlock Footprint Summary
- Chips/counters by unlock type (grape unlocks, contract channels, staff cap tier, vineyard caps, fermentation methods).

3. Recent Impact Feed
- Last N completed research impacts in compact lines.

This gives players one place to answer: "What did research give me?"

---

## 11. Interaction Model

1. Search input (title/id/effect text).
2. Filters:
- status: available/in-progress/locked/completed
- gate type: prestige/prereq/company value/achievement/loyalty
- unlock type

3. Sort:
- recommended progression (default)
- cost
- work
- complexity

4. View toggles:
- Focus vs Full Tree
- Hide completed

---

## 12. Data and Layering Plan (No Logic Relocation)

UI-only composition should continue using current sources:

- Catalog: `RESEARCH_PROJECTS`
- Completion: `getUnlockedResearchIds()`
- Active: `getAllActivities()` filtered to research category
- Eligibility + reasons: `loadResearchEligibilityContext()`, `isResearchProjectEligible()`, `getResearchRequirementReasons()`
- Permanent effects summary: `getResearchPermanentEffects()` + `getResearchViewSummary()`

No business-rule shifts into page components.

Recommended extraction for implementation phase:
- Add a UI mapper utility in service-adjacent UI layer to derive:
  - display group
  - normalized primary impact text
  - derived dependency metadata (`unlocks next`)
  - compact row model

---

## 13. Responsive Strategy

Desktop:
- multi-column compact rows with inline chips and numeric columns.

Mobile:
- same row model collapses to stacked two-line entries.
- optional bottom sheet for expanded details.

No horizontal tab dependency, reducing cramped mobile behavior.

---

## 14. Phased Delivery Proposal

## Phase 1 - IA and Compact Rows
1. Replace tab shell with grouped sections.
2. Introduce compact row component + inline expand.
3. Preserve current start workflow and lock reason logic.

## Phase 2 - Dependency Enhancements
1. Add dependency chips and `unlocks next` derivation.
2. Add frontier highlighting and group progression metrics.

## Phase 3 - Benefits Consolidation
1. Upgrade active effects panel to full unlock/effect footprint summary.
2. Add recent impact feed.

## Phase 4 - Optional Hybrid Mini-Map
1. Add right-side dependency mini-map for selected row (desktop only).

---

## 15. Acceptance Criteria

1. Tabs are removed from active Research interaction view.
2. Average vertical space per project is significantly reduced (target: at least 40% less than card layout).
3. User can identify for any project: status, gates, prerequisites, primary benefit in one row.
4. User can identify current chain frontier for staff and vineyard ladders without opening every row.
5. Completed projects are easy to scan and optionally hidden.
6. A unified benefits overview exists above project groups.

---

## 16. Risks and Mitigations

1. Risk: Group mapping confusion when categories overlap progression themes.
- Mitigation: deterministic mapping rules + fallback group.

2. Risk: Dependency metadata becomes noisy.
- Mitigation: one-line summary + expand-on-demand.

3. Risk: Over-filtering hides important next steps.
- Mitigation: clear focus/full mode toggle and reset filters action.

---

## 17. Open Decisions for User Confirmation

1. Preferred default mode:
- A: Focus Mode (frontier-first)
- B: Full Tree

2. Group naming tone:
- A: Mechanical/system labels
- B: Winery fantasy labels

3. Completed default visibility:
- A: shown
- B: hidden

4. Compact density preference:
- A: ultra-compact table-like
- B: medium compact with richer row subtitles

---

## 18. Implementation Note

This document intentionally avoids code changes. It is a planning/design artifact only, aligned with existing services/database boundaries and current research progression semantics.
