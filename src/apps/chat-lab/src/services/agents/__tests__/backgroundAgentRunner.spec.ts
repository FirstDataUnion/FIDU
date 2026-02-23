import {
  maybeEvaluateBackgroundAgents,
  clearDebounceCache,
} from '../backgroundAgentRunner';
import type { BackgroundAgent } from '../../../types';
import type {
  ConversationSliceMessage,
  EvaluationResult,
} from '../backgroundAgentsService';
import type { Message } from '../../../types';

const mockGetConversationById = jest.fn();
const mockGetMessages = jest.fn();
const mockUpdateConversation = jest.fn();

jest.mock('../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: () => ({
    getBackgroundAgents: jest.fn().mockResolvedValue({
      backgroundAgents: [
        {
          id: 'a1',
          name: 'Agent 1',
          enabled: true,
          runEveryNTurns: 2,
          verbosityThreshold: 50,
          contextWindowStrategy: 'lastNMessages',
          contextParams: { lastN: 6 },
          actionType: 'alert',
        } as BackgroundAgent,
        {
          id: 'a2',
          name: 'Agent 2',
          enabled: false,
          runEveryNTurns: 1,
          verbosityThreshold: 0,
          actionType: 'alert',
        } as BackgroundAgent,
      ],
    }),
    getConversationById: mockGetConversationById,
    getMessages: mockGetMessages,
    updateConversation: mockUpdateConversation,
  }),
}));

const mockEvaluateBackgroundAgent = jest.fn();
jest.mock('../backgroundAgentsService', () => ({
  evaluateBackgroundAgent: (...args: any[]) =>
    mockEvaluateBackgroundAgent(...args),
}));

jest.mock('../agentPreferences', () => ({
  loadAgentPreferences: jest.fn().mockReturnValue({}),
}));

jest.mock('../agentTransformers', () => ({
  transformBuiltInAgentsWithPreferences: jest.fn().mockReturnValue([]),
}));

const addAgentAlertSpy = jest.fn();
jest.mock('../agentAlerts', () => ({
  addAgentAlert: (alert: any) => addAgentAlertSpy(alert),
}));

// Mock the store and feature flag selector
jest.mock('../../../store', () => {
  const mockGetState = jest.fn(() => ({
    systemFeatureFlags: { flags: { background_agents: true } },
  }));
  return {
    store: {
      getState: mockGetState,
    },
  };
});

jest.mock('../../../store/selectors/featureFlagsSelectors', () => ({
  selectIsFeatureFlagEnabled: jest.fn((state: any, flag: string) => {
    return (
      flag === 'background_agents'
      && state.systemFeatureFlags?.flags?.background_agents === true
    );
  }),
}));

describe('maybeEvaluateBackgroundAgents', () => {
  const baseParams = {
    profileId: 'p1',
    conversationId: 'c1',
    messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ] satisfies ConversationSliceMessage[],
    turnCount: 0,
    messageId: 'test-msg-1', // Required parameter
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear debounce cache to prevent test interference
    clearDebounceCache();

    // Reset to default mock that triggers alerts
    mockEvaluateBackgroundAgent.mockResolvedValue({
      agentId: 'a1',
      response: {
        actionType: 'alert',
        rating: 30, // Below threshold of 50 to trigger alert
        severity: 'warn',
        notify: true,
        shortMessage: 'Test alert',
        description: 'Test alert',
        details: {},
      },
      rawModelOutput: '',
      parsedResult: {},
    } satisfies EvaluationResult);

    // Setup default storage mocks
    mockGetConversationById.mockResolvedValue({
      id: 'c1',
      title: 'Test Conversation',
    });
    mockGetMessages.mockResolvedValue([
      {
        id: 'test-msg-1',
        conversationId: 'c1',
        content: 'Hello',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'test',
        isEdited: false,
      } satisfies Message,
    ]);
    mockUpdateConversation.mockResolvedValue({
      id: 'c1',
      title: 'Test Conversation',
    });
  });

  it('does not trigger when cadence does not match', async () => {
    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 1,
      messageId: 'test-msg-1',
    });
    expect(mockEvaluateBackgroundAgent).not.toHaveBeenCalled();
  });

  it('triggers evaluation when cadence matches and emits alert above threshold', async () => {
    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      messageId: 'test-msg-1',
    });
    expect(mockEvaluateBackgroundAgent).toHaveBeenCalledTimes(1);
    expect(addAgentAlertSpy).toHaveBeenCalledTimes(1);
    const alert = addAgentAlertSpy.mock.calls[0][0];
    expect(alert.agentId).toBe('a1');
    expect(alert.message).toBe('Test alert');
  });

  it('skips disabled agents', async () => {
    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      messageId: 'test-msg-1',
    });
    const alert = addAgentAlertSpy.mock.calls[0][0];
    expect(alert.agentId).toBe('a1');
  });

  it('includes conversationId and messageId in alerts', async () => {
    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      conversationId: 'test-conv-1',
      messageId: 'test-msg-1',
    });
    const alert = addAgentAlertSpy.mock.calls[0][0];
    expect(alert.conversationId).toBe('test-conv-1');
    expect(alert.messageId).toBe('test-msg-1');
  });

  it('persists alert metadata to message when conversationId is valid', async () => {
    mockGetMessages.mockResolvedValueOnce([
      {
        id: 'test-msg-1',
        conversationId: 'c1',
        content: 'Hello',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'test',
        metadata: {},
      },
    ]);

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      conversationId: 'c1',
      messageId: 'test-msg-1',
    });

    expect(mockGetConversationById).toHaveBeenCalledWith('c1');
    expect(mockGetMessages).toHaveBeenCalledWith('c1');
    expect(mockUpdateConversation).toHaveBeenCalled();

    const updateCall = mockUpdateConversation.mock.calls[0];
    const updatedMessages = updateCall[1];
    const targetMessage = updatedMessages.find(
      (m: any) => m.id === 'test-msg-1'
    );

    expect(targetMessage).toBeDefined();
    expect(targetMessage.metadata.backgroundAgentAlerts).toBeDefined();
    expect(targetMessage.metadata.backgroundAgentAlerts.length).toBe(1);
    expect(targetMessage.metadata.backgroundAgentAlerts[0].agentId).toBe('a1');
    expect(targetMessage.metadata.backgroundAgentAlerts[0].agentName).toBe(
      'Agent 1'
    );
    expect(targetMessage.metadata.backgroundAgentAlerts[0].rating).toBe(30);
  });

  it('does not persist alerts when conversationId is "current"', async () => {
    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      conversationId: 'current',
      messageId: 'test-msg-1',
    });

    expect(mockGetConversationById).not.toHaveBeenCalled();
    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });

  it('does not persist alerts when messageId is missing', async () => {
    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      conversationId: 'c1',
      messageId: '',
    });

    expect(mockGetConversationById).not.toHaveBeenCalled();
    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });

  it('appends to existing alerts when message already has alerts', async () => {
    mockGetMessages.mockResolvedValueOnce([
      {
        id: 'test-msg-1',
        conversationId: 'c1',
        content: 'Hello',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'test',
        metadata: {
          backgroundAgentAlerts: [
            {
              agentId: 'a2',
              agentName: 'Agent 2',
              createdAt: new Date().toISOString(),
              rating: 40,
              severity: 'warn',
              message: 'Existing alert',
            },
          ],
        },
      },
    ]);

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      conversationId: 'c1',
      messageId: 'test-msg-1',
    });

    const updateCall = mockUpdateConversation.mock.calls[0];
    const updatedMessages = updateCall[1];
    const targetMessage = updatedMessages.find(
      (m: any) => m.id === 'test-msg-1'
    );

    expect(targetMessage.metadata.backgroundAgentAlerts.length).toBe(2);
    expect(targetMessage.metadata.backgroundAgentAlerts[0].agentId).toBe('a2');
    expect(targetMessage.metadata.backgroundAgentAlerts[1].agentId).toBe('a1');
  });

  it('handles message not found gracefully without persisting alerts', async () => {
    // Mock to always return a message with different ID (never the target)
    mockGetMessages.mockResolvedValue([
      {
        id: 'other-msg',
        conversationId: 'c1',
        content: 'Other',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'test',
        metadata: {},
      },
    ]);

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      conversationId: 'c1',
      messageId: 'test-msg-1',
    });

    // Alert should still be created (in memory)
    expect(addAgentAlertSpy).toHaveBeenCalled();

    // But should not persist to message metadata when message not found
    // (after retries, it will log a warning and not update)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Message ID test-msg-1 not found')
    );

    // Should not update conversation when message not found after all retries
    expect(mockUpdateConversation).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('handles message not found when no assistant messages exist', async () => {
    // Mock to always return only user messages (no assistant messages)
    mockGetMessages.mockResolvedValue([
      {
        id: 'user-msg',
        conversationId: 'c1',
        content: 'User message',
        role: 'user',
        timestamp: new Date().toISOString(),
        platform: 'test',
      },
    ]);

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      conversationId: 'c1',
      messageId: 'test-msg-1',
    });

    // Alert should still be created (in memory)
    expect(addAgentAlertSpy).toHaveBeenCalled();

    // Should not update when message not found (after retries)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Message ID test-msg-1 not found')
    );

    // Should not update conversation when message not found after all retries
    expect(mockUpdateConversation).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('handles storage errors gracefully without breaking alert creation', async () => {
    mockGetConversationById.mockRejectedValueOnce(new Error('Storage error'));

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      conversationId: 'c1',
      messageId: 'test-msg-1',
    });

    // Alert should still be created
    expect(addAgentAlertSpy).toHaveBeenCalled();
    // Error should be logged but not thrown
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('generates unique alert IDs', async () => {
    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      messageId: 'test-msg-1',
    });
    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 4,
      messageId: 'test-msg-2',
    });

    expect(addAgentAlertSpy).toHaveBeenCalledTimes(2);
    const alert1 = addAgentAlertSpy.mock.calls[0][0];
    const alert2 = addAgentAlertSpy.mock.calls[1][0];

    expect(alert1.id).not.toBe(alert2.id);
    // Alert IDs should include agent ID, timestamp, and random suffix
    expect(alert1.id).toMatch(/^a1-\d+-[a-z0-9]+$/);
    expect(alert2.id).toMatch(/^a1-\d+-[a-z0-9]+$/);
  });

  it('does not create alert when rating exceeds threshold', async () => {
    mockEvaluateBackgroundAgent.mockResolvedValueOnce({
      agentId: 'a1',
      response: {
        actionType: 'alert',
        rating: 80, // Above threshold of 50
        severity: 'info',
        notify: true,
        shortMessage: 'High rating',
        description: 'High rating',
        details: {},
      },
      rawModelOutput: '',
      parsedResult: {},
    } satisfies EvaluationResult);

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      messageId: 'test-msg-1',
    });

    expect(addAgentAlertSpy).not.toHaveBeenCalled();
  });

  it('does not create alert when notify is false', async () => {
    mockEvaluateBackgroundAgent.mockResolvedValueOnce({
      agentId: 'a1',
      response: {
        actionType: 'alert',
        rating: 30, // Below threshold
        severity: 'warn',
        notify: false, // Should not notify
        shortMessage: 'Test',
        description: 'Test',
        details: {},
      },
      rawModelOutput: '',
      parsedResult: {},
    } satisfies EvaluationResult);

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      messageId: 'test-msg-1',
    });

    expect(addAgentAlertSpy).not.toHaveBeenCalled();
  });

  it('handles evaluation errors gracefully', async () => {
    mockEvaluateBackgroundAgent.mockRejectedValueOnce(new Error('API error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      messageId: 'test-msg-1',
    });

    // Should not throw, just log error
    expect(consoleSpy).toHaveBeenCalled();
    expect(addAgentAlertSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('evaluates update_document agent but does not create alert', async () => {
    // Create an update_document agent mock (enabled, cadence matches)
    const updateDocumentAgent = {
      id: 'a3',
      name: 'Agent 3',
      enabled: true,
      runEveryNTurns: 2,
      actionType: 'update_document',
      outputDocumentId: 'doc-123',
      contextWindowStrategy: 'lastNMessages',
      contextParams: { lastN: 6 },
      verbosityThreshold: 0,
    } as BackgroundAgent;

    // Patch storage mock to include the update_document agent
    jest.mock('../../storage/UnifiedStorageService', () => ({
      getUnifiedStorageService: () => ({
        getBackgroundAgents: jest.fn().mockResolvedValue({
          backgroundAgents: [updateDocumentAgent],
        }),
        getConversationById: mockGetConversationById,
        getMessages: mockGetMessages,
        updateConversation: mockUpdateConversation,
      }),
    }));

    mockEvaluateBackgroundAgent.mockResolvedValueOnce({
      agentId: 'a3',
      response: {
        actionType: 'update_document',
        heading: 'Doc Heading',
        content: 'This is the content to append.',
      },
      rawModelOutput: '',
      parsedResult: {},
    } satisfies EvaluationResult);

    await maybeEvaluateBackgroundAgents({
      ...baseParams,
      turnCount: 2,
      messageId: 'test-msg-2',
    });

    expect(mockEvaluateBackgroundAgent).toHaveBeenCalledTimes(1);
    expect(addAgentAlertSpy).not.toHaveBeenCalled();
  });
});
