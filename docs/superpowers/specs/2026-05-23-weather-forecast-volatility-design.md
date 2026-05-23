# Weather Forecast Volatility Design
**Date:** 2026-05-23  
**Status:** Approved for phased implementation

## 1. Goal
Add a top-level Weather system, parallel to Economy Phase, with:
- seasonal forecast baseline
- mostly reliable week-ahead forecast
- weekly realized weather variation
- immediate integration into grape buyer market volatility

This mechanic is designed as a shared macro driver for future systems:
- vineyard health
- ripeness growth
- wine/taste anchor channels

## 2. Approved Model
The weather model uses a mixed structure:
1. Seasonal forecast set at season start
2. Weekly weather realized inside that forecast
3. Week-ahead forecast shown to player
4. Forecast reliability mostly high, with occasional misses

## 3. Domain Types
Introduced top-level weather types:
- `WeatherState`: Clear, Rain, Heat, Frost, Storm, Snow
- `WeatherIntensity`: Mild, Moderate, Severe
- `WeatherForecastPattern`: Stable, Wet, Dry, Cold, Heat, Storm-prone
- `WeatherForecastConfidence`: Low, Medium, High

## 4. Generation Rules
### 4.1 Season start
Roll:
- forecast pattern
- forecast confidence

Seasonal pattern is weighted by season (e.g. Winter favors Cold/Storm-prone patterns).

### 4.2 Weekly realization
Each week resolves:
- current weather state
- current weather intensity

Using:
- season baseline weather distribution
- forecast pattern bias
- short persistence from previous state
- deterministic seeded randomness for reproducibility/debuggability

### 4.3 Week-ahead forecast
For next week:
- generate hidden likely next weather
- apply confidence-driven forecast error model

Reliability target:
- High confidence: mostly correct
- Medium confidence: commonly correct
- Low confidence: noticeably less reliable

## 5. Integration: Grape Market Volatility
Weather is added as a macro volatility deviation layer.

Final volatility stack now includes:
- season pressure
- economy pressure
- weather pressure (state + intensity)
- deterministic sentiment shock

The system preserves existing season/economy behavior and adds weather-driven variation.

## 6. Buyer Sensitivity Layer
Existing buyer metadata now has behavioral use:
- `buyerCategory`
- `dealStyle`
- `originTag`

These produce buyer-specific response multipliers for price/limit volatility sensitivity.

## 7. UI Integration
### 7.1 Header
Topbar now includes a Weather badge with icon and current state.
Tooltip includes:
- now weather
- week-ahead forecast
- seasonal forecast + confidence

### 7.2 Sell Grapes modal
Macro outlook now shows weather chip (state + intensity) and includes buyer profile response context.

## 8. Persistence Strategy (Current Slice)
Weather is generated deterministically and maintained in runtime game state.
No database migration is required for this first implementation slice.

## 9. Rollout Phases
### Phase 1 (in progress)
- weather types
- weather generator service
- tick integration
- header visibility
- grape market volatility integration

### Phase 2
- vineyard health + ripeness weather impacts

### Phase 3
- taste/anchor weather channel effects

### Phase 4
- optional research/upgrades that improve forecast confidence

## 10. Guardrails
- avoid season/weather double counting by treating weather as deviation around season baseline
- clamp volatility outputs for economic stability
- keep macro UI concise; expose details in tooltips/reasons
