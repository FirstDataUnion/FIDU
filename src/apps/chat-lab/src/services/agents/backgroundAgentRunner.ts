import { getUnifiedStorageService } from '../storage/UnifiedStorageService';
import type { ConversationSliceMessage } from './backgroundAgentsService';
import { evaluateBackgroundAgent } from './backgroundAgentsService';
import { addAgentAlert } from './agentAlerts';
import type { BackgroundAgent } from '../api/backgroundAgents';
import { loadAgentPreferences } from './agentPreferences';
import { transformBuiltInAgentsWithPreferences } from './agentTransformers';
import type { BackgroundAgentAlertMetadata } from '../../types';
import type { Message } from '../../types';

/**
 * Debounce tracking for evaluations to prevent duplicate calls during streaming
 * Key format: `${conversationId}:${messageId}:${turnCount}`
 * Expires after DEBOUNCE_WINDOW_MS
 */
const DEBOUNCE_WINDOW_MS = 5000; // 5 seconds - prevents duplicate evaluations during streaming
const evaluationDebounceCache = new Map<string, number>();

/**
 * Check if an evaluation should be debounced (skip if recently evaluated)
 */
function shouldDebounceEvaluation(conversationId: string, messageId: string, turnCount: number): boolean {
  const key = `${conversationId}:${messageId}:${turnCount}`;
  const lastEvaluation = evaluationDebounceCache.get(key);
  const now = Date.now();
  
  if (lastEvaluation && (now - lastEvaluation) < DEBOUNCE_WINDOW_MS) {
    console.log(`🤖 [BackgroundAgents] Evaluation debounced for ${conversationId}:${messageId}:${turnCount} (evaluated ${now - lastEvaluation}ms ago)`);
    return true;
  }
  
  // Update cache with current timestamp
  evaluationDebounceCache.set(key, now);
  
  // Clean up old entries (older than 1 minute) to prevent memory leak
  if (evaluationDebounceCache.size > 100) {
    const oneMinuteAgo = now - 60000;
    for (const [k, v] of evaluationDebounceCache.entries()) {
      if (v < oneMinuteAgo) {
        evaluationDebounceCache.delete(k);
      }
    }
  }
  
  return false;
}

/**
 * Clear the debounce cache (useful for testing)
 * @internal
 */
export function clearDebounceCache(): void {
  evaluationDebounceCache.clear();
}

/**
 * Maximum number of enabled background agents allowed
 * Limits evaluations to prevent API overload and keep things simple
 */
const MAX_ENABLED_AGENTS = 5;

/**
 * Slice conversation messages based on agent's context window strategy
 */
function sliceMessagesForAgent(
  messages: ConversationSliceMessage[],
  agent: BackgroundAgent
): ConversationSliceMessage[] {
  // Early return if no messages
  if (!messages || messages.length === 0) {
    console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - No messages provided for evaluation`);
    return [];
  }
  
  const strategy = agent.contextWindowStrategy;
  
  switch (strategy) {
    case 'lastNMessages': {
      const lastN = Math.max(1, Math.min(100, agent.contextParams?.lastN || 6)); // Clamp to valid range
      // Take the last N messages from the end
      const sliced = messages.slice(-lastN);
      console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Sliced ${messages.length} messages to last ${lastN} messages (got ${sliced.length} messages)`);
      return sliced;
    }
    case 'summarizeThenEvaluate':
      // For now, pass all messages (summarization would happen in evaluateBackgroundAgent)
      // TODO: Implement summarization logic here
      console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Using all ${messages.length} messages (summarizeThenEvaluate strategy not yet implemented)`);
      return messages;
    case 'fullThreadIfSmall':
      // For now, pass all messages (token limit check would happen in evaluateBackgroundAgent)
      // TODO: Implement token limit check here
      console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Using all ${messages.length} messages (fullThreadIfSmall strategy not yet implemented)`);
      return messages;
    default:
      // Unknown strategy, pass all messages
      console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - Unknown context strategy "${strategy}", using all ${messages.length} messages`);
      return messages;
  }
}

/**
 * Creates alert metadata from evaluation result and agent info
 */
function createAlertMetadata(
  result: any,
  agent: BackgroundAgent
): BackgroundAgentAlertMetadata {
  return {
    agentId: agent.id,
    agentName: agent.name,
    createdAt: new Date().toISOString(),
    rating: Number(result.rating),
    severity: result.severity,
    message: result.shortMessage || result.message || '', // Use shortMessage, fallback to legacy message
    shortMessage: result.shortMessage,
    description: result.description,
    details: {
      ...result.details,
      // Include parse error information in details for debugging
      parseError: result.parseError,
    },
    rawModelOutput: result.rawModelOutput,
    parsedResult: result.parsedResult,
  };
}

/**
 * maybeEvaluateBackgroundAgents
 * Call this after an assistant reply is finalized for a conversation.
 * It will fetch enabled agents for the current profile, check cadence, and run evaluations.
 * 
 * IMPORTANT: messageId is required for alert-based agents to persist alerts to message metadata.
 * If messageId is not provided, alerts will still be created but not persisted to messages.
 * 
 * IMPORTANT: The conversation must be saved to storage before calling this function, otherwise
 * message persistence will fail. The function will wait a short time and retry if messages aren't found.
 * 
 * Features:
 * - Debouncing: Prevents duplicate evaluations for the same (conversationId, messageId, turnCount) within 5 seconds
 * - Agent limit: Only processes the first 5 enabled agents to prevent API overload
 */
export async function maybeEvaluateBackgroundAgents(
  params: {
    profileId: string;
    conversationId: string;
    messages: ConversationSliceMessage[];
    turnCount: number; // total turns so far (user+assistant pairs or assistant turns depending on app logic)
    messageId: string; // Required: ID of the assistant message that triggered this evaluation
  }
): Promise<void> {
  const { profileId, conversationId, messages, turnCount, messageId } = params;
  
  // Validate messageId is provided
  if (!messageId) {
    console.warn(`🤖 [BackgroundAgents] messageId is required but was not provided. Alerts will not be persisted to messages.`);
  }
  
  // Check debouncing - skip if recently evaluated (futureproofs against streaming)
  if (shouldDebounceEvaluation(conversationId, messageId, turnCount)) {
    console.log(`🤖 [BackgroundAgents] Evaluation skipped - duplicate call debounced (conversationId: ${conversationId}, messageId: ${messageId}, turnCount: ${turnCount})`);
    return;
  }
  
  console.log(`🤖 [BackgroundAgents] Evaluation triggered - Turn: ${turnCount}, Conversation: ${conversationId}, Messages: ${messages.length}`);
  
  const storage = getUnifiedStorageService();
  const { backgroundAgents: customAgents } = await storage.getBackgroundAgents(undefined, 1, 100, profileId);
  
  // Load and merge built-in agents with user preferences from localStorage
  const storedPrefs = loadAgentPreferences();
  console.log(`🤖 [BackgroundAgents] Loaded preferences from localStorage:`, storedPrefs);
  
  const transformedBuiltInAgents = transformBuiltInAgentsWithPreferences(storedPrefs);
  
  // Combine built-in agents (with preferences) with custom agents from storage
  const allAgents = [...transformedBuiltInAgents, ...(customAgents || [])];
  
  // Detailed logging of all agents before filtering
  console.log(`🤖 [BackgroundAgents] All agents loaded:`, {
    builtInCount: transformedBuiltInAgents.length,
    customCount: customAgents?.length || 0,
    totalCount: allAgents.length,
    agents: allAgents.map((a: any) => ({
      id: a.id,
      name: a.name,
      enabled: a.enabled,
      actionType: a.actionType,
      runEveryNTurns: a.runEveryNTurns,
      isSystem: a.isSystem,
    }))
  });
  
  // Filter enabled agents and validate they have required fields
  const enabledAgents = allAgents.filter((a: any) => {
    if (!a.enabled) {
      console.log(`🤖 [BackgroundAgents] Agent "${a.name || a.id}" filtered out - disabled`);
      return false;
    }
    
    // Validate actionType is set - this is critical for agent execution
    if (!a.actionType || (a.actionType !== 'alert' && a.actionType !== 'update_context')) {
      console.warn(`🤖 [BackgroundAgents] Agent "${a.name || a.id}" is enabled but has invalid or missing actionType: "${a.actionType}". Skipping this agent - please fix the agent configuration.`);
      // Skip this agent - user should fix the agent configuration
      return false;
    }
    
    return true;
  });

  console.log(`🤖 [BackgroundAgents] Found ${transformedBuiltInAgents.length} built-in, ${customAgents?.length || 0} custom, ${allAgents.length} total agents, ${enabledAgents.length} enabled`);
  
  // Apply hard limit on enabled agents (prevents API overload)
  const agentsToEvaluate = enabledAgents.slice(0, MAX_ENABLED_AGENTS);
  const skippedAgents = enabledAgents.slice(MAX_ENABLED_AGENTS);
  
  if (skippedAgents.length > 0) {
    console.warn(`🤖 [BackgroundAgents] ${skippedAgents.length} agent(s) skipped due to limit of ${MAX_ENABLED_AGENTS} enabled agents:`, skippedAgents.map((a: any) => a.name || a.id));
  }
  
  console.log(`🤖 [BackgroundAgents] Evaluating ${agentsToEvaluate.length} agent(s):`, agentsToEvaluate.map((a: any) => ({
    id: a.id,
    name: a.name,
    runEveryNTurns: a.runEveryNTurns,
    actionType: a.actionType,
  })));

  // Use Promise.allSettled to ensure all agents are evaluated independently
  // and failures don't affect each other
  // Collect agent info along with results for alert metadata
  const results = await Promise.allSettled(
    agentsToEvaluate.map(async (agent: any) => {
      // Parse cadence with detailed logging
      const rawCadence = agent.runEveryNTurns;
      const cadence = Math.max(1, Number(rawCadence || 1));
      const meetsCadence = turnCount % cadence === 0;
      
      console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" (ID: ${agent.id}) - Checking cadence:`, {
        rawCadenceValue: rawCadence,
        parsedCadence: cadence,
        currentTurn: turnCount,
        calculation: `${turnCount} % ${cadence} = ${turnCount % cadence}`,
        meetsCadence: meetsCadence,
        enabled: agent.enabled,
        actionType: agent.actionType,
        isSystem: agent.isSystem,
      });
      
      if (!meetsCadence) {
        console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" skipped - not due to run (turn ${turnCount} % ${cadence} = ${turnCount % cadence} !== 0)`);
        return { skipped: true, reason: 'cadence', agent: agent.name };
      }

      console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - ✅ Meets cadence, starting evaluation...`);

      try {
        // Slice messages based on agent's context window strategy
        const slicedMessages = sliceMessagesForAgent(messages, agent);
        
        const evaluationStartTime = Date.now();
        const result = await evaluateBackgroundAgent(agent, {
          conversationId,
          messages: slicedMessages,
        });
        const evaluationTime = Date.now() - evaluationStartTime;
        
        const threshold = Number(agent.verbosityThreshold ?? 50);
        // Alert when rating is <= threshold (lower rating = worse, so we want to alert on low scores)
        const meetsThreshold = Number(result.rating) <= threshold;
        const shouldNotify = result.notify && meetsThreshold;
        
        console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Evaluation completed in ${evaluationTime}ms`);
        console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Result:`, {
          rating: result.rating,
          severity: result.severity,
          notify: result.notify,
          threshold,
          meetsThreshold,
          shouldNotify,
          message: result.message,
        });
        
        if (shouldNotify) {
          console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - 🚨 Triggering action: ${result.actionType} (rating ${result.rating} <= threshold ${threshold})`);
          
          // Dispatch based on action type
          switch (result.actionType) {
            case 'alert': {
              // Generate unique alert ID with timestamp and random suffix to prevent collisions
              const alertId = `${agent.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              addAgentAlert({
                id: alertId,
                agentId: agent.id,
                createdAt: new Date().toISOString(),
                rating: Number(result.rating),
                severity: result.severity,
                message: result.shortMessage || result.message || '', // Use shortMessage, fallback to legacy message
                shortMessage: result.shortMessage,
                description: result.description,
                details: result.details,
                read: false,
                conversationId: conversationId, // Link alert to conversation
                messageId: messageId, // Link alert to specific message that triggered it
              });
              console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - ✅ Alert created successfully`);
              
              // Return alert metadata for batch persistence
              return {
                agent,
                result,
                alertMetadata: createAlertMetadata(result, agent),
              };
            }
            case 'update_context': {
              // Future: Handle context updates
              // For now, just log that this action type is not yet implemented
              console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - ⚠️  Action type 'update_context' not yet implemented`);
              // TODO: Implement context update logic
              // applyContextUpdates(result.contextUpdates);
              return null;
            }
            default: {
              console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - ⚠️  Unknown action type: ${result.actionType}`);
              return null;
            }
          }
        } else {
          const reason = !result.notify 
            ? 'notify flag is false'
            : !meetsThreshold 
            ? `rating ${result.rating} > threshold ${threshold}`
            : 'unknown';
          console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - ⏭️  No action triggered (${reason})`);
          return null;
        }
      } catch (e: any) {
        // Log errors for debugging but don't let them propagate
        const errorMessage = e?.message || String(e) || 'Unknown error';
        const errorStatus = e?.status;
        console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - ❌ Evaluation failed:`, errorMessage, errorStatus ? `(Status: ${errorStatus})` : '');
        console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - Error stack:`, e);
        // Swallow errors to avoid breaking the main chat flow
        // TODO: emit a debug metric/log entry
        return null;
      }
    })
  );

  // Check results summary
  const successes = results.filter(r => r.status === 'fulfilled');
  const failures = results.filter(r => r.status === 'rejected');
  const skipped = results.filter(r => r.status === 'fulfilled' && ((r as PromiseFulfilledResult<any>).value === null || (r as PromiseFulfilledResult<any>).value === undefined));
  
  console.log(`🤖 [BackgroundAgents] Evaluation complete - ${successes.length} succeeded, ${failures.length} failed, ${skipped.length} skipped`);
  
  if (failures.length > 0) {
    console.warn(`🤖 [BackgroundAgents] ${failures.length} background agent evaluation(s) failed, but chat flow continues normally`);
  }
  
  if (agentsToEvaluate.length === 0) {
    console.log(`🤖 [BackgroundAgents] No agents to evaluate (${enabledAgents.length} enabled, ${skippedAgents.length} skipped due to limit)`);
  }

  // Batch persist alerts to message metadata
  // Only proceed if we have messageId and conversationId is valid (not 'current')
  if (messageId && conversationId && conversationId !== 'current') {
    try {
      // Collect all alerts that should be persisted
      const alertsToPersist = results
        .filter((r): r is PromiseFulfilledResult<{ agent: BackgroundAgent; result: any; alertMetadata: BackgroundAgentAlertMetadata }> => 
          r.status === 'fulfilled' && r.value !== null && r.value !== undefined && 'alertMetadata' in r.value
        )
        .map(r => (r as PromiseFulfilledResult<{ agent: BackgroundAgent; result: any; alertMetadata: BackgroundAgentAlertMetadata }>).value);

      if (alertsToPersist.length > 0) {
        console.log(`🤖 [BackgroundAgents] Persisting ${alertsToPersist.length} alert(s) to message ${messageId} in conversation ${conversationId}`);
        
        // Load conversation and messages
        // Add retry logic in case the conversation hasn't finished saving yet
        // Note: We should have verified messages are available before calling this function,
        // but we still retry here as a safety measure
        let conversation;
        let currentMessages: Message[] = [];
        let messageIndex = -1;
        let assistantMessages: Message[] = [];
        const maxRetries = 5; // Increased retries
        const retryDelay = 400; // 400ms between retries (slightly faster since we verified earlier)
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            conversation = await storage.getConversationById(conversationId);
            currentMessages = await storage.getMessages(conversationId);
            
            console.log(`🤖 [BackgroundAgents] Attempt ${attempt + 1}/${maxRetries}: Loaded ${currentMessages.length} messages from storage`);
        
        // Find the target message by exact ID match
        // Since we now preserve original message IDs in storage, we can rely on direct ID matching
        messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex === -1) {
          // Message not found - this shouldn't happen if IDs are preserved correctly
          // Log warning for debugging but don't use fallback (would cause incorrect alert attachment)
          console.warn(`🤖 [BackgroundAgents] Message ID ${messageId} not found in loaded messages. Available IDs: ${currentMessages.map(m => m.id).join(', ')}`);
        }
        
            if (messageIndex !== -1) {
              break; // Found the message, exit retry loop
            }
            
            // If we haven't found it and there are retries left, wait and try again
            if (attempt < maxRetries - 1) {
              console.log(`🤖 [BackgroundAgents] Message not found yet, waiting ${retryDelay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          } catch (error) {
            console.error(`🤖 [BackgroundAgents] Error loading messages on attempt ${attempt + 1}:`, error);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
        }
        
        if (messageIndex === -1 || !conversation) {
          assistantMessages = currentMessages.filter((msg: Message) => msg.role === 'assistant');
          console.warn(`🤖 [BackgroundAgents] Could not find target message for ${messageId} in conversation ${conversationId} after ${maxRetries} attempts. Alert metadata will not be persisted.`);
          console.warn(`🤖 [BackgroundAgents] Conversation found: ${!!conversation}, Available message IDs:`, currentMessages.map((m: Message) => m.id).slice(0, 10));
          console.warn(`🤖 [BackgroundAgents] Available assistant messages:`, assistantMessages.map((m: Message) => ({ id: m.id, role: m.role })).slice(0, 10));
          console.warn(`🤖 [BackgroundAgents] Looking for message ID: ${messageId}`);
        } else {
          // Update message with alert metadata
          const targetMessage = currentMessages[messageIndex];
          console.log(`🤖 [BackgroundAgents] Found target message at index ${messageIndex}:`, {
            id: targetMessage.id,
            role: targetMessage.role,
            hasExistingAlerts: !!(targetMessage.metadata?.backgroundAgentAlerts?.length),
            existingAlertCount: targetMessage.metadata?.backgroundAgentAlerts?.length || 0,
          });
          
          const updatedMessages = currentMessages.map((msg, idx) => {
            if (idx === messageIndex) {
              // Append new alerts to existing ones
              const existingAlerts = msg.metadata?.backgroundAgentAlerts || [];
              const newAlerts = alertsToPersist.map(a => a.alertMetadata);
              
              console.log(`🤖 [BackgroundAgents] Updating message ${msg.id} with ${existingAlerts.length} existing + ${newAlerts.length} new alerts`);
              
              return {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  backgroundAgentAlerts: [...existingAlerts, ...newAlerts],
                },
              } as Message;
            }
            return msg;
          });
          
          // Update conversation with modified messages
          await storage.updateConversation(conversation, updatedMessages);
          
          // Verify persistence by re-reading the message
          const verifyMessages = await storage.getMessages(conversationId);
          const verifyMessage = verifyMessages[messageIndex];
          const persistedAlerts = verifyMessage?.metadata?.backgroundAgentAlerts || [];
          
          console.log(`🤖 [BackgroundAgents] ✅ Successfully persisted ${alertsToPersist.length} alert(s) to message metadata`);
          console.log(`🤖 [BackgroundAgents] Verification: Message ${verifyMessage?.id} now has ${persistedAlerts.length} total alert(s)`);
        }
      }
    } catch (error: any) {
      // Log error but don't throw - alerts are still created, just not persisted to message
      console.error(`🤖 [BackgroundAgents] Failed to persist alerts to message metadata:`, error?.message || error);
      console.error(`🤖 [BackgroundAgents] Alerts were still created and are available in alert history.`);
    }
  } else {
    if (!messageId) {
      console.warn(`🤖 [BackgroundAgents] No messageId provided - alerts will not be persisted to message metadata`);
    } else if (!conversationId) {
      console.warn(`🤖 [BackgroundAgents] No conversationId provided - alerts will not be persisted to message metadata`);
    }
  }
}
