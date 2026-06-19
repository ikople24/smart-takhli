// Design System Constants - Centralized design tokens for consistent styling

export const COLORS = {
  // Base colors (OKLch)
  base: {
    100: 'oklch(98% 0.02 240)',
    200: 'oklch(95% 0.03 240)',
    300: 'oklch(92% 0.04 240)',
  },
  content: {
    base: 'oklch(20% 0.05 240)',
    light: 'oklch(98% 0.01 240)',
  },

  // Semantic colors
  primary: 'oklch(55% 0.3 240)',
  primaryContent: 'oklch(98% 0.01 240)',
  secondary: 'oklch(70% 0.25 200)',
  accent: 'oklch(65% 0.25 160)',
  neutral: 'oklch(50% 0.05 240)',

  // Status colors
  success: 'oklch(65% 0.25 140)',
  warning: 'oklch(80% 0.25 80)',
  error: 'oklch(65% 0.3 30)',
  info: 'oklch(70% 0.2 220)',
};

export const SPACING = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
};

export const BORDER_RADIUS = {
  none: '0',
  sm: '0.25rem',
  base: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  full: '9999px',
};

export const SHADOWS = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

export const TYPOGRAPHY = {
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.625',
  },
};

export const BREAKPOINTS = {
  mobile: '375px',
  tablet: '768px',
  desktop: '1280px',
};

export const TRANSITIONS = {
  fast: '150ms',
  base: '300ms',
  slow: '500ms',
};

export const Z_INDEX = {
  hide: '-1',
  base: '0',
  dropdown: '10',
  modal: '50',
  popover: '25',
  tooltip: '75',
  notification: '100',
};

// Common size presets for components
export const BUTTON_SIZES = {
  xs: {
    padding: 'px-2 py-1',
    fontSize: 'text-xs',
    height: 'h-7',
  },
  sm: {
    padding: 'px-3 py-1.5',
    fontSize: 'text-sm',
    height: 'h-8',
  },
  md: {
    padding: 'px-4 py-2',
    fontSize: 'text-base',
    height: 'h-10',
  },
  lg: {
    padding: 'px-6 py-3',
    fontSize: 'text-lg',
    height: 'h-12',
  },
};

export const INPUT_SIZES = {
  sm: {
    padding: 'px-2 py-1',
    fontSize: 'text-sm',
    height: 'h-8',
  },
  md: {
    padding: 'px-3 py-2',
    fontSize: 'text-base',
    height: 'h-10',
  },
  lg: {
    padding: 'px-4 py-2.5',
    fontSize: 'text-lg',
    height: 'h-12',
  },
};

// Animation durations
export const ANIMATION = {
  duration: {
    shortest: '150ms',
    short: '250ms',
    standard: '300ms',
    slow: '500ms',
    slowest: '1000ms',
  },
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};
