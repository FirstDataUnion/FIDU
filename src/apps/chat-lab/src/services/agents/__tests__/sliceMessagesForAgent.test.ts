/**
 * Tests for context window message slicing functionality
 *
 * Note: sliceMessagesForAgent is currently a private function in backgroundAgentRunner.ts
 * These tests verify the behavior through the public maybeEvaluateBackgroundAgents API
 */

import {
  maybeEvaluateBackgroundAgents,
  clearDebounceCache,
} from '../backgroundAgentRunner';
import type { BackgroundAgent } from '../../api/backgroundAgents';
import type {
  ConversationSliceMessage,
  EvaluationResult,
} from '../backgroundAgentsService';

// Create mocks before using them in jest.mock
const mockGetBackgroundAgents = jest.fn();
const mockEvaluateBackgroundAgent = jest.fn();
const mockLoadAgentPreferences = jest.fn();
const mockTransformBuiltInAgents = jest.fn();
const addAgentAlertSpy = jest.fn();

jest.mock('../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: () => ({
    getBackgroundAgents: (...args: any[]) => mockGetBackgroundAgents(...args),
  }),
}));

jest.mock('../backgroundAgentsService', () => ({
  evaluateBackgroundAgent: (...args: any[]) =>
    mockEvaluateBackgroundAgent(...args),
}));

jest.mock('../agentPreferences', () => ({
  loadAgentPreferences: (...args: any[]) => mockLoadAgentPreferences(...args),
}));

jest.mock('../agentTransformers', () => ({
  transformBuiltInAgentsWithPreferences: (...args: any[]) =>
    mockTransformBuiltInAgents(...args),
}));

jest.mock('../agentAlerts', () => ({
  addAgentAlert: (alert: any) => addAgentAlertSpy(alert),
}));

describe('Context Window Message Slicing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear debounce cache to prevent test interference
    clearDebounceCache();

    mockLoadAgentPreferences.mockReturnValue({});
    mockTransformBuiltInAgents.mockReturnValue([]);
    mockEvaluateBackgroundAgent.mockResolvedValue({
      agentId: 'agent-1',
      response: {
        actionType: 'alert',
        rating: 50,
        severity: 'warn',
        notify: true,
        shortMessage: 'Test',
        description: 'Test',
        details: {},
      },
      rawModelOutput: '',
      parsedResult: {},
    } satisfies EvaluationResult);
  });

  const createMessages = (count: number): ConversationSliceMessage[] => {
    return Array.from({ length: count }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}`,
      timestamp: `2024-01-01T${String(i).padStart(2, '0')}:00:00Z`,
    }));
  };

  describe('lastNMessages strategy', () => {
    it('should slice to last N messages', async () => {
      const messages = createMessages(20);
      const agent: BackgroundAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        enabled: true,
        description: 'Test Description',
        actionType: 'alert',
        runEveryNTurns: 1,
        verbosityThreshold: 50,
        contextWindowStrategy: 'lastNMessages',
        contextParams: { lastN: 6 },
        promptTemplate: 'Test',
        notifyChannel: 'inline',
        isSystem: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockGetBackgroundAgents.mockResolvedValue({
        backgroundAgents: [agent],
      });

      await maybeEvaluateBackgroundAgents({
        profileId: 'p1',
        conversationId: 'c1',
        messages,
        turnCount: 1,
        messageId: 'test-msg-1',
      });

      // Verify evaluateBackgroundAgent was called with sliced messages
      expect(mockEvaluateBackgroundAgent).toHaveBeenCalled();
      const callArgs = mockEvaluateBackgroundAgent.mock.calls[0];
      const slice = callArgs[1]; // Second argument is the ConversationSlice

      expect(slice.messages).toHaveLength(6);
      expect(slice.messages[0].content).toBe('Message 15'); // Last 6 messages
      expect(slice.messages[5].content).toBe('Message 20');
    });

    it('should use default lastN (6) when not specified', async () => {
      const messages = createMessages(20);
      const agent: BackgroundAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        enabled: true,
        description: 'Test Description',
        runEveryNTurns: 1,
        verbosityThreshold: 50,
        actionType: 'alert',
        contextWindowStrategy: 'lastNMessages',
        contextParams: {}, // No lastN specified
        promptTemplate: 'Test',
        notifyChannel: 'inline',
        isSystem: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockGetBackgroundAgents.mockResolvedValue({
        backgroundAgents: [agent],
      });

      await maybeEvaluateBackgroundAgents({
        profileId: 'p1',
        conversationId: 'c1',
        messages,
        turnCount: 1,
        messageId: 'test-msg-1',
      });

      const slice = mockEvaluateBackgroundAgent.mock.calls[0][1];
      expect(slice.messages).toHaveLength(6); // Default
    });

    it('should return all messages when messages.length < lastN', async () => {
      const messages = createMessages(3);
      const agent: BackgroundAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        enabled: true,
        description: 'Test Description',
        runEveryNTurns: 1,
        verbosityThreshold: 50,
        actionType: 'alert',
        contextWindowStrategy: 'lastNMessages',
        contextParams: { lastN: 10 }, // More than available
        promptTemplate: 'Test',
        notifyChannel: 'inline',
        isSystem: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockGetBackgroundAgents.mockResolvedValue({
        backgroundAgents: [agent],
      });

      await maybeEvaluateBackgroundAgents({
        profileId: 'p1',
        conversationId: 'c1',
        messages,
        turnCount: 1,
        messageId: 'test-msg-1',
      });

      const slice = mockEvaluateBackgroundAgent.mock.calls[0][1];
      expect(slice.messages).toHaveLength(3); // All available
    });

    it('should clamp lastN to valid range (1-100)', async () => {
      const messages = createMessages(20);
      const agent: BackgroundAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        enabled: true,
        description: 'Test Description',
        runEveryNTurns: 1,
        verbosityThreshold: 50,
        actionType: 'alert',
        contextWindowStrategy: 'lastNMessages',
        contextParams: { lastN: 150 }, // Invalid: too high
        promptTemplate: 'Test',
        notifyChannel: 'inline',
        isSystem: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockGetBackgroundAgents.mockResolvedValue({
        backgroundAgents: [agent],
      });

      await maybeEvaluateBackgroundAgents({
        profileId: 'p1',
        conversationId: 'c1',
        messages,
        turnCount: 1,
        messageId: 'test-msg-1',
      });

      const slice = mockEvaluateBackgroundAgent.mock.calls[0][1];
      expect(slice.messages).toHaveLength(20); // Clamped to available messages
    });

    it('should handle empty messages array', async () => {
      const agent: BackgroundAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        enabled: true,
        description: 'Test Description',
        runEveryNTurns: 1,
        verbosityThreshold: 50,
        actionType: 'alert',
        contextWindowStrategy: 'lastNMessages',
        contextParams: { lastN: 6 },
        promptTemplate: 'Test',
        notifyChannel: 'inline',
        isSystem: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockGetBackgroundAgents.mockResolvedValue({
        backgroundAgents: [agent],
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await maybeEvaluateBackgroundAgents({
        profileId: 'p1',
        conversationId: 'c1',
        messages: [],
        turnCount: 1,
        messageId: 'test-msg-1',
      });

      // Should handle gracefully - may or may not call evaluateBackgroundAgent
      // but should not throw
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Other context strategies', () => {
    it('should pass all messages for summarizeThenEvaluate', async () => {
      const messages = createMessages(20);
      const agent: BackgroundAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        enabled: true,
        description: 'Test Description',
        runEveryNTurns: 1,
        verbosityThreshold: 50,
        actionType: 'alert',
        contextWindowStrategy: 'summarizeThenEvaluate',
        contextParams: {},
        promptTemplate: 'Test',
        notifyChannel: 'inline',
        isSystem: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockGetBackgroundAgents.mockResolvedValue({
        backgroundAgents: [agent],
      });

      await maybeEvaluateBackgroundAgents({
        profileId: 'p1',
        conversationId: 'c1',
        messages,
        turnCount: 1,
        messageId: 'test-msg-1',
      });

      const slice = mockEvaluateBackgroundAgent.mock.calls[0][1];
      expect(slice.messages).toHaveLength(20); // All messages
    });

    it('should pass all messages for fullThreadIfSmall', async () => {
      const messages = createMessages(20);
      const agent: BackgroundAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        enabled: true,
        description: 'Test Description',
        runEveryNTurns: 1,
        verbosityThreshold: 50,
        actionType: 'alert',
        contextWindowStrategy: 'fullThreadIfSmall',
        contextParams: { tokenLimit: 4000 },
        promptTemplate: 'Test',
        notifyChannel: 'inline',
        isSystem: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      mockGetBackgroundAgents.mockResolvedValue({
        backgroundAgents: [agent],
      });

      await maybeEvaluateBackgroundAgents({
        profileId: 'p1',
        conversationId: 'c1',
        messages,
        turnCount: 1,
        messageId: 'test-msg-1',
      });

      const slice = mockEvaluateBackgroundAgent.mock.calls[0][1];
      expect(slice.messages).toHaveLength(20); // All messages
    });
  });
});
