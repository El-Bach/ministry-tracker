// src/components/StatusBadge.tsx
// Colored pill badge for task/stop status labels — 3 sizes (sm/md/lg)
// All styles via theme tokens.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Props {
  label: string;
  color?: string;
  small?: boolean;  // kept for backwards compatibility — maps to 'sm' size
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({
  label,
  color = theme.color.primary,
  small = false,
  size,
}: Props) {
  // Resolve size: explicit size prop wins; fall back to small boolean
  const resolvedSize = size ?? (small ? 'sm' : 'md');

  const badgeStyle = resolvedSize === 'lg' ? styles.badgeLg
    : resolvedSize === 'sm' ? styles.badgeSm
    : styles.badgeMd;

  const textStyle = resolvedSize === 'lg' ? styles.textLg
    : resolvedSize === 'sm' ? styles.textSm
    : styles.textMd;

  const dotStyle = resolvedSize === 'sm' ? styles.dotSm : styles.dotMd;

  return (
    <View
      style={[styles.base, badgeStyle, { backgroundColor: color + '22', borderColor: color + '55' }]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      <View style={[styles.dot, dotStyle, { backgroundColor: color }]} />
      <Text style={[styles.text, textStyle, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            theme.spacing.space1 + 1, // 5px — between dot and text
    borderWidth:    1,
    borderRadius:   theme.radius.full,
    alignSelf:      'flex-start',
  },

  // Size variants
  badgeSm: {
    paddingHorizontal: theme.spacing.space2 - 1, // 7px
    paddingVertical:   theme.spacing.space1 - 2, // 2px
  },
  badgeMd: {
    paddingHorizontal: theme.spacing.space2 + 2, // 10px
    paddingVertical:   theme.spacing.space1,      // 4px
  },
  badgeLg: {
    paddingHorizontal: theme.spacing.space3,      // 12px
    paddingVertical:   theme.spacing.space1 + 2,  // 6px
  },

  // Dot sizes
  dotSm: {
    width:        5,
    height:       5,
    borderRadius: theme.radius.full,
  },
  dotMd: {
    width:        6,
    height:       6,
    borderRadius: theme.radius.full,
  },

  // Text variants
  text: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  textSm: {
    fontSize:   theme.typography.caption.fontSize, // 11
    lineHeight: theme.typography.caption.lineHeight,
  },
  textMd: {
    fontSize:   theme.typography.label.fontSize,   // 12
    lineHeight: theme.typography.label.lineHeight,
  },
  textLg: {
    fontSize:   theme.typography.body.fontSize,    // 14
    lineHeight: theme.typography.body.lineHeight,
  },

  // Shared dot base
  dot: {
    borderRadius: theme.radius.full,
  },
});
