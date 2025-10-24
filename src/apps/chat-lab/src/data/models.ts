// Centralized model definitions for Chat Lab
// This file contains all available AI models with their configurations, URLs, and descriptions

import { getGatewayUrl } from '../utils/environment';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  agentId: string;
  maxTokens: number;
  description: string;
  capabilities: string[];
  category: 'general' | 'coding' | 'reasoning' | 'multimodal' | 'search';
  costTier: 'low' | 'medium' | 'high' | 'premium';
  speed: 'fast' | 'medium' | 'slow';
  // New metadata to support BYOK and routing visibility
  executionPath: ExecutionPath;
  providerKey?: ProviderKey;
}

export type ExecutionPath = 'openrouter' | 'direct';
export type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'microsoft'
  | 'xai'
  | 'openrouter';

// Model configurations mapped by model ID
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Auto Router
  'auto-router': {
    id: 'auto-router',
    name: 'Auto Router',
    provider: 'NLP Workbench',
    agentId: 'agent-1760704967617415350',
    maxTokens: 128000,
    description: 'Intelligent routing system that automatically selects the best model for your task',
    capabilities: ['routing', 'optimization', 'task-analysis'],
    category: 'general',
    costTier: 'medium',
    speed: 'fast',
    executionPath: 'openrouter'
  },

  // OpenAI Models
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    agentId: 'agent-1760705053398115593',
    maxTokens: 16385,
    description: 'Fast and cost-effective model for simple tasks and quick responses',
    capabilities: ['text-generation', 'conversation', 'summarization'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-3.5-turbo-instruct': {
    id: 'gpt-3.5-turbo-instruct',
    name: 'GPT-3.5 Turbo Instruct',
    provider: 'OpenAI',
    agentId: 'agent-1760705089403635100',
    maxTokens: 16385,
    description: 'Instruction-tuned version optimized for following specific directions',
    capabilities: ['instruction-following', 'task-completion', 'structured-output'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    agentId: 'agent-1760705320712272823',
    maxTokens: 128000,
    description: 'Standard GPT-4 model with strong reasoning capabilities and broad knowledge',
    capabilities: ['reasoning', 'analysis', 'complex-problem-solving'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    agentId: 'agent-1760705466957671877',
    maxTokens: 128000,
    description: 'Fast and efficient GPT-4 model optimized for most use cases',
    capabilities: ['reasoning', 'analysis', 'fast-processing'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    agentId: 'agent-1760705506337652774',
    maxTokens: 128000,
    description: 'Multimodal GPT-4 model with vision capabilities and enhanced performance',
    capabilities: ['multimodal', 'vision', 'reasoning', 'analysis'],
    category: 'multimodal',
    costTier: 'high',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-4o-search-preview': {
    id: 'gpt-4o-search-preview',
    name: 'GPT-4o Search Preview',
    provider: 'OpenAI',
    agentId: 'agent-1760705560426328350',
    maxTokens: 128000,
    description: 'GPT-4o with real-time web search capabilities for current information',
    capabilities: ['web-search', 'real-time-info', 'multimodal', 'reasoning'],
    category: 'search',
    costTier: 'premium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    agentId: 'agent-1760705613286137890',
    maxTokens: 128000,
    description: 'Compact GPT-4o model for cost-effective usage with good performance',
    capabilities: ['multimodal', 'reasoning', 'cost-effective'],
    category: 'multimodal',
    costTier: 'medium',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-4o-mini-search-preview': {
    id: 'gpt-4o-mini-search-preview',
    name: 'GPT-4o Mini Search Preview',
    provider: 'OpenAI',
    agentId: 'agent-1760705659828798869',
    maxTokens: 128000,
    description: 'GPT-4o Mini with web search capabilities for current information',
    capabilities: ['web-search', 'real-time-info', 'multimodal', 'cost-effective'],
    category: 'search',
    costTier: 'medium',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-5': {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    agentId: 'agent-1760705693833449461',
    maxTokens: 128000,
    description: 'Latest GPT-5 model with advanced capabilities and improved reasoning',
    capabilities: ['advanced-reasoning', 'complex-analysis', 'latest-features'],
    category: 'reasoning',
    costTier: 'premium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    agentId: 'agent-1760705730738170554',
    maxTokens: 128000,
    description: 'Compact GPT-5 model for efficient processing with advanced capabilities',
    capabilities: ['advanced-reasoning', 'efficient-processing', 'cost-effective'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    agentId: 'agent-1760705791304160253',
    maxTokens: 128000,
    description: 'Ultra-compact GPT-5 model for maximum efficiency and speed',
    capabilities: ['ultra-fast', 'efficient', 'lightweight'],
    category: 'general',
    costTier: 'medium',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  // GPT-5-Pro is very expensive and slow, often causing requests to timeout. 
  // Going to leave it out for now, but it's an option. 
  // 'gpt-5-pro': {
  //   id: 'gpt-5-pro',
  //   name: 'GPT-5 Pro',
  //   provider: 'OpenAI',
  //   agentId: 'agent-1760705821375280640',
  //   maxTokens: 128000,
  //   description: 'Professional-grade GPT-5 model with maximum capabilities and performance',
  //   capabilities: ['maximum-capabilities', 'professional-grade', 'advanced-reasoning'],
  //   category: 'reasoning',
  //   costTier: 'premium',
  //   speed: 'slow',
  //   executionPath: 'openrouter',
  //   providerKey: 'openai'
  // },
  'gpt-oss-20b': {
    id: 'gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'OpenAI',
    agentId: 'agent-1761212031501504422',
    maxTokens: 128000,
    description: 'Open Source GPT-20B model with fantastic performance and good capabilities',
    capabilities: ['open-source', 'advanced-reasoning', 'general-use'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },
  'gpt-oss-120b': {
    id: 'gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'OpenAI',
    agentId: 'agent-1760960117597658953',
    maxTokens: 128000,
    description: 'Open Source GPT-120B model with maximum capabilities and performance',
    capabilities: ['open-source', 'advanced-reasoning', 'general-use'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'openai'
  },

  // Anthropic Claude Models
  'claude-haiku-3': {
    id: 'claude-haiku-3',
    name: 'Claude Haiku 3',
    provider: 'Anthropic',
    agentId: 'agent-1760705845490475103',
    maxTokens: 200000,
    description: 'Fastest Claude model for quick responses and simple tasks',
    capabilities: ['fast-responses', 'simple-tasks', 'conversation'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'anthropic'
  },
  'claude-haiku-3.5': {
    id: 'claude-haiku-3.5',
    name: 'Claude Haiku 3.5',
    provider: 'Anthropic',
    agentId: 'agent-1760706358784244479',
    maxTokens: 200000,
    description: 'Enhanced Claude Haiku with improved performance and capabilities',
    capabilities: ['fast-responses', 'improved-performance', 'conversation'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'anthropic'
  },
  'claude-opus-4': {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    agentId: 'agent-1760706383558420507',
    maxTokens: 200000,
    description: 'Most capable Claude model with advanced reasoning and analysis capabilities',
    capabilities: ['advanced-reasoning', 'complex-analysis', 'creative-writing'],
    category: 'reasoning',
    costTier: 'premium',
    speed: 'slow',
    executionPath: 'openrouter',
    providerKey: 'anthropic'
  },
  'claude-opus-4.1': {
    id: 'claude-opus-4.1',
    name: 'Claude Opus 4.1',
    provider: 'Anthropic',
    agentId: 'agent-1760706407136556576',
    maxTokens: 200000,
    description: 'Enhanced Claude Opus with improved reasoning and updated knowledge',
    capabilities: ['advanced-reasoning', 'complex-analysis', 'updated-knowledge'],
    category: 'reasoning',
    costTier: 'premium',
    speed: 'slow',
    executionPath: 'openrouter',
    providerKey: 'anthropic'
  },
  'claude-sonnet-3.7': {
    id: 'claude-sonnet-3.7',
    name: 'Claude Sonnet 3.7',
    provider: 'Anthropic',
    agentId: 'agent-1760706438010442624',
    maxTokens: 200000,
    description: 'Balanced Claude model for general use with good performance',
    capabilities: ['balanced-performance', 'general-use', 'conversation'],
    category: 'general',
    costTier: 'medium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'anthropic'
  },
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    agentId: 'agent-1760706461560174997',
    maxTokens: 200000,
    description: 'Enhanced Claude Sonnet with improved capabilities and performance',
    capabilities: ['improved-capabilities', 'balanced-performance', 'general-use'],
    category: 'general',
    costTier: 'medium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'anthropic'
  },
  'claude-sonnet-4.5': {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    agentId: 'agent-1760706478542170589',
    maxTokens: 200000,
    description: 'Latest Claude Sonnet with enhanced performance and capabilities',
    capabilities: ['latest-features', 'enhanced-performance', 'general-use'],
    category: 'general',
    costTier: 'medium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'anthropic'
  },

  // Google Gemini Models
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    agentId: 'agent-1760706522943960820',
    maxTokens: 32768,
    description: 'Fast and efficient Gemini model for quick responses and general tasks',
    capabilities: ['fast-responses', 'general-tasks', 'multimodal'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'google'
  },
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    provider: 'Google',
    agentId: 'agent-1760706551033086790',
    maxTokens: 32768,
    description: 'Ultra-lightweight Gemini model for maximum speed and efficiency',
    capabilities: ['ultra-fast', 'lightweight', 'efficient'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'google'
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    agentId: 'agent-1760706590897101696',
    maxTokens: 32768,
    description: 'Enhanced Gemini Flash with improved performance and capabilities',
    capabilities: ['improved-performance', 'fast-responses', 'multimodal'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'google'
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'Google',
    agentId: 'agent-1760706615390075250',
    maxTokens: 32768,
    description: 'Enhanced lightweight Gemini model for ultra-fast processing',
    capabilities: ['ultra-fast', 'enhanced-performance', 'lightweight'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'google'
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    agentId: 'agent-1760706637079605131',
    maxTokens: 32768,
    description: 'Google\'s most capable Gemini model for complex tasks and advanced reasoning',
    capabilities: ['advanced-reasoning', 'complex-tasks', 'multimodal'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'google'
  },

  // Meta Llama Models
  'llama-4-maverick': {
    id: 'llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    agentId: 'agent-1760706657551628343',
    maxTokens: 128000,
    description: 'Advanced Llama model with enhanced capabilities and performance',
    capabilities: ['advanced-capabilities', 'enhanced-performance', 'reasoning'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'meta'
  },
  'llama-4-scout': {
    id: 'llama-4-scout',
    name: 'Llama 4 Scout',
    provider: 'Meta',
    agentId: 'agent-1760706677004528555',
    maxTokens: 128000,
    description: 'Efficient Llama model optimized for speed and cost-effectiveness',
    capabilities: ['efficient-processing', 'cost-effective', 'fast-responses'],
    category: 'general',
    costTier: 'medium',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'meta'
  },

  // Mistral Models
  'mistral-medium-3.1': {
    id: 'mistral-medium-3.1',
    name: 'Mistral Medium 3.1',
    provider: 'Mistral',
    agentId: 'agent-1760706702760080740',
    maxTokens: 128000,
    description: 'Balanced Mistral model with good performance for general tasks',
    capabilities: ['balanced-performance', 'general-tasks', 'reasoning'],
    category: 'general',
    costTier: 'medium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'mistral'
  },
  'mistral-codestral-2508': {
    id: 'mistral-codestral-2508',
    name: 'Mistral Codestral 2508',
    provider: 'Mistral',
    agentId: 'agent-1760707034347611905',
    maxTokens: 128000,
    description: 'Specialized Mistral model optimized for coding and programming tasks',
    capabilities: ['coding', 'programming', 'code-generation', 'debugging'],
    category: 'coding',
    costTier: 'medium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'mistral'
  },
  'mistral-ministral-3b': {
    id: 'mistral-ministral-3b',
    name: 'Mistral Ministral 3B',
    provider: 'Mistral',
    agentId: 'agent-1760707075366443333',
    maxTokens: 128000,
    description: 'Compact 3B parameter Mistral model for fast and efficient processing',
    capabilities: ['fast-processing', 'efficient', 'lightweight'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'mistral'
  },
  'mistral-ministral-8b': {
    id: 'mistral-ministral-8b',
    name: 'Mistral Ministral 8B',
    provider: 'Mistral',
    agentId: 'agent-1760707108767100052',
    maxTokens: 128000,
    description: '8B parameter Mistral model with balanced performance and efficiency',
    capabilities: ['balanced-performance', 'efficient', 'general-use'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'mistral'
  },
  'mistral-small': {
    id: 'mistral-small',
    name: 'Mistral Small',
    provider: 'Mistral',
    agentId: 'agent-1760707131235300191',
    maxTokens: 128000,
    description: 'Small Mistral model for cost-effective general purpose tasks',
    capabilities: ['cost-effective', 'general-purpose', 'efficient'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'mistral'
  },
  'mistral-tiny': {
    id: 'mistral-tiny',
    name: 'Mistral Tiny',
    provider: 'Mistral',
    agentId: 'agent-1760707154439527475',
    maxTokens: 128000,
    description: 'Ultra-compact Mistral model for maximum speed and efficiency',
    capabilities: ['ultra-fast', 'maximum-efficiency', 'lightweight'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'mistral'
  },
  'mistral-large': {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'Mistral',
    agentId: 'agent-1760707180706454867',
    maxTokens: 128000,
    description: 'Large Mistral model with advanced capabilities for complex tasks',
    capabilities: ['advanced-capabilities', 'complex-tasks', 'reasoning'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'mistral'
  },

  // Microsoft Phi Models
  'microsoft-phi-4': {
    id: 'microsoft-phi-4',
    name: 'Microsoft Phi 4',
    provider: 'Microsoft',
    agentId: 'agent-1760707202082019962',
    maxTokens: 128000,
    description: 'Microsoft\'s Phi-4 model with strong reasoning and mathematical capabilities',
    capabilities: ['reasoning', 'mathematics', 'analysis'],
    category: 'reasoning',
    costTier: 'medium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'microsoft'
  },
  'microsoft-phi-4-multimodal': {
    id: 'microsoft-phi-4-multimodal',
    name: 'Microsoft Phi 4 Multimodal',
    provider: 'Microsoft',
    agentId: 'agent-1760707223792061056',
    maxTokens: 128000,
    description: 'Multimodal Phi-4 model with vision and text processing capabilities',
    capabilities: ['multimodal', 'vision', 'reasoning', 'mathematics'],
    category: 'multimodal',
    costTier: 'medium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'microsoft'
  },
  'microsoft-phi-4-reasoning-plus': {
    id: 'microsoft-phi-4-reasoning-plus',
    name: 'Microsoft Phi 4 Reasoning Plus',
    provider: 'Microsoft',
    agentId: 'agent-1760707248047608924',
    maxTokens: 128000,
    description: 'Enhanced Phi-4 model with advanced reasoning and problem-solving capabilities',
    capabilities: ['advanced-reasoning', 'problem-solving', 'mathematics', 'analysis'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'microsoft'
  },

  // xAI Grok Models
  'grok-3': {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xAI',
    agentId: 'agent-1760707269037134547',
    maxTokens: 128000,
    description: 'xAI\'s Grok-3 model with real-time information access and conversational capabilities',
    capabilities: ['real-time-info', 'conversation', 'reasoning'],
    category: 'search',
    costTier: 'high',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'xai'
  },
  'grok-3-mini': {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini',
    provider: 'xAI',
    agentId: 'agent-1760707632555954554',
    maxTokens: 128000,
    description: 'Compact Grok-3 model for efficient processing with real-time capabilities',
    capabilities: ['real-time-info', 'efficient-processing', 'conversation'],
    category: 'search',
    costTier: 'medium',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'xai'
  },
  'grok-4': {
    id: 'grok-4',
    name: 'Grok 4',
    provider: 'xAI',
    agentId: 'agent-1760707653003847088',
    maxTokens: 128000,
    description: 'Advanced Grok-4 model with enhanced reasoning and real-time information access',
    capabilities: ['advanced-reasoning', 'real-time-info', 'conversation'],
    category: 'search',
    costTier: 'premium',
    speed: 'medium',
    executionPath: 'openrouter',
    providerKey: 'xai'
  },
  'grok-4-fast': {
    id: 'grok-4-fast',
    name: 'Grok 4 Fast',
    provider: 'xAI',
    agentId: 'agent-1760707675878618837',
    maxTokens: 128000,
    description: 'Fast Grok-4 model optimized for speed while maintaining advanced capabilities',
    capabilities: ['advanced-reasoning', 'real-time-info', 'fast-processing'],
    category: 'search',
    costTier: 'high',
    speed: 'fast',
    executionPath: 'openrouter',
    providerKey: 'xai'
  }
  ,

  // ===== Direct (non-OpenRouter) Models =====
  // Google Gemini (Direct)
  'gemini-2.5-flash-lite-direct': {
    id: 'gemini-2.5-flash-lite-direct',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    agentId: 'agent-1757247536134017642',
    maxTokens: 32768,
    description: 'Ultra-lightweight Gemini model for maximum speed and efficiency',
    capabilities: ['ultra-fast', 'lightweight', 'efficient'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'direct',
    providerKey: 'google'
  },
  'gemini-2.0-flash-direct': {
    id: 'gemini-2.0-flash-direct',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    agentId: 'agent-1757247513434443545',
    maxTokens: 32768,
    description: 'Fast and efficient Gemini model for quick responses and general tasks',
    capabilities: ['fast-responses', 'general-tasks', 'multimodal'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'direct',
    providerKey: 'google'
  },

  // Anthropic Claude (Direct)
  'claude-opus-4.1-direct': {
    id: 'claude-opus-4.1-direct',
    name: 'Claude Opus 4.1',
    provider: 'Anthropic',
    agentId: 'agent-1758124239529968489',
    maxTokens: 200000,
    description: 'Enhanced Claude Opus with improved reasoning and updated knowledge',
    capabilities: ['advanced-reasoning', 'complex-analysis', 'updated-knowledge'],
    category: 'reasoning',
    costTier: 'premium',
    speed: 'slow',
    executionPath: 'direct',
    providerKey: 'anthropic'
  },
  'claude-haiku-3-direct': {
    id: 'claude-haiku-3-direct',
    name: 'Claude Haiku 3',
    provider: 'Anthropic',
    agentId: 'agent-1757247576782610310',
    maxTokens: 200000,
    description: 'Fastest Claude model for quick responses and simple tasks',
    capabilities: ['fast-responses', 'simple-tasks', 'conversation'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'direct',
    providerKey: 'anthropic'
  },
  'claude-sonnet-3.7-direct': {
    id: 'claude-sonnet-3.7-direct',
    name: 'Claude Sonnet 3.7',
    provider: 'Anthropic',
    agentId: 'agent-1757247595523653178',
    maxTokens: 200000,
    description: 'Balanced Claude model for general use with good performance',
    capabilities: ['balanced-performance', 'general-use', 'conversation'],
    category: 'general',
    costTier: 'medium',
    speed: 'medium',
    executionPath: 'direct',
    providerKey: 'anthropic'
  },

  // OpenAI GPT (Direct)
  'gpt-5-nano-direct': {
    id: 'gpt-5-nano-direct',
    name: 'GPT 5.0 Nano',
    provider: 'OpenAI',
    agentId: 'agent-1757247941934986576',
    maxTokens: 128000,
    description: 'Ultra-compact GPT-5 model for maximum efficiency and speed',
    capabilities: ['ultra-fast', 'efficient', 'lightweight'],
    category: 'general',
    costTier: 'medium',
    speed: 'fast',
    executionPath: 'direct',
    providerKey: 'openai'
  },
  'gpt-5-mini-direct': {
    id: 'gpt-5-mini-direct',
    name: 'GPT 5.0 Mini',
    provider: 'OpenAI',
    agentId: 'agent-1757247909361890725',
    maxTokens: 128000,
    description: 'Compact GPT-5 model for efficient processing with advanced capabilities',
    capabilities: ['advanced-reasoning', 'efficient-processing', 'cost-effective'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'fast',
    executionPath: 'direct',
    providerKey: 'openai'
  },
  'gpt-5-direct': {
    id: 'gpt-5-direct',
    name: 'GPT 5.0',
    provider: 'OpenAI',
    agentId: 'agent-1757247842543346249',
    maxTokens: 128000,
    description: 'Latest GPT-5 model with advanced capabilities and improved reasoning',
    capabilities: ['advanced-reasoning', 'complex-analysis', 'latest-features'],
    category: 'reasoning',
    costTier: 'premium',
    speed: 'medium',
    executionPath: 'direct',
    providerKey: 'openai'
  },
  'gpt-4o-mini-direct': {
    id: 'gpt-4o-mini-direct',
    name: 'GPT 4.0 Mini',
    provider: 'OpenAI',
    agentId: 'agent-1757247819944085397',
    maxTokens: 128000,
    description: 'Compact GPT-4o model for cost-effective usage with good performance',
    capabilities: ['multimodal', 'reasoning', 'cost-effective'],
    category: 'multimodal',
    costTier: 'medium',
    speed: 'fast',
    executionPath: 'direct',
    providerKey: 'openai'
  },
  'gpt-4-direct': {
    id: 'gpt-4-direct',
    name: 'GPT 4.0',
    provider: 'OpenAI',
    agentId: 'agent-1757247792142471669',
    maxTokens: 128000,
    description: 'Standard GPT-4 model with strong reasoning capabilities and broad knowledge',
    capabilities: ['reasoning', 'analysis', 'complex-problem-solving'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'medium',
    executionPath: 'direct',
    providerKey: 'openai'
  },
  'gpt-4-turbo-direct': {
    id: 'gpt-4-turbo-direct',
    name: 'GPT 4.0 Turbo',
    provider: 'OpenAI',
    agentId: 'agent-1757247699977175946',
    maxTokens: 128000,
    description: 'Fast and efficient GPT-4 model optimized for most use cases',
    capabilities: ['reasoning', 'analysis', 'fast-processing'],
    category: 'reasoning',
    costTier: 'high',
    speed: 'fast',
    executionPath: 'direct',
    providerKey: 'openai'
  },
  'gpt-3.5-turbo-direct': {
    id: 'gpt-3.5-turbo-direct',
    name: 'GPT 3.5 Turbo',
    provider: 'OpenAI',
    agentId: 'agent-1757247699977175946',
    maxTokens: 16385,
    description: 'Fast and cost-effective model for simple tasks and quick responses',
    capabilities: ['text-generation', 'conversation', 'summarization'],
    category: 'general',
    costTier: 'low',
    speed: 'fast',
    executionPath: 'direct',
    providerKey: 'openai'
  },
  'gpt-4o-search-preview-direct': {
    id: 'gpt-4o-search-preview-direct',
    name: 'GPT 4o Search',
    provider: 'OpenAI',
    agentId: 'agent-1760959407832164620',
    maxTokens: 128000,
    description: 'GPT-4o with real-time web search capabilities for current information',
    capabilities: ['web-search', 'real-time-info', 'multimodal', 'reasoning'],
    category: 'search',
    costTier: 'premium',
    speed: 'medium',
    executionPath: 'direct',
    providerKey: 'openai'
  }
};

// Helper functions for working with models
export const getModelConfig = (modelId: string): ModelConfig | undefined => {
  return MODEL_CONFIGS[modelId];
};

export const getAllModels = (): ModelConfig[] => {
  return Object.values(MODEL_CONFIGS);
};

export const getModelsByProvider = (provider: string): ModelConfig[] => {
  return Object.values(MODEL_CONFIGS).filter(model => model.provider === provider);
};

export const getModelsByCategory = (category: ModelConfig['category']): ModelConfig[] => {
  return Object.values(MODEL_CONFIGS).filter(model => model.category === category);
};

export const getModelsByCostTier = (costTier: ModelConfig['costTier']): ModelConfig[] => {
  return Object.values(MODEL_CONFIGS).filter(model => model.costTier === costTier);
};

export const getModelsBySpeed = (speed: ModelConfig['speed']): ModelConfig[] => {
  return Object.values(MODEL_CONFIGS).filter(model => model.speed === speed);
};

// BYOK helpers
export const isBYOKSupported = (model: ModelConfig): boolean => {
  return model.executionPath === 'direct' && !!model.providerKey;
};

export const getModelsForMode = (options: { useBYOK: boolean; userProviders?: ProviderKey[] }): ModelConfig[] => {
  const { useBYOK, userProviders } = options;
  const models = getAllModels();
  if (!useBYOK) return models;
  const allowedProviders = new Set<ProviderKey>(userProviders || []);
  // BYOK enabled: if no provider keys are configured, show nothing
  if (allowedProviders.size === 0) return [];
  
  return models.filter(m => {
    // Show OpenRouter models if user has OpenRouter key
    if (m.executionPath === 'openrouter' && allowedProviders.has('openrouter')) {
      return true;
    }
    // Show direct models if user has the corresponding provider key
    return isBYOKSupported(m) && !!m.providerKey && allowedProviders.has(m.providerKey);
  });
};

// Get model agent URL
export const getModelAgentUrl = (modelId: string): string => {
  const config = getModelConfig(modelId);
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }
  const gatewayUrl = getGatewayUrl();
  return `${gatewayUrl}/api/nlp-workbench/api/public/agents/${config.agentId}/execute`;
};

// Legacy model ID mappings for backward compatibility
export const LEGACY_MODEL_MAPPINGS: Record<string, string> = {
  'gemini-flash': 'gemini-2.0-flash',
  'gemini-pro': 'gemini-2.5-pro',
  'claude-haiku': 'claude-haiku-3',
  'claude-sonnet': 'claude-sonnet-4',
  'claude-opus-41': 'claude-opus-4.1',
  'gpt-3.5-turbo': 'gpt-3.5-turbo',
  'gpt-4.0': 'gpt-4',
  'gpt-4.0-turbo': 'gpt-4-turbo',
  'gpt-4.0-mini': 'gpt-4o-mini',
  'gpt-5.0': 'gpt-5',
  'gpt-5.0-mini': 'gpt-5-mini',
  'gpt-5.0-nano': 'gpt-5-nano'
};

// Convert legacy model ID to new model ID
export const convertLegacyModelId = (legacyId: string): string => {
  return LEGACY_MODEL_MAPPINGS[legacyId] || legacyId;
};
