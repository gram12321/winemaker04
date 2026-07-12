# Weather Phase 2 Final Design: Vineyard Integration
**Date:** 2026-05-23  
**Status:** Historical superseded design (2026-07-11 weather module redesign replaced its runtime implementation).

> Historical record only. The active weather owner is `src/lib/features/weather/`; references below to former service files and raw deviation tables do not describe current runtime.

Implementation note: deterministic vineyard health/ripeness impact, site coupling, Weather Center, and planned-alert shell are implemented. Severe weather event mechanics, recommended action engine, research/weather upgrades, weather achievements, and additional boundary/deterministic fixture tests remain deferred or active follow-up.

## 1. Purpose and Lineage
This document defines the final Phase 2 design for extending weather into vineyard simulation.

Source lineage:
- `docs/superpowers/completed/2026-05-23-weather-forecast-volatility-design.md`
- `docs/superpowers/plans/2026-05-20-early-game-balance-founder-economy.md` (bulk grape market iteration context)

This Phase 2 design applies weather to:
- vineyard health progression
- ripeness progression

And couples weather response with site factors:
- aspect
- altitude
- terroir suitability
- soil retention/inertia behavior

## 2. Scope and Non-Goals

### 2.1 In Scope
- Deterministic weather impact on weekly vineyard health updates.
- Deterministic weather impact on weekly ripeness updates.
- Site-response coupling (aspect, altitude, terroir, soil) as bounded modifiers on weather impact.
- Player-facing concise weather reason output in vineyard-facing UI surfaces.
- Test coverage for deterministic replay and severe weather edge cases.

### 2.2 Out of Scope
- Taste/anchor weather channels (Phase 3).
- Forecast confidence upgrades/research (Phase 4).
- Economy rewrite or grape market volatility redesign (must remain behaviorally intact).

## 3. Design Goals
- Preserve determinism and reproducibility.
- Keep season as baseline and weather as deviation around baseline.
- Avoid runaway compounding.
- Keep model explainable to players.
- Reuse current weather runtime context already generated in tick flow.

## 4. Current Foundation (Already Shipped)
- Top-level weather runtime exists with deterministic weekly state + intensity.
- Tick already has weather context each week.
- Weather already drives grape market volatility in a deterministic way.
- Winepedia weather page and topbar weather UX already exist.

Phase 2 extends this same framework to vineyard simulation.

## 5. Final Effect Model

### 5.1 Core Principle
For each weekly update:
- `Season baseline` remains the primary progression logic.
- `Weather deviation` is a bounded additive/multiplicative adjustment.
- `Site response` scales only the weather deviation, not the season baseline.

This prevents season/weather double counting.

### 5.2 Two-Layer Equation
For each vineyard and week:

1. Compute baseline deltas with existing season logic:
- `baseRipenessDelta`
- `baseHealthDelta`

2. Compute weather deviation:
- `weatherRipenessDelta = weatherBaseRipenessDelta(state, intensity, seasonWindow)`
- `weatherHealthDelta = weatherBaseHealthDelta(state, intensity, seasonWindow)`

3. Compute site response multiplier (bounded):
- `siteResponse = f(aspect, altitude, terroir, soil, weatherState)`

4. Apply bounded final deltas:
- `finalRipenessDelta = clamp(baseRipenessDelta + weatherRipenessDelta * siteResponse, RIPENESS_DELTA_MIN, RIPENESS_DELTA_MAX)`
- `finalHealthDelta = clamp(baseHealthDelta + weatherHealthDelta * siteResponse, HEALTH_DELTA_MIN, HEALTH_DELTA_MAX)`

5. Apply state clamps:
- `ripeness = clamp(ripeness + finalRipenessDelta, 0, 1)`
- `vineyardHealth = clamp(vineyardHealth + finalHealthDelta, 0.1, 1)`

### 5.3 Weather Severity Direction
Default direction by weather state/intensity:
- Clear (Mild/Moderate): neutral to slight positive consistency.
- Rain: slight positive or neutral ripeness (context-sensitive), generally positive short-term health in dry windows, neutral/slightly negative in saturated windows.
- Heat: positive ripeness momentum up to a cap, negative health at Moderate/Severe.
- Frost: strongly negative ripeness in sensitive windows, negative health at Moderate/Severe.
- Storm: negative health and ripeness consistency, strongest at Severe.
- Snow: ripeness suppression outside dormancy-friendly windows; minor health stress unless already winter-dormant context.

## 6. Site Coupling Design (Feedback + Brainstorm Consolidation)

### 6.1 Aspect Coupling (Approved)
Design feedback: strong fit.

Use aspect to modulate heat/frost sensitivity of weather deviation only.
- South/Southeast/Southwest: amplify Heat effect and reduce Frost penalty slightly.
- North/Northeast/Northwest: reduce Heat acceleration and amplify Frost penalty.
- East/West: near-neutral.

Bounded multiplier example:
- aspect response range target: `0.85 - 1.15`.

### 6.2 Altitude Coupling (Approved)
Design feedback: strong fit and realistic.

Use altitude band normalization to alter thermal weather response:
- Higher altitude: stronger Frost/Snow effect, weaker Heat acceleration.
- Lower altitude: opposite tendency.

Bounded multiplier example:
- altitude response range target: `0.9 - 1.1` per channel.

### 6.3 Terroir Coupling (Approved, keep simple in Phase 2)
Design feedback: good but should avoid over-modeling.

Use terroir/suitability as resilience/sensitivity factor for volatility absorption:
- Better grape-site suitability should dampen extreme negative weather deviations.
- Poor suitability should amplify negative deviation.

Bounded multiplier example:
- terroir response range target: `0.9 - 1.1`.

### 6.4 Soil Coupling (Approved)
Design feedback: excellent thematic and mechanical fit.

Represent soil with two weather-response properties:
- `waterRetention`: how strongly Rain/Snow buffers or saturates.
- `thermalInertia`: how strongly Heat/Frost swings are damped.

Phase 2 implementation approach:
- Map existing soil types into coarse classes rather than per-soil bespoke formulas.
- Example classes: fast-draining, balanced, high-retention, rocky-low-inertia, clay-high-inertia.

Bounded multiplier example:
- soil response range target: `0.85 - 1.15`.

## 7. Determinism Contract

### 7.1 Required Behavior
Given same:
- companyId
- year/season/week
- vineyard snapshot

The resulting health/ripeness deltas must be identical.

### 7.2 Implementation Rule
- Do not use direct `Math.random()` in weather-driven health/ripeness updates.
- Use deterministic seeded helpers keyed by company + time + vineyard + channel if stochastic variation is still needed.
- Prefer pure table-driven weather effects in Phase 2 and reserve extra stochastic noise for later phases only if needed.

## 8. Data and Configuration Structure

### 8.1 New Constants (Target)
- `WEATHER_RIPENESS_DEVIATION_BY_STATE_INTENSITY`
- `WEATHER_HEALTH_DEVIATION_BY_STATE_INTENSITY`
- `ASPECT_WEATHER_RESPONSE`
- `ALTITUDE_WEATHER_RESPONSE_CURVE`
- `TERROIR_WEATHER_RESILIENCE_CURVE`
- `SOIL_WEATHER_RESPONSE_PROFILE`
- Hard clamps for per-week max effect and final state bounds.

### 8.2 Function Structure (Target)
- `calculateWeatherRipenessDeviation(...)`
- `calculateWeatherHealthDeviation(...)`
- `calculateSiteWeatherResponse(...)`
- `composeVineyardWeatherDelta(...)`

Keep composition in service layer, not component/UI layer.

## 9. Integration Points

### 9.1 Tick Flow
Weather is already available during weekly tick progression. Phase 2 should pass weather context directly into vineyard update functions instead of re-reading implicit globals.

Target pattern:
- `updateVineyardRipeness(season, week, weatherContext)`
- `updateVineyardHealthDegradation(season, week, weatherContext)`

### 9.2 Existing Seasonal Baselines
Current season baselines (ripeness increase and health degradation) remain baseline layer. Weather applies as deviation only.

## 10. Explainability UX

### 10.1 Player-Facing Reason Text
Add concise reason payloads when values change significantly:
- top reason category (`Heat Stress`, `Frost Shock`, `Rain Recovery`, etc.)
- net weather delta contribution (small formatted value)
- optional site note (`north-facing slope amplified frost impact`)

### 10.2 Noise Control
- No per-cell spam.
- Prefer modal/section summary and concise tooltip-level details.
- Reuse existing style from volatility reason patterns.

## 11. Weather UI Surface Plan

### 11.1 Why New UI Is Required
Topbar badge + Winepedia reference content is insufficient once weather directly affects vineyard outcomes. Weather needs an operational screen for planning, not only descriptive documentation.

### 11.2 New Screen: Weather Center (Phase 2 UI)
Add a dedicated Weather Center page for weekly decision support.

Phase 2 implementation scope for this screen:
- Current weather hero panel (state, intensity, week-ahead forecast, confidence).
- Seasonal outlook strip (short horizon, forecast + uncertainty).
- Global impact summary cards (ripeness momentum, health pressure, market volatility context).
- Vineyard impact table (per-vineyard net weather delta preview + concise reason).
- Alerts panel shell with clearly labeled placeholder state for future event/action systems.

### 11.3 Alerts Panel Status (Deferred Mechanics)
Alerts are approved as a core UI element, but the full mechanics are deferred.

In Phase 2 UI:
- Include an Alerts panel container and empty-state copy.
- Mark severe-event alerts as "planned".
- Mark recommended-action cards as "planned".
- Do not imply automated destructive events are active yet.

Placeholder messaging examples:
- "Severe weather event alerts (for example hail damage) are planned for a future phase."
- "Recommended action guidance will unlock when agricultural protection and response systems are implemented."

### 11.4 Future Alert/Event Mechanism (Post-Phase 2)
Planned future system requirements:
- Explicit weather-event trigger model (for example hail incidents).
- Event payload schema (event type, severity, affected vineyards, impact values, duration).
- Resolution and mitigation hooks.
- Player notification + acknowledgement flow.

No event-damage implementation is included in Phase 2.

### 11.5 Future Recommended Action Mechanism (Post-Phase 2)
Planned future system requirements:
- Decision engine mapping weather risk to actionable operations.
- Coupling to staff activities, vineyard operations, and protection investments.
- Coupling to research/project unlocks for prevention and resilience.

No auto-generated recommended actions are required in Phase 2.

## 12. Phase Roadmap Clarification

### 12.1 Phase 2 (Current)
- Deterministic weather impact on vineyard health/ripeness.
- Site-response coupling.
- Weather Center operational UI.
- Alerts panel shell only (future mechanics clearly marked planned).

### 12.2 Phase 3 (Planned)
- Taste/anchor weather channels.
- Optional first release of explicit severe weather events and impact rules if stable.
- Optional first release of recommended-action engine if vineyard operations dependencies are ready.

### 12.3 Phase 4 (Planned)
- Forecast-confidence-altering research/upgrades.
- Broader weather strategy layer (improved forecasting, resilience investments, response optimization).

## 13. Research and Achievement Connections

### 13.1 Research Integration (Planned Extensions)
Research tie-ins are highly thematic and mechanically coherent.

Recommended future research branches:
- Forecasting: improved confidence floor, lower miss severity.
- Vineyard protection: reduced severe-weather damage multipliers.
- Soil and canopy management: better retention/inertia response under extremes.
- Climate adaptation: improved resilience curves for specific weather states.

Phase 2 requirement:
- Only document these as planned hooks.
- Do not hard-wire forecast upgrades in the Phase 2 mechanic.

### 13.2 Achievement Integration (Planned Extensions)
Achievement tie-ins make sense for progression and teaching weather literacy.

Candidate achievement themes:
- "Storm Survivor": complete a season with multiple severe events and no vineyard collapse.
- "Precision Harvester": achieve high ripeness targets through adverse forecast windows.
- "Climate Strategist": sustain healthy vineyards across multi-season weather volatility.
- "Prepared Vintner": unlock and use protection-oriented research paths.

Phase 2 requirement:
- Reserve achievement ids/labels only if useful for UI continuity.
- Full trigger logic can be introduced in later phases with event/research systems.

## 14. Validation and Test Matrix

### 14.1 Required Tests
- Unit tests:
  - weather deviation table correctness
  - site response composition and clamp behavior
  - severe state edge cases (Frost/Heat/Storm)
- Integration tests:
  - weekly tick applies weather-driven vineyard changes
  - deterministic replay across identical inputs
- Regression tests:
  - grape market weather-volatility behavior unchanged
  - Weather Center renders correctly with and without planned-alert data

### 14.2 Balance Checks
- Multi-season sim pass (no collapse/exploit trends).
- Ensure Year 1 and early-game loops remain survivable without introducing hidden punitive spikes.

## 15. Implementation Sequence (Final)
1. Add constants/tables for weather deviations and site response curves.
2. Implement pure helper functions (weather deviation, site response, composition).
3. Wire weather context into vineyard weekly update functions.
4. Replace non-deterministic randomness in these vineyard paths with deterministic or table-driven behavior.
5. Implement Weather Center UI with operational weather and vineyard-impact surfaces.
6. Add Alerts panel shell and planned-state messaging (no severe-event mechanics yet).
7. Add reason payloads and vineyard-facing explanation surfaces.
8. Update Winepedia Weather content to include vineyard impact model, site coupling summary, and Weather Center guidance.
9. Execute deterministic, regression, and balance verification.
10. Tune constants with small bounded adjustments.

## 16. Risk Register
- Over-coupling too many factors can create opaque outcomes.
- Excessive soil/aspect/altitude weighting can punish specific regions too hard.
- Hidden compounding with existing seasonal penalties can create runaway decline.

Mitigation:
- Strict per-layer clamps.
- Small initial coefficient ranges.
- Test matrix and replay checks before tuning expansion.
- Keep planned alerts/recommended-actions clearly labeled until mechanics are implemented.

## 17. Final Summary
Phase 2 is now defined as a deterministic, explainable extension of weather into vineyard health and ripeness, with a dedicated Weather Center UI for operational visibility. Aspect, altitude, terroir, and soil are included as bounded site-response scalers on weather deviation only. Alert events and recommended actions are intentionally prepared in UI/design as planned future systems. This preserves current seasonal baselines, prevents double counting, and keeps the model extensible for later taste/anchor, research, and achievement-connected weather strategy phases.
