import { useMediaQuery, useTheme } from '@mui/material';

/**
 * Custom hook for mobile-responsive behavior
 * Provides consistent breakpoint detection across the app
 */
export const useMobile = () => {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return {
    isMobile,
    isTablet, // Returned for use by other hooks/components
    isDesktop,
    isSmallMobile,
    // Convenience methods
    isMobileOrTablet: isMobile || isTablet,
    isDesktopOrTablet: isDesktop || isTablet,
  };
};

/**
 * Hook for responsive spacing values
 */
export const useResponsiveSpacing = () => {
  const { isMobile } = useMobile();

  return {
    // Padding values
    padding: {
      xs: isMobile ? 1 : 2,
      sm: isMobile ? 1.5 : 2,
      md: isMobile ? 2 : 3,
      lg: isMobile ? 2.5 : 4,
    },
    // Margin values
    margin: {
      xs: isMobile ? 0.5 : 1,
      sm: isMobile ? 1 : 1.5,
      md: isMobile ? 1.5 : 2,
      lg: isMobile ? 2 : 3,
    },
    // Gap values
    gap: {
      xs: isMobile ? 1 : 1.5,
      sm: isMobile ? 1.5 : 2,
      md: isMobile ? 2 : 2.5,
      lg: isMobile ? 2.5 : 3,
    },
  };
};

/**
 * Hook for responsive typography
 */
export const useResponsiveTypography = () => {
  const { isMobile, isSmallMobile } = useMobile();

  return {
    h1: isSmallMobile ? '1.75rem' : isMobile ? '2rem' : '2.5rem',
    h2: isSmallMobile ? '1.5rem' : isMobile ? '1.75rem' : '2rem',
    h3: isSmallMobile ? '1.25rem' : isMobile ? '1.5rem' : '1.75rem',
    h4: isSmallMobile ? '1.125rem' : isMobile ? '1.25rem' : '1.5rem',
    h5: isSmallMobile ? '1rem' : isMobile ? '1.125rem' : '1.25rem',
    h6: isSmallMobile ? '0.875rem' : isMobile ? '1rem' : '1.125rem',
    body1: isMobile ? '0.875rem' : '1rem',
    body2: isMobile ? '0.75rem' : '0.875rem',
    caption: isMobile ? '0.625rem' : '0.75rem',
  };
};

/**
 * Hook for responsive component sizing
 */
export const useResponsiveSizing = () => {
  const { isMobile, isSmallMobile } = useMobile();

  return {
    // Button sizes
    button: {
      height: isSmallMobile ? 40 : isMobile ? 44 : 48,
      minWidth: isSmallMobile ? 80 : isMobile ? 100 : 120,
    },
    // Input sizes
    input: {
      height: isSmallMobile ? 40 : isMobile ? 44 : 48,
      fontSize: isMobile ? '1rem' : '0.875rem',
    },
    // Icon sizes
    icon: {
      small: isMobile ? 20 : 18,
      medium: isMobile ? 24 : 22,
      large: isMobile ? 32 : 28,
    },
    // Touch targets (minimum 44px for accessibility)
    touchTarget: {
      min: 44,
      recommended: isMobile ? 48 : 44,
    },
  };
};
