# Knip Disagreements

This file documents cases where knip flags issues but we choose not to fix them, or where we disagree with knip's assessment.

## Duplicate Exports

### `getFiduAuthService|getFiduTokenService|getFiduAuthCookieService` in `src/services/auth/FiduAuthService.ts`

**Knip flags this as:** Duplicate exports

**Our reasoning:** These are not true duplicates - they are three separate named exports. `getFiduTokenService` and `getFiduAuthCookieService` are documented as "legacy aliases to ease migration" and are intentionally kept for backward compatibility, even though they may not be actively used in the current codebase. They serve as migration helpers and removing them could break external code or future migration paths.

**Decision:** Keep all three exports as they are intentionally separate named exports, not duplicates.
