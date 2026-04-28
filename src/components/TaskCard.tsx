// src/components/TaskCard.tsx
// Airtable-style dense card — shows most urgent stage status on dashboard
// Locked 4-row structure per design spec v2. All styles via theme tokens.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, I18nManager, Alert, Linking } from 'react-native';
import { Task } from '../types';
import StatusBadge from './StatusBadge';
import { theme } from '../theme';
import { formatPhoneDisplay } from '../lib/phone';

// ─── Props (unchanged) ────────────────────────────────────────────────────────

interface Props {
  task: Task;
  statusColor: string;
  onPress: () => void;
  onLongPress?: () => void;
  onClientPress?: () => void;
  onCityPress?: (cityId: string) => void;
  onServicePress?: () => void;
  onPin?: () => void;
  allStatusColors?: Record<string, string>;
  cardStyle?: object;
  loading?: boolean;
  error?: boolean;
  selected?: boolean;
  exchangeRate?: number;
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
  onLongPress,
  onClientPress,
  onCityPress,
  onServicePress,
  onPin,
  allStatusColors = {},
  cardStyle,
  loading = false,
  error = false,
  selected = false,
  exchangeRate = 89500,
}: Props) {
  if (loading) return <SkeletonCard cardStyle={cardStyle} />;

  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const dueDays = daysUntil(task.due_date);
  const isDueSoon = task.due_date
    ? Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000) <= 3
    : false;

  const stopsTotal = task.route_stops?.length ?? 0;
  const stopsDone  = task.route_stops?.filter((s) => s.status === 'Done').length ?? 0;
  const allDone    = stopsTotal > 0 && task.route_stops!.every(
    (s) => s.status === 'Done' || s.status === 'Rejected'
  );

  // Financial summary — only computed for archived (allDone) cards
  const txs = task.transactions ?? [];
  const totalRevUSD  = txs.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount_usd, 0);
  const totalExpUSD  = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_usd, 0);
  const totalRevLBP  = txs.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount_lbp, 0);
  const totalExpLBP  = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_lbp, 0);
  const dueUSD       = (task.price_usd ?? 0) - totalRevUSD;
  const dueLBP       = (task.price_lbp ?? 0) - totalRevLBP;
  // C/V USD result: convert every revenue & expense to USD equivalent, then net them
  const cvRate = exchangeRate > 0 ? exchangeRate : 89500;
  const cvRev  = txs.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount_usd + t.amount_lbp / cvRate, 0);
  const cvExp  = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_usd + t.amount_lbp / cvRate, 0);
  const cvResult = cvRev - cvExp;
  const hasFinancials = allDone && (task.price_usd > 0 || task.price_lbp > 0 || txs.length > 0);
  // Show LBP line in DUE chip whenever any LBP amount exists
  const hasLBP = (task.price_lbp ?? 0) > 0 || totalRevLBP > 0 || totalExpLBP > 0;
  const fmtUSD = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmtLBP = (n: number) => `LBP ${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  // Status logic: Done + Rejected are both terminal; show most urgent of remaining
  const nonTerminalStatuses = task.route_stops
    ?.filter((s) => s.status !== 'Done' && s.status !== 'Rejected')
    .map((s) => s.status) ?? [];
  const urgentStatus = nonTerminalStatuses.length > 0
    ? getMostUrgentStatus(nonTerminalStatuses)
    : (stopsTotal > 0 ? 'Done' : task.current_status);

  const displayStatus = (stopsTotal > 0 && !allDone && urgentStatus !== task.current_status)
    ? urgentStatus
    : task.current_status;

  const urgentColor  = allStatusColors[urgentStatus] ?? theme.color.primary;
  const accentColor  = allDone ? theme.color.success : urgentColor;
  const displayColor = allStatusColors[displayStatus] ?? theme.color.primary;

  const handlePhonePress = (phone: string) => {
    const clean = phone.replace(/[^0-9+]/g, '');
    Alert.alert(task.client?.name ?? '', phone, [
      { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
      { text: '💬 WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
      onLongPress={onLongPress}
      delayLongPress={400}
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

      {/* ROW 1: Client name + phone (same line) + reference info below */}
      <View style={styles.row1}>
        <TouchableOpacity
          style={[styles.clientNameCol, { minHeight: theme.touchTarget.min }]}
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
        >
          {/* Client name + client phone on same line */}
          <View style={styles.clientNameRow}>
            <Text
              style={[styles.clientName, onClientPress && styles.clientNameLink]}
              numberOfLines={1}
              suppressHighlighting
            >
              {task.client?.name ?? '—'}
            </Text>
            {!!task.client?.phone && (
              <TouchableOpacity
                onPress={() => handlePhonePress(task.client!.phone!)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                activeOpacity={0.7}
              >
                <Text style={styles.clientPhoneInline} numberOfLines={1}>
                  📞 {formatPhoneDisplay(task.client.phone)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Reference info below — clearly secondary */}
          {!!task.client?.reference_name && (
            <Text style={styles.referenceLabel} numberOfLines={1}>
              عبر {task.client.reference_name}
            </Text>
          )}
          {!!task.client?.reference_phone && (
            <TouchableOpacity
              onPress={() => handlePhonePress(task.client!.reference_phone!)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              activeOpacity={0.7}
            >
              <Text style={styles.phoneLabel} numberOfLines={1}>
                📞 {formatPhoneDisplay(task.client.reference_phone)}
              </Text>
            </TouchableOpacity>
          )}
          {/* Pin / Unpin toggle */}
          {!!onPin && (
            <TouchableOpacity
              onPress={onPin}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.7}
              style={styles.pinToggle}
            >
              <Text style={[styles.pinToggleText, !!task.is_pinned && styles.pinToggleTextActive]}>
                📌 {task.is_pinned ? 'Pinned' : 'Pin'}
              </Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* City chips — unique cities from route stops */}
      {(() => {
        const seen = new Set<string>();
        const stopCities = (task.route_stops ?? []).filter((s) => {
          if (!s.city_id || !s.city?.name) return false;
          if (seen.has(s.city_id)) return false;
          seen.add(s.city_id);
          return true;
        });
        if (!stopCities.length) return null;
        return (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
            {stopCities.map((s) => (
              <TouchableOpacity
                key={s.city_id}
                style={styles.cityChip}
                onPress={() => onCityPress?.(s.city_id!)}
                activeOpacity={onCityPress ? 0.65 : 1}
                disabled={!onCityPress}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.cityChipText} numberOfLines={1}>📍 {s.city!.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      })()}

      {/* ROW 2: Service name + contract price */}
      <View style={styles.row2}>
        <TouchableOpacity
          onPress={onServicePress}
          disabled={!onServicePress}
          activeOpacity={onServicePress ? 0.7 : 1}
          style={{ flex: 1 }}
        >
          <Text style={styles.serviceName} numberOfLines={1}>
            {task.service?.name ?? '—'}
          </Text>
        </TouchableOpacity>
        {(task.price_usd ?? 0) > 0 && (
          <Text
            style={styles.contractPrice}
            accessibilityLabel={`Contract price $${task.price_usd}`}
          >
            ${(task.price_usd!).toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
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
        {task.due_date && !allDone && (
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

      {/* COMPLETION INFO — archived cards: start → end • Xd */}
      {allDone && (() => {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const fmt = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${months[d.getMonth()]}`; };
        const days = Math.max(1, Math.round((Date.parse(task.updated_at) - Date.parse(task.created_at)) / 86400000));
        return (
          <Text style={styles.completionRow}>
            📅 {fmt(task.created_at)} → {fmt(task.updated_at)}  •  {days}d
          </Text>
        );
      })()}

      {/* FINANCIAL SUMMARY — archived cards only */}
      {hasFinancials && (
        <View style={styles.finRow}>
          <View style={styles.finChip}>
            <Text style={styles.finLabel}>RESULT</Text>
            <Text style={[styles.finValue, cvResult >= 0 ? styles.finPos : styles.finNeg]}>
              {cvResult >= 0 ? '+' : '-'}{fmtUSD(cvResult)}
            </Text>
          </View>
          <View style={styles.finDivider} />
          <View style={styles.finChip}>
            <Text style={styles.finLabel}>DUE</Text>
            <Text style={[styles.finValue, dueUSD <= 0 ? styles.finPos : styles.finNeg]}>
              {dueUSD <= 0 ? '✓ ' : ''}{fmtUSD(dueUSD)}
            </Text>
            {hasLBP && (
              <Text style={[styles.finValueSmall, dueLBP <= 0 ? styles.finPos : styles.finNeg]}>
                {dueLBP <= 0 ? '✓ ' : ''}{fmtLBP(dueLBP)}
              </Text>
            )}
          </View>
        </View>
      )}
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
  pinToggle: {
    alignSelf:  'flex-start',
    marginTop:  2,
  },
  pinToggleText: {
    ...theme.typography.caption,
    color: theme.color.textMuted,
  },
  pinToggleTextActive: {
    color: theme.color.primary,
    fontWeight: '600',
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
  clientNameRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            6,
  },
  clientName: {
    ...theme.typography.heading,
    fontSize: 15, // slightly tighter than heading on card
    flex: 1,
  },
  clientNameLink: {
    color: theme.color.primaryText,
  },
  // Client's own phone — inline with the name, subdued
  clientPhoneInline: {
    ...theme.typography.caption,
    color:      theme.color.textSecondary,
    flexShrink: 0,
  },
  referenceLabel: {
    ...theme.typography.caption,
    fontStyle: 'italic',
  },
  // Reference phone — same primary blue as before so it's clearly tappable
  phoneLabel: {
    ...theme.typography.caption,
    color: theme.color.primary,
  },

  cityChip: {
    alignSelf: 'flex-end',
    backgroundColor: theme.color.bgBase,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical: 2,
    marginTop: theme.spacing.space1,
    marginBottom: theme.spacing.space1,
    maxWidth: '60%',
  },
  cityChipText: {
    ...theme.typography.caption,
    color: theme.color.primary,
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
    color: theme.color.warning,
  },
  completionRow: {
    ...theme.typography.caption,
    color: theme.color.warning,
    marginTop: 2,
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

  // Financial summary row (archive only)
  finRow: {
    flexDirection:   'row',
    alignItems:      'stretch',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    overflow:        'hidden',
    marginTop:       2,
  },
  finChip: {
    flex:            1,
    paddingVertical: 5,
    paddingHorizontal: theme.spacing.space2,
    gap:             1,
  },
  finDivider: {
    width:           1,
    backgroundColor: theme.color.border,
  },
  finLabel: {
    ...theme.typography.sectionDivider,
    fontSize:   9,
    letterSpacing: 0.6,
    color:      theme.color.textMuted,
  },
  finValue: {
    fontSize:   12,
    fontWeight: '700',
  },
  finValueSmall: {
    fontSize:   10,
    fontWeight: '600',
  },
  finPos: { color: theme.color.success },
  finNeg: { color: theme.color.danger },

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
