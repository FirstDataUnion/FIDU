import { getUnifiedStorageService } from '../storage/UnifiedStorageService';
import type { ConversationSliceMessage } from './backgroundAgentsService';
import { evaluateBackgroundAgent } from './backgroundAgentsService';
import { addAgentAlert } from './agentAlerts';
import type { BackgroundAgent } from '../api/backgroundAgents';
import { loadAgentPreferences } from './agentPreferences';
import { transformBuiltInAgentsWithPreferences } from './agentTransformers';

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
 * maybeEvaluateBackgroundAgents
 * Call this after an assistant reply is finalized for a conversation.
 * It will fetch enabled agents for the current profile, check cadence, and run evaluations.
 *
 * TODO: Debounce per (conversationId, agentId, turnIndex) to avoid duplicate calls in streaming.
 */
export async function maybeEvaluateBackgroundAgents(
  params: {
    profileId: string;
    conversationId: string;
    messages: ConversationSliceMessage[];
    turnCount: number; // total turns so far (user+assistant pairs or assistant turns depending on app logic)
    messageId?: string; // Optional: ID of the assistant message that triggered this evaluation
  }
): Promise<void> {
  const { profileId, conversationId, messages, turnCount, messageId } = params;
  
  console.log(`🤖 [BackgroundAgents] Evaluation triggered - Turn: ${turnCount}, Conversation: ${conversationId}, Messages: ${messages.length}`);
  
  const storage = getUnifiedStorageService();
  const { backgroundAgents: customAgents } = await storage.getBackgroundAgents(undefined, 1, 100, profileId);
  
  // Load and merge built-in agents with user preferences from localStorage
  const storedPrefs = loadAgentPreferences();
  console.log(`🤖 [BackgroundAgents] Loaded preferences from localStorage:`, storedPrefs);
  
  const transformedBuiltInAgents = transformBuiltInAgentsWithPreferences(storedPrefs);
  
  // Combine built-in agents (with preferences) with custom agents from storage
  const allAgents = [...transformedBuiltInAgents, ...(customAgents || [])];
  const enabledAgents = allAgents.filter((a: any) => Boolean(a.enabled));

  console.log(`🤖 [BackgroundAgents] Found ${transformedBuiltInAgents.length} built-in, ${customAgents?.length || 0} custom, ${allAgents.length} total agents, ${enabledAgents.length} enabled`);

  // Use Promise.allSettled to ensure all agents are evaluated independently
  // and failures don't affect each other
  const results = await Promise.allSettled(
    enabledAgents.map(async (agent: any) => {
      const cadence = Math.max(1, Number(agent.runEveryNTurns || 1));
      const meetsCadence = turnCount % cadence === 0;
      
      console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" (ID: ${agent.id}) - Enabled: true, Cadence: every ${cadence} turns, Current turn: ${turnCount}, Meets cadence: ${meetsCadence}`);
      
      if (!meetsCadence) {
        console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" skipped - not due to run (turn ${turnCount} % ${cadence} !== 0)`);
        return;
      }

      console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Starting evaluation...`);

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
          console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - 🚨 Creating alert (rating ${result.rating} <= threshold ${threshold})`);
          // Generate unique alert ID with timestamp and random suffix to prevent collisions
          const alertId = `${agent.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          addAgentAlert({
            id: alertId,
            agentId: agent.id,
            createdAt: new Date().toISOString(),
            rating: Number(result.rating),
            severity: result.severity,
            message: result.message,
            details: result.details,
            read: false,
            conversationId: conversationId, // Link alert to conversation
            messageId: messageId, // Link alert to specific message that triggered it
          });
          console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - ✅ Alert created successfully`);
        } else {
          const reason = !result.notify 
            ? 'notify flag is false'
            : !meetsThreshold 
            ? `rating ${result.rating} > threshold ${threshold}`
            : 'unknown';
          console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - ⏭️  No alert created (${reason})`);
        }
      } catch (e: any) {
        // Log errors for debugging but don't let them propagate
        const errorMessage = e?.message || String(e) || 'Unknown error';
        const errorStatus = e?.status;
        console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - ❌ Evaluation failed:`, errorMessage, errorStatus ? `(Status: ${errorStatus})` : '');
        console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - Error stack:`, e);
        // Swallow errors to avoid breaking the main chat flow
        // TODO: emit a debug metric/log entry
      }
    })
  );

  // Check results summary
  const successes = results.filter(r => r.status === 'fulfilled');
  const failures = results.filter(r => r.status === 'rejected');
  const skipped = results.filter(r => r.status === 'fulfilled' && r.value === undefined);
  
  console.log(`🤖 [BackgroundAgents] Evaluation complete - ${successes.length} succeeded, ${failures.length} failed, ${skipped.length} skipped`);
  
  if (failures.length > 0) {
    console.warn(`🤖 [BackgroundAgents] ${failures.length} background agent evaluation(s) failed, but chat flow continues normally`);
  }
  
  if (enabledAgents.length === 0) {
    console.log(`🤖 [BackgroundAgents] No enabled agents found - nothing to evaluate`);
  }
}
