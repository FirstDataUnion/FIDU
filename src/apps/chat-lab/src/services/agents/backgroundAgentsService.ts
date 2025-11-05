import type { BackgroundAgent, AgentActionType } from '../api/backgroundAgents';
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
  actionType: AgentActionType;
  rating: number;
  severity: 'info' | 'warn' | 'error';
  notify: boolean;
  shortMessage: string; // Brief notification for toast/popup
  description: string; // Detailed explanation for expanded view
  details?: Record<string, any>;
  rawModelOutput: string;
  parsedResult: Record<string, any>;
  // Legacy field for backward compatibility - will be removed in future
  message?: string;
  // Error tracking for debugging
  parseError?: {
    message: string;
    rawOutput: string;
    execStatus?: any; // Full execution status for debugging
  };
}

/**
 * Builds the output schema for alert-based agents.
 * This is the "Alert" schema used for action_type: 'alert' responses.
 * Supports both default and custom schemas.
 */
function buildOutputSchema(agent: BackgroundAgent): Record<string, any> {
  if (agent.outputSchemaName === 'custom' && agent.customOutputSchema) {
    return agent.customOutputSchema;
  }
  
  // Alert schema - action_type is NOT included as it's determined by agent configuration
  return {
    type: 'object',
    required: ['rating', 'short_message', 'description'],
    properties: {
      rating: { 
        type: 'number', 
        minimum: 0, 
        maximum: 100,
        description: 'Health/quality score from 0 (worst) to 100 (best)'
      },
      short_message: { 
        type: 'string',
        description: 'Brief notification message (1-2 sentences) suitable for toast notifications or popups. Keep it concise and actionable.'
      },
      description: {
        type: 'string',
        description: 'Detailed explanation of the alert, including context, reasoning, and recommendations. This appears when users expand the notification for more details.'
      },
      severity: { 
        type: 'string', 
        enum: ['info', 'warn', 'error'], 
        default: 'warn',
        description: 'Severity level of the alert'
      },
      notify: { 
        type: 'boolean', 
        default: true,
        description: 'Whether this alert should trigger a notification'
      },
      details: { 
        type: 'object',
        description: 'Additional structured data or metadata about the alert'
      },
    },
    additionalProperties: false,
  };
}

/**
 * Formats conversation messages into a readable text block for the prompt.
 */
function formatConversationMessages(messages: ConversationSliceMessage[]): string {
  if (!messages || messages.length === 0) {
    return '(No conversation messages provided)';
  }
  
  return messages
    .map((msg, index) => {
      const roleLabel = msg.role.toUpperCase();
      const timestamp = msg.timestamp ? ` [${msg.timestamp}]` : '';
      const content = msg.content.trim();
      
      // Format with clear role separation
      return `--- Message ${index + 1} ---\n${roleLabel}${timestamp}:\n${content}`;
    })
    .join('\n\n');
}

/**
 * Builds the complete prompt for a background agent evaluation.
 * 
 * Structure:
 * 1. System instructions (schema enforcement)
 * 2. Agent-specific instructions (from promptTemplate)
 * 3. Conversation context (formatted messages)
 * 4. Output requirements (JSON-only, schema compliance)
 */
function buildAgentPrompt(
  agent: BackgroundAgent,
  messages: ConversationSliceMessage[],
  schema: Record<string, any>
): string {
  const systemInstructions = 
    'You are a background analysis agent for alert generation. Your task is to evaluate the conversation and respond with JSON only, ' +
    'matching the required Alert schema. Do not include any explanatory text, markdown, or prose outside of the JSON object.\n\n' +
    `Required Alert JSON Schema:\n${JSON.stringify(schema, null, 2)}`;
  
  const agentInstructions = agent.promptTemplate || 'Analyze the conversation and provide an evaluation.';
  
  const conversationBlock = formatConversationMessages(messages);
  
  const alertMessageGuidance = 
    '\n\n--- ALERT MESSAGE GUIDANCE ---\n' +
    'IMPORTANT: Provide both a short_message and a description:\n\n' +
    '1. short_message: A brief, actionable notification (1-2 sentences, ~50-100 characters ideal). ' +
    '   This will be shown in toast notifications and popups. Make it clear, concise, and immediately understandable.\n\n' +
    '2. description: A detailed explanation (2-6 sentences depending on the severity) that includes:\n' +
    '   - Context about what was detected or evaluated\n' +
    '   - Reasoning behind the rating and severity\n' +
    '   - Specific recommendations or next steps\n' +
    '   - Any relevant details that help users understand the full picture\n' +
    '   This will be shown when users expand the notification for more details.\n\n' +
    '3. severity: Choose the appropriate severity level based on the issue:\n' +
    '   - "error": Use for critical issues that require immediate attention\n' +
    '   - "warn": Use for moderate concerns\n' +
    '   - "info": Use for low-risk informational notes\n' +
    'Example:\n' +
    '  short_message: "Potential privacy concern detected in conversation"\n' +
    '  description: "The conversation contains references to personal information that could be sensitive... ' +
    '               [detailed explanation with context, reasoning, and recommendations]"\n';
  
  const outputRequirements = 
    '\n\n--- OUTPUT REQUIREMENTS ---\n' +
    '1. Return ONLY valid JSON matching the Alert schema above\n' +
    '2. Do not include any text before or after the JSON\n' +
    '3. Ensure all required fields are present (rating, short_message, description)\n' +
    '4. Use proper JSON formatting (quoted strings, proper number types)\n' +
    '5. Provide both short_message and description as specified above';
  
  return [
    systemInstructions,
    '\n--- AGENT INSTRUCTIONS ---',
    agentInstructions,
    '\n--- CONVERSATION TO EVALUATE ---',
    conversationBlock,
    alertMessageGuidance,
    outputRequirements,
  ].join('\n\n');
}

/**
 * Extracts the model response content from the execution status structure.
 * Tries multiple possible paths to handle different response formats.
 */
function extractModelOutput(execStatus: any, agentName: string): string {
  const outputs: any = execStatus.outputs || {};
  
  // Log full structure for debugging
  console.log(`🤖 [BackgroundAgents] Agent "${agentName}" - Full execStatus structure:`, {
    status: execStatus.status,
    hasOutputs: !!execStatus.outputs,
    outputsKeys: execStatus.outputs ? Object.keys(execStatus.outputs) : [],
    resultsLength: outputs.results?.length,
    firstResult: outputs.results?.[0],
    outputsSnapshot: JSON.stringify(outputs, null, 2).substring(0, 500), // First 500 chars for debugging
  });
  
  // Primary expected path
  let content = outputs.results?.[0]?.output?.result;
  
  // Fallback paths for different response structures
  if (content === undefined || content === null) {
    console.log(`🤖 [BackgroundAgents] Agent "${agentName}" - Primary path empty, trying alternatives...`);
    content = outputs.results?.[0]?.result || 
              outputs.results?.[0]?.output ||
              outputs.results?.[0]?.text ||
              outputs.results?.[0]?.content ||
              outputs.result ||
              outputs.output ||
              outputs.text ||
              outputs.content;
    
    if (content !== undefined && content !== null) {
      console.log(`🤖 [BackgroundAgents] Agent "${agentName}" - Found content via alternative path:`, typeof content, content?.toString().substring(0, 200));
    } else {
      console.warn(`🤖 [BackgroundAgents] Agent "${agentName}" - No content found in any path. Full outputs:`, JSON.stringify(outputs, null, 2));
    }
  }
  
  // Convert to string safely
  if (typeof content === 'string') {
    if (content.length === 0) {
      console.warn(`🤖 [BackgroundAgents] Agent "${agentName}" - Content is empty string`);
    }
    return content;
  }
  
  if (content === null || content === undefined) {
    console.warn(`🤖 [BackgroundAgents] Agent "${agentName}" - Model output is null/undefined. Full execStatus:`, JSON.stringify(execStatus, null, 2).substring(0, 1000));
    return '{}';
  }
  
  try {
    const jsonString = JSON.stringify(content);
    if (!jsonString || jsonString === 'null' || jsonString === 'undefined') {
      console.warn(`🤖 [BackgroundAgents] Agent "${agentName}" - JSON stringify produced invalid result:`, jsonString);
      return '{}';
    }
    return jsonString || '{}';
  } catch (error) {
    console.error(`🤖 [BackgroundAgents] Agent "${agentName}" - Error stringifying content:`, error, 'Content:', content);
    return '{}';
  }
}

/**
 * Attempts to parse JSON with repair logic for malformed responses.
 * Extracts JSON object from text that may contain extra characters.
 */
function parseJsonWithRepair(rawOutput: string, agentName: string): Record<string, any> | null {
  // Try direct parse first
  try {
    return JSON.parse(rawOutput);
  } catch {
    // Attempt repair by extracting JSON object
    const start = rawOutput.indexOf('{');
    const end = rawOutput.lastIndexOf('}');
    
    if (start !== -1 && end > start) {
      try {
        const jsonCandidate = rawOutput.slice(start, end + 1);
        return JSON.parse(jsonCandidate);
      } catch {
        console.warn(`🤖 [BackgroundAgents] Agent "${agentName}" - JSON repair failed`);
      }
    }
  }
  
  return null;
}

/**
 * Validates and normalizes the parsed result against the expected Alert schema.
 */
function validateAndNormalizeResult(
  parsed: Record<string, any> | null,
  agent: BackgroundAgent
): Record<string, any> {
  if (!parsed || typeof parsed !== 'object') {
    console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - Invalid parsed result, using defaults`);
    return {
      rating: 0,
      short_message: 'Evaluation failed - invalid response format',
      description: 'The background agent evaluation could not be completed due to an invalid response format from the model.',
      severity: 'info',
      notify: false,
      details: {},
    };
  }
  
  // Support both new format (short_message/description) and legacy format (warning_message)
  const shortMessage = parsed.short_message ?? parsed.warning_message ?? '';
  const description = parsed.description ?? parsed.warning_message ?? '';
  
  // Ensure required fields exist with defaults
  return {
    rating: Math.max(0, Math.min(100, Number(parsed.rating ?? 0))) | 0,
    short_message: String(shortMessage || 'Background analysis completed'),
    description: String(description || 'No detailed description provided.'),
    severity: (['info', 'warn', 'error'].includes(parsed.severity) 
      ? parsed.severity 
      : 'info') as 'info' | 'warn' | 'error',
    notify: Boolean(parsed.notify ?? true),
    details: (typeof parsed.details === 'object' && parsed.details !== null 
      ? parsed.details 
      : {}),
  };
}

/**
 * Evaluates a background agent on a conversation slice.
 * 
 * This function:
 * 1. Builds a structured prompt with agent instructions and conversation context
 * 2. Sends the prompt to the configured model (defaults to gpt-oss-120b)
 * 3. Parses and validates the JSON response
 * 4. Returns normalized evaluation results
 * 
 * The action type is always determined by the agent's configuration, not the model response.
 * The model only provides evaluation metrics (rating, severity, message, etc.).
 * 
 * @param agent - The background agent configuration
 * @param slice - The conversation slice to evaluate
 * @returns Promise resolving to the evaluation result
 */
export async function evaluateBackgroundAgent(
  agent: BackgroundAgent,
  slice: ConversationSlice
): Promise<EvaluationResult> {
  console.log(`🤖 [BackgroundAgents] Evaluating agent "${agent.name}" (ID: ${agent.id})`);
  console.log(`🤖 [BackgroundAgents] Conversation slice: ${slice.messages.length} messages, Conversation ID: ${slice.conversationId}`);
  
  const nlpWorkbenchAPIClient = createNLPWorkbenchAPIClientWithSettings();
  const schema = buildOutputSchema(agent);
  const prompt = buildAgentPrompt(agent, slice.messages, schema);
  
  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Prompt length: ${prompt.length} chars`);
  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Prompt template preview: ${(agent.promptTemplate || '').substring(0, 100)}...`);

  // Model selection - currently defaults to gpt-oss-120b
  // TODO: Add model selection capability to agent configuration
  const selectedModel = 'gpt-oss-120b';
  let execStatus;
  try {
    const apiCallStartTime = Date.now();
    console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Executing model: ${selectedModel}`);
    
    execStatus = await nlpWorkbenchAPIClient.executeAgentAndWait(
      prompt,
      (input: string) => nlpWorkbenchAPIClient.executeModelAgent(selectedModel, input)
    );
    
    const apiCallTime = Date.now() - apiCallStartTime;
    console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - API call completed in ${apiCallTime}ms, status: ${execStatus?.status}`);
    
    if (execStatus?.status !== 'completed') {
      throw new Error(`Model execution failed with status: ${execStatus?.status}`);
    }
  } catch (error: any) {
    console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - API call failed:`, error?.message || error, `Status: ${error?.status}`);
    
    // Handle API key/auth errors gracefully - return a neutral result that won't trigger alerts
    if (error?.status === 403 || error?.message?.includes('Paid membership') || error?.message?.includes('API key')) {
      console.warn(`🤖 [BackgroundAgents] Agent "${agent.name}" - Evaluation skipped due to authentication error`);
      return {
        agentId: agent.id,
        actionType: agent.actionType,
        rating: 0,
        severity: 'info' as const,
        notify: false,
        shortMessage: '',
        description: 'Evaluation skipped - authentication required',
        details: { error: 'Evaluation skipped - authentication required' },
        rawModelOutput: '{}',
        parsedResult: { rating: 0, short_message: '', description: '', severity: 'info', notify: false, details: {} },
      };
    }
    // Re-throw other errors to be handled by the caller
    throw error;
  }

  // Extract and parse model output
  const rawModelOutput = extractModelOutput(execStatus, agent.name);
  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Raw model output (${rawModelOutput.length} chars):`, rawModelOutput.substring(0, 200));

  const parsed = parseJsonWithRepair(rawModelOutput, agent.name);
  
  // Track parsing errors for debugging
  let parseError: { message: string; rawOutput: string; execStatus?: any } | undefined;
  if (!parsed || rawModelOutput.length === 0 || rawModelOutput === '{}') {
    const errorMessage = rawModelOutput.length === 0 
      ? 'Model returned empty response'
      : rawModelOutput === '{}'
      ? 'Model response could not be extracted from execution status'
      : 'Failed to parse model response as JSON';
    
    parseError = {
      message: errorMessage,
      rawOutput: rawModelOutput,
      execStatus: execStatus, // Include full execStatus for debugging
    };
    
    console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - Parse error:`, errorMessage);
    console.error(`🤖 [BackgroundAgents] Agent "${agent.name}" - Full execStatus:`, JSON.stringify(execStatus, null, 2));
  }
  
  const normalized = validateAndNormalizeResult(parsed, agent);

  // Always use the agent's configured actionType - never trust the model's action_type
  // The model should only provide evaluation metrics (rating, severity, message, etc.)
  // The action type is a hard-coded property of the agent definition
  const actionType = agent.actionType;
  
  const verbosityThreshold = Number(agent.verbosityThreshold ?? 50);
  // Alert when rating is <= threshold (lower rating = worse, so we want to alert on low scores)
  const notify = normalized.notify && normalized.rating <= verbosityThreshold;

  const result = {
    agentId: agent.id,
    actionType,
    rating: normalized.rating,
    severity: normalized.severity,
    notify,
    shortMessage: normalized.short_message,
    description: normalized.description,
    details: normalized.details,
    rawModelOutput,
    parsedResult: normalized,
    // Legacy field for backward compatibility - use shortMessage instead
    message: normalized.short_message,
    // Include parse error if one occurred
    parseError,
  };

  console.log(`🤖 [BackgroundAgents] Agent "${agent.name}" - Evaluation result:`, {
    actionType: result.actionType,
    rating: result.rating,
    severity: result.severity,
    notify: result.notify,
    shortMessageLength: result.shortMessage.length,
    descriptionLength: result.description.length,
    verbosityThreshold,
    meetsThreshold: result.rating <= verbosityThreshold,
  });

  return result;
}
