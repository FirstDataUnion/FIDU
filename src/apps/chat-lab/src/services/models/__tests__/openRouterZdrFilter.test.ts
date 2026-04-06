import type { OpenRouterModel } from '../../../types/openRouter';
import {
  applyOpenRouterZdrAllowlist,
  filterOpenRouterModelsByZdr,
  openRouterCatalogModelAllowedByZdr,
  openRouterModelHasTextInputAndOutput,
} from '../openRouterModelService';

function textChatModel(
  id: string,
  extra?: Partial<OpenRouterModel>
): OpenRouterModel {
  return {
    id,
    name: id,
    context_length: 8192,
    architecture: {
      tokenizer: 'test',
      input_modalities: ['text'],
      output_modalities: ['text'],
    },
    top_provider: { is_moderated: false },
    pricing: { prompt: '0', completion: '0' },
    ...extra,
  };
}

describe('openRouterCatalogModelAllowedByZdr', () => {
  const zdr = new Set(['qwen/qwen3-32b', 'openai/gpt-4o']);

  it('allows exact catalog id match', () => {
    expect(
      openRouterCatalogModelAllowedByZdr(textChatModel('openai/gpt-4o'), zdr)
    ).toBe(true);
  });

  it('allows canonical_slug when it matches a ZDR model_id', () => {
    expect(
      openRouterCatalogModelAllowedByZdr(
        textChatModel('vendor/foo-2025-01-01', {
          canonical_slug: 'qwen/qwen3-32b',
        }),
        zdr
      )
    ).toBe(true);
  });

  it('allows catalog id that extends ZDR id with a dated suffix (-…)', () => {
    expect(
      openRouterCatalogModelAllowedByZdr(
        textChatModel('qwen/qwen3-32b-04-28'),
        zdr
      )
    ).toBe(true);
  });

  it('allows catalog id that extends ZDR id with a variant (:…)', () => {
    const withFree = new Set(['meta-llama/llama-3']);
    expect(
      openRouterCatalogModelAllowedByZdr(
        textChatModel('meta-llama/llama-3:free'),
        withFree
      )
    ).toBe(true);
  });

  it('rejects models not in the ZDR allowlist', () => {
    expect(
      openRouterCatalogModelAllowedByZdr(
        textChatModel('acme/secret-model'),
        zdr
      )
    ).toBe(false);
  });
});

describe('openRouterModelHasTextInputAndOutput', () => {
  it('requires both text modalities when arrays are present', () => {
    expect(
      openRouterModelHasTextInputAndOutput(
        textChatModel('x/y', {
          architecture: {
            tokenizer: 't',
            input_modalities: ['text'],
            output_modalities: ['image'],
          },
        })
      )
    ).toBe(false);
  });

  it('drops image-only modality when arrays are absent', () => {
    expect(
      openRouterModelHasTextInputAndOutput(
        textChatModel('x/y', {
          architecture: {
            tokenizer: 't',
            modality: 'image',
          },
        })
      )
    ).toBe(false);
  });
});

describe('applyOpenRouterZdrAllowlist', () => {
  it('passes through all models when ZDR allowlist is empty', () => {
    const models = [
      textChatModel('a/b'),
      textChatModel('nope/model'),
    ];
    expect(applyOpenRouterZdrAllowlist(models, new Set())).toEqual(models);
  });

  it('filters like filterOpenRouterModelsByZdr when allowlist is non-empty', () => {
    const zdr = new Set(['a/b']);
    const models = [textChatModel('a/b'), textChatModel('nope/model')];
    expect(applyOpenRouterZdrAllowlist(models, zdr).map(m => m.id)).toEqual([
      'a/b',
    ]);
  });
});

describe('filterOpenRouterModelsByZdr (display pipeline invariant)', () => {
  it('every result is ZDR-allowed for the same Set used to filter', () => {
    const zdr = new Set(['a/b', 'c/d']);
    const afterText = [
      textChatModel('a/b'),
      textChatModel('c/d-2025'),
      textChatModel('nope/model'),
    ].filter(openRouterModelHasTextInputAndOutput);

    const out = filterOpenRouterModelsByZdr(afterText, zdr);

    expect(out.map(m => m.id)).toEqual(['a/b', 'c/d-2025']);
    expect(
      out.every(m => openRouterCatalogModelAllowedByZdr(m, zdr))
    ).toBe(true);
  });
});
