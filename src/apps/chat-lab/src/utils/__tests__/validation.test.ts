import {
  sanitizeString,
  validateApiKey,
  validateProviderName,
  validateConversationTitle,
  validateSearchQuery,
  validateJsonData,
  validateFormData,
} from '../validation';

describe('validation', () => {
  describe('sanitizeString', () => {
    it('should throw error for non-string input', () => {
      expect(() => sanitizeString(null as any)).toThrow('Input must be a string');
      expect(() => sanitizeString(undefined as any)).toThrow('Input must be a string');
      expect(() => sanitizeString(123 as any)).toThrow('Input must be a string');
    });

    it('should remove control characters', () => {
      const input = 'Hello\x00World\x1F\x7F';
      const result = sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    it('should escape HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeString(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(1500);
      const result = sanitizeString(longString, 100);
      expect(result).toHaveLength(100);
    });

    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const result = sanitizeString(input);
      expect(result).toBe('hello world');
    });

    it('should handle empty string', () => {
      const result = sanitizeString('');
      expect(result).toBe('');
    });
  });

  describe('validateApiKey', () => {
    it('should throw error for non-string input', () => {
      expect(() => validateApiKey(null as any)).toThrow('API key must be a string');
      expect(() => validateApiKey(123 as any)).toThrow('API key must be a string');
    });

    it('should validate correct API key format', () => {
      const validKeys = [
        'sk-1234567890abcdef',
        'API_KEY_123',
        'test-key-123',
        'a'.repeat(50),
      ];

      validKeys.forEach(key => {
        expect(() => validateApiKey(key)).not.toThrow();
        expect(validateApiKey(key)).toBe(key.trim());
      });
    });

    it('should reject invalid characters', () => {
      const invalidKeys = [
        'sk-123@#$',
        'key with spaces',
        'key\nwith\nnewlines',
        'key\twith\ttabs',
      ];

      invalidKeys.forEach(key => {
        expect(() => validateApiKey(key)).toThrow('Invalid API key format');
      });
    });

    it('should reject keys that are too short', () => {
      expect(() => validateApiKey('short')).toThrow('API key length must be between 10 and 1000 characters');
    });

    it('should reject keys that are too long', () => {
      const longKey = 'a'.repeat(1001);
      expect(() => validateApiKey(longKey)).toThrow('API key length must be between 10 and 1000 characters');
    });

    it('should trim whitespace', () => {
      const key = '  sk-1234567890  ';
      const result = validateApiKey(key);
      expect(result).toBe('sk-1234567890');
    });
  });

  describe('validateProviderName', () => {
    it('should throw error for non-string input', () => {
      expect(() => validateProviderName(null as any)).toThrow('Provider name must be a string');
    });

    it('should validate correct provider names', () => {
      const validNames = [
        'OpenAI',
        'Anthropic Claude',
        'Google-Gemini',
        'test_provider',
        'Provider123',
      ];

      validNames.forEach(name => {
        expect(() => validateProviderName(name)).not.toThrow();
      });
    });

    it('should reject invalid characters', () => {
      const invalidNames = [
        'Provider@#$',
        'Provider<script>',
        'Provider"test"',
        'Provider\'test\'',
      ];

      invalidNames.forEach(name => {
        expect(() => validateProviderName(name)).toThrow('Invalid provider name');
      });
    });

    it('should limit length to 50 characters', () => {
      const longName = 'a'.repeat(100);
      const result = validateProviderName(longName);
      expect(result).toHaveLength(50);
    });
  });

  describe('validateConversationTitle', () => {
    it('should throw error for non-string input', () => {
      expect(() => validateConversationTitle(null as any)).toThrow('Title must be a string');
    });

    it('should validate correct titles', () => {
      const validTitles = [
        'My Conversation',
        'Test Chat',
        'Discussion about AI',
      ];

      validTitles.forEach(title => {
        expect(() => validateConversationTitle(title)).not.toThrow();
      });
    });

    it('should reject empty titles', () => {
      expect(() => validateConversationTitle('')).toThrow('Title cannot be empty');
      expect(() => validateConversationTitle('   ')).toThrow('Title cannot be empty');
    });

    it('should limit length to 200 characters', () => {
      const longTitle = 'a'.repeat(300);
      const result = validateConversationTitle(longTitle);
      expect(result).toHaveLength(200);
    });

    it('should sanitize HTML characters', () => {
      const title = '<script>alert("xss")</script>';
      const result = validateConversationTitle(title);
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
  });

  describe('validateSearchQuery', () => {
    it('should throw error for non-string input', () => {
      expect(() => validateSearchQuery(null as any)).toThrow('Search query must be a string');
    });

    it('should validate correct search queries', () => {
      const validQueries = [
        'hello world',
        'test query',
        'search for something',
      ];

      validQueries.forEach(query => {
        expect(() => validateSearchQuery(query)).not.toThrow();
      });
    });

    it('should remove dangerous characters', () => {
      const query = 'test <script>alert("xss")</script> query';
      const result = validateSearchQuery(query);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
      expect(result).not.toContain("'");
    });

    it('should limit length to 500 characters', () => {
      const longQuery = 'a'.repeat(1000);
      const result = validateSearchQuery(longQuery);
      expect(result).toHaveLength(500);
    });
  });

  describe('validateJsonData', () => {
    it('should throw error for non-object input', () => {
      expect(() => validateJsonData(null)).toThrow('Data must be an object');
      expect(() => validateJsonData('string')).toThrow('Data must be an object');
      expect(() => validateJsonData(123)).toThrow('Data must be an object');
    });

    it('should validate correct JSON data', () => {
      const validData = {
        name: 'test',
        value: 123,
        nested: { key: 'value' },
        array: [1, 2, 3],
      };

      expect(() => validateJsonData(validData)).not.toThrow();
    });

    it('should reject data that is too large', () => {
      const largeData = { data: 'x'.repeat(1000001) };
      expect(() => validateJsonData(largeData)).toThrow('Data too large (max 1MB)');
    });

    it('should sanitize string values in objects', () => {
      const data = {
        title: '<script>alert("xss")</script>',
        content: 'Hello <b>world</b>',
      };

      const result = validateJsonData(data);
      expect(result.title).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result.content).toBe('Hello &lt;b&gt;world&lt;/b&gt;');
    });

    it('should sanitize nested objects', () => {
      const data = {
        user: {
          name: '<script>alert("xss")</script>',
          profile: {
            bio: 'Hello <b>world</b>',
          },
        },
      };

      const result = validateJsonData(data);
      expect(result.user.name).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result.user.profile.bio).toBe('Hello &lt;b&gt;world&lt;/b&gt;');
    });

    it('should sanitize arrays', () => {
      const data = {
        items: ['<script>alert("xss")</script>', 'normal text'],
      };

      const result = validateJsonData(data);
      expect(result.items[0]).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result.items[1]).toBe('normal text');
    });
  });

  describe('validateFormData', () => {
    it('should validate form data with strings', () => {
      const formData = {
        title: 'My Title',
        description: 'My Description',
        tags: 'tag1, tag2',
      };

      const result = validateFormData(formData);
      expect(result.title).toBe('My Title');
      expect(result.description).toBe('My Description');
      expect(result.tags).toBe('tag1, tag2');
    });

    it('should validate form data with objects', () => {
      const formData = {
        title: 'My Title',
        metadata: {
          author: 'John Doe',
          created: '2024-01-01',
        },
      };

      const result = validateFormData(formData);
      expect(result.title).toBe('My Title');
      expect(result.metadata.author).toBe('John Doe');
      expect(result.metadata.created).toBe('2024-01-01');
    });

    it('should handle validation errors gracefully', () => {
      const formData = {
        title: 'My Title',
        invalidField: '<script>alert("xss")</script>',
      };

      expect(() => validateFormData(formData)).not.toThrow();
      const result = validateFormData(formData);
      expect(result.invalidField).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should preserve non-string values', () => {
      const formData = {
        title: 'My Title',
        count: 42,
        isActive: true,
        items: [1, 2, 3],
      };

      const result = validateFormData(formData);
      expect(result.title).toBe('My Title');
      expect(result.count).toBe(42);
      expect(result.isActive).toBe(true);
      expect(result.items).toEqual([1, 2, 3]);
    });
  });
});
