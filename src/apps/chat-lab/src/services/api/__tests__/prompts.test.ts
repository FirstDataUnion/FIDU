/**
 * Unit tests for prompt building functionality
 * Focus on context handling and prompt construction logic
 */

import { buildCompletePrompt } from '../prompts';
import type { Message } from '../../../types';

describe('buildCompletePrompt', () => {
  const mockSystemPrompt = {
    content: 'You are a helpful assistant.',
    id: 'sp-1',
    name: 'Test',
  };
  const mockMessage: Message = {
    id: 'msg-1',
    conversationId: 'conv-1',
    content: 'Hello',
    role: 'user',
    timestamp: new Date().toISOString(),
    platform: 'test',
    isEdited: false,
  };

  describe('Context Handling', () => {
    it('should handle no contexts', () => {
      const result = buildCompletePrompt([], [], [], [], 'Test prompt');

      expect(result).toContain('Answer the following prompt:');
      expect(result).toContain('Prompt: Test prompt');
      expect(result).not.toContain(
        'Given the following existing background context'
      );
    });

    it('should handle single context as array', () => {
      const contexts = [
        { body: 'Context content', title: 'Context 1', id: 'ctx-1' },
      ];
      const result = buildCompletePrompt([], [], contexts, [], 'Test prompt');

      expect(result).toContain(
        'Given the following existing background context:'
      );
      expect(result).toContain('Context content');
      expect(result).toContain(
        'Answer the following prompt, keeping the existing context in mind:'
      );
    });

    it('should handle single context as object (backward compatibility)', () => {
      const context = {
        body: 'Context content',
        title: 'Context 1',
        id: 'ctx-1',
      };
      const result = buildCompletePrompt([], [], context, [], 'Test prompt');

      expect(result).toContain(
        'Given the following existing background context:'
      );
      expect(result).toContain('Context content');
    });

    it('should handle multiple contexts', () => {
      const contexts = [
        { body: 'First context content', title: 'Context 1', id: 'ctx-1' },
        { body: 'Second context content', title: 'Context 2', id: 'ctx-2' },
      ];
      const result = buildCompletePrompt([], [], contexts, [], 'Test prompt');

      expect(result).toContain(
        'Given the following existing background contexts:'
      );
      expect(result).toContain('Context 1:');
      expect(result).toContain('First context content');
      expect(result).toContain('Context 2:');
      expect(result).toContain('Second context content');
      expect(result).toContain(
        'Answer the following prompt, keeping the existing contexts in mind:'
      );
    });

    it('should handle context with only title (no body)', () => {
      const contexts = [{ title: 'Context Title Only', id: 'ctx-1' }];
      const result = buildCompletePrompt([], [], contexts, [], 'Test prompt');

      expect(result).toContain('Context Title Only');
    });

    it('should handle context as string', () => {
      const contexts = ['Raw context string'];
      const result = buildCompletePrompt([], [], contexts, [], 'Test prompt');

      expect(result).toContain('Raw context string');
    });

    it('should filter out empty contexts', () => {
      const contexts = [
        { body: 'Valid context', title: 'Valid', id: 'ctx-1' },
        { body: '   ', title: 'Empty', id: 'ctx-2' }, // Whitespace only
        { title: '', body: '', id: 'ctx-3' }, // Empty
      ];
      const result = buildCompletePrompt([], [], contexts, [], 'Test prompt');

      expect(result).toContain('Valid context');
      expect(result).not.toContain('ctx-2');
      expect(result).not.toContain('ctx-3');
    });

    it('should handle context with conversation history - single context', () => {
      const contexts = [
        { body: 'Context content', title: 'Context 1', id: 'ctx-1' },
      ];
      const messages: Message[] = [
        { ...mockMessage, content: 'User message', role: 'user' },
        {
          ...mockMessage,
          content: 'AI response',
          role: 'assistant',
          id: 'msg-2',
        },
      ];
      const result = buildCompletePrompt(
        [],
        [],
        contexts,
        messages,
        'Test prompt'
      );

      expect(result).toContain(
        'Given the following existing background context:'
      );
      expect(result).toContain('Given the following conversation history:');
      expect(result).toContain('User: User message');
      expect(result).toContain('Assistant: AI response');
      expect(result).toContain(
        'keeping the existing context of the conversation in mind'
      );
    });

    it('should handle context with conversation history - multiple contexts', () => {
      const contexts = [
        { body: 'First context', title: 'Context 1', id: 'ctx-1' },
        { body: 'Second context', title: 'Context 2', id: 'ctx-2' },
      ];
      const messages: Message[] = [
        { ...mockMessage, content: 'User message', role: 'user' },
      ];
      const result = buildCompletePrompt(
        [],
        [],
        contexts,
        messages,
        'Test prompt'
      );

      expect(result).toContain(
        'Given the following existing background contexts:'
      );
      expect(result).toContain(
        'keeping the existing contexts of the conversation in mind'
      );
    });
  });

  describe('Combined Scenarios', () => {
    it('should build complete prompt with system prompts, contexts, and conversation', () => {
      const systemPrompts = [mockSystemPrompt];
      const contexts = [
        { body: 'Context content', title: 'Context 1', id: 'ctx-1' },
      ];
      const messages: Message[] = [
        { ...mockMessage, content: 'Previous message', role: 'user' },
      ];

      const result = buildCompletePrompt(
        systemPrompts,
        [],
        contexts,
        messages,
        'User question'
      );

      expect(result).toContain('You are a helpful assistant.');
      expect(result).toContain(
        'Given the following existing background context:'
      );
      expect(result).toContain('Context content');
      expect(result).toContain('Given the following conversation history:');
      expect(result).toContain('User: Previous message');
      expect(result).toContain('Prompt: User question');
    });

    it('should handle three contexts in correct order', () => {
      const contexts = [
        { body: 'First', title: 'Context 1', id: 'ctx-1' },
        { body: 'Second', title: 'Context 2', id: 'ctx-2' },
        { body: 'Third', title: 'Context 3', id: 'ctx-3' },
      ];
      const result = buildCompletePrompt([], [], contexts, [], 'Test');

      expect(result).toContain('Context 1:\nFirst');
      expect(result).toContain('Context 2:\nSecond');
      expect(result).toContain('Context 3:\nThird');
      // Verify order
      const index1 = result.indexOf('Context 1:');
      const index2 = result.indexOf('Context 2:');
      const index3 = result.indexOf('Context 3:');
      expect(index1).toBeLessThan(index2);
      expect(index2).toBeLessThan(index3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null context', () => {
      const result = buildCompletePrompt([], [], null, [], 'Test prompt');
      expect(result).toContain('Answer the following prompt:');
    });

    it('should handle undefined context', () => {
      const result = buildCompletePrompt([], [], undefined, [], 'Test prompt');
      expect(result).toContain('Answer the following prompt:');
    });

    it('should handle empty array of contexts', () => {
      const result = buildCompletePrompt([], [], [], [], 'Test prompt');
      expect(result).toContain('Answer the following prompt:');
    });

    it('should handle context object with no body or title', () => {
      const contexts = [{ id: 'ctx-1' }];
      const result = buildCompletePrompt([], [], contexts, [], 'Test prompt');
      // Should convert to string and still work
      expect(result).toBeTruthy();
    });
  });
});
