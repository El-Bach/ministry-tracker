// src/screens/ActivityScreen.tsx
// Recent activity feed: status updates + comments + deletions, grouped by day

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { DashboardStackParamList } from '../types';
import { useAuth } from '../hooks/useAuth';

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface ActivityItem {
  id: string;
  type: 'status' | 'comment' | 'deleted' | 'other';
  created_at: string;
  task_id?: string;
  client_name?: string;
  service_name?: string;
  actor_name?: string;
  old_status?: string;
  new_status?: string;
  comment_body?: string;
}

interface DaySection {
  title: string;        // e.g. "Today", "Yesterday", "Mon 21 Apr"
  dayIndex: number;     // for rotating color
  data: ActivityItem[];
}

// Rotating background colors for day headers
const DAY_COLORS = [
  '#6366f122', // indigo
  '#10b98122', // teal
  '#f59e0b22', // amber
  '#ec489922', // pink
  '#3b82f622', // blue
  '#8b5cf622', // violet
  '#14b8a622', // cyan
];

const DAY_BORDER_COLORS = [
  '#6366f144',
  '#10b98144',
  '#f59e0b44',
  '#ec489944',
  '#3b82f644',
  '#8b5cf644',
  '#14b8a644',
];

function formatDay(iso: string, lang: string, todayLabel: string, yesterdayLabel: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - itemDay.getTime()) / 86400000);
  if (diff === 0) return todayLabel;
  if (diff === 1) return yesterdayLabel;
  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-FR' : 'en-GB';
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso: string, lang: string): string {
  const locale = lang === 'ar' ? 'ar-LB' : lang === 'fr' ? 'fr-FR' : 'en-GB';
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ActivityScreen() {
  const navigation = useNavigation<Nav>();
  const { t, lang } = useTranslation();
  const { teamMember, permissions } = useAuth();
  const [sections, setSections] = useState<DaySection[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async () => {
    const orgId = teamMember?.org_id;
    if (!orgId) {
      setSections([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    try {
      const [statusRes, commentRes, logRes] = await Promise.all([
        supabase
          .from('status_updates')
          .select(`
            id, created_at, old_status, new_status, task_id,
            task:tasks!inner(org_id, client:clients(name), service:services(name)),
            updater:team_members(name)
          `)
          .eq('task.org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('task_comments')
          .select(`
            id, created_at, body, task_id,
            task:tasks!inner(org_id, client:clients(name), service:services(name)),
            author:team_members(name)
          `)
          .eq('task.org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('activity_log')
          .select('id, created_at, event_type, client_name, service_name, actor_name, description')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const statusItems: ActivityItem[] = (statusRes.data ?? []).map((r: any) => ({
        id: `s_${r.id}`,
        type: 'status' as const,
        created_at: r.created_at,
        task_id: r.task_id,
        client_name: r.task?.client?.name,
        service_name: r.task?.service?.name,
        actor_name: r.updater?.name,
        old_status: r.old_status,
        new_status: r.new_status,
      }));

      const commentItems: ActivityItem[] = (commentRes.data ?? []).map((r: any) => ({
        id: `c_${r.id}`,
        type: 'comment' as const,
        created_at: r.created_at,
        task_id: r.task_id,
        client_name: r.task?.client?.name,
        service_name: r.task?.service?.name,
        actor_name: r.author?.name,
        comment_body: r.body,
      }));

      const logItems: ActivityItem[] = (logRes.data ?? []).map((r: any) => ({
        id: `l_${r.id}`,
        type: 'deleted' as const,
        created_at: r.created_at,
        client_name: r.client_name,
        service_name: r.service_name,
        actor_name: r.actor_name,
        comment_body: r.description,
      }));

      // ── Task visibility filter ──────────────────────────────────────────────
      // Build blocked IDs and optional allowlist, same logic as DashboardScreen
      const blocksRes = teamMember?.id
        ? await supabase.from('file_visibility_blocks').select('task_id').eq('team_member_id', teamMember.id)
        : { data: [] };
      const blockedIds = new Set<string>((blocksRes.data ?? []).map((b: any) => b.task_id as string));

      let allowedTaskIds: Set<string> | null = null;
      if (!permissions.can_see_all_files && teamMember?.id) {
        const [atRes, asRes] = await Promise.all([
          supabase.from('tasks').select('id').eq('assigned_to', teamMember.id),
          supabase.from('task_route_stops').select('task_id').eq('assigned_to', teamMember.id),
        ]);
        allowedTaskIds = new Set<string>();
        (atRes.data ?? []).forEach((t: any) => allowedTaskIds!.add(t.id as string));
        (asRes.data ?? []).forEach((s: any) => allowedTaskIds!.add(s.task_id as string));
        for (const id of blockedIds) allowedTaskIds.delete(id);
      }

      const isTaskVisible = (taskId?: string): boolean => {
        if (!taskId) return true; // no task_id = deletion log — always show
        if (blockedIds.has(taskId)) return false;
        if (allowedTaskIds !== null && !allowedTaskIds.has(taskId)) return false;
        return true;
      };

      // Filter status + comment items by task visibility
      const visibleStatusItems  = statusItems.filter((i) => isTaskVisible(i.task_id));
      const visibleCommentItems = commentItems.filter((i) => isTaskVisible(i.task_id));

      // Merge and sort
      const all = [...visibleStatusItems, ...visibleCommentItems, ...logItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 150);

      setTotalCount(all.length);

      // Group by day
      const dayMap = new Map<string, ActivityItem[]>();
      for (const item of all) {
        const key = dayKey(item.created_at);
        if (!dayMap.has(key)) dayMap.set(key, []);
        dayMap.get(key)!.push(item);
      }

      let dayIndex = 0;
      const sects: DaySection[] = [];
      for (const [, items] of dayMap) {
        sects.push({
          title: formatDay(items[0].created_at, lang, t('today'), t('yesterday')),
          dayIndex: dayIndex % DAY_COLORS.length,
          data: items,
        });
        dayIndex++;
      }

      setSections(sects);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [permissions, teamMember]);

  useFocusEffect(useCallback(() => { fetchActivity(); }, [fetchActivity]));

  const onRefresh = () => { setRefreshing(true); fetchActivity(); };

  const renderItem = ({ item, section }: { item: ActivityItem; section: DaySection }) => {
    const isStatus  = item.type === 'status';
    const isComment = item.type === 'comment';
    const isDeleted = item.type === 'deleted';

    const icon  = isStatus ? '🔄' : isComment ? '💬' : isDeleted ? '🗑' : '📋';
    const color = isDeleted
      ? theme.color.danger
      : isStatus
        ? theme.color.primary
        : theme.color.textSecondary;

    return (
      <TouchableOpacity
        style={s.item}
        onPress={() => item.task_id
          ? navigation.navigate('TaskDetail', { taskId: item.task_id })
          : undefined}
        activeOpacity={item.task_id ? 0.7 : 1}
      >
        {/* Icon stripe */}
        <View style={[s.iconCol, { backgroundColor: color + '18' }]}>
          <Text style={s.icon}>{icon}</Text>
        </View>

        <View style={s.body}>
          {/* Client + service */}
          <View style={s.topRow}>
            <Text style={s.clientText} numberOfLines={1}>
              {item.client_name ?? t('unknown')}
            </Text>
            {item.service_name ? (
              <Text style={s.serviceText} numberOfLines={1}> · {item.service_name}</Text>
            ) : null}
          </View>

          {/* Event description */}
          {isStatus && (
            <Text style={s.desc}>
              <Text style={s.actor}>{item.actor_name ?? t('someone')}</Text>
              {' '}{t('changedStatus')}
              {item.old_status ? ` ${t('fromStatus')} ${item.old_status}` : ''}
              {' → '}
              <Text style={[s.newStatus, { color }]}>{item.new_status}</Text>
            </Text>
          )}
          {isComment && (
            <Text style={s.desc} numberOfLines={2}>
              <Text style={s.actor}>{item.actor_name ?? t('someone')}</Text>
              {': '}
              {item.comment_body}
            </Text>
          )}
          {isDeleted && (
            <Text style={[s.desc, { color: theme.color.danger }]} numberOfLines={2}>
              <Text style={[s.actor, { color: theme.color.danger }]}>{item.actor_name ?? t('someone')}</Text>
              {' '}{t('deletedThisFile')}
            </Text>
          )}

          <Text style={s.time}>{formatTime(item.created_at, lang)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: DaySection }) => (
    <View style={[
      s.dayHeader,
      {
        backgroundColor: DAY_COLORS[section.dayIndex],
        borderColor: DAY_BORDER_COLORS[section.dayIndex],
      }
    ]}>
      <Text style={s.dayHeaderText}>{section.title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.title}>{t('activity')}</Text>
        <Text style={s.subtitle}>{totalCount} events</Text>
      </View>

      {sections.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No activity yet</Text>
          <Text style={s.emptySubtext}>Status changes, comments, and deletions will appear here</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.primary} />
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase, gap: 8 },
  header: {
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space4,
    paddingBottom:     theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
    flexDirection:     'row',
    alignItems:        'baseline',
    gap:               10,
  },
  title:       { ...theme.typography.heading, fontSize: 24, fontWeight: '800' },
  subtitle:    { ...theme.typography.body, color: theme.color.textMuted, fontWeight: '600' },
  list:        { paddingTop: theme.spacing.space2, paddingBottom: 32 },

  dayHeader: {
    marginHorizontal: theme.spacing.space4,
    marginTop: theme.spacing.space3,
    marginBottom: theme.spacing.space2,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  dayHeaderText: {
    ...theme.typography.label,
    fontWeight: '800',
    fontSize: 11,
    color: theme.color.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  item: {
    flexDirection:    'row',
    backgroundColor:  theme.color.bgSurface,
    marginHorizontal: theme.spacing.space4,
    marginBottom:     theme.spacing.space2,
    borderRadius:     theme.radius.lg,
    borderWidth:      1,
    borderColor:      theme.color.border,
    overflow:         'hidden',
  },
  iconCol: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.space3,
  },
  icon:  { fontSize: 18 },
  body:  { flex: 1, padding: theme.spacing.space3, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  clientText:  { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  serviceText: { ...theme.typography.caption, color: theme.color.textMuted, flexShrink: 1 },
  desc:        { ...theme.typography.body, color: theme.color.textSecondary, fontSize: 13 },
  actor:       { fontWeight: '700', color: theme.color.textPrimary },
  newStatus:   { fontWeight: '700' },
  time:        { ...theme.typography.caption, color: theme.color.textMuted },
  emptyText:    { ...theme.typography.body, color: theme.color.textMuted, fontWeight: '700' },
  emptySubtext: { ...theme.typography.caption, color: theme.color.border, textAlign: 'center', marginHorizontal: 40 },
});
