---
name: tdd-gram
description: Enforces practical TDD with red-green-refactor cycles, behavior-first tests, and disciplined mocking. Use when implementing behavior, fixing bugs, refactoring under tests, or when the user asks for TDD/test-first.
---

# TDD Gram

## Rule

Test first. Watch it fail for the expected reason. Implement only enough code to pass. Refactor only while green.

Use for features, bug fixes, refactors, and behavior changes. Ask the human before skipping for throwaway prototypes, generated code, config-only changes, or truly untestable setup. Exploration is allowed, but throw it away before starting TDD.

Iron law: no production behavior without a failing test first. Code written first is not trusted; delete it and reimplement from tests.

## Plan

Before coding:

- Confirm the public interface and priority behaviors with the human.
- Use the project's domain language, glossary, docs, and ADRs.
- List observable behaviors, not implementation steps.
- Design small, deep interfaces: few methods, simple params, complexity hidden inside.
- Do not write all tests first. Work in vertical slices: one test, one implementation, repeat.

## Cycle

1. RED: write one minimal test for one behavior through a public interface.
2. Verify RED: run it; it must fail because the behavior is missing, not because of typos or setup.
3. GREEN: write the simplest code that passes; add no speculative features and do no refactor.
4. Verify GREEN: run the focused test and relevant suite; output should be clean.
5. REFACTOR: while green, remove duplication, improve names, extract helpers, deepen modules, move logic to the right owner, and replace primitive obsession where useful.
6. Repeat with the next behavior.

If the new test passes immediately, it tests existing behavior or the wrong thing. Fix the test. If it errors, fix setup until it fails correctly.

## Test Design

Good tests read like specifications:

- Behavior callers care about.
- Public API only; private helpers are tested through public behavior.
- Clear name, one logical assertion, stable under internal refactor.
- Bug fixes start with a regression test.

Example: "rejects empty email" calls public `submitForm({ email: "" })` and asserts the returned error.

Bad tests reveal implementation:

- Mock internal collaborators.
- Test private methods.
- Assert call counts, call order, or mock existence.
- Query storage directly when a public read interface exists.
- Break when behavior is unchanged but internals move.

## Mocking

Mock only system boundaries: external APIs, time, randomness, filesystem, and sometimes databases when a test DB is not practical.

Do not mock code you own. Before mocking, know the real dependency's side effects, preserve side effects the test needs, and mock the slow or external layer instead of the high-level behavior under test. Mock data must match the real schema completely.

Never add test-only methods to production classes; put cleanup and fixtures in test utilities. If mock setup is larger than the test, prefer an integration test or simplify the design.

## Interface Pressure

Hard-to-test code is design feedback:

- Accept dependencies; do not construct external clients inside business logic.
- Return values instead of hiding outcomes in side effects.
- Keep surfaces small.
- Prefer specific boundary functions over one generic fetcher with conditional mocks.
- If you must mock everything, decouple the code.

## Completion

Before claiming done:

- Each new public function, changed behavior, edge case, and error path has a test that failed first.
- All tests pass with clean output.
- Tests exercise real behavior, not mocks.
- Refactors stayed green after each step.
- No test-only production API or over-complex mock remains.

## Red Flags

"I'll test after", "manual testing is enough", "too simple to test", "keep code as reference", "spirit not ritual", "just this once", "mock it to be safe", or "testing is a follow-up" all mean stop and restart from a failing test.

## Stuck

Write the wished-for API, then the assertion. If setup is huge, add helpers or simplify the interface. If the behavior is unclear, ask the human which public outcome matters most.
