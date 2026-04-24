// src/screens/TeamMembersScreen.tsx
// Team members list + invite flow — navigated from SettingsScreen

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { TeamMember } from '../types';
import { normalizeToEmail } from '../lib/authHelpers';
import { DEFAULT_COUNTRY, SORTED_COUNTRIES } from '../components/PhoneInput';

// Generates a readable 8-char code e.g. "ABCD-1234"
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function TeamMembersScreen() {
  const { teamMember, isAdmin } = useAuth();
  const isOwnerOrAdmin = teamMember?.role === 'owner' || teamMember?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  // Join codes
  const [joinCodes, setJoinCodes] = useState<any[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviteInputType, setInviteInputType] = useState<'email' | 'phone'>('email');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteCountryCode, setInviteCountryCode] = useState(DEFAULT_COUNTRY.code);
  const [inviting, setInviting] = useState(false);

  const fetchData = useCallback(async () => {
    const [tmRes, invRes, codeRes] = await Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase
        .from('invitations')
        .select('id, email, role, expires_at')
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('org_join_codes')
        .select('*')
        .eq('org_id', teamMember?.org_id ?? '')
        .order('created_at', { ascending: false }),
    ]);
    if (tmRes.data)   setTeamMembers(tmRes.data as TeamMember[]);
    if (invRes.data)  setPendingInvites(invRes.data as any[]);
    if (codeRes.data) setJoinCodes(codeRes.data);
    setLoading(false);
  }, [teamMember?.org_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleChangeRole = async (tm: TeamMember, newRole: string) => {
    if (tm.role === newRole) return;
    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', tm.id);
    if (error) { Alert.alert('Error', error.message); return; }
    fetchData();
  };

  const handleGenerateCode = async () => {
    if (!teamMember?.org_id) return;
    setGeneratingCode(true);
    const code = makeCode();
    const { error } = await supabase.from('org_join_codes').insert({
      org_id:     teamMember.org_id,
      code,
      created_by: teamMember.id,
    });
    setGeneratingCode(false);
    if (error) { Alert.alert('Error', error.message); return; }
    fetchData();
  };

  const handleDeactivateCode = (codeId: string, code: string) => {
    Alert.alert('Deactivate Code', `Deactivate code ${code}? Members will no longer be able to use it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => {
        await supabase.from('org_join_codes').update({ is_active: false }).eq('id', codeId);
        fetchData();
      }},
    ]);
  };

  const handleShareCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join our company on GovPilot!\n\nDownload the app and go to My Account → My Company → Join a Company, then enter this code:\n\n${code}\n\nThis code lets you join our team directly.`,
      });
    } catch {}
  };

  const deleteRecord = (table: string, id: string, label: string) => {
    Alert.alert('Delete', `Delete "${label}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        },
      },
    ]);
  };

  const revokeInvite = (inviteId: string, email: string) => {
    Alert.alert('Revoke Invite', `Remove pending invite for ${email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          await supabase.from('invitations').delete().eq('id', inviteId);
          fetchData();
        },
      },
    ]);
  };

  const sendInvite = async () => {
    const trimEmail = normalizeToEmail(inviteEmail.trim());
    if (inviteEmail.trim().length < 4) {
      Alert.alert('Required', 'Enter an email or phone number.');
      return;
    }
    if (!teamMember?.org_id) return;
    setInviting(true);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('invitations')
      .insert({
        org_id:     teamMember.org_id,
        email:      trimEmail,
        role:       inviteRole,
        invited_by: teamMember.id,
        expires_at: expires,
      })
      .select('token')
      .single();
    setInviting(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('member');
    fetchData();
    Alert.alert(
      '✉️ Invite Sent',
      `Invitation created for ${trimEmail}.\n\nAsk them to download the app and register with this email — they will automatically join your organization.`,
      [{ text: 'OK' }]
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
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Invite button in top-right */}
      {isAdmin && (
        <TouchableOpacity style={s.inviteBtn} onPress={() => setShowInviteModal(true)}>
          <Text style={s.inviteBtnText}>+ Invite</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={s.scroll}>

        {/* ── JOIN CODES (owner/admin only) ── */}
        {isOwnerOrAdmin && (
          <View style={s.codesSection}>
            <View style={s.codesSectionHeader}>
              <View>
                <Text style={s.codesSectionTitle}>🔑 Company Join Codes</Text>
                <Text style={s.codesSectionSub}>Share a code with anyone to let them join your company</Text>
              </View>
              <TouchableOpacity
                style={[s.genBtn, generatingCode && { opacity: 0.6 }]}
                onPress={handleGenerateCode}
                disabled={generatingCode}
              >
                {generatingCode
                  ? <ActivityIndicator color={theme.color.white} size="small" />
                  : <Text style={s.genBtnText}>+ New Code</Text>}
              </TouchableOpacity>
            </View>

            {joinCodes.length === 0 && (
              <Text style={s.codesEmpty}>No codes yet. Generate one to share with your team.</Text>
            )}

            {joinCodes.map((jc) => (
              <View key={jc.id} style={[s.codeRow, !jc.is_active && s.codeRowInactive]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.codeText, !jc.is_active && s.codeTextInactive]}>{jc.code}</Text>
                  <Text style={s.codeMeta}>
                    {jc.use_count} use{jc.use_count !== 1 ? 's' : ''} · {jc.is_active ? 'Active' : 'Deactivated'} · {new Date(jc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                {jc.is_active && (
                  <>
                    <TouchableOpacity style={s.shareBtn} onPress={() => handleShareCode(jc.code)}>
                      <Text style={s.shareBtnText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.deactivateBtn} onPress={() => handleDeactivateCode(jc.id, jc.code)}>
                      <Text style={s.deactivateBtnText}>✕</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Section divider */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>TEAM MEMBERS ({teamMembers.length})</Text>
        </View>

        {/* Team members */}
        {teamMembers.map((tm) => {
          const roleBadgeColor =
            tm.role === 'owner'  ? theme.color.primary :
            tm.role === 'admin'  ? theme.color.warning :
            tm.role === 'viewer' ? theme.color.textMuted :
            theme.color.success;
          const isYou = tm.id === teamMember?.id;
          const canEdit = isOwnerOrAdmin && !isYou && tm.role !== 'owner';
          return (
            <View key={tm.id} style={s.memberCard}>
              {/* Top row: avatar + name + delete */}
              <View style={s.memberTop}>
                <View style={[s.avatar, { backgroundColor: roleBadgeColor + '33' }]}>
                  <Text style={[s.avatarText, { color: roleBadgeColor }]}>
                    {tm.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{tm.name}{isYou ? ' (you)' : ''}</Text>
                  <Text style={s.email}>{tm.email}{tm.phone ? ` · ${tm.phone}` : ''}</Text>
                </View>
                {canEdit && (
                  <TouchableOpacity
                    onPress={() => deleteRecord('team_members', tm.id, tm.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ color: theme.color.danger, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Role chips row */}
              <View style={s.roleChipsRow}>
                {tm.role === 'owner' ? (
                  <View style={[s.roleChip, { borderColor: theme.color.primary + '55', backgroundColor: theme.color.primary + '18' }]}>
                    <Text style={[s.roleChipText, { color: theme.color.primary }]}>👑 Owner</Text>
                  </View>
                ) : (
                  (['admin', 'member', 'viewer'] as const).map((r) => {
                    const active = tm.role === r;
                    const chipColor = r === 'admin' ? theme.color.warning : r === 'viewer' ? theme.color.textMuted : theme.color.success;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          s.roleChip,
                          active
                            ? { borderColor: chipColor, backgroundColor: chipColor + '22' }
                            : { borderColor: theme.color.border, backgroundColor: theme.color.bgBase },
                          !canEdit && { opacity: 0.5 },
                        ]}
                        onPress={() => canEdit && handleChangeRole(tm, r)}
                        disabled={!canEdit}
                        activeOpacity={canEdit ? 0.7 : 1}
                      >
                        <Text style={[s.roleChipText, { color: active ? chipColor : theme.color.textMuted }]}>
                          {r === 'admin' ? '🔑 Admin' : r === 'member' ? '👤 Member' : '👁 Viewer'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* Role description */}
              {canEdit && (
                <Text style={s.roleDesc}>
                  {tm.role === 'admin'  ? 'Can manage settings, invite members, view all data' :
                   tm.role === 'member' ? 'Can create and edit files, add stages and documents' :
                   'Limited access — tap a role above to change'}
                </Text>
              )}
            </View>
          );
        })}

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>PENDING INVITES ({pendingInvites.length})</Text>
          </View>
        )}
        {pendingInvites.map((inv) => (
          <View key={inv.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{inv.email}</Text>
              <Text style={s.email}>
                {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => revokeInvite(inv.id, inv.email)}
                style={s.revokeBtn}
              >
                <Text style={s.revokeBtnText}>Revoke</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* ── INVITE MODAL ── */}
      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>✉️ Invite Team Member</Text>
              <Text style={s.sheetDesc}>They will automatically join your organization when they register.</Text>

              {/* Email / Phone tabs */}
              <View style={s.roleRow}>
                <TouchableOpacity
                  style={[s.roleChip, inviteInputType === 'email' && s.roleChipActive]}
                  onPress={() => setInviteInputType('email')}
                >
                  <Text style={[s.roleChipText, inviteInputType === 'email' && s.roleChipTextActive]}>✉️ Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.roleChip, inviteInputType === 'phone' && s.roleChipActive]}
                  onPress={() => setInviteInputType('phone')}
                >
                  <Text style={[s.roleChipText, inviteInputType === 'phone' && s.roleChipTextActive]}>📱 Phone</Text>
                </TouchableOpacity>
              </View>

              {inviteInputType === 'email' ? (
                <TextInput
                  style={s.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="their@email.com"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[s.input, { flex: 0, minWidth: 100, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Text>{SORTED_COUNTRIES.find(c => c.code === inviteCountryCode)?.flag ?? '🇱🇧'}</Text>
                    <Text style={{ color: theme.color.textPrimary, fontWeight: '600' }}>{inviteCountryCode}</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={invitePhone}
                    onChangeText={setInvitePhone}
                    placeholder="70 123 456"
                    placeholderTextColor={theme.color.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              )}

              <Text style={s.fieldLabel}>ROLE</Text>
              <View style={s.roleRow}>
                {(['admin', 'member', 'viewer'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.roleChip, inviteRole === r && s.roleChipActive]}
                    onPress={() => setInviteRole(r)}
                  >
                    <Text style={[s.roleChipText, inviteRole === r && s.roleChipTextActive]}>
                      {r === 'admin' ? '🔑 Admin' : r === 'member' ? '👤 Member' : '👁 Viewer'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.roleDesc}>
                {inviteRole === 'admin'  ? 'Can manage settings, invite members, view all data' :
                 inviteRole === 'member' ? 'Can create and edit files, add stages and documents' :
                 'Read-only access — cannot create or edit any records'}
              </Text>

              <TouchableOpacity style={[s.saveBtn, inviting && { opacity: 0.6 }]} onPress={sendInvite} disabled={inviting}>
                {inviting
                  ? <ActivityIndicator color={theme.color.white} />
                  : <Text style={s.saveBtnText}>Send Invite</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowInviteModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  scroll: { padding: theme.spacing.space4, gap: 2 },

  inviteBtn: {
    alignSelf:       'flex-end',
    marginEnd:       theme.spacing.space4,
    marginTop:       theme.spacing.space3,
    backgroundColor: theme.color.primary,
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:    theme.radius.md,
  },
  inviteBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 14 },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.space3,
    paddingVertical: theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  name:  { ...theme.typography.body, fontWeight: '600' },
  email: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 1 },

  roleBadge: {
    borderWidth: 1, borderRadius: theme.radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },

  // Join codes section
  codesSection: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    padding:         theme.spacing.space4,
    gap:             12,
    borderWidth:     1,
    borderColor:     theme.color.primary + '33',
    marginBottom:    theme.spacing.space3,
  },
  codesSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  codesSectionTitle: { ...theme.typography.body, fontWeight: '700', color: theme.color.textPrimary, fontSize: 15 },
  codesSectionSub:   { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  genBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  genBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  codesEmpty: { ...theme.typography.caption, color: theme.color.textMuted, textAlign: 'center', paddingVertical: 8 },
  codeRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  codeRowInactive: { opacity: 0.45 },
  codeText: {
    fontSize:    17,
    fontWeight:  '800',
    color:       theme.color.primary,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'] as any,
  },
  codeTextInactive: { color: theme.color.textMuted },
  codeMeta: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  shareBtn: {
    backgroundColor: theme.color.primary + '18',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.primary + '44',
  },
  shareBtnText: { color: theme.color.primary, fontWeight: '700', fontSize: 12 },
  deactivateBtn: { padding: 4 },
  deactivateBtnText: { color: theme.color.danger, fontSize: 16, fontWeight: '700' },

  sectionHeader: {
    paddingTop:    theme.spacing.space2,
    paddingBottom: theme.spacing.space2,
  },
  sectionLabel: {
    ...theme.typography.sectionDivider,
    color: theme.color.textMuted,
  },

  // Member card (inline role chips)
  memberCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.border,
    padding:         theme.spacing.space3,
    gap:             10,
    marginBottom:    8,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.space3,
  },
  roleChipsRow: {
    flexDirection: 'row',
    gap:           8,
    flexWrap:      'wrap',
    paddingStart:  4,
  },

  revokeBtn: {
    borderWidth: 1, borderColor: theme.color.danger,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  revokeBtnText: { color: theme.color.danger, fontSize: 12, fontWeight: '600' },

  // Modal shared
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', padding: theme.spacing.space5,
  },
  sheet: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.space5,
    gap: theme.spacing.space3,
  },
  sheetTitle: { ...theme.typography.heading, fontSize: 17, fontWeight: '700' },
  sheetDesc:  { ...theme.typography.caption, color: theme.color.textMuted },

  roleRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  roleChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border,
    backgroundColor: theme.color.bgBase,
  },
  roleChipActive:    { borderColor: theme.color.primary, backgroundColor: theme.color.primary + '18' },
  roleChipText:      { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '600' },
  roleChipTextActive:{ color: theme.color.primary },
  roleDesc:          { ...theme.typography.caption, color: theme.color.textMuted },

  fieldLabel: { ...theme.typography.sectionDivider, color: theme.color.textMuted, marginBottom: 4 },
  input: {
    backgroundColor: theme.color.bgBase,
    borderWidth: 1, borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    color: theme.color.textPrimary,
    fontSize: 15,
  },

  saveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText:   { color: theme.color.white, fontWeight: '700', fontSize: 15 },
  cancelBtn:     { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { color: theme.color.textMuted, fontSize: 14 },
});
