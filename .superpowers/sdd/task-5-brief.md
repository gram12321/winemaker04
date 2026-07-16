### Task 5: Update staff and assignment UI without business logic in React

- Replace broad-role task choices/displays with WorkCategory groups using shared labels/descriptions/icons; no Sales subskill UI.
- Convert every staff display/search/start/founder reference from `specializations` and `SPECIALIZED_ROLES` to `taskSpecializations` shared helpers (including FounderPanel integration reference).
- Display learned Grape Mastery by `experience` keys beginning `grape:`; do not expose raw keys or task XP.
- Assignment modal displays calculator-supplied task/grape bonuses and expected work, with no business calculations.
- Update wage/specialization wording and neutral empty state.
- Add focused component/service-backed coverage as project patterns allow; ensure TypeScript is clean for UI contract.
