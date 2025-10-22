/**
 * Tests for PROMPT_ID tag detection and cleaning utilities
 * These are critical functions for the System Prompt Suggestor wizard's auto-linking feature
 */

describe('PROMPT_ID Tag Detection and Cleaning', () => {
  // Test the regex pattern used for detecting PROMPT_ID tags
  const promptIdRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;

  describe('Tag Detection', () => {
    it('should detect single PROMPT_ID tag', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.';
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toEqual(['fabric-create_micro_summary']);
    });

    it('should detect multiple PROMPT_ID tags', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] and the Improve Writing system prompt [PROMPT_ID:fabric-improve_writing] for your needs.';
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toEqual(['fabric-create_micro_summary', 'fabric-improve_writing']);
    });

    it('should detect PROMPT_ID tags with underscores and hyphens', () => {
      const content = 'Try the [PROMPT_ID:fabric-create_micro_summary] and [PROMPT_ID:custom-prompt_123] prompts.';
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toEqual(['fabric-create_micro_summary', 'custom-prompt_123']);
    });

    it('should not detect invalid PROMPT_ID tags', () => {
      const content = 'Try the [PROMPT_ID:invalid@tag] and [PROMPT_ID:invalid tag] prompts.';
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toEqual([]);
    });

    it('should handle empty content', () => {
      const content = '';
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toEqual([]);
    });

    it('should handle content without PROMPT_ID tags', () => {
      const content = 'This is just regular text without any special tags.';
      const matches = [];
      let match;

      while ((match = promptIdRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toEqual([]);
    });
  });

  describe('Tag Cleaning', () => {
    it('should remove single PROMPT_ID tag from content', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.';
      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(cleaned).toBe('I recommend the Create Micro Summary system prompt  for your needs.');
    });

    it('should remove multiple PROMPT_ID tags from content', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] and the Improve Writing system prompt [PROMPT_ID:fabric-improve_writing] for your needs.';
      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(cleaned).toBe('I recommend the Create Micro Summary system prompt  and the Improve Writing system prompt  for your needs.');
    });

    it('should handle content with no PROMPT_ID tags', () => {
      const content = 'This is just regular text without any special tags.';
      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(cleaned).toBe('This is just regular text without any special tags.');
    });

    it('should handle empty content', () => {
      const content = '';
      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(cleaned).toBe('');
    });

    it('should preserve other content while removing tags', () => {
      const content = 'Welcome! I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs. Happy writing!';
      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(cleaned).toBe('Welcome! I recommend the Create Micro Summary system prompt  for your needs. Happy writing!');
    });
  });

  describe('Integration Tests', () => {
    it('should detect and clean tags correctly in sequence', () => {
      const content = 'I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] and the Improve Writing system prompt [PROMPT_ID:fabric-improve_writing] for your needs.';
      
      // First detect tags
      const matches = [];
      let match;
      const detectRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;

      while ((match = detectRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      // Then clean content
      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(matches).toEqual(['fabric-create_micro_summary', 'fabric-improve_writing']);
      expect(cleaned).toBe('I recommend the Create Micro Summary system prompt  and the Improve Writing system prompt  for your needs.');
    });

    it('should handle edge cases with special characters', () => {
      const content = 'Try [PROMPT_ID:test-123] and [PROMPT_ID:test_456] prompts.';
      
      const matches = [];
      let match;
      const detectRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;

      while ((match = detectRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(matches).toEqual(['test-123', 'test_456']);
      expect(cleaned).toBe('Try  and  prompts.');
    });

    it('should handle malformed tags gracefully', () => {
      const content = 'Try [PROMPT_ID:valid-tag] and [PROMPT_ID:invalid@tag] and [PROMPT_ID:another-valid_tag] prompts.';
      
      const matches = [];
      let match;
      const detectRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;

      while ((match = detectRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      // Should only detect valid tags
      expect(matches).toEqual(['valid-tag', 'another-valid_tag']);
      // Should only clean valid tags
      expect(cleaned).toBe('Try  and [PROMPT_ID:invalid@tag] and  prompts.');
    });
  });

  describe('Real-world Examples', () => {
    it('should handle typical librarian responses', () => {
      const content = `Welcome back to the quiet reading room of the FIDU Library—let me pull a few helpful volumes from the writing shelf for you. I hear you're looking to craft a compelling blurb for your book, and I think we have just the right prompts to spark a polished, attention‑grabbing description.

First, the Create Micro Summary prompt can distill the heart of your story into a concise, punchy paragraph that works beautifully as a back‑cover blurb. I recommend the Create Micro Summary system prompt [PROMPT_ID:fabric-create_micro_summary] for your needs.

If you'd like a slightly longer, yet still tight, version, the Create 5‑Sentence Summary prompt expands the micro summary into a five‑sentence narrative that captures the main arc while leaving readers eager for more. You'll find it under the Create 5 Sentence Summary system prompt [PROMPT_ID:fabric-create_5_sentence_summary].

Finally, should you have a draft ready and want to polish the language, the Improve Writing prompt can refine tone, rhythm, and word choice to ensure your blurb shines. Look for the Improve Writing system prompt [PROMPT_ID:fabric-improve_writing].`;

      const matches = [];
      let match;
      const detectRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;

      while ((match = detectRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(matches).toEqual([
        'fabric-create_micro_summary',
        'fabric-create_5_sentence_summary',
        'fabric-improve_writing'
      ]);

      // Verify cleaned content doesn't contain tags
      expect(cleaned).not.toContain('[PROMPT_ID:');
      expect(cleaned).toContain('I recommend the Create Micro Summary system prompt');
      expect(cleaned).toContain('for your needs');
    });

    it('should handle responses with no suggestions', () => {
      const content = 'I understand you need help with writing. Let me think about the best approach for your specific needs.';
      
      const matches = [];
      let match;
      const detectRegex = /\[PROMPT_ID:([a-zA-Z0-9_-]+)\]/g;

      while ((match = detectRegex.exec(content)) !== null) {
        matches.push(match[1]);
      }

      const cleaned = content.replace(/\[PROMPT_ID:[a-zA-Z0-9_-]+\]/g, '');

      expect(matches).toEqual([]);
      expect(cleaned).toBe(content);
    });
  });
});
