// Theme color utilities for light and dark modes
export const lightModeColors = {
  primary: {
    main: '#2e6417', // Brand green - main color
    light: '#4ca626', // Brand green - lighter variant
    dark: '#1a3d0d', // Generated darker variant for hover states
    contrastText: '#FFFFFF', // White text for good contrast on dark green
  },
  secondary: {
    main: '#3e1964', // Brand purple - secondary color
    light: '#654783', // Brand purple - lighter variant
    dark: '#2a1247', // Generated darker variant for hover states
    contrastText: '#FFFFFF', // White text for good contrast on dark purple
  },
  tertiary: {
    main: '#ffaa2a',
    light: '#ffe2c0',
    dark: '#fff6c6',
    contrastText: '#212121',
  },
  background: {
    default: '#FFFFFF',
    alternative: '#fff6c6',
    paper: '#F8F9FA',
  },
  text: {
    primary: '#212121',
    secondary: '#757575',
  },
  modelColors: {
    // Auto Router
    autoRouter: '#b8b9f5', // Light indigo for light backgrounds

    // OpenAI Models
    openai: '#7dd3b0', // Light teal for light backgrounds

    // Anthropic Claude Models
    anthropic: '#e6a85a', // Light orange for light backgrounds

    // Google Gemini Models
    google: '#8ab4f7', // Light blue for light backgrounds

    // Meta Llama Models
    meta: '#7bb3f5', // Light blue for light backgrounds

    // Mistral Models
    mistral: '#ffb88a', // Light orange for light backgrounds

    // Microsoft Phi Models
    microsoft: '#7dd9f5', // Light cyan for light backgrounds

    // xAI Grok Models
    xai: '#ffb380', // Light orange for light backgrounds

    // Unknown/Fallback
    unknown: '#7dd3b0', // Light green for light backgrounds
  },
};

export const darkModeColors = {
  primary: {
    main: '#00654C',
    light: '#161A19',
    dark: '#019872',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#3e1964', // Brand purple - secondary color
    light: '#efe0ff', // Brand purple - lighter variant
    dark: '#321450', // Generated darker variant for hover states
    contrastText: '#FFFFFF', // White text for good contrast on dark purple
  },
  tertiary: {
    main: '#ffaa2a',
    light: '#ffe2c0',
    dark: '#102903',
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#121212',
    alternative: '#fff6c6',
    paper: '#1E1E1E',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
  },
  modelColors: {
    // Auto Router
    autoRouter: '#210a39', // Original indigo for dark backgrounds

    // OpenAI Models
    openai: '#10a37f', // Original teal for dark backgrounds

    // Anthropic Claude Models
    anthropic: '#C46902', // Original orange for dark backgrounds

    // Google Gemini Models
    google: '#4285F4', // Original blue for dark backgrounds

    // Meta Llama Models
    meta: '#1877f2', // Original blue for dark backgrounds

    // Mistral Models
    mistral: '#ff6b35', // Original orange for dark backgrounds

    // Microsoft Phi Models
    microsoft: '#00bcf2', // Original cyan for dark backgrounds

    // xAI Grok Models
    xai: '#ff6b00', // Original orange for dark backgrounds

    // Unknown/Fallback
    unknown: '#00654C', // Primary dark color for dark backgrounds
  },
};

export const getThemeColors = (mode: 'light' | 'dark') => {
  return mode === 'light' ? lightModeColors : darkModeColors;
};

export const getPrimaryColor = (
  mode: 'light' | 'dark',
  variant: 'main' | 'light' | 'dark' = 'main'
) => {
  const colors = getThemeColors(mode);
  return colors.primary[variant];
};

export const getSecondaryColor = (
  mode: 'light' | 'dark',
  variant: 'main' | 'light' | 'dark' = 'main'
) => {
  const colors = getThemeColors(mode);
  return colors.secondary[variant];
};

export const getModelColor = (
  mode: 'light' | 'dark',
  provider:
    | 'autoRouter'
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'meta'
    | 'mistral'
    | 'microsoft'
    | 'xai'
    | 'unknown'
) => {
  const colors = getThemeColors(mode);
  return colors.modelColors[provider];
};
