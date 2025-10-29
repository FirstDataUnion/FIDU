import {
  getPlatformColor,
  getRoleColor,
  getRoleIcon,
  getTagColor,
  formatDate,
  formatTimestamp,
  formatMessageContent,
  getModelDisplayName,
  extractUniqueModels,
  calculatePrimaryModelsDisplay,
  calculatePrimaryModelsFromInteractions,
  calculatePrimaryModelsFromMessages,
} from '../conversationUtils';

describe('conversationUtils', () => {
  describe('getPlatformColor', () => {
    it('should return correct color for ChatGPT', () => {
      expect(getPlatformColor('chatgpt')).toBe('#00A67E');
      expect(getPlatformColor('ChatGPT')).toBe('#00A67E');
      expect(getPlatformColor('CHATGPT')).toBe('#00A67E');
    });

    it('should return correct color for Claude', () => {
      expect(getPlatformColor('claude')).toBe('#FF6B35');
      expect(getPlatformColor('Claude')).toBe('#FF6B35');
      expect(getPlatformColor('CLAUDE')).toBe('#FF6B35');
    });

    it('should return correct color for Gemini', () => {
      expect(getPlatformColor('gemini')).toBe('#4285F4');
      expect(getPlatformColor('Gemini')).toBe('#4285F4');
      expect(getPlatformColor('GEMINI')).toBe('#4285F4');
    });

    it('should return default color for unknown platforms', () => {
      expect(getPlatformColor('unknown')).toBe('#666');
      expect(getPlatformColor('')).toBe('#666');
      expect(getPlatformColor('other')).toBe('#666');
    });
  });

  describe('getRoleColor', () => {
    it('should return correct color for user role', () => {
      expect(getRoleColor('user')).toBe('#1976d2');
      expect(getRoleColor('User')).toBe('#1976d2');
      expect(getRoleColor('USER')).toBe('#1976d2');
    });

    it('should return correct color for assistant role', () => {
      expect(getRoleColor('assistant')).toBe('#388e3c');
      expect(getRoleColor('Assistant')).toBe('#388e3c');
      expect(getRoleColor('ASSISTANT')).toBe('#388e3c');
    });

    it('should return correct color for system role', () => {
      expect(getRoleColor('system')).toBe('#f57c00');
      expect(getRoleColor('System')).toBe('#f57c00');
      expect(getRoleColor('SYSTEM')).toBe('#f57c00');
    });

    it('should return default color for unknown roles', () => {
      expect(getRoleColor('unknown')).toBe('#666');
      expect(getRoleColor('')).toBe('#666');
      expect(getRoleColor('bot')).toBe('#666');
    });
  });

  describe('getRoleIcon', () => {
    it('should return correct icon for user role', () => {
      expect(getRoleIcon('user')).toBe('👤');
      expect(getRoleIcon('User')).toBe('👤');
      expect(getRoleIcon('USER')).toBe('👤');
    });

    it('should return correct icon for assistant role', () => {
      expect(getRoleIcon('assistant')).toBe('🤖');
      expect(getRoleIcon('Assistant')).toBe('🤖');
      expect(getRoleIcon('ASSISTANT')).toBe('🤖');
    });

    it('should return correct icon for system role', () => {
      expect(getRoleIcon('system')).toBe('⚙️');
      expect(getRoleIcon('System')).toBe('⚙️');
      expect(getRoleIcon('SYSTEM')).toBe('⚙️');
    });

    it('should return default icon for unknown roles', () => {
      expect(getRoleIcon('unknown')).toBe('💬');
      expect(getRoleIcon('')).toBe('💬');
      expect(getRoleIcon('bot')).toBe('💬');
    });
  });

  describe('getTagColor', () => {
    it('should return consistent colors for the same tag', () => {
      const color1 = getTagColor('test-tag');
      const color2 = getTagColor('test-tag');
      expect(color1).toBe(color2);
    });

    it('should return different colors for different tags', () => {
      const color1 = getTagColor('tag1');
      const color2 = getTagColor('tag2');
      expect(color1).not.toBe(color2);
    });

    it('should return a valid hex color', () => {
      const color = getTagColor('test');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('should handle empty string', () => {
      const color = getTagColor('');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('should handle special characters', () => {
      const color = getTagColor('tag-with-special-chars!@#$%');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('formatDate', () => {
    const now = new Date('2024-01-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should format recent dates correctly', () => {
      const recentDate = new Date('2024-01-15T11:30:00Z'); // 30 minutes ago
      expect(formatDate(recentDate)).toBe('30 minutes ago');
    });

    it('should format hours ago correctly', () => {
      const hoursAgo = new Date('2024-01-15T10:00:00Z'); // 2 hours ago
      expect(formatDate(hoursAgo)).toBe('2 hours ago');
    });

    it('should format yesterday correctly', () => {
      const yesterday = new Date('2024-01-14T12:00:00Z'); // 24 hours ago
      expect(formatDate(yesterday)).toBe('Yesterday');
    });

    it('should format older dates with locale date string', () => {
      const olderDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago
      const result = formatDate(olderDate);
      expect(result).toBe(olderDate.toLocaleDateString());
    });

    it('should handle edge case of exactly 24 hours', () => {
      const exactly24Hours = new Date('2024-01-14T12:00:00Z'); // exactly 24 hours ago
      expect(formatDate(exactly24Hours)).toBe('Yesterday');
    });
  });

  describe('formatTimestamp', () => {
    it('should format Date object correctly', () => {
      const date = new Date('2024-01-15T12:30:45Z');
      const result = formatTimestamp(date);
      expect(result).toMatch(/Jan 15, 2024, 12:30:45/);
    });

    it('should format string timestamp correctly', () => {
      const timestamp = '2024-01-15T12:30:45Z';
      const result = formatTimestamp(timestamp);
      expect(result).toMatch(/Jan 15, 2024, 12:30:45/);
    });

    it('should handle invalid date strings', () => {
      const invalidDate = 'invalid-date';
      const result = formatTimestamp(invalidDate);
      expect(result).toBe('Invalid Date');
    });
  });

  describe('formatMessageContent', () => {
    it('should return empty string for empty content', () => {
      expect(formatMessageContent('')).toBe('');
      expect(formatMessageContent(null as any)).toBe('');
      expect(formatMessageContent(undefined as any)).toBe('');
    });

    it('should replace multiple consecutive newlines with double newlines (paragraph breaks)', () => {
      const content = 'Line 1\n\n\n\nLine 2';
      const result = formatMessageContent(content);
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('should preserve markdown formatting', () => {
      const content = '**bold** *italic* `code`';
      const result = formatMessageContent(content);
      expect(result).toBe('**bold** *italic* `code`');
    });

    it('should handle code blocks correctly', () => {
      const content = '```javascript\nconst x = 1;\n```';
      const result = formatMessageContent(content);
      expect(result).toBe('```javascript\nconst x = 1;\n```');
    });

    it('should not add leading newlines for numbered lists', () => {
      const content = '1. First item\n2. Second item';
      const result = formatMessageContent(content);
      expect(result).toBe('1. First item\n2. Second item');
    });

    it('should add proper spacing for bullet points', () => {
      const content = '- First item\n- Second item';
      const result = formatMessageContent(content);
      expect(result).toBe('- First item\n- Second item');
    });

    it('should preserve headers without extra spacing', () => {
      const content = '# Header\nSome text';
      const result = formatMessageContent(content);
      expect(result).toBe('# Header\nSome text');
    });

    it('should handle complex content with multiple formatting', () => {
      const content = '# Header\n\n**Bold text**\n\n1. First item\n- Bullet point\n\n```code```';
      const result = formatMessageContent(content);
      expect(result).toContain('# Header');
      expect(result).toContain('**Bold text**');
      expect(result).toContain('1. First item');
      expect(result).toContain('- Bullet point');
    });
  });

  describe('getModelDisplayName', () => {
    it('should return "AutoRouter" for autorouter models', () => {
      expect(getModelDisplayName('autorouter')).toBe('AutoRouter');
      expect(getModelDisplayName('openrouter')).toBe('AutoRouter');
      expect(getModelDisplayName('AUTOROUTER')).toBe('AutoRouter');
    });

    it('should return correct names for OpenAI models', () => {
      expect(getModelDisplayName('gpt-4o')).toBe('GPT-4o');
      expect(getModelDisplayName('gpt-4-turbo')).toBe('GPT-4 Turbo');
      expect(getModelDisplayName('gpt-4')).toBe('GPT-4');
      expect(getModelDisplayName('gpt-3.5-turbo')).toBe('GPT-3.5');
      expect(getModelDisplayName('gpt-5')).toBe('GPT-5');
      expect(getModelDisplayName('chatgpt')).toBe('ChatGPT');
    });

    it('should return correct names for Anthropic models', () => {
      expect(getModelDisplayName('claude-3.5-sonnet')).toBe('Claude 3.5 Sonnet');
      expect(getModelDisplayName('claude-3-opus')).toBe('Claude 3 Opus');
      expect(getModelDisplayName('claude-3-sonnet')).toBe('Claude 3 Sonnet');
      expect(getModelDisplayName('claude-3-haiku')).toBe('Claude 3 Haiku');
      expect(getModelDisplayName('claude')).toBe('Claude');
    });

    it('should return correct names for Google models', () => {
      expect(getModelDisplayName('gemini-flash')).toBe('Gemini Flash');
      expect(getModelDisplayName('gemini-pro')).toBe('Gemini Pro');
      expect(getModelDisplayName('gemini')).toBe('Gemini');
    });

    it('should return "Unknown" for invalid models', () => {
      expect(getModelDisplayName('unknown')).toBe('Unknown');
      expect(getModelDisplayName('other')).toBe('Unknown');
      expect(getModelDisplayName('')).toBe('Unknown');
      expect(getModelDisplayName(null as any)).toBe('Unknown');
      expect(getModelDisplayName(undefined as any)).toBe('Unknown');
    });

    it('should format unknown model IDs with capitalization', () => {
      expect(getModelDisplayName('custom-model-name')).toBe('Custom Model Name');
      expect(getModelDisplayName('my_custom_model')).toBe('My Custom Model');
    });
  });

  describe('extractUniqueModels', () => {
    it('should extract models from assistant messages only', () => {
      const interactions = [
        { role: 'user', platform: 'user-platform' },
        { role: 'assistant', platform: 'gpt-4o' },
        { role: 'assistant', platform: 'claude-3-5-sonnet' },
        { role: 'user', platform: 'user-platform' },
        { role: 'assistant', platform: 'gpt-4o' }, // duplicate
      ];

      const result = extractUniqueModels(interactions);
      expect(result).toEqual(['gpt-4o', 'claude-3-5-sonnet']);
    });

    it('should handle interaction format with actor and model', () => {
      const interactions = [
        { actor: 'user', model: 'user-platform' },
        { actor: 'bot', model: 'autorouter' },
        { actor: 'assistant', model: 'gpt-4o' },
        { actor: 'bot', model: 'autorouter' }, // duplicate
      ];

      const result = extractUniqueModels(interactions);
      expect(result).toEqual(['autorouter', 'gpt-4o']);
    });

    it('should filter out invalid models', () => {
      const interactions = [
        { role: 'assistant', platform: 'gpt-4o' },
        { role: 'assistant', platform: 'unknown' },
        { role: 'assistant', platform: 'other' },
        { role: 'assistant', platform: '' },
        { role: 'assistant', platform: 'claude-3-5-sonnet' },
      ];

      const result = extractUniqueModels(interactions);
      expect(result).toEqual(['gpt-4o', 'claude-3-5-sonnet']);
    });

    it('should return empty array for no assistant messages', () => {
      const interactions = [
        { role: 'user', platform: 'user-platform' },
        { role: 'system', platform: 'system-platform' },
      ];

      const result = extractUniqueModels(interactions);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      expect(extractUniqueModels([])).toEqual([]);
    });

    it('should handle mixed format (both role and actor)', () => {
      const interactions = [
        { role: 'assistant', platform: 'gpt-4o' },
        { actor: 'bot', model: 'claude-3-5-sonnet' },
      ];

      const result = extractUniqueModels(interactions);
      expect(result).toEqual(['gpt-4o', 'claude-3-5-sonnet']);
    });
  });

  describe('calculatePrimaryModelsDisplay', () => {
    it('should return single model name for one model', () => {
      expect(calculatePrimaryModelsDisplay(['gpt-4o'])).toBe('GPT-4o');
      expect(calculatePrimaryModelsDisplay(['autorouter'])).toBe('AutoRouter');
      expect(calculatePrimaryModelsDisplay(['claude-3-5-sonnet'])).toBe('Claude 3.5 Sonnet');
    });

    it('should return two models separated by "/" for two models', () => {
      expect(calculatePrimaryModelsDisplay(['gpt-4o', 'claude-3-5-sonnet'])).toBe('GPT-4o/Claude 3.5 Sonnet');
      expect(calculatePrimaryModelsDisplay(['autorouter', 'gpt-4o'])).toBe('AutoRouter/GPT-4o');
    });

    it('should return "Multiple Models" for three or more models', () => {
      expect(calculatePrimaryModelsDisplay(['gpt-4o', 'claude-3-5-sonnet', 'gemini-flash'])).toBe('Multiple Models');
      expect(calculatePrimaryModelsDisplay(['gpt-4o', 'claude-3-5-sonnet', 'gemini-flash', 'gpt-3.5-turbo'])).toBe('Multiple Models');
    });

    it('should handle duplicates by returning unique models', () => {
      expect(calculatePrimaryModelsDisplay(['gpt-4o', 'gpt-4o', 'claude-3-5-sonnet'])).toBe('GPT-4o/Claude 3.5 Sonnet');
    });

    it('should return "Unknown" for empty or invalid models', () => {
      expect(calculatePrimaryModelsDisplay([])).toBe('Unknown');
      expect(calculatePrimaryModelsDisplay(['unknown', 'other'])).toBe('Unknown');
    });

    it('should filter out invalid models before calculating', () => {
      expect(calculatePrimaryModelsDisplay(['gpt-4o', 'unknown', 'other'])).toBe('GPT-4o');
      expect(calculatePrimaryModelsDisplay(['unknown', 'other', 'gpt-4o'])).toBe('GPT-4o');
    });
  });

  describe('calculatePrimaryModelsFromInteractions', () => {
    it('should calculate from interactions with model field', () => {
      const interactions = [
        { actor: 'user', model: 'user-platform' },
        { actor: 'assistant', model: 'gpt-4o' },
        { actor: 'assistant', model: 'claude-3-5-sonnet' },
      ];

      const result = calculatePrimaryModelsFromInteractions(interactions);
      expect(result).toBe('GPT-4o/Claude 3.5 Sonnet');
    });

    it('should return "Unknown" when no valid models found', () => {
      const interactions = [
        { actor: 'user', model: 'user-platform' },
        { actor: 'assistant', model: 'unknown' },
      ];

      const result = calculatePrimaryModelsFromInteractions(interactions);
      expect(result).toBe('Unknown');
    });

    it('should handle bot actor as assistant', () => {
      const interactions = [
        { actor: 'bot', model: 'autorouter' },
        { actor: 'assistant', model: 'gpt-4o' },
      ];

      const result = calculatePrimaryModelsFromInteractions(interactions);
      expect(result).toBe('AutoRouter/GPT-4o');
    });
  });

  describe('calculatePrimaryModelsFromMessages', () => {
    it('should calculate from messages with platform field', () => {
      const messages = [
        { role: 'user', platform: 'user-platform' },
        { role: 'assistant', platform: 'gpt-4o' },
        { role: 'assistant', platform: 'claude-3-5-sonnet' },
      ];

      const result = calculatePrimaryModelsFromMessages(messages);
      expect(result).toBe('GPT-4o/Claude 3.5 Sonnet');
    });

    it('should return "Unknown" when no valid models found', () => {
      const messages = [
        { role: 'user', platform: 'user-platform' },
        { role: 'assistant', platform: 'unknown' },
      ];

      const result = calculatePrimaryModelsFromMessages(messages);
      expect(result).toBe('Unknown');
    });

    it('should handle bot role as assistant', () => {
      const messages = [
        { role: 'bot', platform: 'autorouter' },
        { role: 'assistant', platform: 'gpt-4o' },
      ];

      const result = calculatePrimaryModelsFromMessages(messages);
      expect(result).toBe('AutoRouter/GPT-4o');
    });
  });
});
