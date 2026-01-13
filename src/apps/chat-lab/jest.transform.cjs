/**
 * Custom Jest transformer to handle import.meta.env for tests
 * Replaces import.meta.env with a mockable global before ts-jest processes the file
 */
const tsJest = require('ts-jest').default;

// Create ts-jest transformer with our config
const tsJestTransformer = tsJest.createTransformer({
  tsconfig: 'tsconfig.jest.json',
  useESM: true,
});

module.exports = {
  process(sourceText, sourcePath, options) {
    // Replace import.meta.env with a global that can be mocked
    const transformedSource = sourceText.replace(
      /import\.meta\.env/g,
      '(globalThis as any).__import_meta_env__'
    );
    
    // Use ts-jest to handle the rest of the transformation
    return tsJestTransformer.process(transformedSource, sourcePath, options);
  },
  
  // Required for ESM support
  getCacheKey(sourceText, sourcePath, options) {
    return tsJestTransformer.getCacheKey(sourceText, sourcePath, options);
  },
};

