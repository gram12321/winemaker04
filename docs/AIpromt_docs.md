## 📚 **Documentation Management**

### **Core Documentation Files**
- `@docs/versionlog.md` - Complete version history with commit tracking
- `@docs/coregame.md` - Comprehensive game system documentation (consolidated)
- `@readme.md` - Project overview and setup instructions
- `@.cursor/rules/ai-agent.rule.mdc/airulesVS.instructions.md` and `@.cursor/rules/airules.mdc` - AI agent rules (should be identical)

### **Legacy Reference Documentation**
- `@docs/old_iterations/v1/` - Original JavaScript implementation with complex balance system
- `@docs/old_iterations/v3/` - Previous React/TypeScript iteration with different architecture
- **Purpose**: Reference for implementing new features, understanding legacy systems, comparing approaches

### **Documentation Principles**
- **Rules vs README**: Keep rules clean of additional info, just AI rules. Avoid duplication between rules and README
- **Consolidation**: Major systems documented in `coregame.md` (wine characteristics, sales system, etc.)
- **Version Tracking**: Each Git commit gets a versionlog entry with technical details

### **AI Versionlog Update Guidelines**
- **Version Numbers**: Follow Git commit names (e.g., commit `9db1324f69a9358fab5fd59128806e4299cf5e1f` = version `0.0023a`)
- **Use MCP Tools**: Use Git MCP tools to check commits and create entries
- **Entry Format**: 3-5 lines per version depending on extent of updates
- **Focus Areas**: Changed files, added/removed functions/functionality
- **Exclude**: Bug fixes and unused code that was removed

### **Current Documentation Status**
- **✅ Updated**: `coregame.md` - Comprehensive system documentation (v0.0091b)
- **✅ Updated**: `versionlog.md` - Complete version history through v0.0091b
- **✅ Consolidated**: Wine characteristics and sales system documentation
- **🔄 Ongoing**: Regular updates with each development cycle 