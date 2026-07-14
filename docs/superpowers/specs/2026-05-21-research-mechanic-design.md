# Research System Unified Design + Handoff
**Date:** 2026-05-25
**Status:** Active living spec. Code-verified on 2026-07-14: core runtime, core UI, major unlock enforcement, foundation lanes, and permanent effects are implemented; equipment, vineyard-technique, wine-feature enforcement, balance calibration, and deeper visibility/reveal rules remain active backlog.

---

## 1. Purpose of This Document

This file replaces and consolidates:
- `docs/superpowers/specs/2026-05-21-research-mechanic-design.md`
- `docs/superpowers/completed/2026-05-25-research-ui-spec-merged.md`

It is intentionally handoff-oriented:
- keeps a concise snapshot of what is already implemented,
- focuses primarily on what is not yet implemented,
- defines a practical pipeline for the next agent to continue work.

---

## 2. Current State Snapshot (Implemented)

### 2.1 Core Runtime and Data Flow

Implemented and active:
- Research activity creation, completion, persistence (`research_unlocks`), and reward flow.
- Unlock enforcement across major gameplay surfaces for:
	- `grape`
	- `fermentation_technology`
	- `staff_limit`
	- `vineyard_size`
	- `total_vineyard_hectares`
	- `vineyard_count`
	- `contract_type`
	- grape buyer scaling unlocks (`grape_buyer_slots`, `grape_buyer_limit_multiplier`, `grape_buyer_multiplier_bonus`)
- Research gating with prestige + prerequisites.
- Starting-condition research head-starts via `startingResearch`.
- Permanent research effects runtime summary (minimum slice already live).

### 2.2 Research UX State (As Of This Pass)

Implemented:
- Research page is split into three tabs:
	- Active Research Effects
	- Research Footprint
	- Catalog
- Catalog tab contains progression interaction and includes `Hide completed` toggle.
- Catalog tab no longer includes the "Research Effects and Unlock Footprint" card.
- Footprint content is isolated to the dedicated footprint view.

Design-intent closure acknowledged for this pass:
- The previous "remove completed" intention is considered satisfied by the live `Hide completed` behavior.

### 2.3 Canonical Constants and Baselines

Implemented and centralized in canonical research constants:
- base vineyard size cap
- base total vineyard hectares cap
- base vineyard count cap
- base staff cap

---

## 3. What Is Still Not Implemented (Primary Focus)

This section is the active backlog and should drive next implementation slices.

### 3.1 Missing Research Tracks

1. Vineyard techniques track is still conceptual:
- `agri_green_harvest`
- `agri_canopy_management`
- `agri_precision_viticulture`
- `agri_cover_cropping`
- `agri_biodynamic`

2. Equipment track remains unimplemented:
- unlock type `equipment` not wired to a concrete gameplay system yet.

3. Wine feature unlocks are still mostly future-facing:
- `wine_feature` exists but is not broadly enforced as a first-class gating surface.

### 3.2 Discovery and Visibility Gating

Not implemented:
- Achievement-triggered research visibility (reveal-on-milestone model).
- Site-conditional research visibility (climate/site-profile based reveal).

### 3.3 UI/UX Progression Goals Not Finished

Implemented since the earlier UI note:
- Focus vs Full Tree exists as a Catalog control.
- Completed projects are shown by default and can be hidden with `Hide completed`.

Still not complete:
- Dependency mini-map behavior remains basic and should be hardened or simplified after UX playtest.
- Visibility filtering is frontier-focused for chained numeric ladders; it does not yet implement a broader reveal-on-discovery model.
- Unified progression readability metrics are present, but not yet tuned with player telemetry.

### 3.4 Balance and Economy Calibration

Not complete:
- Cost/work/prestige calibration against real revenue and progression telemetry.
- Late-game pacing targets for high-complexity research still need empirical validation.
- Grant and progression ROI still need pass-level balancing after broader track additions.

### 3.5 Documentation Debt in Catalog Copy

Still pending:
- Some project `benefits` text remains aspirational and not fully mapped to concrete mechanics.
- Every benefit line should be normalized to one of:
	- implemented unlock,
	- implemented permanent effect,
	- explicitly tagged future intent.

---

## 4. Consolidated Pipeline For The Next Agent

This is the recommended execution order.

### Phase 1: Build One Vineyard-Technique Vertical Slice

Goal:
- implement one end-to-end project with real mechanical impact.

Suggested slice:
- `agri_canopy_management`

Definition of done:
- project appears with proper gates,
- completion creates measurable runtime effect,
- effect is visible in active effects/footprint summary,
- regression tests updated.

### Phase 2: Implement Visibility Gating (Low-Risk First)

Goal:
- reduce catalog overwhelm using reveal logic.

Deliverables:
- achievement-triggered visibility rules for a small initial set,
- UI messaging for "hidden until milestone" behavior,
- deterministic tests for reveal conditions.

### Phase 3: Equipment Track Foundation

Goal:
- add minimal real system anchor for `equipment` unlocks.

Deliverables:
- define first enforceable equipment effect,
- add unlock enforcement point,
- keep scope narrow to avoid parallel system explosion.

### Phase 4: Balance Pass

Goal:
- calibrate research progression to playable pacing.

Deliverables:
- retune complexity-cost-work-prestige relationship,
- verify early/mid/late targets with repeatable test scenarios,
- document new target bands in this file.

---

## 5. Acceptance Criteria For Handoff Completion

The next agent should consider this handoff continuation successful when:

1. At least one previously not-implemented track item is fully shipped.
2. Visibility gating exists for at least one milestone type.
3. All newly added benefits are mechanically true at runtime.
4. Tests cover both unlock enforcement and visibility behavior for the new slice.
5. This document is updated with moved status lines (`not implemented` -> `implemented`).

---

## 6. Open Decisions (Keep Explicit)

1. Fermentation unlock model:
- maintain method-level unlock values or migrate to tiered tech levels.

2. Repeatability policy:
- should selected grant-style research be repeatable with cooldown rules.

3. Multi-vineyard scope semantics:
- clarify whether specific unlocks are global or site-local in multi-site wineries.

4. Staff-skill coupling:
- decide if selected research should require minimum staff skill thresholds.

---

## 7. Handoff Notes

- This pass intentionally ends with a consolidated doc and UI cleanup for tab boundaries.
- Catalog now treats `Hide completed` as the practical completion of the previous remove-completed UX intention.
- The backlog above is intentionally biased toward unimplemented gameplay-impact tracks, not cosmetic UI churn.
