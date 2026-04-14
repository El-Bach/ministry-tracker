// src/components/RouteStop.tsx
// Single stop in a ministry route chain — shows status, updater, notes
// All styles via theme tokens.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TaskRouteStop } from '../types';
import StatusBadge from './StatusBadge';
import { theme } from '../theme';

interface Props {
  stop: TaskRouteStop;
  isLast: boolean;
  statusColor: string;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export default function RouteStop({ stop, isLast, statusColor }: Props) {
  const hasGps = stop.gps_lat != null && stop.gps_lng != null;

  return (
    <View style={styles.container}>
      {/* Connector rail */}
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        {!isLast && <View style={styles.line} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text
            style={styles.ministryName}
            numberOfLines={1}
            accessibilityLabel={`Stage: ${stop.ministry?.name ?? 'Unknown'}`}
          >
            {stop.ministry?.name ?? 'Unknown Ministry'}
          </Text>
          <Text style={styles.stopOrder} accessibilityLabel={`Stop number ${stop.stop_order}`}>
            #{stop.stop_order}
          </Text>
        </View>

        <StatusBadge label={stop.status} color={statusColor} size="sm" />

        {stop.updated_at && (
          <Text style={styles.meta}>
            Updated {formatDate(stop.updated_at)}
            {stop.updater ? ` by ${stop.updater.name}` : ''}
          </Text>
        )}

        {hasGps && (
          <Text style={styles.gps} accessibilityLabel={`GPS: ${stop.gps_lat!.toFixed(5)}, ${stop.gps_lng!.toFixed(5)}`}>
            📍 {stop.gps_lat!.toFixed(5)}, {stop.gps_lng!.toFixed(5)}
          </Text>
        )}

        {stop.notes ? (
          <Text style={styles.notes}>{stop.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap:           theme.spacing.space3,
    paddingBottom: theme.spacing.space1,
  },
  rail: {
    alignItems: 'center',
    width:      theme.spacing.space5,
  },
  dot: {
    width:        12,
    height:       12,
    borderRadius: theme.radius.full,
    marginTop:    theme.spacing.space1,
  },
  line: {
    width:           2,
    flex:            1,
    backgroundColor: theme.color.border,
    marginTop:       theme.spacing.space1,
    minHeight:       theme.spacing.space8,
  },
  content: {
    flex:          1,
    paddingBottom: theme.spacing.space5,
    gap:           theme.spacing.space1 + 2, // 6px
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  ministryName: {
    ...theme.typography.body,
    fontWeight: '700',
    flex:        1,
  },
  stopOrder: {
    ...theme.typography.caption,
    fontWeight: '600',
  },
  meta: {
    ...theme.typography.caption,
    color: theme.color.textMuted,
  },
  gps: {
    ...theme.typography.caption,
    color: theme.color.primary,
  },
  notes: {
    ...theme.typography.label,
    color:      theme.color.textSecondary,
    fontStyle:  'italic',
    marginTop:  theme.spacing.space1 - 2, // 2px
  },
});
