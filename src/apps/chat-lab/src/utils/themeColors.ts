// Theme color utilities for light and dark modes
export const lightModeColors = {
  primary: {
    main: '#5CD58F',
    light: '#F3F3F3',
    dark: '#189878',
    contrastText: '#000000',
  },
  secondary: {
    main: '#D34E00',
    light: '#D1C4E9',
    dark: '#311B92',
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#FFFFFF',
    paper: '#F8F9FA',
  },
  text: {
    primary: '#212121',
    secondary: '#757575',
  }
};

export const darkModeColors = {
  primary: {
    main: '#00654C',
    light: '#161A19',
    dark: '#019872',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#D34E00',
    light: '#D1C4E9',
    dark: '#311B92',
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#121212',
    paper: '#1E1E1E',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B0B0',
  }
};

export const getThemeColors = (mode: 'light' | 'dark') => {
  return mode === 'light' ? lightModeColors : darkModeColors;
};

export const getPrimaryColor = (mode: 'light' | 'dark', variant: 'main' | 'light' | 'dark' = 'main') => {
  const colors = getThemeColors(mode);
  return colors.primary[variant];
};

export const getSecondaryColor = (mode: 'light' | 'dark', variant: 'main' | 'light' | 'dark' = 'main') => {
  const colors = getThemeColors(mode);
  return colors.secondary[variant];
};
