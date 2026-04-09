// src/components/TaskCard.tsx
// Airtable-style dense card — shows most urgent stage status on dashboard
// Locked 4-row structure per design spec v2. All styles via theme tokens.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, I18nManager } from 'react-native';
import { Task } from '../types';
import StatusBadge from './StatusBadge';
import { theme } from '../theme';

// ─── Props (unchanged) ────────────────────────────────────────────────────────

interface Props {
  task: Task;
  statusColor: string;
  onPress: () => void;
  onClientPress?: () => void;
  allStatusColors?: Record<string, string>;
  cardStyle?: object;
  loading?: boolean;
  error?: boolean;
  selected?: boolean;
}

// ─── Urgency Logic (unchanged) ───────────────────────────────────────────────

const URGENCY_ORDER: Record<string, number> = {
  'Rejected':          1,
  'Pending Signature': 2,
  'In Review':         3,
  'Submitted':         4,
  'Pending':           5,
  'Done':              99,
  'Closed':            100,
};

function getMostUrgentStatus(statuses: string[]): string {
  if (statuses.length === 0) return '';
  return statuses.reduce((most, curr) => {
    const mostScore = URGENCY_ORDER[most] ?? 50;
    const currScore = URGENCY_ORDER[curr] ?? 50;
    return currScore < mostScore ? curr : most;
  });
}

function daysUntil(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  return `${diff}d left`;
}

// ─── Skeleton component ───────────────────────────────────────────────────────

function SkeletonCard({ cardStyle }: { cardStyle?: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View style={[styles.card, cardStyle]} accessibilityLabel="Loading task">
      <Animated.View style={[styles.skeletonBar, styles.skeletonBarWide, { opacity }]} />
      <Animated.View style={[styles.skeletonBar, styles.skeletonBarNarrow, { opacity }]} />
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function TaskCard({
  task,
  statusColor,
  onPress,
  onClientPress,
  allStatusColors = {},
  cardStyle,
  loading = false,
  error = false,
  selected = false,
}: Props) {
  if (loading) return <SkeletonCard cardStyle={cardStyle} />;

  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const dueDays = daysUntil(task.due_date);
  const isDueSoon = task.due_date
    ? Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000) <= 3
    : false;

  const stopsTotal = task.route_stops?.length ?? 0;
  const stopsDone  = task.route_stops?.filter((s) => s.status === 'Done').length ?? 0;
  const allDone    = stopsTotal > 0 && stopsDone === stopsTotal;

  // Status logic: show urgentStatus if different from current_status, else current_status
  const nonDoneStatuses = task.route_stops
    ?.filter((s) => s.status !== 'Done')
    .map((s) => s.status) ?? [];
  const urgentStatus = nonDoneStatuses.length > 0
    ? getMostUrgentStatus(nonDoneStatuses)
    : (stopsTotal > 0 ? 'Done' : task.current_status);

  const displayStatus = (stopsTotal > 0 && !allDone && urgentStatus !== task.current_status)
    ? urgentStatus
    : task.current_status;

  const urgentColor  = allStatusColors[urgentStatus] ?? statusColor;
  const accentColor  = allDone ? theme.color.success : urgentColor;
  const displayColor = allStatusColors[displayStatus] ?? statusColor;

  // Error state
  if (error) {
    return (
      <TouchableOpacity
        style={[styles.card, styles.cardError, cardStyle]}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Failed to load task. Tap to retry.`}
      >
        <View style={[styles.accentStrip, { backgroundColor: theme.color.danger }]} />
        <Text style={styles.errorText}>Failed to load — tap to retry</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        selected && styles.cardSelected,
        cardStyle,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${task.client?.name ?? 'Unknown client'}, ${task.service?.name ?? ''}, status ${displayStatus}`}
    >
      {/* Left accent strip — RTL aware */}
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />

      {/* Selected checkmark */}
      {selected && (
        <View style={styles.selectedCheck} accessibilityLabel="Selected">
          <Text style={styles.selectedCheckText}>✓</Text>
        </View>
      )}

      {/* ROW 1: Client name + "via Ref" */}
      <View style={styles.row1}>
        <TouchableOpacity
          style={styles.clientNameCol}
          onPress={onClientPress}
          activeOpacity={onClientPress ? 0.75 : 1}
          disabled={!onClientPress}
          accessibilityRole={onClientPress ? 'button' : 'text'}
          accessibilityLabel={
            task.client?.reference_name
              ? `${task.client?.name ?? '—'}, referred by ${task.client.reference_name}`
              : (task.client?.name ?? '—')
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.clientNameCol, { minHeight: theme.touchTarget.min }]}
        >
          <Text
            style={[styles.clientName, onClientPress && styles.clientNameLink]}
            numberOfLines={1}
            suppressHighlighting
          >
            {task.client?.name ?? '—'}
          </Text>
          {!!task.client?.reference_name && (
            <Text style={styles.referenceLabel} numberOfLines={1}>
              via {task.client.reference_name}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ROW 2: Service name + contract price */}
      <View style={styles.row2}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {task.service?.name ?? '—'}
        </Text>
        {(task.price_usd ?? 0) > 0 && (
          <Text
            style={styles.contractPrice}
            accessibilityLabel={`Contract price $${task.price_usd}`}
          >
            ${(task.price_usd!).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        )}
      </View>

      {/* ROW 3: Status badge + assigned */}
      <View style={styles.row3}>
        <StatusBadge
          label={displayStatus}
          color={displayColor}
          small
        />
        <Text
          style={styles.assignedText}
          numberOfLines={1}
          accessibilityLabel={`Assigned to ${task.assignee?.name ?? 'Unassigned'}`}
        >
          {task.assignee?.name ?? 'Unassigned'}
        </Text>
      </View>

      {/* ROW 4: Stages X/Y + due date */}
      <View style={styles.row4}>
        <Text
          style={styles.stagesText}
          accessibilityLabel={`Stages ${stopsDone} of ${stopsTotal}`}
        >
          {stopsTotal > 0 ? `${stopsDone}/${stopsTotal} stages` : 'No stages'}
        </Text>
        {task.due_date && (
          <Text
            style={[
              styles.dueText,
              (isOverdue || isDueSoon) && styles.dueTextUrgent,
            ]}
            accessibilityLabel={`Due: ${dueDays}`}
          >
            {dueDays}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(TaskCard);

// ─── Styles (all values via theme tokens) ─────────────────────────────────────

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    paddingTop:      theme.spacing.space3,
    paddingBottom:   theme.spacing.space3,
    paddingEnd:      theme.spacing.space3,
    paddingStart:    theme.spacing.space5,  // extra start for accent strip
    borderWidth:     1,
    borderColor:     theme.color.border,
    gap:             theme.spacing.space2,
    overflow:        'hidden',
  },
  cardError: {
    borderColor: theme.color.danger,
  },
  cardSelected: {
    backgroundColor: theme.color.primaryDim,
    borderColor:     theme.color.primary,
  },

  // RTL-aware accent strip
  accentStrip: {
    position:               'absolute',
    top:                    0,
    bottom:                 0,
    width:                  3,
    left:                   isRTL ? undefined : 0,
    right:                  isRTL ? 0 : undefined,
    borderTopLeftRadius:    isRTL ? 0 : theme.radius.lg,
    borderBottomLeftRadius: isRTL ? 0 : theme.radius.lg,
    borderTopRightRadius:   isRTL ? theme.radius.lg : 0,
    borderBottomRightRadius:isRTL ? theme.radius.lg : 0,
  },

  selectedCheck: {
    position: 'absolute',
    top:      theme.spacing.space2,
    right:    theme.spacing.space2,
  },
  selectedCheckText: {
    color:      theme.color.primaryText,
    fontSize:   theme.typography.label.fontSize,
    fontWeight: '700',
  },

  // Row 1
  row1: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  clientNameCol: {
    flex: 1,
    gap:  2,
  },
  clientName: {
    ...theme.typography.heading,
    fontSize: 15, // slightly tighter than heading on card
  },
  clientNameLink: {
    color:               theme.color.primaryText,
    textDecorationLine:  'underline',
  },
  referenceLabel: {
    ...theme.typography.caption,
    fontStyle: 'italic',
  },

  // Row 2
  row2: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            theme.spacing.space2,
  },
  serviceName: {
    ...theme.typography.body,
    color: theme.color.textMuted,
    flex:  1,
  },
  contractPrice: {
    ...theme.typography.label,
    color: theme.color.primaryText,
  },

  // Row 3
  row3: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent:'space-between',
    gap:           theme.spacing.space2,
  },
  assignedText: {
    ...theme.typography.caption,
    maxWidth: '40%',
  },

  // Row 4
  row4: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            theme.spacing.space2,
  },
  stagesText: {
    ...theme.typography.caption,
  },
  dueText: {
    ...theme.typography.caption,
  },
  dueTextUrgent: {
    color: theme.color.warning,
  },

  // Error state
  errorText: {
    ...theme.typography.caption,
    color: theme.color.danger,
  },

  // Skeleton state
  skeletonBar: {
    backgroundColor: theme.color.bgSubtle,
    borderRadius:    theme.radius.md,
    height:          12,
  },
  skeletonBarWide: {
    width: '70%',
  },
  skeletonBarNarrow: {
    width: '40%',
  },
});
