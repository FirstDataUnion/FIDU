import type { BackgroundAgent } from '../api/backgroundAgents';
import { createNLPWorkbenchAPIClientWithSettings } from '../api/apiClientNLPWorkbench';

export interface ConversationSliceMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ConversationSlice {
  conversationId: string;
  messages: ConversationSliceMessage[];
}

export interface EvaluationResult {
  agentId: string;
  rating: number;
  severity: 'info' | 'warn' | 'error';
  notify: boolean;
  message: string;
  details?: Record<string, any>;
  rawModelOutput: string;
  parsedResult: Record<string, any>;
}

/**
 * evaluateBackgroundAgent
 * Placeholder facade that constructs the evaluation request in a way that will later
 * be reused to call the selected model provider. For now, it routes to the backend
 * placeholder endpoint which returns a heuristic-based result.
 *
 * TODO: Replace backend call with a WebApp-side model invocation when model routing
 * is available in the frontend (or keep on server if centralizing providers/keys).
 */
export async function evaluateBackgroundAgent(
  agent: BackgroundAgent,
  slice: ConversationSlice
): Promise<EvaluationResult> {
  console.log(`🤖 [BackgroundAgents] Evaluating agent "${agent.name}" (ID: ${agent.id})`);
  console.log(`🤖 [BackgroundAgents] Conversation slice: ${slice.messages.length} messages, Conversation ID: ${slice.conversationId}`);
  
  const nlpWorkbenchAPIClient = createNLPWorkbenchAPIClientWithSettings();

  // Default schema enforced via prompt
  const defaultSchema = {
    type: 'object',
    required: ['rating', 'warning_message'],
    properties: {
      rating: { type: 'number', minimum: 0, maximum: 100 },
      warning_message: { type: 'string' },
      severity: { type: 'string', enum: ['info', 'warn', 'error'], default: 'warn' },
      notify: { type: 'boolean', default: true },
      details: { type: 'object' },
    },
    additionalProperties: false,
  } as const;

  // Build prompt with strict JSON-only instructions
  const systemPreamble =
    'You are a background analysis agent. Respond with JSON only, no prose, matching this schema: ' +
    JSON.stringify(defaultSchema) +
    '. Do not include any text outside of the JSON object.';

  const promptTemplate = agent.promptTemplate || 'Analyze the conversation.';
  const convoBlock = slice.messages
    .map((m) => `[${m.role}${m.timestamp ? ' ' + m.timestamp : ''}] ${m.content}`)
    .join('\n');

  const agentInput = `${systemPreamble}\n\nAGENT INSTRUCTIONS:\n${promptTemplate}\n\nCONVERSATION:\n${convoBlock}\n\nSTRICT REQUIREMENT: Return only JSON matching the schema.`;

  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Calling model with input length: ${agentInput.length} chars`);
  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Prompt template: ${promptTemplate.substring(0, 100)}...`);

  // Execute using centralized model flow (same as wizards)
  const selectedModel = 'gpt-oss-120b';
  let execStatus;
  try {
    const apiCallStartTime = Date.now();
    console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Making API call to model ${selectedModel}...`);
    execStatus = await nlpWorkbenchAPIClient.executeAgentAndWait(
      agentInput,
      (input: string) => nlpWorkbenchAPIClient.executeModelAgent(selectedModel, input)
    );
    const apiCallTime = Date.now() - apiCallStartTime;
    console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - API call completed in ${apiCallTime}ms, status: ${execStatus?.status}`);
  } catch (error: any) {
    console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - API call failed:`, error?.message || error, `Status: ${error?.status}`);
    
    // Handle API key/auth errors gracefully - return a default result instead of throwing
    if (error?.status === 403 || error?.message?.includes('Paid membership') || error?.message?.includes('API key')) {
      console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - Evaluation skipped due to authentication error: ${error.message || 'Authentication required'}`);
      // Return a neutral result that won't trigger alerts
      return {
        agentId: agent.id,
        rating: 0,
        severity: 'info' as const,
        notify: false,
        message: '',
        details: { error: 'Evaluation skipped - authentication required' },
        rawModelOutput: '{}',
        parsedResult: { rating: 0, warning_message: '', severity: 'info', notify: false, details: {} },
      };
    }
    // Re-throw other errors to be handled by the caller
    throw error;
  }

  // Extract model output - log the structure for debugging
  const outputs: any = execStatus.outputs || {};
  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Full execStatus structure:`, {
    status: execStatus.status,
    hasOutputs: !!execStatus.outputs,
    outputsKeys: execStatus.outputs ? Object.keys(execStatus.outputs) : [],
    resultsLength: outputs.results?.length,
    firstResult: outputs.results?.[0],
  });
  
  let content: any;
  try {
    // Try the expected path first
    content = outputs.results?.[0]?.output?.result;
    
    // If that doesn't work, try alternative paths
    if (content === undefined || content === null) {
      console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Trying alternative extraction paths...`);
      // Try different possible structures
      content = outputs.results?.[0]?.result || 
                outputs.results?.[0]?.output ||
                outputs.results?.[0]?.text ||
                outputs.results?.[0]?.content ||
                outputs.result ||
                outputs.output ||
                outputs.text ||
                outputs.content;
      
      if (content !== undefined && content !== null) {
        console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Found content via alternative path:`, typeof content, content?.toString().substring(0, 100));
      }
    }
    
    if (content === undefined || content === null) {
      console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - Could not extract content from response structure`);
    }
  } catch (error) {
    console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - Error extracting content:`, error);
    content = '{}';
  }
  
  // Safely convert content to string, handling undefined/null cases
  let rawModelOutput: string;
  if (typeof content === 'string') {
    rawModelOutput = content;
  } else if (content === null || content === undefined) {
    console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - Model output is null/undefined, using default`);
    rawModelOutput = '{}';
  } else {
    try {
      rawModelOutput = JSON.stringify(content);
      // JSON.stringify can return undefined for some values
      if (rawModelOutput === undefined || rawModelOutput === null) {
        rawModelOutput = '{}';
      }
    } catch {
      rawModelOutput = '{}';
    }
  }
  
  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Raw model output received (${rawModelOutput.length} chars):`, rawModelOutput.substring(0, 200));

  // Parse with repair attempt
  let parsed: Record<string, any> | null = null;
  try {
    parsed = JSON.parse(rawModelOutput);
    console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Successfully parsed JSON`);
  } catch {
    console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - Initial JSON parse failed, attempting repair...`);
    const start = rawModelOutput.indexOf('{');
    const end = rawModelOutput.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(rawModelOutput.slice(start, end + 1));
        console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - JSON repair successful`);
      } catch {
        console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - JSON repair failed, using default values`);
        parsed = null;
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - Using default parsed result (invalid/missing JSON)`);
    parsed = { rating: 0, warning_message: '', severity: 'info', notify: false, details: {} };
  }

  const rating = Math.max(0, Math.min(100, Number(parsed.rating ?? 0))) | 0;
  const severity = (parsed.severity as 'info' | 'warn' | 'error') || (rating <= 50 ? 'warn' : 'info');
  const verbosityThreshold = Number(agent.verbosityThreshold ?? 50);
  // Alert when rating is <= threshold (lower rating = worse, so we want to alert on low scores)
  const notify = Boolean(parsed.notify ?? true) && rating <= verbosityThreshold;
  const message = String(parsed.warning_message ?? (notify ? 'Background analysis completed.' : ''));

  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Parsed result:`, {
    rating,
    severity,
    notify,
    message,
    verbosityThreshold,
    ratingMeetsThreshold: rating >= verbosityThreshold,
  });

  return {
    agentId: agent.id,
    rating,
    severity,
    notify,
    message,
    details: (parsed.details as Record<string, any>) || {},
    rawModelOutput,
    parsedResult: parsed,
  };
}
