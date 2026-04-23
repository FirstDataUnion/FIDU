import {
  getBackgroundAgentCompatibleModels,
  normalizeBackgroundAgentModelId,
  resolveNlpWorkbenchModelId,
  resolveOpenRouterModelId,
} from '../agentModelUtils';

describe('agentModelUtils', () => {
  describe('getBackgroundAgentCompatibleModels', () => {
    it('excludes image-output models and keeps text-only models', () => {
      const models = [
        {
          id: 'text-model',
          outputModalities: ['text'],
        },
        {
          id: 'image-model',
          outputModalities: ['text', 'image'],
        },
        {
          id: 'legacy-static-model',
        },
      ];

      const compatible = getBackgroundAgentCompatibleModels(models);

      expect(compatible.map(model => model.id)).toEqual([
        'text-model',
        'legacy-static-model',
      ]);
    });
  });

  describe('model id normalization', () => {
    it('normalizes legacy OSS IDs to OpenRouter IDs', () => {
      expect(normalizeBackgroundAgentModelId('gpt-oss-20b')).toBe(
        'openai/gpt-oss-20b'
      );
      expect(normalizeBackgroundAgentModelId('gpt-oss-120b')).toBe(
        'openai/gpt-oss-120b'
      );
    });

    it('maps auto-router correctly for OpenRouter execution', () => {
      expect(resolveOpenRouterModelId('auto-router')).toBe('openrouter/auto');
    });

    it('maps normalized OpenRouter OSS IDs back to NLP IDs', () => {
      expect(resolveNlpWorkbenchModelId('openai/gpt-oss-20b')).toBe(
        'gpt-oss-20b'
      );
    });
  });
});
