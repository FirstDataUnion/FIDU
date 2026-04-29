import type { Message } from '../../types';
import {
  buildConversationExportFilename,
  buildConversationExportText,
  collectImageAttachments,
} from '../conversationExport';

function makeMessage(overrides: Partial<Message>): Message {
  return {
    id: overrides.id || 'm-1',
    conversationId: 'c-1',
    content: overrides.content || '',
    role: overrides.role || 'assistant',
    timestamp: overrides.timestamp || '2026-04-29T10:00:00.000Z',
    platform: 'other',
    isEdited: false,
    ...overrides,
  };
}

describe('conversationExport', () => {
  it('builds markdown transcript with image references', () => {
    const messages: Message[] = [
      makeMessage({
        id: 'm-1',
        role: 'user',
        content: 'hello',
      }),
      makeMessage({
        id: 'm-2',
        role: 'assistant',
        content: 'hi there',
        attachments: [
          {
            id: 'a-1',
            name: 'image-one.png',
            type: 'image',
            url: 'https://example.com/image-one.png',
            status: 'ready',
          },
          {
            id: 'a-2',
            name: 'missing.png',
            type: 'image',
            status: 'missing',
          },
        ],
      }),
    ];

    const output = buildConversationExportText(messages, {
      format: 'markdown',
      title: 'Demo Chat',
      includeTimestamps: false,
    });

    expect(output).toContain('# Demo Chat');
    expect(output).toContain('## Assistant');
    expect(output).toContain('### Images');
    expect(output).toContain('- image-one.png');
    expect(output).toContain('- missing.png (unavailable)');
  });

  it('builds txt transcript from a start index', () => {
    const messages: Message[] = [
      makeMessage({ id: 'm-1', role: 'user', content: 'first' }),
      makeMessage({ id: 'm-2', role: 'assistant', content: 'second' }),
    ];

    const output = buildConversationExportText(messages, {
      format: 'txt',
      startIndex: 1,
    });

    expect(output).toContain('[Assistant]');
    expect(output).toContain('second');
    expect(output).not.toContain('first');
  });

  it('collects resolvable image attachments and skips duplicates', () => {
    const messages: Message[] = [
      makeMessage({
        id: 'm-1',
        role: 'assistant',
        content: 'one',
        attachments: [
          {
            id: 'a-1',
            name: 'a.png',
            type: 'image',
            url: 'https://example.com/a.png',
          },
          {
            id: 'a-2',
            name: 'a-copy.png',
            type: 'image',
            url: 'https://example.com/a.png',
          },
        ],
      }),
      makeMessage({
        id: 'm-2',
        role: 'assistant',
        content: 'two',
        attachments: [
          {
            id: 'a-3',
            name: 'b.png',
            type: 'image',
            url: 'https://example.com/b.png',
          },
        ],
      }),
    ];

    const images = collectImageAttachments(messages);
    expect(images).toHaveLength(2);
    expect(images.map(img => img.url)).toEqual([
      'https://example.com/a.png',
      'https://example.com/b.png',
    ]);
  });

  it('builds a safe filename with the right extension', () => {
    const mdName = buildConversationExportFilename('My Demo Chat!', 'markdown');
    const txtName = buildConversationExportFilename('My Demo Chat!', 'txt');
    expect(mdName.endsWith('.md')).toBe(true);
    expect(txtName.endsWith('.txt')).toBe(true);
    expect(mdName.startsWith('my-demo-chat')).toBe(true);
  });
});
