# Knip Disagreements

This file documents cases where knip flags issues but we choose not to fix them, or where we disagree with knip's assessment.

## Unused Exports

### Large number of unused exports (~130+)

**Knip flags:** Many exported functions, classes, constants, and types that appear unused

**Our reasoning:** Many of these exports serve as:
1. **Public API surface**: Service creators (e.g., `createFiduVaultAPIClient`, `createContextsApi`), utility functions, and classes that may be used by external code or future features
2. **Internal utilities**: Functions that might be used in ways knip doesn't detect (dynamic imports, string-based references, or through other build tools)
3. **Future-proofing**: Exports kept for planned features or backward compatibility
4. **Type exports**: Some are TypeScript types/interfaces that may be used for type checking even if not directly imported

**Examples:**
- API service creators (`createContextsApi`, `createPromptsApi`, etc.) - part of public API
- Model configuration constants (`MODEL_CONFIGS_STAGING`, `MODEL_CONFIGS_PROD`) - may be used in build-time code generation
- Utility functions in hooks (`useResponsiveTypography`, `useResponsiveSizing`) - may be used in future components
- Service classes (`APIKeyService`, `RefreshTokenService`) - may be instantiated dynamically

**Decision:** We've removed clearly unused exports from barrel files (like `settings/index.ts`), but we're keeping most individual component/utility exports as they may be part of the public API or used in ways knip cannot detect. Removing them could break external integrations or future development.

## Unused Exported Types

### ~21 unused exported types/interfaces

**Knip flags:** Exported TypeScript types and interfaces that appear unused

**Our reasoning:** TypeScript types are often used for:
1. **Type checking**: Even if not directly imported, types can be used through type inference
2. **Documentation**: Types serve as documentation for the API surface
3. **Future use**: Types may be needed for future features or external integrations
4. **Build-time usage**: Some types may be used by build tools or code generators

**Decision:** Keep exported types as they serve important documentation and type safety purposes, even if not directly imported in the current codebase.
