/**
 * Design tokens for the "Candy Adventure" theme: a playful, game-like look
 * with saturated warm colors and rounded shapes. Import these constants
 * instead of hardcoding colors/fonts/radii in component styles.
 */
export const colors = {
  coral: '#FF5A5F',
  coralDark: '#E23F45',
  sun: '#FFC93C',
  sunDark: '#E8A800',
  grass: '#4CD787',
  grassDark: '#2FAE68',
  sky: '#3AA6FF',
  skyDark: '#1E7FD6',
  grape: '#9B5DE5',
  grapeDark: '#7A3DC2',
  cream: '#FFF8EC',
  sand: '#FFE8C2',
  ink: '#3A2E39',
  inkMuted: '#6B5C68',
  white: '#FFFFFF',
} as const;

export const fonts = {
  display: "'Fredoka', system-ui, sans-serif",
  body: "'Nunito', system-ui, sans-serif",
} as const;

export const radii = {
  sm: '10px',
  md: '16px',
  lg: '22px',
  pill: '999px',
} as const;

export const shadows = {
  sticker: '0 4px 0 rgba(0,0,0,0.15), 0 6px 14px rgba(0,0,0,0.18)',
  card: '0 8px 24px rgba(58,46,57,0.16)',
  soft: '0 2px 8px rgba(58,46,57,0.12)',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const;
