/**
 * Professional Dark Theme - Iron Man HUD Inspired
 * App Store Quality Color System for F.R.I.D.A.Y
 */

import { Platform } from 'react-native';

// Professional Dark Theme Palette
const background = '#0A0A0F';     // Near black with blue tint
const surface = '#12121A';         // Cards, input areas
const border = '#1E1E2E';          // Subtle borders
const accentCyan = '#00D4FF';      // Primary cyan (tech/AI feel)
const accentBlue = '#0096FF';      // Deeper blue
const accentGreen = '#00FF88';     // Neon green for success
const textPrimary = '#FFFFFF';
const textSecondary = '#8888AA';
const textMuted = '#5A5A7A';

export const Colors = {
  // Base
  background,
  surface,
  border,

  // Accents (Cyan/Blue)
  accent: accentCyan,
  accentSecondary: accentBlue,
  accentSuccess: accentGreen,

  // Text
  textPrimary,
  textSecondary,
  textMuted,

  // Status
  success: accentGreen,
  error: '#FF4466',
  warning: '#FFB800',

  // Message bubbles
  userBubble: '#1A2744',
  fridayBubble: surface,

  // Legacy light/dark for compatibility
  light: {
    text: '#11181C',
    background: '#fff',
    tint: accentCyan,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: accentCyan,
  },
  dark: {
    text: textPrimary,
    background,
    tint: accentCyan,
    icon: textMuted,
    tabIconDefault: textMuted,
    tabIconSelected: accentCyan,
  },
};

// Legacy exports for compatibility with existing code
export const ACCENT_GREEN = accentGreen;
export const ACCENT_BLUE = accentBlue;
export const DARK_BG = background;
export const HEADER_BG = surface;
export const INACTIVE_TAB = textMuted;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
