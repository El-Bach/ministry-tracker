// src/screens/ActivityScreen.tsx
// Recent activity feed: status updates + comments across all org files

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { DashboardStackParamList } from '../types';

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

interface ActivityItem {
  id: string;
  type: 'status' | 'comment' | 'assignment';
  created_at: string;
  task_id: string;
  client_name?: string;
  service_name?: string;
  actor_name?: string;
  old_status?: string;
  new_status?: string;
  comment_body?: string;
  status_color?: string;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function ActivityScreen() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const [statusRes, commentRes] = await Promise.all([
        supabase
          .from('status_updates')
          .select(`
            id, created_at, old_status, new_status, task_id,
            task:tasks(client:clients(name), service:services(name)),
            updater:team_members(name)
          `)
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('task_comments')
          .select(`
            id, created_at, body, task_id,
            task:tasks(client:clients(name), service:services(name)),
            author:team_members(name)
          `)
          .order('created_at', { ascending: false })
          .limit(80),
      ]);

      const statusItems: ActivityItem[] = (statusRes.data ?? []).map((r: any) => ({
        id: `s_${r.id}`,
        type: 'status',
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
        type: 'comment',
        created_at: r.created_at,
        task_id: r.task_id,
        client_name: r.task?.client?.name,
        service_name: r.task?.service?.name,
        actor_name: r.author?.name,
        comment_body: r.body,
      }));

      // Merge and sort all items by date
      const all = [...statusItems, ...commentItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setItems(all.slice(0, 100));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchActivity();
  }, [fetchActivity]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivity();
  };

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const isStatus = item.type === 'status';
    const isComment = item.type === 'comment';
    const icon = isStatus ? '🔄' : isComment ? '💬' : '👤';

    return (
      <TouchableOpacity
        style={s.item}
        onPress={() => item.task_id && navigation.navigate('TaskDetail', { taskId: item.task_id })}
        activeOpacity={0.7}
      >
        {/* Icon stripe */}
        <View style={[s.iconCol, isComment && { backgroundColor: theme.color.infoDim ?? theme.color.bgSurface }]}>
          <Text style={s.icon}>{icon}</Text>
        </View>

        <View style={s.body}>
          {/* Client + service */}
          <View style={s.topRow}>
            <Text style={s.clientText} numberOfLines={1}>
              {item.client_name ?? 'Unknown'}
            </Text>
            {item.service_name ? (
              <Text style={s.serviceText} numberOfLines={1}> · {item.service_name}</Text>
            ) : null}
          </View>

          {/* Event description */}
          {isStatus && (
            <Text style={s.desc}>
              <Text style={s.actor}>{item.actor_name ?? 'Someone'}</Text>
              {' changed status'}
              {item.old_status ? ` from ${item.old_status}` : ''}
              {' → '}
              <Text style={[s.newStatus]}>{item.new_status}</Text>
            </Text>
          )}
          {isComment && (
            <Text style={s.desc} numberOfLines={2}>
              <Text style={s.actor}>{item.actor_name ?? 'Someone'}</Text>
              {': '}
              {item.comment_body}
            </Text>
          )}

          <Text style={s.time}>{timeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={s.title}>Activity</Text>
        <Text style={s.subtitle}>{items.length} events</Text>
      </View>

      {items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No activity yet</Text>
          <Text style={s.emptySubtext}>Status changes and comments will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.primary} />
          }
          showsVerticalScrollIndicator={false}
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
  list:        { paddingTop: theme.spacing.space2 },
  item: {
    flexDirection:  'row',
    backgroundColor: theme.color.bgSurface,
    marginHorizontal: theme.spacing.space4,
    marginBottom:   theme.spacing.space2,
    borderRadius:   theme.radius.lg,
    borderWidth:    1,
    borderColor:    theme.color.border,
    overflow:       'hidden',
  },
  iconCol: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgBase,
    paddingVertical: theme.spacing.space3,
  },
  icon:  { fontSize: 18 },
  body:  { flex: 1, padding: theme.spacing.space3, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  clientText:  { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  serviceText: { ...theme.typography.caption, color: theme.color.textMuted, flexShrink: 1 },
  desc:        { ...theme.typography.body, color: theme.color.textSecondary, fontSize: 13 },
  actor:       { fontWeight: '700', color: theme.color.textPrimary },
  newStatus:   { fontWeight: '700', color: theme.color.primary },
  time:        { ...theme.typography.caption, color: theme.color.textMuted },
  emptyText:    { ...theme.typography.body, color: theme.color.textMuted, fontWeight: '700' },
  emptySubtext: { ...theme.typography.caption, color: theme.color.border, textAlign: 'center', marginHorizontal: 40 },
});
