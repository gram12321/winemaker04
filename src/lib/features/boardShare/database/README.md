# Dormant board-share persistence

These adapters are intentionally isolated with the dormant `boardShare` feature.
They are not imported by the active host and their former tables were removed by
`20260720192921_remove_deferred_legacy_schema.sql`.

When public-company gameplay is reintroduced, restore its schema through a new
migration before wiring these adapters into the feature facade.
