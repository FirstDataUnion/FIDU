import type { Attachment } from '../types';
import type { OpenRouterImageUrlPart } from '../types/openRouter';

/** Map OpenRouter completion/stream image parts to Chat Lab `Attachment` records. */
export function openRouterImagePartsToAttachments(
  parts: OpenRouterImageUrlPart[] | undefined,
  idPrefix: string
): Attachment[] | undefined {
  if (!parts?.length) {
    return undefined;
  }
  return parts.map((part, index) => {
    const url = part.image_url?.url ?? '';
    const mimeMatch = /^data:([^;]+);/.exec(url);
    return {
      id: `${idPrefix}-gen-${index}`,
      name: `Generated image ${index + 1}`,
      type: 'image' as const,
      storage: 'inline' as const,
      ...(url ? { url } : {}),
      ...(mimeMatch?.[1] ? { mimeType: mimeMatch[1] } : {}),
    };
  });
}

/** True when the execute-prompt result has text and/or generated images to show or save. */
export function responseHasDisplayableChatPayload(responses: {
  content?: string | null;
  images?: readonly unknown[] | null | undefined;
}): boolean {
  const text = responses.content?.trim() ?? '';
  const imageCount = responses.images?.length ?? 0;
  return text.length > 0 || imageCount > 0;
}
