import {
  convertToOpenRouterMessages,
  mergeSystemPrompts,
} from '../openRouterMessageBuilder';
import type { Message } from '../../../types';

describe('mergeSystemPrompts', () => {
  it('returns empty string for empty input', () => {
    expect(mergeSystemPrompts([])).toBe('');
  });

  it('joins multiple system prompts', () => {
    expect(
      mergeSystemPrompts([
        { id: '1', name: 'a', content: 'First' },
        { id: '2', name: 'b', content: 'Second' },
      ] as any)
    ).toBe('First\n\nSecond');
  });
});

describe('convertToOpenRouterMessages', () => {
  const baseUser: Message = {
    id: 'u1',
    conversationId: 'c1',
    content: 'hello',
    role: 'user',
    timestamp: new Date().toISOString(),
    platform: 'test',
    isEdited: false,
  };

  it('builds system + history + current user message', () => {
    const messages = convertToOpenRouterMessages(
      [{ id: 's1', name: 'sys', content: 'You are helpful.' } as any],
      [],
      [],
      [
        baseUser,
        {
          ...baseUser,
          id: 'a1',
          role: 'assistant',
          content: 'Hi!',
        },
      ],
      'Follow-up'
    );

    expect(messages[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('You are helpful.'),
    });
    expect(messages[1]).toEqual({ role: 'user', content: 'hello' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'Hi!' });
    expect(messages[3]).toEqual({ role: 'user', content: 'Follow-up' });
  });

  it('adds default instruction in system message when no prompts/contexts', () => {
    const messages = convertToOpenRouterMessages([], [], [], [], 'Only user');
    expect(messages[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('Answer the following prompt'),
    });
    expect(messages[messages.length - 1]).toEqual({
      role: 'user',
      content: 'Only user',
    });
  });

  it('filters out system role from conversation history (system comes from builder only)', () => {
    const messages = convertToOpenRouterMessages(
      [],
      [],
      [],
      [
        {
          ...baseUser,
          id: 'sys',
          role: 'system',
          content: 'ignored in history',
        },
        baseUser,
      ],
      'Next'
    );
    expect(
      messages.find(m => m.content === 'ignored in history')
    ).toBeUndefined();
    expect(messages.filter(m => m.role === 'user')[0].content).toBe('hello');
  });
});
