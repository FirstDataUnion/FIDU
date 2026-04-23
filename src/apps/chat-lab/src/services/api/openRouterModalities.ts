/**
 * Build OpenRouter `modalities` from the selected Chat Lab model catalog entry.
 * Only image-capable API-sourced models set this; omit the field otherwise.
 * (OpenRouter only requires this field to be set when the model is image-capable.)
 */

import { getModelConfig, modelSupportsImageOutput } from '../../data/models';
import type { OpenRouterImageUrlPart } from '../../types/openRouter';

/** Append delta images; dedupe by `image_url.url` across chunks (multiple images per response supported). */
export function mergeOpenRouterStreamImages(
  existing: OpenRouterImageUrlPart[],
  deltaImages: OpenRouterImageUrlPart[] | undefined
): OpenRouterImageUrlPart[] {
  if (!deltaImages?.length) {
    return existing;
  }
  const seen = new Set(
    existing.map(part => part.image_url?.url).filter(Boolean) as string[]
  );
  const next = [...existing];
  for (const part of deltaImages) {
    const url = part.image_url?.url;
    if (url && !seen.has(url)) {
      seen.add(url);
      next.push(part);
    }
  }
  return next;
}

/**
 * @returns `modalities` for the chat request, or `undefined` to omit the field.
 * - Image + text outputs: `["text", "image"]` (ordering may be validated per OpenRouter).
 * - Image-only outputs: `["image"]`.
 */
export function getModalitiesForOpenRouterModel(
  modelId: string
): string[] | undefined {
  // Auto-router may route to image-capable models; opt in to multimodal responses.
  if (modelId === 'auto-router' || modelId === 'openrouter/auto') {
    return ['text', 'image'];
  }

  const config = getModelConfig(modelId);
  if (!config || !modelSupportsImageOutput(config)) {
    return undefined;
  }
  const outs = config.outputModalities ?? [];
  const hasText = outs.includes('text');
  const hasImage = outs.includes('image');
  if (hasImage && hasText) {
    return ['text', 'image'];
  }
  if (hasImage) {
    return ['image'];
  }
  return undefined;
}
