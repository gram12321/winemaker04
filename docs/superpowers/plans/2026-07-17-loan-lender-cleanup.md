# Loan Lender Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make loan quotes, activities, UI previews, and completed loans use one consistent payload while reducing duplicated lifecycle and finance logic.

**Architecture:** Keep `loanLenderFeature` as the public facade. Add a focused quote/read-model seam for borrower-facing calculations, preserve database adapters as persistence owners, and split the large lifecycle implementation by payment/default/restructure behavior without changing public feature hooks.

**Tech Stack:** React, TypeScript, Vitest, Supabase-backed database adapters.

---

### Task 1: Preserve finalized loan applications and search quotes

**Files:**
- Modify: `src/lib/types/types.ts`
- Modify: `src/lib/features/loanLender/services/activity/activitymanagers/takeLoanManager.ts`
- Modify: `src/lib/features/loanLender/services/activity/activitymanagers/lenderSearchManager.ts`
- Modify: `src/lib/features/loanLender/ui/LenderSearchOptionsModal.tsx`
- Modify: `src/lib/features/loanLender/ui/LenderSearchResultsModal.tsx`
- Test: `tests/finance/loanLifecycle.test.ts`

- [ ] Add an explicit finalized application payload type containing the adjusted amount, duration, terms, and work.
- [ ] Persist that payload in the take-loan activity and consume it in `completeTakeLoan`.
- [ ] Move lender-search quote adjustment into a shared service result so preview and activity creation agree.
- [ ] Add tests proving adjusted values survive activity completion.

### Task 2: Centralize loan quote and payment summaries

**Files:**
- Create: `src/lib/features/loanLender/services/finance/loanQuoteService.ts`
- Modify: `src/lib/features/loanLender/ui/LenderSearchOptionsModal.tsx`
- Modify: `src/lib/features/loanLender/ui/LenderSearchResultsModal.tsx`
- Modify: `src/lib/features/loanLender/ui/LoansView.tsx`
- Modify: `src/lib/features/loanLender/services/activity/activitymanagers/*.ts`
- Test: `tests/finance/loanQuoteService.test.ts`

- [ ] Centralize borrower capacity, loan terms, search quote, and payment summary calculations.
- [ ] Keep UI modules focused on state and rendering.
- [ ] Ensure displayed extra-payment fees match the charged fees.

### Task 3: Extract residual tunable loan constants

**Files:**
- Modify: `src/lib/constants/loanConstants.ts`
- Modify: `src/lib/features/loanLender/services/finance/lenderService.ts`
- Modify: `src/lib/features/loanLender/services/finance/loanService.ts`
- Test: `tests/finance/loanCalculations.test.ts`

- [ ] Name lender-generation, prestige-availability, and liquidation values.
- [ ] Replace repeated seizure and forced-sale literals with the constants.

### Task 4: Split the self-contained repayment module

**Files:**
- Create: `src/lib/features/loanLender/services/finance/loanPaymentService.ts`
- Modify: `src/lib/features/loanLender/services/finance/loanService.ts`
- Modify: `src/lib/features/loanLender/feature.tsx`
- Test: `tests/finance/loanLifecycle.test.ts`

- [ ] Move self-contained repayment operations and outstanding-balance reads behind a focused module.
- [ ] Keep the intertwined payment-warning/default/restructure tick orchestration together until its shared liquidation state can be separated safely.
- [ ] Preserve persistence failure propagation and global update behavior.

### Task 5: Documentation and regression coverage

**Files:**
- Modify: `docs/PROJECT_INFO.md`
- Modify: `docs/WineSystem_VariableRelationshipMap.md`
- Modify: `docs/AIdocs/AIDescriptions_coregame.md` only if behavior-facing wording changes.
- Test: loan finance and feature API tests.

- [ ] Document quote ownership and lifecycle module ownership.
- [ ] Add regression coverage for warnings, defaults, restructuring, and adjusted applications.

### Task 6: Verification and sanitation

- [ ] Run focused finance tests.
- [ ] Run `npm test`.
- [ ] Run `npm run build` because service/UI boundaries changed.
- [ ] Run `git diff --check`.
- [ ] Scan for service logic in UI, hardcoded loan economics, and bypassed feature barrels.
