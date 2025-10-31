# Background Agents Feature - Audit Report

## 🟡 Outstanding TODOs & Placeholders

### Critical TODOs (Should Address Before Deployment)
1. **Debouncing for Streaming** (`backgroundAgentRunner.ts:48`)
   - **Issue**: No debouncing for duplicate calls during streaming
   - **Impact**: May trigger multiple evaluations for the same turn
   - **Risk**: Medium - Could cause performance issues and duplicate alerts
   - **Recommendation**: Add debounce logic using `(conversationId, agentId, turnIndex)` key

2. **Context Window Strategies Not Implemented** (`backgroundAgentRunner.ts:28, 33`)
   - **Issue**: `summarizeThenEvaluate` and `fullThreadIfSmall` strategies not implemented
   - **Impact**: These strategies pass all messages instead of proper slicing
   - **Risk**: Low - Currently only `lastNMessages` is used in built-in agents
   - **Recommendation**: Document as "coming soon" or implement basic versions

3. **Metrics/Logging** (`backgroundAgentRunner.ts:151`)
   - **Issue**: No metrics/logging for failed evaluations
   - **Impact**: Hard to debug production issues
   - **Risk**: Low - Errors are logged but not tracked
   - **Recommendation**: Add basic error tracking/metrics system

### Low Priority TODOs (Can Defer)
4. **Model Routing** (`backgroundAgentsService.ts:32`)
   - **Issue**: Hardcoded model 'gpt-oss-120b', comment mentions future routing
   - **Impact**: Can't easily change models
   - **Risk**: Low - Works for current needs
   - **Recommendation**: Keep as-is for now, address when model selection is needed

---

## ⚠️ Potential Issues & Edge Cases

### High Priority Issues

1. **Alert ID Collision Risk** (`backgroundAgentRunner.ts:124`)
   - **Issue**: Alert ID uses `${agent.id}-${Date.now()}` - collisions possible with rapid successive calls
   - **Impact**: Duplicate alert IDs could overwrite each other in history
   - **Recommendation**: Add random suffix: `${agent.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

2. **No Validation for Agent Configuration**
   - **Issue**: No validation when creating/updating agents for:
     - Empty prompt template (only checked in UI, not enforced)
     - Invalid `runEveryNTurns` values (< 1 or > 100)
     - Invalid `verbosityThreshold` values (< 0 or > 100)
     - Invalid `contextParams.lastN` values (< 1 or > 100)
   - **Impact**: Could create agents with invalid configs
   - **Recommendation**: Add validation in storage adapters or create helper function

3. **Missing Error Recovery for localStorage**
   - **Issue**: `agentPreferences.ts` and `agentAlertHistory.ts` use try-catch but don't handle quota exceeded
   - **Impact**: If localStorage is full, preferences/history silently fail
   - **Recommendation**: Detect quota errors and show user notification

4. **No Limit on Concurrent Agent Evaluations**
   - **Issue**: All enabled agents evaluate in parallel (Promise.allSettled)
   - **Impact**: Could overwhelm API with many agents
   - **Risk**: Medium - If user creates 20+ agents, could cause rate limiting
   - **Recommendation**: Add concurrency limit (e.g., max 5 simultaneous evaluations)

### Medium Priority Issues

5. **Empty Messages Array Handling**
   - **Issue**: `sliceMessagesForAgent` doesn't validate empty messages array
   - **Impact**: Agent would evaluate with no context
   - **Risk**: Low - Rare edge case
   - **Recommendation**: Early return if messages.length === 0

6. **Turn Count Edge Cases**
   - **Issue**: Turn count calculation could be inconsistent (assistant-only vs pairs)
   - **Impact**: Cadence matching might be off
   - **Risk**: Low - Current implementation seems consistent
   - **Recommendation**: Add comments documenting expected turnCount format

7. **Alert History Limit Logic**
   - **Issue**: `saveAlertHistory` uses `.slice(-MAX_STORED_ALERTS)` which keeps oldest alerts if limit exceeded
   - **Impact**: New alerts might be lost if history is full
   - **Risk**: Low - Keeps 500 most recent (should be enough)
   - **Recommendation**: Document behavior, consider FIFO queue

8. **Built-in Agent Preference Merging**
   - **Issue**: `transformBuiltInAgentsWithPreferences` only merges `contextLastN` if explicitly set
   - **Impact**: If user never sets it, template default (6) is used
   - **Risk**: None - This is expected behavior
   - **Recommendation**: No change needed

### Low Priority / Nice-to-Have

9. **Missing Type Guards**
   - **Issue**: Agent objects use `any` type in some places (`enabledAgents.map((agent: any) => ...)`)
   - **Impact**: Runtime errors possible if data is malformed
   - **Risk**: Low - Storage layer should enforce types
   - **Recommendation**: Add proper typing

10. **No Retry Logic for Failed Evaluations**
   - **Issue**: If API call fails (non-auth), evaluation is abandoned
   - **Impact**: User might miss important alerts
   - **Risk**: Low - Errors are logged
   - **Recommendation**: Consider retry with exponential backoff

11. **Conversation ID Fallback**
   - **Issue**: Uses `currentConversation?.id || 'current'` - could cause confusion in history
   - **Impact**: Alerts might not link properly if conversation ID missing
   - **Risk**: Low - Edge case
   - **Recommendation**: Validate conversationId before evaluation

---

## 🧪 Recommended Tests (Low Effort, High Value)

### Unit Tests (Quick Wins)

1. **`sliceMessagesForAgent` edge cases**
   ```typescript
   - Empty messages array
   - Messages.length < lastN (should return all messages)
   - lastN = 0 or negative (should use default)
   - Unknown strategy (should return all messages)
   ```

2. **`agentPreferences` localStorage handling**
   ```typescript
   - Handles quota exceeded gracefully
   - Handles corrupted JSON
   - Merges partial preferences correctly
   ```

3. **`agentAlertHistory` filtering**
   ```typescript
   - Filters by messageId correctly
   - Filters by conversationId correctly
   - Limits work correctly
   - MAX_STORED_ALERTS truncation works
   ```

4. **Alert ID uniqueness**
   ```typescript
   - Rapid successive alerts generate unique IDs
   - Alert ID format validation
   ```

5. **Validation helpers**
   ```typescript
   - Clamps runEveryNTurns to valid range
   - Clamps verbosityThreshold to valid range
   - Clamps contextLastN to valid range
   - Validates prompt template not empty
   ```

### Integration Tests

6. **Agent evaluation flow**
   ```typescript
   - Agent with cadence that doesn't match doesn't run
   - Agent with rating above threshold doesn't create alert
   - Agent with notify=false doesn't create alert
   - Multiple agents evaluate independently
   ```

7. **Storage operations**
   ```typescript
   - Create agent with minimal required fields
   - Update agent preserves all fields
   - Delete agent removes from storage
   - Preferences persist across page reloads
   ```

### E2E Test Scenarios (Manual / Selenium)

8. **User workflows**
   ```typescript
   - Create agent → Edit agent → Delete agent
   - Change preferences → Verify agent uses new settings
   - Enable/disable agent → Verify it runs/skips
   - Trigger alert → Verify inline display
   - Mark alert as read → Verify badge updates
   ```

---

## 🔍 Code Quality Observations

### Good Practices ✅
- Excellent error isolation (Promise.allSettled)
- Comprehensive logging for debugging
- Graceful degradation (errors don't break chat)
- localStorage quota awareness (MAX_STORED_ALERTS)
- Type-safe interfaces for data structures

### Areas for Improvement ⚠️
1. **Type Safety**: Some `any` types should be replaced
2. **Constants**: Magic numbers (100 limit, etc.) should use constants
3. **Validation**: Missing input validation in several places
4. **Error Messages**: Some errors could be more user-friendly

---

## 📋 Pre-Deployment Checklist

### Must Fix Before Deployment
- [ ] Fix alert ID collision risk (add random suffix)
- [ ] Add validation for agent configuration values
- [ ] Add empty messages check in `sliceMessagesForAgent`
- [ ] Document context window strategy limitations

### Should Fix (Can Defer to Next Release)
- [ ] Add debouncing for streaming scenarios
- [ ] Add localStorage quota error handling
- [ ] Add concurrency limit for agent evaluations
- [ ] Improve type safety (remove `any` types)

### Nice to Have
- [ ] Implement basic `fullThreadIfSmall` strategy
- [ ] Add retry logic for failed API calls
- [ ] Add metrics/tracking for failed evaluations
- [ ] Improve error messages for users

---

## 🎯 Summary

**Overall Assessment**: The Background Agents feature is **production-ready** with a few minor improvements recommended.

**Critical Issues**: None that block deployment

**Recommended Actions**:
1. Fix alert ID collision risk (5 min fix)
2. Add empty messages validation (2 min fix)
3. Add basic input validation for agent configs (10 min fix)
4. Document context strategy limitations (5 min)

**Test Coverage**: Existing tests cover basic flows. Recommended tests would add confidence for edge cases.

