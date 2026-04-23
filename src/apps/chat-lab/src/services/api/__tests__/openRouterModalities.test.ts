import {
  getModalitiesForOpenRouterModel,
  mergeOpenRouterStreamImages,
} from '../openRouterModalities';
import type { OpenRouterImageUrlPart } from '../../../types/openRouter';

jest.mock('../../../data/models', () => ({
  getModelConfig: jest.fn(),
  modelSupportsImageOutput: jest.fn(),
}));

import { getModelConfig, modelSupportsImageOutput } from '../../../data/models';

const img = (url: string): OpenRouterImageUrlPart => ({
  type: 'image_url',
  image_url: { url },
});

describe('mergeOpenRouterStreamImages', () => {
  it('returns existing when delta has no images', () => {
    const existing = [img('a')];
    expect(mergeOpenRouterStreamImages(existing, undefined)).toBe(existing);
    expect(mergeOpenRouterStreamImages(existing, [])).toEqual(existing);
  });

  it('appends new images and dedupes by url', () => {
    const a = img('data:image/png;base64,AAA');
    const b = img('data:image/png;base64,BBB');
    const one = mergeOpenRouterStreamImages([], [a, b]);
    expect(one).toEqual([a, b]);
    const dup = mergeOpenRouterStreamImages(one, [a, img('data:image/png;base64,CCC')]);
    expect(dup).toEqual([a, b, img('data:image/png;base64,CCC')]);
  });
});

describe('getModalitiesForOpenRouterModel', () => {
  beforeEach(() => {
    jest.mocked(getModelConfig).mockReset();
    jest.mocked(modelSupportsImageOutput).mockReset();
  });

  it('returns undefined when model does not support image output', () => {
    jest.mocked(getModelConfig).mockReturnValue({
      outputModalities: ['text'],
    } as any);
    jest.mocked(modelSupportsImageOutput).mockReturnValue(false);
    expect(getModalitiesForOpenRouterModel('any-id')).toBeUndefined();
  });

  it('returns text then image for auto-router', () => {
    expect(getModalitiesForOpenRouterModel('auto-router')).toEqual([
      'text',
      'image',
    ]);
  });

  it('returns text then image for openrouter/auto', () => {
    expect(getModalitiesForOpenRouterModel('openrouter/auto')).toEqual([
      'text',
      'image',
    ]);
  });

  it('returns text then image when both modalities are declared', () => {
    jest.mocked(getModelConfig).mockReturnValue({
      outputModalities: ['text', 'image'],
    } as any);
    jest.mocked(modelSupportsImageOutput).mockReturnValue(true);
    expect(getModalitiesForOpenRouterModel('x')).toEqual(['text', 'image']);
  });

  it('returns image only when output is image-only', () => {
    jest.mocked(getModelConfig).mockReturnValue({
      outputModalities: ['image'],
    } as any);
    jest.mocked(modelSupportsImageOutput).mockReturnValue(true);
    expect(getModalitiesForOpenRouterModel('x')).toEqual(['image']);
  });
});
