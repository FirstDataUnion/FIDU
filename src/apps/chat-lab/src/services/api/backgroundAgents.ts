import { fiduVaultAPIClient } from './apiClientFIDUVault';

export const BACKGROUND_AGENT_TAG = 'FIDU-CHAT-LAB-BackgroundAgent';

export type AgentActionType = 'alert' | 'update_context';

export interface BackgroundAgentDataPacket {
  id: string;
  profile_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string[];
  data: {
    name: string;
    description: string;
    enabled: boolean;
    action_type: AgentActionType;
    prompt_template: string;
    cadence: {
      run_every_n_turns: number;
    };
    verbosity_threshold: number; // 0-100
    context_window_strategy: 'lastNMessages' | 'summarizeThenEvaluate' | 'fullThreadIfSmall';
    context_params?: {
      lastN?: number;
      token_limit?: number;
    };
    output_schema_name?: 'default' | 'custom';
    custom_output_schema?: Record<string, any> | null;
    notify_channel: 'inline' | 'toast' | 'panel' | 'all';
    is_system?: boolean; // built-in template indicator
    categories?: string[];
    version?: string;
  };
}

export interface BackgroundAgent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  actionType: AgentActionType;
  promptTemplate: string;
  runEveryNTurns: number;
  verbosityThreshold: number;
  contextWindowStrategy: 'lastNMessages' | 'summarizeThenEvaluate' | 'fullThreadIfSmall';
  contextParams?: {
    lastN?: number;
    tokenLimit?: number;
  };
  outputSchemaName?: 'default' | 'custom';
  customOutputSchema?: Record<string, any> | null;
  notifyChannel: 'inline' | 'toast' | 'panel' | 'all';
  isSystem?: boolean;
  categories?: string[];
  version?: string;
  createdAt: string;
  updatedAt: string;
}

const transformDataPacketToBackgroundAgent = (packet: BackgroundAgentDataPacket): BackgroundAgent => {
  // Validate actionType - ensure it's always set and valid
  const actionType: AgentActionType = 
    (packet.data.action_type && (packet.data.action_type === 'alert' || packet.data.action_type === 'update_context'))
      ? packet.data.action_type
      : 'alert'; // Default to 'alert' for backward compatibility and safety
  
  return {
    id: packet.id,
    name: packet.data.name,
    description: packet.data.description,
    enabled: packet.data.enabled,
    actionType: actionType,
    promptTemplate: packet.data.prompt_template,
    runEveryNTurns: packet.data.cadence?.run_every_n_turns ?? 6,
    verbosityThreshold: packet.data.verbosity_threshold,
    contextWindowStrategy: packet.data.context_window_strategy,
    contextParams: packet.data.context_params
      ? {
          lastN: packet.data.context_params.lastN,
          tokenLimit: packet.data.context_params.token_limit,
        }
      : undefined,
    outputSchemaName: packet.data.output_schema_name,
    customOutputSchema: packet.data.custom_output_schema ?? null,
    notifyChannel: packet.data.notify_channel,
    isSystem: packet.data.is_system ?? false,
    categories: packet.data.categories ?? [],
    version: packet.data.version,
    createdAt: packet.create_timestamp,
    updatedAt: packet.update_timestamp,
  };
};

const transformBackgroundAgentToDataPacket = (
  agent: BackgroundAgent,
  profileId: string,
): BackgroundAgentDataPacket => {
  return {
    id: agent.id,
    profile_id: profileId,
    create_timestamp: agent.createdAt || new Date().toISOString(),
    update_timestamp: agent.updatedAt || new Date().toISOString(),
    tags: [BACKGROUND_AGENT_TAG],
    data: {
      name: agent.name,
      description: agent.description,
      enabled: agent.enabled,
      action_type: agent.actionType,
      prompt_template: agent.promptTemplate,
      cadence: {
        run_every_n_turns: agent.runEveryNTurns,
      },
      verbosity_threshold: agent.verbosityThreshold,
      context_window_strategy: agent.contextWindowStrategy,
      context_params: agent.contextParams
        ? {
            lastN: agent.contextParams.lastN,
            token_limit: agent.contextParams.tokenLimit,
          }
        : undefined,
      output_schema_name: agent.outputSchemaName,
      custom_output_schema: agent.customOutputSchema ?? null,
      notify_channel: agent.notifyChannel,
      is_system: agent.isSystem ?? false,
      categories: agent.categories ?? [],
      version: agent.version,
    },
  };
};

export const createBackgroundAgentsApi = () => {
  return {
    getAll: async (queryParams?: any, page = 1, limit = 20, profileId?: string) => {
      const response = await fiduVaultAPIClient.get<BackgroundAgentDataPacket[]>('/data-packets', {
        params: {
          tags: [BACKGROUND_AGENT_TAG],
          profile_id: profileId,
          limit: limit,
          offset: (page - 1) * limit,
          sort_order: 'desc',
          ...queryParams,
        },
        paramsSerializer: {
          serialize: (params: Record<string, any>) => {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                  value.forEach((item) => searchParams.append(key, String(item)));
                } else {
                  searchParams.append(key, String(value));
                }
              }
            });
            return searchParams.toString();
          },
        },
      });

      const agents = Array.isArray(response.data)
        ? response.data.map(transformDataPacketToBackgroundAgent)
        : [];

      return {
        backgroundAgents: agents,
        total: agents.length,
        page,
        limit,
      };
    },

    getById: async (id: string) => {
      const response = await fiduVaultAPIClient.get<BackgroundAgentDataPacket>(`/data-packets/${id}`);
      return transformDataPacketToBackgroundAgent(response.data);
    },

    create: async (agent: BackgroundAgent, profileId: string) => {
      const packet = transformBackgroundAgentToDataPacket(agent, profileId);
      const payload = {
        request_id: agent.id,
        data_packet: packet,
      };
      const response = await fiduVaultAPIClient.post<BackgroundAgentDataPacket>('/data-packets', payload);
      return transformDataPacketToBackgroundAgent(response.data);
    },

    update: async (agent: BackgroundAgent, profileId: string) => {
      const packet = transformBackgroundAgentToDataPacket(agent, profileId);
      const payload = {
        request_id: `${agent.id}-update-${Date.now()}`,
        data_packet: packet,
      };
      const response = await fiduVaultAPIClient.put<BackgroundAgentDataPacket>(`/data-packets/${agent.id}`, payload);
      return transformDataPacketToBackgroundAgent(response.data);
    },

    delete: async (id: string) => {
      await fiduVaultAPIClient.delete(`/data-packets/${id}`);
      return id;
    },
  };
};
