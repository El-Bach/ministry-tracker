// src/screens/MemberFileVisibilityScreen.tsx
// Owner/Admin only — toggle which files a specific member can see.
// A blocked file disappears from that member's dashboard instantly.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { SettingsStackParamList } from '../types';

type Route = RouteProp<SettingsStackParamList, 'MemberFileVisibility'>;

export default function MemberFileVisibilityScreen() {
  const { params } = useRoute<Route>();
  const { memberId, memberName, memberRole } = params;
  const { teamMember } = useAuth();

  const [tasks,    setTasks]    = useState<any[]>([]);
  const [blocked,  setBlocked]  = useState<Set<string>>(new Set());
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null); // task id being toggled
  const [search,   setSearch]   = useState('');

  const roleLabel = memberRole === 'admin' ? '🛡 Admin'
    : memberRole === 'member' ? '👤 Member' : '👁 Viewer';

  // ── Load tasks + existing blocks ──────────────────────────────
  const loadData = useCallback(async () => {
    if (!teamMember?.org_id) return;
    setLoading(true);

    const [tasksRes, blocksRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, client:clients(name), service:services(name), current_status')
        .eq('org_id', teamMember.org_id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('file_visibility_blocks')
        .select('task_id')
        .eq('team_member_id', memberId)
        .eq('org_id', teamMember.org_id),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (blocksRes.data) {
      setBlocked(new Set(blocksRes.data.map((b: any) => b.task_id)));
    }
    setLoading(false);
  }, [memberId, teamMember?.org_id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Toggle visibility for a file ──────────────────────────────
  const handleToggle = async (taskId: string, currentlyVisible: boolean) => {
    if (!teamMember?.org_id) return;
    setSaving(taskId);

    if (currentlyVisible) {
      // Block the file — insert into file_visibility_blocks
      await supabase.from('file_visibility_blocks').insert({
        org_id:         teamMember.org_id,
        team_member_id: memberId,
        task_id:        taskId,
        blocked_by:     teamMember.id,
      });
      setBlocked(prev => new Set([...prev, taskId]));
    } else {
      // Unblock — delete from file_visibility_blocks
      await supabase.from('file_visibility_blocks')
        .delete()
        .eq('team_member_id', memberId)
        .eq('task_id', taskId);
      setBlocked(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }

    setSaving(null);
  };

  // ── Filtered list — searches client name and service name ────
  const filtered = tasks.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const clientName  = (t.client?.name  ?? '').toLowerCase();
    const serviceName = (t.service?.name ?? '').toLowerCase();
    return clientName.includes(q) || serviceName.includes(q);
  });

  const hiddenCount = blocked.size;

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Member info banner */}
      <View style={s.banner}>
        <View style={{ flex: 1 }}>
          <Text style={s.bannerName}>{memberName}</Text>
          <Text style={s.bannerRole}>{roleLabel}</Text>
        </View>
        <View style={s.hiddenBadge}>
          <Text style={s.hiddenBadgeText}>
            {hiddenCount === 0 ? 'All visible' : `${hiddenCount} hidden`}
          </Text>
        </View>
      </View>

      {/* Info note */}
      <View style={s.note}>
        <Text style={s.noteText}>
          Toggle OFF to hide a file from {memberName}'s dashboard. Changes take effect immediately.
        </Text>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by client or service name..."
          placeholderTextColor={theme.color.textMuted}
          autoCorrect={false}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="search"
        />
      </View>

      {/* File list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: theme.spacing.space4, gap: 8 }}
        renderItem={({ item }) => {
          const isVisible = !blocked.has(item.id);
          const isSaving  = saving === item.id;
          return (
            <View style={[s.row, !isVisible && s.rowHidden]}>
              <View style={s.rowInfo}>
                <Text style={[s.rowClient, !isVisible && s.rowTextHidden]} numberOfLines={1}>
                  {item.client?.name ?? '—'}
                </Text>
                <Text style={[s.rowService, !isVisible && s.rowTextHidden]} numberOfLines={1}>
                  {item.service?.name ?? '—'}
                </Text>
                <Text style={[s.rowStatus, !isVisible && s.rowTextHidden]}>
                  {item.current_status}
                </Text>
              </View>
              {isSaving ? (
                <ActivityIndicator color={theme.color.primary} size="small" style={{ marginEnd: 4 }} />
              ) : (
                <Switch
                  value={isVisible}
                  onValueChange={() => handleToggle(item.id, isVisible)}
                  trackColor={{ false: theme.color.danger + '55', true: theme.color.primary + '88' }}
                  thumbColor={isVisible ? theme.color.primary : theme.color.danger}
                />
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={s.empty}>
            {search.trim() ? `No files match "${search}"` : 'No files found'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  banner: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    backgroundColor:  theme.color.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  bannerName: { ...theme.typography.body, fontWeight: '700', fontSize: 15 },
  bannerRole: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  hiddenBadge: {
    backgroundColor: theme.color.danger + '18',
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   6,
    borderWidth:     1,
    borderColor:     theme.color.danger + '44',
  },
  hiddenBadgeText: { ...theme.typography.caption, color: theme.color.danger, fontWeight: '700' },

  note: {
    backgroundColor:  theme.color.primary + '10',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  noteText: { ...theme.typography.caption, color: theme.color.textSecondary },

  searchRow: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  searchInput: {
    backgroundColor:   theme.color.bgSurface,
    borderWidth:       1,
    borderColor:       theme.color.border,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   8,
    color:             theme.color.textPrimary,
    fontSize:          14,
  },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.border,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    gap:             12,
  },
  rowHidden: {
    backgroundColor: theme.color.danger + '08',
    borderColor:     theme.color.danger + '33',
  },
  rowInfo:      { flex: 1 },
  rowClient:    { ...theme.typography.body, fontWeight: '600', fontSize: 14 },
  rowService:   { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2 },
  rowStatus:    { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  rowTextHidden:{ color: theme.color.textMuted },

  empty: { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', marginTop: 40 },
});
