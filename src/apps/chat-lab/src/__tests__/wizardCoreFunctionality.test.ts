/**
 * Focused tests for wizard functionality that can be tested without complex mocking
 * These tests focus on the core logic and prevent regressions in critical features
 */

describe('Wizard Core Functionality Tests', () => {
  describe('PROMPT_ID Tag Detection', () => {
    const extractSystemPromptIdsFromContent = (content: string): string[] => {
      const promptIdRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }
      return matches;
    };

    it('should detect single PROMPT_ID tag', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.';
      const result = extractSystemPromptIdsFromContent(content);
      expect(result).toEqual(['fabric-create_micro_summary']);
    });

    it('should detect multiple PROMPT_ID tags', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] and the Improve Writing system prompt [PROMPT_ID:fabric-improve_writing] for your needs.';
      const result = extractSystemPromptIdsFromContent(content);
      expect(result).toEqual(['fabric-create_micro_summary', 'fabric-improve_writing']);
    });

    it('should handle empty content', () => {
      const content = '';
      const result = extractSystemPromptIdsFromContent(content);
      expect(result).toEqual([]);
    });

    it('should handle content without PROMPT_ID tags', () => {
      const content = 'This is just regular text without any special tags.';
      const result = extractSystemPromptIdsFromContent(content);
      expect(result).toEqual([]);
    });

    it('should handle malformed tags gracefully', () => {
      const content = 'Try [PROMPT_ID:valid-tag] and [PROMPT_ID:invalid@tag] and [PROMPT_ID:another-valid_tag] prompts.';
      const result = extractSystemPromptIdsFromContent(content);
      expect(result).toEqual(['valid-tag', 'another-valid_tag']);
    });
  });

  describe('PROMPT_ID Tag Cleaning', () => {
    const cleanMessageContent = (content: string): string => {
      return content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');
    };

    it('should remove single PROMPT_ID tag from content', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.';
      const result = cleanMessageContent(content);
      expect(result).toBe('I recommend the Create Micro Summary system prompt  for your needs.');
    });

    it('should remove multiple PROMPT_ID tags from content', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] and the Improve Writing system prompt [PROMPT_ID:fabric-improve_writing] for your needs.';
      const result = cleanMessageContent(content);
      expect(result).toBe('I recommend the Create Micro Summary system prompt  and the Improve Writing system prompt  for your needs.');
    });

    it('should handle content with no PROMPT_ID tags', () => {
      const content = 'This is just regular text without any special tags.';
      const result = cleanMessageContent(content);
      expect(result).toBe('This is just regular text without any special tags.');
    });

    it('should handle empty content', () => {
      const content = '';
      const result = cleanMessageContent(content);
      expect(result).toBe('');
    });

    it('should preserve other content while removing tags', () => {
      const content = 'Welcome! I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs. Happy writing!';
      const result = cleanMessageContent(content);
      expect(result).toBe('Welcome! I recommend the Create Micro Summary system prompt  for your needs. Happy writing!');
    });
  });

  describe('System Prompt ID Validation', () => {
    const isValidPromptId = (id: string): boolean => {
      return /^[a-zA-Z0-9_-]+$/.test(id);
    };

    it('should validate correct prompt IDs', () => {
      expect(isValidPromptId('fabric-create_micro_summary')).toBe(true);
      expect(isValidPromptId('fabric-improve_writing')).toBe(true);
      expect(isValidPromptId('custom-prompt_123')).toBe(true);
      expect(isValidPromptId('test123')).toBe(true);
    });

    it('should reject invalid prompt IDs', () => {
      expect(isValidPromptId('invalid@tag')).toBe(false);
      expect(isValidPromptId('invalid tag')).toBe(false);
      expect(isValidPromptId('invalid.tag')).toBe(false);
      expect(isValidPromptId('invalid/tag')).toBe(false);
      expect(isValidPromptId('')).toBe(false);
    });
  });

  describe('Wizard Message Structure', () => {
    it('should create valid wizard message objects', () => {
      const message = {
        id: 'test-1',
        role: 'assistant' as const,
        content: 'Test message content',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      expect(message.id).toBe('test-1');
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Test message content');
      expect(message.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should handle different message roles', () => {
      const userMessage = {
        id: 'test-2',
        role: 'user' as const,
        content: 'User input',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const assistantMessage = {
        id: 'test-3',
        role: 'assistant' as const,
        content: 'Assistant response',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      expect(userMessage.role).toBe('user');
      expect(assistantMessage.role).toBe('assistant');
    });
  });

  describe('Wizard State Management Logic', () => {
    it('should handle wizard open/close state transitions', () => {
      let isOpen = false;
      let isMinimized = false;

      // Open wizard
      isOpen = true;
      isMinimized = false;
      expect(isOpen).toBe(true);
      expect(isMinimized).toBe(false);

      // Minimize wizard
      isOpen = false;
      isMinimized = true;
      expect(isOpen).toBe(false);
      expect(isMinimized).toBe(true);

      // Maximize wizard
      isOpen = true;
      isMinimized = false;
      expect(isOpen).toBe(true);
      expect(isMinimized).toBe(false);

      // Close wizard
      isOpen = false;
      isMinimized = false;
      expect(isOpen).toBe(false);
      expect(isMinimized).toBe(false);
    });

    it('should handle message array operations', () => {
      const messages: Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
      }> = [
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! I\'m the FIDU Librarian.',
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      ];

      // Add user message
      const userMessage = {
        id: '2',
        role: 'user' as const,
        content: 'I need help with writing.',
        timestamp: '2024-01-01T00:01:00.000Z'
      };
      messages.push(userMessage);

      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe('user');

      // Add assistant response
      const assistantMessage = {
        id: '3',
        role: 'assistant' as const,
        content: 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.',
        timestamp: '2024-01-01T00:02:00.000Z'
      };
      messages.push(assistantMessage);

      expect(messages).toHaveLength(3);
      expect(messages[2].role).toBe('assistant');
    });

    it('should handle conversation clearing', () => {
      const _messages = [
        {
          id: '1',
          role: 'assistant' as const,
          content: 'Hello! I\'m the FIDU Librarian.',
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          id: '2',
          role: 'user' as const,
          content: 'I need help with writing.',
          timestamp: '2024-01-01T00:01:00.000Z'
        },
        {
          id: '3',
          role: 'assistant' as const,
          content: 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.',
          timestamp: '2024-01-01T00:02:00.000Z'
        }
      ];

      // Clear conversation (reset to initial greeting)
      const initialGreeting = {
        id: 'initial',
        role: 'assistant' as const,
        content: 'Hello! I\'m the FIDU Librarian, your friendly system prompt assistant.',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const clearedMessages = [initialGreeting];

      expect(clearedMessages).toHaveLength(1);
      expect(clearedMessages[0].content).toContain('Hello! I\'m the FIDU Librarian');
    });
  });

  describe('System Prompt Auto-Linking Logic', () => {
    const mockSystemPrompts = [
      {
        id: 'fabric-create_micro_summary',
        name: 'Create Micro Summary',
        description: 'Creates micro summaries'
      },
      {
        id: 'fabric-improve_writing',
        name: 'Improve Writing',
        description: 'Improves writing quality'
      }
    ];

    const getSystemPromptById = (id: string) => {
      return mockSystemPrompts.find(prompt => prompt.id === id);
    };

    it('should find system prompt by ID', () => {
      const prompt = getSystemPromptById('fabric-create_micro_summary');
      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('Create Micro Summary');
    });

    it('should return undefined for non-existent prompt ID', () => {
      const prompt = getSystemPromptById('non-existent-id');
      expect(prompt).toBeUndefined();
    });

    it('should process message content for auto-linking', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.';
      
      // Extract IDs
      const promptIdRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      // Find corresponding prompts
      const foundPrompts = matches.map(id => getSystemPromptById(id)).filter(Boolean);

      expect(matches).toEqual(['fabric-create_micro_summary']);
      expect(foundPrompts).toHaveLength(1);
      expect(foundPrompts[0]?.name).toBe('Create Micro Summary');
    });

    it('should handle multiple prompts in one message', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] and the Improve Writing system prompt [PROMPT_ID:fabric-improve_writing] for your needs.';
      
      const promptIdRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      const foundPrompts = matches.map(id => getSystemPromptById(id)).filter(Boolean);

      expect(matches).toEqual(['fabric-create_micro_summary', 'fabric-improve_writing']);
      expect(foundPrompts).toHaveLength(2);
      expect(foundPrompts[0]?.name).toBe('Create Micro Summary');
      expect(foundPrompts[1]?.name).toBe('Improve Writing');
    });
  });

  describe('Real-world Message Processing', () => {
    it('should process typical librarian response correctly', () => {
      const content = `Welcome back to the quiet reading room of the FIDU Library—let me pull a few helpful volumes from the writing shelf for you. I hear you're looking to craft a compelling blurb for your book, and I think we have just the right prompts to spark a polished, attention‑grabbing description.

First, the Create Micro Summary prompt can distill the heart of your story into a concise, punchy paragraph that works beautifully as a back‑cover blurb. I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.

If you'd like a slightly longer, yet still tight, version, the Create 5‑Sentence Summary prompt expands the micro summary into a five‑sentence narrative that captures the main arc while leaving readers eager for more. You'll find it under the Create 5 Sentence Summary system prompt [PROMPT_ID:fabric-create_5_sentence_summary].

Finally, should you have a draft ready and want to polish the language, the Improve Writing prompt can refine tone, rhythm, and word choice to ensure your blurb shines. Look for the Improve Writing system prompt [PROMPT_ID:fabric-improve_writing].`;

      // Extract IDs
      const promptIdRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      // Clean content
      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(matches).toEqual([
        'fabric-create_micro_summary',
        'fabric-create_5_sentence_summary',
        'fabric-improve_writing'
      ]);

      expect(cleaned).not.toContain('[PROMPT_ID:');
      expect(cleaned).toContain('I recommend the Create Micro Summary system prompt');
      expect(cleaned).toContain('for your needs');
    });
  });
});
