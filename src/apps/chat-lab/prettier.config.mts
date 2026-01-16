import { type Config } from 'prettier';

const config: Config = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  experimentalOperatorPosition: 'start',
};

export default config;
