// src/screens/VisibilitySettingsScreen.tsx
// Owner/Admin only — configure what each role (admin / member / viewer) can see and do
// Session 29: added 'admin' tab (migration_team_overhaul.sql adds admin to CHECK constraint)

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────

type Role = 'admin' | 'member' | 'viewer';

interface RoleSettings {
  // Files
  can_see_all_files:        boolean;
  can_create_files:         boolean;
  can_edit_file_details:    boolean;
  can_delete_files:         boolean;
  // Stages
  can_update_stage_status:  boolean;
  can_add_edit_stages:      boolean;
  // Financial
  can_see_contract_price:   boolean;
  can_see_financial_report: boolean;
  can_add_revenue:          boolean;
  can_add_expenses:         boolean;
  can_edit_contract_price:  boolean;
  can_delete_transactions:  boolean;
  // Documents
  can_upload_documents:     boolean;
  can_delete_documents:     boolean;
  // Clients
  can_manage_clients:       boolean;
  // Activity
  can_add_comments:         boolean;
  can_delete_comments:      boolean;
  // Catalog
  can_manage_catalog:       boolean;
}

const ADMIN_DEFAULTS: RoleSettings = {
  can_see_all_files:        true,
  can_create_files:         true,
  can_edit_file_details:    true,
  can_delete_files:         false,
  can_update_stage_status:  true,
  can_add_edit_stages:      true,
  can_see_contract_price:   true,
  can_see_financial_report: false,
  can_add_revenue:          true,
  can_add_expenses:         true,
  can_edit_contract_price:  false,
  can_delete_transactions:  false,
  can_upload_documents:     true,
  can_delete_documents:     false,
  can_manage_clients:       true,
  can_add_comments:         true,
  can_delete_comments:      false,
  can_manage_catalog:       true,
};

const MEMBER_DEFAULTS: RoleSettings = {
  can_see_all_files:        true,
  can_create_files:         true,
  can_edit_file_details:    true,
  can_delete_files:         false,
  can_update_stage_status:  true,
  can_add_edit_stages:      true,
  can_see_contract_price:   true,
  can_see_financial_report: false,
  can_add_revenue:          true,
  can_add_expenses:         true,
  can_edit_contract_price:  false,
  can_delete_transactions:  false,
  can_upload_documents:     true,
  can_delete_documents:     false,
  can_manage_clients:       true,
  can_add_comments:         true,
  can_delete_comments:      false,
  can_manage_catalog:       false,
};

const VIEWER_DEFAULTS: RoleSettings = {
  can_see_all_files:        false,
  can_create_files:         false,
  can_edit_file_details:    false,
  can_delete_files:         false,
  can_update_stage_status:  true,
  can_add_edit_stages:      false,
  can_see_contract_price:   false,
  can_see_financial_report: false,
  can_add_revenue:          false,
  can_add_expenses:         true,
  can_edit_contract_price:  false,
  can_delete_transactions:  false,
  can_upload_documents:     true,
  can_delete_documents:     false,
  can_manage_clients:       false,
  can_add_comments:         true,
  can_delete_comments:      false,
  can_manage_catalog:       false,
};

// ─── Permission groups definition ────────────────────────────

interface PermissionItem {
  key: keyof RoleSettings;
  label: string;
  description: string;
}
interface PermissionGroup {
  icon: string;
  title: string;
  items: PermissionItem[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    icon: '📁',
    title: 'Files',
    items: [
      { key: 'can_see_all_files',     label: 'See all files',         description: 'OFF = they only see files assigned to them' },
      { key: 'can_create_files',      label: 'Create new files',      description: 'Open new client files' },
      { key: 'can_edit_file_details', label: 'Edit file details',     description: 'Change client, service, notes, due date' },
      { key: 'can_delete_files',      label: 'Delete files',          description: 'Permanently remove a file and all its data' },
    ],
  },
  {
    icon: '📋',
    title: 'Stages',
    items: [
      { key: 'can_update_stage_status', label: 'Update stage status', description: 'Move a stage to Submitted, In Review, Done, etc.' },
      { key: 'can_add_edit_stages',     label: 'Add & edit stages',   description: 'Add, reorder, or remove stages on a file' },
    ],
  },
  {
    icon: '💰',
    title: 'Financial',
    items: [
      { key: 'can_see_contract_price',   label: 'See contract price',      description: 'View the agreed billing price on each file' },
      { key: 'can_see_financial_report', label: 'See financial report',     description: 'Access the full P&L report across all files' },
      { key: 'can_add_revenue',          label: 'Add payments received',    description: 'Log revenue transactions on a file' },
      { key: 'can_add_expenses',         label: 'Add expenses',             description: 'Log expense transactions on a file' },
      { key: 'can_edit_contract_price',  label: 'Edit contract price',      description: 'Change the agreed billing price on a file' },
      { key: 'can_delete_transactions',  label: 'Delete transactions',      description: 'Remove financial entries from a file' },
    ],
  },
  {
    icon: '📄',
    title: 'Documents',
    items: [
      { key: 'can_upload_documents',  label: 'Upload documents', description: 'Scan or attach files to a stage' },
      { key: 'can_delete_documents',  label: 'Delete documents', description: 'Remove uploaded documents from a stage' },
    ],
  },
  {
    icon: '👥',
    title: 'Clients',
    items: [
      { key: 'can_manage_clients', label: 'Add & edit clients', description: 'Create new clients and edit existing client info' },
    ],
  },
  {
    icon: '🗂',
    title: 'Catalog',
    items: [
      { key: 'can_manage_catalog', label: 'Manage services, stages & network', description: 'Add and edit services, stage templates, and network contacts' },
    ],
  },
  {
    icon: '💬',
    title: 'Activity & Comments',
    items: [
      { key: 'can_add_comments',    label: 'Add comments',    description: 'Post comments on files' },
      { key: 'can_delete_comments', label: 'Delete comments', description: 'Remove any comment from a file' },
    ],
  },
];

// ─── Main screen ──────────────────────────────────────────────

export default function VisibilitySettingsScreen() {
  const { teamMember } = useAuth();

  const [activeRole, setActiveRole] = useState<Role>('admin');
  const [settings, setSettings] = useState<Record<Role, RoleSettings>>({
    admin:  { ...ADMIN_DEFAULTS },
    member: { ...MEMBER_DEFAULTS },
    viewer: { ...VIEWER_DEFAULTS },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Load existing settings ──────────────────────────────────
  const loadSettings = useCallback(async () => {
    if (!teamMember?.org_id) return;
    const { data } = await supabase
      .from('org_visibility_settings')
      .select('*')
      .eq('org_id', teamMember.org_id);

    if (data && data.length > 0) {
      const next: Record<Role, RoleSettings> = {
        admin:  { ...ADMIN_DEFAULTS },
        member: { ...MEMBER_DEFAULTS },
        viewer: { ...VIEWER_DEFAULTS },
      };
      for (const row of data) {
        const role = row.role as Role;
        if (role !== 'admin' && role !== 'member' && role !== 'viewer') continue;
        next[role] = {
          can_see_all_files:        row.can_see_all_files,
          can_create_files:         row.can_create_files,
          can_edit_file_details:    row.can_edit_file_details,
          can_delete_files:         row.can_delete_files,
          can_update_stage_status:  row.can_update_stage_status,
          can_add_edit_stages:      row.can_add_edit_stages,
          can_see_contract_price:   row.can_see_contract_price,
          can_see_financial_report: row.can_see_financial_report,
          can_add_revenue:          row.can_add_revenue,
          can_add_expenses:         row.can_add_expenses,
          can_edit_contract_price:  row.can_edit_contract_price,
          can_delete_transactions:  row.can_delete_transactions,
          can_upload_documents:     row.can_upload_documents,
          can_delete_documents:     row.can_delete_documents,
          can_manage_clients:       row.can_manage_clients,
          can_add_comments:         row.can_add_comments,
          can_delete_comments:      row.can_delete_comments,
          can_manage_catalog:       row.can_manage_catalog ?? false,
        };
      }
      setSettings(next);
    }
    setLoading(false);
  }, [teamMember?.org_id]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Toggle a single permission ─────────────────────────────
  const handleToggle = async (key: keyof RoleSettings, value: boolean) => {
    if (!teamMember?.org_id) return;

    // Optimistic update
    setSettings((prev) => ({
      ...prev,
      [activeRole]: { ...prev[activeRole], [key]: value },
    }));

    setSaving(true);
    const payload = {
      org_id:    teamMember.org_id,
      role:      activeRole,
      [key]:     value,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('org_visibility_settings')
      .upsert(payload, { onConflict: 'org_id,role' });

    setSaving(false);
    if (error) {
      // Revert on failure
      setSettings((prev) => ({
        ...prev,
        [activeRole]: { ...prev[activeRole], [key]: !value },
      }));
      Alert.alert('Error', error.message);
    }
  };

  // ── Reset to defaults ──────────────────────────────────────
  const handleReset = () => {
    Alert.alert(
      'Reset to Defaults',
      `Reset all ${activeRole} permissions to their default values?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            if (!teamMember?.org_id) return;
            const defaults = activeRole === 'admin' ? ADMIN_DEFAULTS : activeRole === 'member' ? MEMBER_DEFAULTS : VIEWER_DEFAULTS;
            setSaving(true);
            const { error } = await supabase
              .from('org_visibility_settings')
              .upsert(
                { org_id: teamMember.org_id, role: activeRole, ...defaults, updated_at: new Date().toISOString() },
                { onConflict: 'org_id,role' }
              );
            setSaving(false);
            if (error) { Alert.alert('Error', error.message); return; }
            setSettings((prev) => ({ ...prev, [activeRole]: { ...defaults } }));
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  const current = settings[activeRole];

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Role tab selector */}
      <View style={s.roleTabsRow}>
        {(['admin', 'member', 'viewer'] as Role[]).map((r) => (
          <TouchableOpacity
            key={r}
            style={[s.roleTab, activeRole === r && s.roleTabActive]}
            onPress={() => setActiveRole(r)}
            activeOpacity={0.75}
          >
            <Text style={[s.roleTabText, activeRole === r && s.roleTabTextActive]}>
              {r === 'admin' ? '🛡 Admin' : r === 'member' ? '👤 Member' : '👁 Viewer'}
            </Text>
          </TouchableOpacity>
        ))}
        {saving && <ActivityIndicator color={theme.color.primary} size="small" style={{ marginStart: 'auto' }} />}
      </View>

      {/* Role description */}
      <View style={s.roleDescBanner}>
        <Text style={s.roleDescText}>
          {activeRole === 'admin'
            ? 'Admins can manage team settings and invite new members. Configure their file & financial access here.'
            : activeRole === 'member'
            ? 'Members are regular employees — they can create and work on files.'
            : 'Viewers have limited access — they can only see and update what you allow below.'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {PERMISSION_GROUPS.map((group) => (
          <View key={group.title} style={s.group}>
            <View style={s.groupHeader}>
              <Text style={s.groupIcon}>{group.icon}</Text>
              <Text style={s.groupTitle}>{group.title}</Text>
            </View>

            {group.items.map((item, idx) => (
              <View
                key={item.key}
                style={[
                  s.permRow,
                  idx < group.items.length - 1 && s.permRowDivider,
                ]}
              >
                <View style={s.permInfo}>
                  <Text style={s.permLabel}>{item.label}</Text>
                  <Text style={s.permDesc}>{item.description}</Text>
                </View>
                <Switch
                  value={current[item.key]}
                  onValueChange={(v) => handleToggle(item.key, v)}
                  trackColor={{ false: theme.color.border, true: theme.color.primary + '88' }}
                  thumbColor={current[item.key] ? theme.color.primary : theme.color.textMuted}
                />
              </View>
            ))}
          </View>
        ))}

        {/* Reset button */}
        <TouchableOpacity style={s.resetBtn} onPress={handleReset} activeOpacity={0.75}>
          <Text style={s.resetBtnText}>↺ Reset {activeRole} to defaults</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  scroll: { padding: theme.spacing.space4, gap: 12 },

  // Role tabs
  roleTabsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             8,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  roleTab: {
    flex:             1,
    paddingVertical:  10,
    alignItems:       'center',
    borderRadius:     theme.radius.md,
    borderWidth:      1,
    borderColor:      theme.color.border,
    backgroundColor:  theme.color.bgBase,
  },
  roleTabActive: {
    borderColor:     theme.color.primary,
    backgroundColor: theme.color.primary + '18',
  },
  roleTabText:       { ...theme.typography.body, fontWeight: '600', color: theme.color.textMuted, fontSize: 14 },
  roleTabTextActive: { color: theme.color.primary, fontWeight: '700' },

  // Role description banner
  roleDescBanner: {
    backgroundColor:  theme.color.bgSurface,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  roleDescText: { ...theme.typography.caption, color: theme.color.textSecondary },

  // Permission groups
  group: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.border,
    overflow:        'hidden',
  },
  groupHeader: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:               8,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space2 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    backgroundColor:   theme.color.bgBase,
  },
  groupIcon:  { fontSize: 16 },
  groupTitle: { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '700', textTransform: 'uppercase', fontSize: 11 },

  // Individual permission row
  permRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    gap:               12,
  },
  permRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  permInfo:  { flex: 1, gap: 2 },
  permLabel: { ...theme.typography.body, fontWeight: '600', fontSize: 14 },
  permDesc:  { ...theme.typography.caption, color: theme.color.textMuted },

  // Reset button
  resetBtn: {
    alignSelf:       'center',
    marginTop:        4,
    paddingVertical:  10,
    paddingHorizontal: 20,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.danger + '55',
    backgroundColor: theme.color.danger + '10',
  },
  resetBtnText: { color: theme.color.danger, fontWeight: '600', fontSize: 13 },
});
