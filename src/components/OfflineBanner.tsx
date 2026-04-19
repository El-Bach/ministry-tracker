// src/components/OfflineBanner.tsx
// Shows a banner when device is offline; shows syncing indicator when reconnected
// All styles via theme tokens.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useOfflineQueue } from '../store/offlineQueue';
import { theme } from '../theme';

export default function OfflineBanner() {
  const { isOnline, isSyncing, queue } = useOfflineQueue();
  const slideAnim = useRef(new Animated.Value(-48)).current;

  const visible = !isOnline || isSyncing || queue.length > 0;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue:         visible ? 0 : -48,
      duration:        theme.animation.durationLg,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const message = !isOnline
    ? `Offline — ${queue.length} update${queue.length !== 1 ? 's' : ''} queued`
    : isSyncing
    ? 'Syncing...'
    : queue.length > 0
    ? `${queue.length} update${queue.length !== 1 ? 's' : ''} pending sync`
    : '';

  const bgColor = !isOnline ? theme.color.warningDim : theme.color.infoDim;
  const dotColor = !isOnline ? theme.color.warning : theme.color.info;

  return (
    <Animated.View
      style={[styles.banner, { backgroundColor: bgColor, transform: [{ translateY: slideAnim }] }]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height:            36,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               theme.spacing.space2,
    paddingHorizontal: theme.spacing.space4,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: theme.radius.full,
  },
  text: {
    ...theme.typography.label,
    color:         theme.color.textPrimary,
    letterSpacing: 0.2,
  },
});
