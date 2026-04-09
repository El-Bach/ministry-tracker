// src/theme/tokens.ts
// Central design token system — Ministry Tracker
// ALL style values must reference these tokens. Hardcoded values are forbidden.

import { I18nManager } from 'react-native';

// ─── Colors ──────────────────────────────────────────────────────────────────

const color = {
  // Backgrounds
  bgBase:       '#0B1120',
  bgSurface:    '#111827',
  bgElevated:   '#1A2235',
  bgSubtle:     '#1E2D40',

  // Borders
  border:       '#243047',
  borderStrong: '#2E3D54',

  // Primary (Indigo)
  primary:      '#6366F1',
  primaryDim:   '#1E1B4B',
  primaryText:  '#A5B4FC',

  // Semantic — Success
  success:      '#10B981',
  successDim:   '#052E16',

  // Semantic — Danger
  danger:       '#EF4444',
  dangerDim:    '#450A0A',

  // Semantic — Warning
  warning:      '#F59E0B',
  warningDim:   '#451A03',

  // Semantic — Info
  info:         '#38BDF8',
  infoDim:      '#082F49',

  // Text
  textPrimary:   '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted:     '#475569',
  textInverse:   '#0B1120',

  // Utility
  white:        '#FFFFFF',
  transparent:  'transparent',
  overlayDark:  'rgba(0,0,0,0.6)',
  hairline:     'rgba(255,255,255,0.1)',
} as const;

// ─── Spacing (8pt grid) ───────────────────────────────────────────────────────

const spacing = {
  space1:  4,
  space2:  8,
  space3:  12,
  space4:  16,
  space5:  20,
  space6:  24,
  space8:  32,
  space10: 40,
  space12: 48,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
// 4 levels only. Use label with uppercase + letterSpacing for section dividers.

const typography = {
  heading: {
    fontSize:   17,
    fontWeight: '700' as const,
    lineHeight: 22,
    color:      color.textPrimary,
  },
  body: {
    fontSize:   14,
    fontWeight: '400' as const,
    lineHeight: 20,
    color:      color.textPrimary,
  },
  label: {
    fontSize:   12,
    fontWeight: '600' as const,
    lineHeight: 16,
    color:      color.textSecondary,
  },
  caption: {
    fontSize:   11,
    fontWeight: '500' as const,
    lineHeight: 15,
    color:      color.textMuted,
  },
  // Section divider — only use case for uppercase + letterSpacing
  sectionDivider: {
    fontSize:      12,
    fontWeight:    '600' as const,
    lineHeight:    16,
    color:         color.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
// Cards: no shadow. Shadows only for modals and dropdowns.

const shadow = {
  none: {},
  modal: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius:  30,
    elevation:     24,
  },
  focus: {
    shadowColor:   '#6366F1',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius:  3,
    elevation:     4,
  },
} as const;

// ─── Z-Index Layers ───────────────────────────────────────────────────────────
// No component may exceed its assigned layer.

const zIndex = {
  base:     0,
  sticky:   10,  // sticky header, filter strip, totals bar
  dropdown: 20,  // manage menu, picker popovers
  modal:    30,  // bottom sheets, full modals
  toast:    40,  // snackbars, inline alerts
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────

const animation = {
  durationSm:  80,   // button press, micro interactions
  duration:    100,  // standard transitions
  durationLg:  120,  // sheet entry/exit
  easing:      'ease-out' as const,
} as const;

// ─── Icon System ─────────────────────────────────────────────────────────────
// Single icon set: Lucide React Native. Consistent stroke width.

const icon = {
  sm:          16,
  md:          20,
  lg:          24,
  strokeWidth: 1.5,
} as const;

// ─── Touch Target ─────────────────────────────────────────────────────────────
// Minimum 44×44px for all interactive elements (WCAG / Apple HIG)

const touchTarget = {
  min: 44,
} as const;

// ─── RTL Helpers ──────────────────────────────────────────────────────────────
// Use these instead of hardcoding left/right for RTL-aware absolute positioning.

const rtl = {
  isRTL: I18nManager.isRTL,
  /**
   * Returns absolute positioning for elements that should anchor to the
   * "start" edge (left in LTR, right in RTL).
   */
  startEdge: () => ({
    left:  I18nManager.isRTL ? undefined : 0 as number | undefined,
    right: I18nManager.isRTL ? 0 as number | undefined : undefined,
  }),
  /**
   * Flip transform for directional icons (chevrons, arrows).
   */
  iconFlip: () => ({
    transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }],
  }),
} as const;

// ─── Status Color Map ─────────────────────────────────────────────────────────
// Maps status label strings to semantic color tokens.

const statusColors: Record<string, { bg: string; text: string; accent: string }> = {
  'Done':               { bg: color.successDim,  text: color.success,     accent: color.success },
  'Closed':             { bg: color.bgSubtle,     text: color.textMuted,   accent: color.textMuted },
  'Submitted':          { bg: color.primaryDim,   text: color.primaryText, accent: color.primary },
  'In Review':          { bg: color.infoDim,      text: color.info,        accent: color.info },
  'Pending Signature':  { bg: color.warningDim,   text: color.warning,     accent: color.warning },
  'Pending':            { bg: color.warningDim,   text: color.warning,     accent: color.warning },
  'Rejected':           { bg: color.dangerDim,    text: color.danger,      accent: color.danger },
};

const getStatusColors = (status: string) =>
  statusColors[status] ?? { bg: color.bgSubtle, text: color.textSecondary, accent: color.textMuted };

// ─── Export ───────────────────────────────────────────────────────────────────

export const theme = {
  color,
  spacing,
  typography,
  radius,
  shadow,
  zIndex,
  animation,
  icon,
  touchTarget,
  rtl,
  getStatusColors,
} as const;

export type Theme = typeof theme;
