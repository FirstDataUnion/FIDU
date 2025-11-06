/**
 * Background Agent Handler Tests
 * Tests export/import logic with validation
 */

import { BackgroundAgentHandler } from '../../handlers/backgroundAgentHandler';
import type { BackgroundAgent } from '../../../../api/backgroundAgents';

jest.mock('../../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: jest.fn(() => ({
    getBackgroundAgents: jest.fn(),
  })),
}));

describe('BackgroundAgentHandler', () => {
  let handler: BackgroundAgentHandler;
  const mockProfileId = 'profile-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    handler = new BackgroundAgentHandler();
    jest.clearAllMocks();
  });

  describe('exportResource', () => {
    it('should sanitize background agent by removing timestamps', async () => {
      const agent: BackgroundAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        description: 'Test Description',
        enabled: true,
        actionType: 'alert',
        promptTemplate: 'Test Template',
        runEveryNTurns: 5,
        verbosityThreshold: 75,
        contextWindowStrategy: 'lastNMessages',
        contextParams: { lastN: 10 },
        outputSchemaName: 'default',
        customOutputSchema: null,
        notifyChannel: 'inline',
        isSystem: false,
        categories: ['test'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      const result = await handler.exportResource(agent, mockProfileId);

      expect(result.originalId).toBe('agent-123');
      expect(result.resourceType).toBe('backgroundAgent');
      expect(result.data.id).toBe('agent-123');
      expect(result.data.name).toBe('Test Agent');
      expect(result.data.actionType).toBe('alert');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
    });
  });

  describe('importResource', () => {
    it('should generate new ID and reset ownership', async () => {
      const exportData = {
        originalId: 'agent-123',
        resourceType: 'backgroundAgent' as const,
        data: {
          id: 'agent-123',
          name: 'Test Agent',
          description: 'Test Description',
          enabled: true,
          actionType: 'alert' as const,
          promptTemplate: 'Test Template',
          runEveryNTurns: 5,
          verbosityThreshold: 75,
          contextWindowStrategy: 'lastNMessages' as const,
          contextParams: { lastN: 10 },
          outputSchemaName: 'default',
          customOutputSchema: null,
          notifyChannel: 'inline' as const,
          isSystem: false,
          categories: [],
        },
      };

      const idMapping: Record<string, string> = {};
      const result = await handler.importResource(
        exportData,
        mockProfileId,
        mockUserId,
        idMapping
      );

      expect(result.id).not.toBe('agent-123');
      expect(idMapping['agent-123']).toBe(result.id);
      expect(result.name).toBe('Test Agent');
      expect(result.actionType).toBe('alert');
      expect(result.isSystem).toBe(false);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should validate action type', async () => {
      const exportData = {
        originalId: 'agent-123',
        resourceType: 'backgroundAgent' as const,
        data: {
          id: 'agent-123',
          name: 'Test Agent',
          description: '',
          enabled: true,
          actionType: 'invalid-action' as any,
          promptTemplate: 'Test',
          runEveryNTurns: 5,
          verbosityThreshold: 50,
          contextWindowStrategy: 'lastNMessages' as const,
          notifyChannel: 'inline' as const,
        },
      };

      await expect(
        handler.importResource(exportData, mockProfileId, mockUserId)
      ).rejects.toThrow('Invalid action type');
    });
  });

  describe('validateImport', () => {
    it('should validate correct background agent data', () => {
      const validData = {
        id: 'agent-123',
        name: 'Test Agent',
        actionType: 'alert',
        promptTemplate: 'Test Template',
      };

      expect(handler.validateImport(validData)).toBe(true);
    });

    it('should validate update_context action type', () => {
      const validData = {
        id: 'agent-123',
        name: 'Test Agent',
        actionType: 'update_context',
        promptTemplate: 'Test Template',
      };

      expect(handler.validateImport(validData)).toBe(true);
    });

    it('should reject invalid action type', () => {
      const invalidData = {
        id: 'agent-123',
        name: 'Test Agent',
        actionType: 'invalid',
        promptTemplate: 'Test Template',
      };

      expect(handler.validateImport(invalidData)).toBe(false);
    });

    it('should reject missing required fields', () => {
      expect(handler.validateImport({ id: 'agent-123' })).toBe(false);
      expect(handler.validateImport({ name: 'Test' })).toBe(false);
      expect(handler.validateImport({ actionType: 'alert' })).toBe(false);
      expect(handler.validateImport({ promptTemplate: 'Template' })).toBe(false);
    });
  });
});

