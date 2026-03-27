/**
 * TypeScript type definitions for OpenRouter API
 * Based on OpenRouter API documentation: https://openrouter.ai/docs/api-reference
 */

/**
 * OpenRouter message role types
 */
export type OpenRouterMessageRole = 'system' | 'user' | 'assistant';

/**
 * OpenRouter message format
 */
export interface OpenRouterMessage {
  role: OpenRouterMessageRole;
  content: string;
  name?: string; // Optional name for the message
}

/**
 * OpenRouter model pricing information
 */
export interface OpenRouterPricing {
  prompt: string; // Price per prompt token (e.g., "0.0000001")
  completion: string; // Price per completion token (e.g., "0.0000002")
  image?: string; // Price per image (if applicable)
  request?: string; // Price per request (if applicable)
  cache_read?: string; // Price per cache read (if applicable)
  cache_write?: string; // Price per cache write (if applicable)
}

/**
 * OpenRouter model metadata
 */
export interface OpenRouterModel {
  id: string; // Model identifier (e.g., "openai/gpt-4")
  name: string; // Human-readable model name
  description?: string; // Model description
  context_length: number; // Maximum context length in tokens
  architecture: {
    modality: 'text' | 'image' | 'multimodal';
    tokenizer: string; // Tokenizer used
    instruct_type?: string; // Instruction type if applicable
  };
  top_provider: {
    max_completion_tokens?: number; // Maximum completion tokens
    is_moderated: boolean; // Whether the provider moderates content
  };
  per_request_limits?: {
    prompt_tokens?: string; // Prompt token limit per request
    completion_tokens?: string; // Completion token limit per request
  };
  pricing: OpenRouterPricing;
  // Supported features
  supported_generation_methods?: ('completion' | 'chat_completion')[];
  // Model capabilities
  capabilities?: {
    tools?: boolean; // Tool calling support
    json_mode?: boolean; // JSON mode support
    structured_outputs?: boolean; // Structured outputs support
    web_search?: boolean; // Web search plugin support
    reasoning?: boolean; // Reasoning capabilities
  };
  // Supported parameters
  supported_parameters?: string[]; // e.g., ["temperature", "top_p", "top_k"]
  // Model category
  category?: string; // e.g., "programming", "roleplay", "finance"
}

/**
 * OpenRouter models list response
 */
export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

/**
 * OpenRouter provider routing configuration
 */
export interface OpenRouterProviderConfig {
  order?: string[]; // Provider order preference
  allow_fallbacks?: boolean; // Allow fallback to other providers
  require_parameters?: string[]; // Require specific parameters
  quantizations?: string[]; // Filter by quantization (e.g., ["4-bit", "8-bit"])
  data_collection?: 'allow' | 'deny' | 'zdr'; // Data retention policy
  sort?: 'price' | 'throughput' | 'latency'; // Sort providers by
}

/**
 * OpenRouter chat completion request
 */
export interface OpenRouterChatRequest {
  model: string; // Model ID (e.g., "openai/gpt-4")
  messages: OpenRouterMessage[];
  // Optional parameters
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  seed?: number;
  max_tokens?: number;
  min_tokens?: number;
  // Streaming
  stream?: boolean;
  // Provider routing
  provider?: OpenRouterProviderConfig;
  // Plugins
  plugins?: string[]; // e.g., ["web_search", "pdf_parsing"]
  // Tool calling
  tools?: any[]; // Tool definitions
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  // Response format
  response_format?: {
    type: 'text' | 'json_object';
    schema?: any; // JSON schema for structured outputs
  };
  // Metadata
  metadata?: {
    application?: string; // Application name
    user?: string; // User identifier
  };
}

/**
 * OpenRouter chat completion choice
 */
export interface OpenRouterChatChoice {
  index: number;
  message: OpenRouterMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: any;
}

/**
 * OpenRouter usage statistics
 */
export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

/**
 * OpenRouter non-streaming chat completion response
 */
export interface OpenRouterChatResponse {
  id: string; // Response ID
  model: string; // Model used
  choices: OpenRouterChatChoice[];
  created: number; // Unix timestamp
  usage: OpenRouterUsage;
  // OpenRouter-specific fields
  provider?: {
    name: string; // Provider name
    context_length: number; // Context length used
  };
}

/**
 * OpenRouter streaming chat completion delta
 */
export interface OpenRouterStreamDelta {
  role?: OpenRouterMessageRole;
  content?: string;
  tool_calls?: any[];
}

/**
 * OpenRouter streaming chat completion choice
 */
export interface OpenRouterStreamChoice {
  index: number;
  delta: OpenRouterStreamDelta;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

/**
 * OpenRouter streaming chat completion chunk
 */
export interface OpenRouterStreamChunk {
  id: string;
  model: string;
  choices: OpenRouterStreamChoice[];
  created: number;
  usage?: OpenRouterUsage;
  provider?: {
    name: string;
    context_length: number;
  };
}

/**
 * OpenRouter error response
 */
export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string | number;
    param?: string;
  };
}

/**
 * OpenRouter API error types
 */
export class OpenRouterAPIError extends Error {
  status: number;
  code?: string | number;
  type?: string;
  param?: string;

  constructor(
    message: string,
    status: number,
    code?: string | number,
    type?: string,
    param?: string
  ) {
    super(message);
    this.name = 'OpenRouterAPIError';
    this.status = status;
    this.code = code;
    this.type = type;
    this.param = param;
  }

  static fromResponse(error: OpenRouterError, status: number): OpenRouterAPIError {
    return new OpenRouterAPIError(
      error.error.message,
      status,
      error.error.code,
      error.error.type,
      error.error.param
    );
  }
}
