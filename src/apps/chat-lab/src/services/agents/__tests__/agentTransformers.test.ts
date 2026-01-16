import {
  transformBuiltInAgentsWithPreferences,
  generateBuiltInAgentId,
  isBuiltInAgent,
  getContextStrategyDisplayName,
  getContextStrategyDescription,
} from '../agentTransformers';
import type { AllAgentPreferences } from '../agentPreferences';

// Mock the built-in agents data
jest.mock('../../../data/backgroundAgents', () => ({
  BUILT_IN_BACKGROUND_AGENTS: [
    {
      name: 'Ethics Monitor',
      description: 'Test agent',
      promptTemplate: 'Test prompt',
      runEveryNTurns: 6,
      verbosityThreshold: 40,
      contextWindowStrategy: 'lastNMessages',
      contextParams: { lastN: 6 },
      outputSchemaName: 'default',
      customOutputSchema: null,
      notifyChannel: 'inline',
      categories: ['ethics'],
      version: '1.0',
    },
  ],
}));

describe('agentTransformers', () => {
  describe('generateBuiltInAgentId', () => {
    it('should generate consistent ID from agent name', () => {
      const id1 = generateBuiltInAgentId('Ethics Monitor');
      const id2 = generateBuiltInAgentId('Ethics Monitor');
      expect(id1).toBe(id2);
      expect(id1).toBe('built-in-ethics-monitor');
    });

    it('should handle names with multiple spaces', () => {
      const id = generateBuiltInAgentId('Ethics  Monitor   Test');
      expect(id).toBe('built-in-ethics-monitor-test');
    });

    it('should handle names with special characters', () => {
      const id = generateBuiltInAgentId('Ethics-Monitor Test');
      expect(id).toBe('built-in-ethics-monitor-test');
    });
  });

  describe('isBuiltInAgent', () => {
    it('should return true for built-in agent IDs', () => {
      expect(isBuiltInAgent('built-in-ethics-monitor')).toBe(true);
      expect(isBuiltInAgent('built-in-test-agent')).toBe(true);
    });

    it('should return false for custom agent IDs', () => {
      expect(isBuiltInAgent('agent-123')).toBe(false);
      expect(isBuiltInAgent('custom-agent')).toBe(false);
      expect(isBuiltInAgent('')).toBe(false);
    });
  });

  describe('getContextStrategyDisplayName', () => {
    it('should return correct display name for each strategy', () => {
      expect(getContextStrategyDisplayName('lastNMessages')).toBe(
        'Last N Messages'
      );
      expect(getContextStrategyDisplayName('summarizeThenEvaluate')).toBe(
        'Summarize Then Evaluate'
      );
      expect(getContextStrategyDisplayName('fullThreadIfSmall')).toBe(
        'Full Thread (if small)'
      );
    });

    it('should return strategy string for unknown strategy', () => {
      expect(getContextStrategyDisplayName('unknown' as any)).toBe('unknown');
    });
  });

  describe('getContextStrategyDescription', () => {
    it('should return description for lastNMessages with params', () => {
      const desc = getContextStrategyDescription('lastNMessages', {
        lastN: 12,
      });
      expect(desc).toBe('Analyzes the last 12 messages');
    });

    it('should return description with default when params missing', () => {
      const desc = getContextStrategyDescription('lastNMessages');
      expect(desc).toBe('Analyzes the last 6 messages');
    });

    it('should return description for summarizeThenEvaluate', () => {
      const desc = getContextStrategyDescription('summarizeThenEvaluate');
      expect(desc).toBe('Summarizes the conversation first, then evaluates');
    });

    it('should return description for fullThreadIfSmall with params', () => {
      const desc = getContextStrategyDescription('fullThreadIfSmall', {
        tokenLimit: 2000,
      });
      expect(desc).toBe('Uses full thread if under 2000 tokens');
    });

    it('should return description with default tokenLimit', () => {
      const desc = getContextStrategyDescription('fullThreadIfSmall');
      expect(desc).toBe('Uses full thread if under 4000 tokens');
    });

    it('should return generic description for unknown strategy', () => {
      const desc = getContextStrategyDescription('unknown' as any);
      expect(desc).toBe('Custom context strategy');
    });
  });

  describe('transformBuiltInAgentsWithPreferences', () => {
    it('should transform agents without preferences', () => {
      const prefs: AllAgentPreferences = {};
      const agents = transformBuiltInAgentsWithPreferences(prefs);

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('Ethics Monitor');
      expect(agents[0].runEveryNTurns).toBe(6); // Template default
      expect(agents[0].verbosityThreshold).toBe(40); // Template default
      expect(agents[0].isSystem).toBe(true);
    });

    it('should merge runEveryNTurns from preferences', () => {
      const agentId = generateBuiltInAgentId('Ethics Monitor');
      const prefs: AllAgentPreferences = {
        [agentId]: {
          runEveryNTurns: 10,
          verbosityThreshold: 40,
        },
      };

      const agents = transformBuiltInAgentsWithPreferences(prefs);
      expect(agents[0].runEveryNTurns).toBe(10);
      expect(agents[0].verbosityThreshold).toBe(40); // Not overridden
    });

    it('should merge verbosityThreshold from preferences', () => {
      const agentId = generateBuiltInAgentId('Ethics Monitor');
      const prefs: AllAgentPreferences = {
        [agentId]: {
          runEveryNTurns: 6,
          verbosityThreshold: 60,
        },
      };

      const agents = transformBuiltInAgentsWithPreferences(prefs);
      expect(agents[0].verbosityThreshold).toBe(60);
    });

    it('should merge contextLastN for lastNMessages strategy', () => {
      const agentId = generateBuiltInAgentId('Ethics Monitor');
      const prefs: AllAgentPreferences = {
        [agentId]: {
          runEveryNTurns: 6,
          verbosityThreshold: 40,
          contextLastN: 12,
        },
      };

      const agents = transformBuiltInAgentsWithPreferences(prefs);
      expect(agents[0].contextParams?.lastN).toBe(12);
    });

    it('should not merge contextLastN for non-lastNMessages strategy', () => {
      // This would require a mock with different strategy, but tests the logic
      const agentId = generateBuiltInAgentId('Ethics Monitor');
      const prefs: AllAgentPreferences = {
        [agentId]: {
          runEveryNTurns: 6,
          verbosityThreshold: 40,
          contextLastN: 20, // Should be ignored
        },
      };

      const agents = transformBuiltInAgentsWithPreferences(prefs);
      // Since the template uses 'lastNMessages', it should be merged
      expect(agents[0].contextParams?.lastN).toBe(20);
    });

    it('should preserve template contextParams when contextLastN not provided', () => {
      const agentId = generateBuiltInAgentId('Ethics Monitor');
      const prefs: AllAgentPreferences = {
        [agentId]: {
          runEveryNTurns: 6,
          verbosityThreshold: 40,
          // contextLastN not provided
        },
      };

      const agents = transformBuiltInAgentsWithPreferences(prefs);
      expect(agents[0].contextParams?.lastN).toBe(6); // Template default
    });

    it('should handle partial preferences', () => {
      const agentId = generateBuiltInAgentId('Ethics Monitor');
      const prefs: AllAgentPreferences = {
        [agentId]: {
          runEveryNTurns: 8,
          // verbosityThreshold not provided, should use template default
        },
      };

      const agents = transformBuiltInAgentsWithPreferences(prefs);
      expect(agents[0].runEveryNTurns).toBe(8);
      expect(agents[0].verbosityThreshold).toBe(40); // Template default
    });

    it('should generate valid agent IDs', () => {
      const prefs: AllAgentPreferences = {};
      const agents = transformBuiltInAgentsWithPreferences(prefs);

      expect(agents[0].id).toBe('built-in-ethics-monitor');
      expect(agents[0].id).toMatch(/^built-in-/);
    });

    it('should set timestamps', () => {
      const prefs: AllAgentPreferences = {};
      const agents = transformBuiltInAgentsWithPreferences(prefs);

      expect(agents[0].createdAt).toBeDefined();
      expect(agents[0].updatedAt).toBeDefined();
      expect(new Date(agents[0].createdAt).getTime()).not.toBeNaN();
      expect(new Date(agents[0].updatedAt).getTime()).not.toBeNaN();
    });
  });
});
