
# AI Prompt: Code Cleanup And Refactoring
## 🧹 **Code Cleanup & Optimization**

### **Current Project Status**
We have implemented comprehensive systems across multiple files and may need cleanup after extensive development cycles.

- Prefer in-place deletion. Do not add wrappers, compatibility paths, caches, generic abstractions, migrations, hooks, or components unless the final production-code delta is negative and control flow is simpler.

### **Cleanup Targets**
- **Illogical Code Placement**: Functions/services in wrong directories or files
- **Duplicate Code**: Repeated functionality across multiple files
- **Unnecessary Code**: Dead code, unused imports, placeholder functions
- **Redundant Code**: Multiple implementations of the same functionality
- **Inefficient Code**: Performance bottlenecks, unnecessary database calls, poor algorithms
- **Excessive Comments**: Overly descriptive comments that state the obvious, Remove obvious comments that restate what the code does, keep only business logic explanations and non-obvious technical details. Or comments written to/from Humans

### **Specific Areas to Review**
- **Services**: `src/lib/services/` - Check for duplicate functionality across user/, sales/, wine/, core/
- **Components**: `src/components/` - Look for duplicate UI patterns and unused components
- **Hooks**: `src/hooks/` - Consolidate similar state management patterns
- **Utils**: `src/lib/utils/` - Remove duplicate helper functions
- **Types**: `src/lib/types/` - Consolidate similar interfaces
- **Constants**: `src/lib/constants/` - Remove unused constants and consolidate related data

### **Cleanup Goals**
- **Improve Readability**: Clear code structure and naming conventions
- **Enhance Efficiency**: Optimize performance and reduce redundancy
- **Maintain Functionality**: Ensure all features continue to work after cleanup
- **Reduce Complexity**: Simplify overly complex implementations
- **Better Organization**: Logical file structure and import patterns

### **Expected Cleanup Task**
A cleanup task is a behavior-preserving, deletion-first pass:
- Remove dead code, pass-through wrappers, duplicate implementations, unused exports, generated artifacts, and redundant state/effects.
- Keep one canonical module or policy; move logic only when ownership becomes clearer.
- Do not add features, compatibility paths, abstractions, caches, or types unless total code and complexity decrease.
- Keep shared constants centralized and UI components presentation-only.
- Verify with tests, TypeScript/build checks, and `git diff --check`; report deferred work separately.

### **Cleanup Process**
1. **Identify Issues**: Scan for duplicate, unused, or inefficient code
2. **Plan Refactoring**: Design better structure without breaking functionality
3. **Implement Changes**: Refactor code with proper testing
4. **Verify Functionality**: Ensure all systems continue to work
5. **Update Documentation**: Reflect changes in documentation

### **Versionlog Governance Sync**
- Versionlog updates are handled by a dedicated versionlog subagent only, only after human-created commits exist (AI commits only if explicitly requested).

### **basic cleanups (Lowest priority)**
1. Fix import/export to use barrel export
2. Fix import one line per file
3, Fix export use index.ts barrel export (use * wildcards) for all exports.
