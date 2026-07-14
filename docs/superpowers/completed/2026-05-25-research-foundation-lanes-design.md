# Research Foundation Lanes Design
**Date:** 2026-05-25
**Status:** Implemented design record. Code-verified on 2026-07-14: foundation IDs, the first-pass admin effect, company-age eligibility, staff productivity effects, and the grant chain are present in current mainline.
**Owner:** Gameplay progression

Implementation note: current mainline also completes the intended foundation-lane rollout. The renamed IDs are persisted through migration, starting conditions no longer pre-unlock the admin foundation, age/achievement/company-value guards are enforced, and admin/staff/grant effects are represented by runtime unlocks or permanent effects. Optional grant cadence/quality modifiers and later experimental branches remain outside this design.

## 1. Objective
Redesign early research progression into three distinct foundation lanes that control access to the broader tree through different guard types.

Primary goals:
- Remove free start unlock of the current `admin_basic` foundation node.
- Ensure foundation research claims only implemented effects.
- Introduce real mechanical effect for administration foundation work.
- Split progression control into three mostly independent early lanes:
  - Administration foundation lane
  - Staff foundation lane
  - Grant foundation lane
- Avoid "all lanes blocked by the same thing" feel.

## 2. Current Problems
- `admin_basic` is granted by all starting conditions, so it does not function as progression.
- `admin_basic` claims "Reduced administrative overhead" without an implemented mechanical effect.
- Early lane identity is blurred; admin/staff/grant progression does not strongly communicate distinct progression fantasies.

## 3. Proposed Lane Model (Renamed IDs)
The user explicitly approved ID renames and save-break risk.

### 3.1 Administration Foundation Lane
- `admin_basic` -> `foundation_admin_baseline`
- `admin_research_methodology` -> `foundation_admin_methodology`
- `admin_research_office` -> `foundation_admin_office`

Implemented lane fantasy:
- Build organizational discipline and internal process quality.

Mechanical effects focus:
- Reduce work requirement for Administration/Research category tasks.
- Improve research execution speed via existing research staff multiplier nodes.

Primary guard type:
- Company value + company age (weeks since start).

### 3.2 Staff Foundation Lane
- `staff_onboarding_program` -> `foundation_staff_onboarding`
- `staff_training` -> `foundation_staff_training`
- `staff_leadership_pipeline` -> `foundation_staff_leadership`

Implemented lane fantasy:
- Upgrade all staff operations quality, not just research.

Mechanical effects focus:
- Better effective throughput across multiple staff-driven categories over time.
- Preserve clear category scope for each bonus (avoid hidden global multipliers).

Primary guard type:
- Achievement milestones + company value.

### 3.3 Grant Foundation Lane
- `project_grant_basic` -> `foundation_grant_basic`
- `project_grant_advanced` -> `foundation_grant_advanced`
- Add new mid node: `foundation_grant_programmatic`

Implemented lane fantasy:
- Build legitimacy and external funding access.

Mechanical effects focus:
- Structured grant payouts and grant-chain unlock progression.
- Optional future: grant cadence/quality modifiers.

Primary guard type:
- Prestige + achievement milestones.

## 4. Guard Capability Model
Current implemented guard fields:
- `requiredPrestige`
- `prerequisites`
- `requiredCompanyValue`
- `requiredBuyerLoyaltyLevel`
- `requiredAchievementIds`

New proposed guard field:
- `requiredCompanyAgeWeeks` (time since company start)

Rationale:
- Time/age guard should be used sparingly to prevent "rush everything in week 1" behavior while still allowing non-linear play.

## 5. Guard Diversity Matrix
Each lane should have one dominant guard, one secondary guard, and one optional tertiary guard.

- Administration lane:
  - Dominant: company value
  - Secondary: company age weeks
  - Optional tertiary: small prestige floor

- Staff lane:
  - Dominant: achievement milestones
  - Secondary: company value
  - Optional tertiary: prerequisite from admin lane for upper staff nodes only

- Grant lane:
  - Dominant: prestige
  - Secondary: achievement milestones
  - Optional tertiary: company value floor for late grant node

## 6. Downstream Gating Recommendations
The three foundation lanes should gate different branch clusters.

### 6.1 Gate via Administration Lane
Gate these behind `foundation_admin_baseline` (or later admin chain nodes):
- Core technology fundamentals (fermentation basics, soil analysis)
- Governance/capacity paperwork progression nodes
- Late research-speed office/institute chain

### 6.2 Gate via Staff Lane
Gate these behind `foundation_staff_onboarding` and higher:
- Staff-cap scaling chain nodes
- Multi-estate coordination staff nodes
- Operational staffing unlocks tied to complexity escalation

### 6.3 Gate via Grant Lane
Gate these behind `foundation_grant_basic` and higher:
- Capital-intensive commercial/technology research nodes
- Late market intelligence and network-expansion projects
- Optional future high-risk/high-reward experimental tracks

## 7. First-Pass Changes (Requested Now)
This design includes a limited first-pass implementation before full lane rollout:
- Remove free starting unlock of admin foundation from all countries.
- Implement real admin overhead effect on the admin foundation project.
- Update admin foundation benefits text to only reflect implemented effects.

This first pass is intentionally narrow and does not perform full lane rename migration yet.

## 8. Full Rollout Plan (After Review)
### Phase 1: Foundation lane rename migration
- Rename IDs in constants and prerequisites.
- Add migration SQL for persisted `research_unlocks` IDs if retaining old saves matters.
- Update all references in services/UI/tests.

### Phase 2: New guard field and enforcement
- Add `requiredCompanyAgeWeeks` to project typing and eligibility service.
- Source company age from company creation metadata and current game date.
- Surface age-gate reason in UI.

### Phase 3: Staff lane broadening
- Expand staff-lane bonuses beyond research-only behavior.
- Ensure bonuses are explicit and test-covered per category.

### Phase 4: Grant lane chaining
- Add programmatic grant middle node and rebalance grant path.
- Re-gate target commercial/technology branches.

## 9. Data and Migration Notes
- User approved breaking saves and SQL migrations if needed.
- Preferred migration shape:
  - SQL remap table for old->new research IDs.
  - One migration script updating `research_unlocks.research_id` values.

## 10. Acceptance Criteria
- Admin foundation is no longer free at game start.
- Admin foundation has at least one measurable implemented effect.
- Admin foundation UI text contains no aspirational-only claim.
- Design review approved before full three-lane rollout starts.
