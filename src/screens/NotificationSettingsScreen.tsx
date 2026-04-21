// src/screens/NotificationSettingsScreen.tsx
// Per-user notification preferences: master toggle, type filters, muted members

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { TeamMember } from '../types';

interface NotifPrefs {
  enabled: boolean;
  notify_comments: boolean;
  notify_status_changes: boolean;
  notify_new_files: boolean;
  muted_actor_ids: string[];
}

const DEFAULT_PREFS: NotifPrefs = {
  enabled: true,
  notify_comments: true,
  notify_status_changes: true,
  notify_new_files: true,
  muted_actor_ids: [],
};

export default function NotificationSettingsScreen() {
  const { teamMember } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!teamMember?.id) return;
    setLoading(true);
    try {
      const [prefsRes, membersRes] = await Promise.all([
        supabase
          .from('notification_prefs')
          .select('*')
          .eq('team_member_id', teamMember.id)
          .maybeSingle(),
        supabase
          .from('team_members')
          .select('id, name, role, email')
          .order('name'),
      ]);

      if (prefsRes.data) {
        setPrefs({
          enabled:               prefsRes.data.enabled ?? true,
          notify_comments:       prefsRes.data.notify_comments ?? true,
          notify_status_changes: prefsRes.data.notify_status_changes ?? true,
          notify_new_files:      prefsRes.data.notify_new_files ?? true,
          muted_actor_ids:       prefsRes.data.muted_actor_ids ?? [],
        });
      }
      if (membersRes.data) setMembers(membersRes.data as TeamMember[]);
    } finally {
      setLoading(false);
    }
  }, [teamMember?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const save = async () => {
    if (!teamMember?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_prefs')
        .upsert(
          {
            team_member_id:        teamMember.id,
            enabled:               prefs.enabled,
            notify_comments:       prefs.notify_comments,
            notify_status_changes: prefs.notify_status_changes,
            notify_new_files:      prefs.notify_new_files,
            muted_actor_ids:       prefs.muted_actor_ids,
            updated_at:            new Date().toISOString(),
          },
          { onConflict: 'team_member_id' }
        );
      if (error) Alert.alert('Error', error.message);
      else Alert.alert('Saved', 'Notification preferences updated.');
    } finally {
      setSaving(false);
    }
  };

  const toggleMuted = (memberId: string) => {
    setPrefs((prev) => {
      const isMuted = prev.muted_actor_ids.includes(memberId);
      return {
        ...prev,
        muted_actor_ids: isMuted
          ? prev.muted_actor_ids.filter((id) => id !== memberId)
          : [...prev.muted_actor_ids, memberId],
      };
    });
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  const otherMembers = members.filter((m) => m.id !== teamMember?.id);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Master toggle */}
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>🔔</Text>
              <View>
                <Text style={s.rowTitle}>Enable Notifications</Text>
                <Text style={s.rowSub}>Receive push notifications on this device</Text>
              </View>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={(v) => setPrefs((p) => ({ ...p, enabled: v }))}
              trackColor={{ false: theme.color.border, true: theme.color.primary }}
              thumbColor={theme.color.white}
            />
          </View>
        </View>

        {/* Type filters */}
        <Text style={s.sectionLabel}>NOTIFICATION TYPES</Text>
        <View style={[s.card, !prefs.enabled && s.cardDisabled]}>
          <View style={[s.row, s.rowBorder]}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>💬</Text>
              <View>
                <Text style={s.rowTitle}>Comments &amp; Notes</Text>
                <Text style={s.rowSub}>When team members add comments to files</Text>
              </View>
            </View>
            <Switch
              value={prefs.enabled && prefs.notify_comments}
              onValueChange={(v) => setPrefs((p) => ({ ...p, notify_comments: v }))}
              trackColor={{ false: theme.color.border, true: theme.color.primary }}
              thumbColor={theme.color.white}
              disabled={!prefs.enabled}
            />
          </View>

          <View style={[s.row, s.rowBorder]}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>🔄</Text>
              <View>
                <Text style={s.rowTitle}>Status Changes</Text>
                <Text style={s.rowSub}>When file or stage statuses are updated</Text>
              </View>
            </View>
            <Switch
              value={prefs.enabled && prefs.notify_status_changes}
              onValueChange={(v) => setPrefs((p) => ({ ...p, notify_status_changes: v }))}
              trackColor={{ false: theme.color.border, true: theme.color.primary }}
              thumbColor={theme.color.white}
              disabled={!prefs.enabled}
            />
          </View>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>📁</Text>
              <View>
                <Text style={s.rowTitle}>New Files</Text>
                <Text style={s.rowSub}>When a new client file is created</Text>
              </View>
            </View>
            <Switch
              value={prefs.enabled && prefs.notify_new_files}
              onValueChange={(v) => setPrefs((p) => ({ ...p, notify_new_files: v }))}
              trackColor={{ false: theme.color.border, true: theme.color.primary }}
              thumbColor={theme.color.white}
              disabled={!prefs.enabled}
            />
          </View>
        </View>

        {/* Per-member mute list */}
        <Text style={s.sectionLabel}>RECEIVE FROM</Text>
        <Text style={s.sectionHint}>
          Unchecked members won't trigger notifications for you — even when they post comments or update statuses.
        </Text>
        <View style={[s.card, !prefs.enabled && s.cardDisabled]}>
          {otherMembers.length === 0 ? (
            <View style={s.emptyMembers}>
              <Text style={s.emptyMembersText}>No other team members yet</Text>
            </View>
          ) : (
            otherMembers.map((m, idx) => {
              const isMuted  = prefs.muted_actor_ids.includes(m.id);
              const isLast   = idx === otherMembers.length - 1;
              const roleBadgeColor =
                m.role === 'owner'  ? theme.color.primary :
                m.role === 'admin'  ? theme.color.warning :
                m.role === 'viewer' ? theme.color.textMuted :
                theme.color.success;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[s.memberRow, !isLast && s.rowBorder]}
                  onPress={() => !prefs.enabled ? null : toggleMuted(m.id)}
                  activeOpacity={prefs.enabled ? 0.7 : 1}
                >
                  <View style={[s.memberAvatar, { backgroundColor: isMuted ? theme.color.border : theme.color.primary }]}>
                    <Text style={s.memberAvatarText}>
                      {m.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View style={s.memberInfo}>
                    <Text style={[s.memberName, isMuted && s.mutedText]}>{m.name}</Text>
                    <View style={s.memberMeta}>
                      <View style={[s.roleBadge, { backgroundColor: roleBadgeColor + '22', borderColor: roleBadgeColor + '55' }]}>
                        <Text style={[s.roleBadgeText, { color: roleBadgeColor }]}>{m.role}</Text>
                      </View>
                      {isMuted && <Text style={s.mutedBadge}>Muted</Text>}
                    </View>
                  </View>
                  <View style={[s.checkbox, !isMuted && s.checkboxActive]}>
                    {!isMuted && <Text style={s.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={theme.color.white} />
            : <Text style={s.saveBtnText}>Save Preferences</Text>
          }
        </TouchableOpacity>

        <Text style={s.footnote}>
          Preferences are stored in your account and apply across all devices you sign in to.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  scroll: { padding: theme.spacing.space4, gap: theme.spacing.space3, paddingBottom: 50 },

  sectionLabel: {
    ...theme.typography.sectionDivider,
    color:         theme.color.textMuted,
    marginTop:     theme.spacing.space2,
    marginBottom:  4,
    paddingStart:  4,
  },
  sectionHint: {
    ...theme.typography.caption,
    color:        theme.color.textMuted,
    paddingStart: 4,
    marginBottom: 8,
    lineHeight:   18,
  },

  card: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.border,
    overflow:        'hidden',
  },
  cardDisabled: { opacity: 0.5 },

  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3 + 2,
    gap:               theme.spacing.space3,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,
    gap:           theme.spacing.space3,
  },
  rowIcon:  { fontSize: 22 },
  rowTitle: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600', fontSize: 14 },
  rowSub:   { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },

  memberRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    gap:               theme.spacing.space3,
  },
  memberAvatar: {
    width:           38,
    height:          38,
    borderRadius:    19,
    justifyContent:  'center',
    alignItems:      'center',
  },
  memberAvatarText: { color: theme.color.white, fontSize: 13, fontWeight: '800' },
  memberInfo:       { flex: 1 },
  memberName:       { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '700', fontSize: 14 },
  memberMeta:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  mutedText:        { color: theme.color.textMuted },
  mutedBadge: {
    ...theme.typography.caption,
    color:           theme.color.danger,
    backgroundColor: theme.color.danger + '18',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical:   1,
  },
  roleBadge: {
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical:   1,
    borderWidth:     1,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  checkbox: {
    width:        24,
    height:       24,
    borderRadius: 6,
    borderWidth:  2,
    borderColor:  theme.color.border,
    justifyContent: 'center',
    alignItems:     'center',
  },
  checkboxActive: {
    backgroundColor: theme.color.primary,
    borderColor:     theme.color.primary,
  },
  checkmark: { color: theme.color.white, fontSize: 14, fontWeight: '800' },

  emptyMembers:     { paddingVertical: theme.spacing.space4, alignItems: 'center' },
  emptyMembersText: { ...theme.typography.body, color: theme.color.textMuted },

  saveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 15,
    alignItems:      'center',
    marginTop:       theme.spacing.space2,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: theme.color.white, fontSize: 16, fontWeight: '700' },

  footnote: {
    ...theme.typography.caption,
    color:     theme.color.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
