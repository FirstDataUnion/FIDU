import {
  openRouterImagePartsToAttachments,
  responseHasDisplayableChatPayload,
} from '../openRouterAttachments';
import type { OpenRouterImageUrlPart } from '../../types/openRouter';

describe('openRouterImagePartsToAttachments', () => {
  it('returns undefined for empty or missing parts', () => {
    expect(openRouterImagePartsToAttachments(undefined, 'm')).toBeUndefined();
    expect(openRouterImagePartsToAttachments([], 'm')).toBeUndefined();
  });

  it('maps parts to image attachments with mime from data URL', () => {
    const parts: OpenRouterImageUrlPart[] = [
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,AAA' },
      },
    ];
    const out = openRouterImagePartsToAttachments(parts, 'msg-1')!;
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('image');
    expect(out[0].url).toBe('data:image/png;base64,AAA');
    expect(out[0].mimeType).toBe('image/png');
    expect(out[0].name).toBe('Generated image 1');
    expect(out[0].id).toBe('msg-1-gen-0');
  });
});

describe('responseHasDisplayableChatPayload', () => {
  it('is true when non-whitespace text', () => {
    expect(responseHasDisplayableChatPayload({ content: ' hi ' })).toBe(true);
  });

  it('is false when only whitespace and no images', () => {
    expect(responseHasDisplayableChatPayload({ content: '   ' })).toBe(false);
    expect(responseHasDisplayableChatPayload({ content: '' })).toBe(false);
  });

  it('is true when images array non-empty', () => {
    expect(
      responseHasDisplayableChatPayload({
        content: '',
        images: [{ image_url: { url: 'data:image/png;base64,x' } }],
      })
    ).toBe(true);
  });
});
