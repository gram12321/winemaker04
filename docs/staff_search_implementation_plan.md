# Staff Search System Implementation Plan (v3 → v4)

## Current State Analysis

### v4 Current Implementation
- **Simple instant hiring**: `HireStaffModal` creates staff immediately
- **No search activity**: STAFF_SEARCH category exists but has empty completion handler
- **Backend ready**: Specialization system works (skill bonuses, wage calculations)
- **UI missing**: No specialization selection, no candidate review

### v3 Implementation (Target)
**Two-Phase System:**
1. **Search Activity**: User configures search → Activity created → Generates candidates
2. **Hiring Activity**: User selects candidate → Activity created → Staff added to company

---

## Implementation Plan

### Phase 1: Staff Search Activity System

#### 1.1 Create Staff Search Service Functions
**File**: `src/lib/services/user/staffSearchService.ts` (NEW)

**Functions to implement:**
```typescript
// Calculate search cost based on parameters
calculateSearchCost(options: StaffSearchOptions): number

// Calculate work estimate for search activity
calculateSearchWork(options: StaffSearchOptions): WorkEstimate

// Calculate hiring work range (min/max based on candidate quality)
calculateHiringWorkRange(skillLevel: number, specializations: string[]): { minWork: number; maxWork: number }

// Generate random staff candidates based on search parameters
generateStaffCandidates(options: StaffSearchOptions): Staff[]

// Start staff search activity
startStaffSearch(options: StaffSearchOptions): Promise<string | null>

// Complete staff search (called by activity completion handler)
completeStaffSearch(activity: Activity): Promise<void>

// Start hiring process for a specific candidate
startHiringProcess(candidate: Staff): Promise<string | null>

// Complete hiring process (called by activity completion handler)
completeHiringProcess(activity: Activity): Promise<void>
```

**Key types:**
```typescript
interface StaffSearchOptions {
  numberOfCandidates: number;
  skillLevel: number;
  specializations: string[]; // e.g., ['field', 'winery']
}

interface SearchWorkEstimate {
  totalWork: number;
  timeEstimate: string;
  cost: number;
}

interface HiringWorkEstimate {
  minWork: number;
  maxWork: number;
  timeEstimate: string;
}
```

#### 1.2 Update Activity Completion Handlers
**File**: `src/lib/services/activity/activitymanagers/activityManager.ts`

**Update `completionHandlers`:**
```typescript
[WorkCategory.STAFF_SEARCH]: async (activity: Activity) => {
  await completeStaffSearch(activity);
},

[WorkCategory.ADMINISTRATION]: async (activity: Activity) => {
  // Check if this is a hiring activity
  if (activity.params.isHiringActivity) {
    await completeHiringProcess(activity);
  } else {
    await completeBookkeeping(activity);
  }
}
```

#### 1.3 Store Search Results
**Challenge**: Where to store generated candidates between search completion and hiring selection?

**Solution**: Use a global state + localStorage for persistence:
```typescript
// In gameState or separate searchResultsState
interface SearchResults {
  activityId: string;
  candidates: Staff[];
  searchOptions: StaffSearchOptions;
  timestamp: number;
}
```

---

### Phase 2: UI Components

#### 2.1 Staff Search Options Modal
**File**: `src/components/ui/modals/UImodals/StaffSearchOptionsModal.tsx` (NEW)

**Features:**
- Number of candidates (dropdown: 1, 3, 5, 10)
- Skill level slider (0.1 - 1.0, showing skill level names)
- Specialization checkboxes (field, winery, administration, sales, maintenance)
- Real-time cost/work calculation display
- Two work calculation tables:
  1. Search Process estimate
  2. Hiring Process estimate (min-max range)
- Submit button showing total cost

**Component structure:**
```typescript
<ActivityOptionsModal
  title="Staff Search"
  subtitle="Find qualified candidates for your winery"
  category={WorkCategory.STAFF_SEARCH}
  fields={[
    { id: 'numberOfCandidates', type: 'select', ... },
    { id: 'skillLevel', type: 'range', ... },
    { id: 'specializations', type: 'checkbox-group', ... }
  ]}
  workEstimate={searchWorkEstimate}
  onSubmit={handleStartSearch}
>
  {/* Second work calculation table for hiring */}
  <HiringWorkEstimateSection />
</ActivityOptionsModal>
```

#### 2.2 Staff Search Results Modal
**File**: `src/components/ui/modals/UImodals/StaffSearchResultsModal.tsx` (NEW)

**Features:**
- Shows all generated candidates
- For each candidate displays:
  - Name, nationality (with flag), skill level
  - Specializations (if any)
  - Skill bars (visual representation)
  - Weekly wage
  - "Hire" button
- Click "Hire" → starts hiring activity for that candidate
- Close button (candidates persist until new search)

**Component structure:**
```typescript
interface StaffSearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: Staff[];
  onHire: (candidate: Staff) => Promise<void>;
}
```

#### 2.3 Update Staff Page
**File**: `src/components/pages/Staff.tsx`

**Changes:**
1. Replace "Hire Staff" button with "Search for Staff"
2. Remove `HireStaffModal` (or keep for debugging/admin)
3. Add `StaffSearchOptionsModal`
4. Add `StaffSearchResultsModal`
5. Listen for search completion to auto-open results modal

---

### Phase 3: Specialization UI Integration

#### 3.1 Display Specializations in Staff List
**File**: `src/components/pages/Staff.tsx`

**Current issue**: Line 163-170 shows specializations as raw strings
```typescript
{staff.specializations.map(spec => (
  <Badge key={spec}>{spec}</Badge>  // Shows 'field', 'winery'
))}
```

**Fix**: Map to proper titles
```typescript
import { SPECIALIZED_ROLES } from '@/lib/constants/staffConstants';

{staff.specializations.map(spec => (
  <Badge key={spec}>
    {SPECIALIZED_ROLES[spec]?.title || spec}
  </Badge>
))}
```

#### 3.2 Add Checkbox Group to ActivityOptionsModal
**File**: `src/components/ui/activities/activityOptionsModal.tsx`

**Add new field type:**
```typescript
{field.type === 'checkbox-group' && (
  <div className="space-y-2">
    {field.checkboxOptions?.map(option => (
      <label key={option.value} className="flex items-start">
        <input
          type="checkbox"
          checked={options[field.id]?.includes(option.value)}
          onChange={e => handleCheckboxChange(field.id, option.value, e.target.checked)}
          className="mr-2 mt-1"
        />
        <div>
          <div className="font-medium">{option.label}</div>
          {option.description && (
            <div className="text-xs text-gray-500">{option.description}</div>
          )}
        </div>
      </label>
    ))}
  </div>
)}
```

---

### Phase 4: Integration & Testing

#### 4.1 Activity Flow
```
User clicks "Search for Staff"
  ↓
Opens StaffSearchOptionsModal
  ↓
User configures: 5 candidates, skill 0.5, specializations: ['field']
  ↓
Calculates cost (e.g., €12,000) and work (e.g., 150)
  ↓
User submits → Creates STAFF_SEARCH activity
  ↓
User assigns staff to activity
  ↓
Activity progresses over time
  ↓
Activity completes → Calls completeStaffSearch()
  ↓
Generates 5 candidates with field specialization
  ↓
Stores candidates in state/localStorage
  ↓
Opens StaffSearchResultsModal
  ↓
User clicks "Hire" on a candidate
  ↓
Creates ADMINISTRATION activity (isHiringActivity: true)
  ↓
Activity completes → Calls completeHiringProcess()
  ↓
Staff added to company, wages deducted
  ↓
Success notification
```

#### 4.2 Cost & Money Flow
1. **Search cost**: Deducted when activity STARTS
2. **Hiring cost**: Deducted when hiring activity COMPLETES (first month's wage)
3. **Transaction records**: Both should create finance transactions

#### 4.3 Database Considerations
- Staff candidates (temporary): Store in localStorage or memory
- Hired staff: Saved to Supabase staff table
- Search/hiring activities: Saved to activities table

---

## File Checklist

### New Files to Create
- [ ] `src/lib/services/user/staffSearchService.ts`
- [ ] `src/components/ui/modals/UImodals/StaffSearchOptionsModal.tsx`
- [ ] `src/components/ui/modals/UImodals/StaffSearchResultsModal.tsx`

### Files to Modify
- [ ] `src/lib/services/activity/activitymanagers/activityManager.ts` (completion handlers)
- [ ] `src/components/pages/Staff.tsx` (replace hire button, add modals)
- [ ] `src/components/ui/activities/activityOptionsModal.tsx` (add checkbox-group)
- [ ] `src/lib/constants/staffConstants.ts` (export SPECIALIZED_ROLES properly)
- [ ] `src/lib/services/index.ts` (export new staff search functions)
- [ ] `src/lib/types/UItypes.ts` (add checkbox-group option type)

### Optional Files (Keep for Reference/Admin)
- [ ] `src/components/ui/modals/UImodals/HireStaffModal.tsx` (keep or remove)

---

## Migration Strategy

### Option A: Big Bang (Recommended)
Implement all phases at once, replace old hiring system completely.

**Pros**: Clean, no confusion, matches v3
**Cons**: More work upfront

### Option B: Gradual
Keep `HireStaffModal` as fallback, add new system alongside.

**Pros**: Lower risk, can test incrementally
**Cons**: Confusing to have two hiring methods

---

## Testing Checklist

### Functionality Tests
- [ ] Search cost calculation matches expectations
- [ ] Work calculation varies with parameters
- [ ] Specialization checkboxes work
- [ ] Search activity creates successfully
- [ ] Search completion generates correct number of candidates
- [ ] Candidates have correct skill levels
- [ ] Specialized candidates have higher skills in their area
- [ ] Specialized candidates have higher wages
- [ ] Results modal displays all candidates
- [ ] Hiring activity starts from results modal
- [ ] Hiring completion adds staff to company
- [ ] Money is deducted at correct times
- [ ] Transactions are recorded
- [ ] Multiple searches work correctly
- [ ] Cancelling activities works

### Edge Cases
- [ ] Not enough money for search
- [ ] Not enough money for hiring
- [ ] No staff available to assign to search activity
- [ ] Search activity cancelled mid-process
- [ ] Hiring activity cancelled mid-process
- [ ] Multiple simultaneous searches
- [ ] Search with no specializations
- [ ] Search with multiple specializations

---

## Questions to Resolve

1. **Where to store candidate results?**
   - Option A: localStorage (persists across refreshes)
   - Option B: Game state only (lost on refresh)
   - Recommendation: Game state + localStorage backup

2. **When to deduct search cost?**
   - Option A: At activity start (v3 approach)
   - Option B: At activity completion
   - Recommendation: At start (upfront cost)

3. **Can user hire multiple candidates from one search?**
   - Option A: Yes, each creates hiring activity
   - Option B: No, can only hire one
   - Recommendation: Yes (more flexibility)

4. **What happens to unhired candidates?**
   - Option A: Persist until new search
   - Option B: Expire after time period
   - Recommendation: Persist until new search

5. **Should hiring cost be first week's wage or full monthly?**
   - v3 used monthly wage calculation but might have charged weekly
   - v4 currently uses seasonal wage payments
   - Recommendation: Charge first month's wage at hire time

---

## Implementation Priority

### Must Have (MVP)
1. StaffSearchService basic functions
2. StaffSearchOptionsModal (without specializations first)
3. Activity completion handlers
4. StaffSearchResultsModal
5. Basic hire flow

### Should Have
6. Specialization selection in search
7. Checkbox group component
8. Hiring work calculation
9. Specialization display improvements

### Nice to Have
10. Advanced cost tooltips
11. Candidate comparison features
12. Search history
13. "Save candidate for later" feature

---

## Success Criteria

✅ User can search for staff with configurable parameters
✅ Search creates an activity that requires staff assignment
✅ Search completion shows candidate results
✅ User can review multiple candidates before hiring
✅ Hiring creates a second activity
✅ Hired staff appears in staff list with correct skills and wages
✅ Specializations work end-to-end (selection → generation → display)
✅ Money flows correctly (search cost + hiring cost)
✅ System matches v3 functionality

