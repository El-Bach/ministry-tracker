// src/screens/TeamMembersScreen.tsx
// Team members list + role-specific invite codes — owner/admin only

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { TeamMember } from '../types';

type InviteRole = 'admin' | 'member' | 'viewer';

// Generates a readable 8-char code e.g. "ABCD-2345" (no 0/O/1/I)
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const ROLE_META: Record<InviteRole, { label: string; icon: string; color: string; desc: string }> = {
  admin:  { label: 'Admin',  icon: '🔑', color: theme.color.warning, desc: 'Can manage settings, invite members, view all data' },
  member: { label: 'Member', icon: '👤', color: theme.color.success, desc: 'Can create and edit files, add stages and documents' },
  viewer: { label: 'Viewer', icon: '👁', color: theme.color.textMuted, desc: 'Limited access — view and update stages only' },
};

export default function TeamMembersScreen() {
  const { teamMember } = useAuth();
  const isOwnerOrAdmin = teamMember?.role === 'owner' || teamMember?.role === 'admin';

  const [loading,     setLoading]     = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [joinCodes,   setJoinCodes]   = useState<any[]>([]);

  // Invite code modal
  const [showModal,       setShowModal]       = useState(false);
  const [modalRole,       setModalRole]       = useState<InviteRole>('member');
  const [generating,      setGenerating]      = useState(false);
  const [generatedCode,   setGeneratedCode]   = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const [tmRes, codeRes] = await Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase
        .from('org_join_codes')
        .select('*')
        .eq('org_id', teamMember?.org_id ?? '')
        .order('created_at', { ascending: false }),
    ]);
    if (tmRes.data)   setTeamMembers(tmRes.data as TeamMember[]);
    if (codeRes.data) setJoinCodes(codeRes.data);
    setLoading(false);
  }, [teamMember?.org_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Role change ──────────────────────────────────────────────
  const handleChangeRole = async (tm: TeamMember, newRole: string) => {
    if (tm.role === newRole) return;
    const { error } = await supabase.from('team_members').update({ role: newRole }).eq('id', tm.id);
    if (error) { Alert.alert('Error', error.message); return; }
    fetchData();
  };

  // ── Generate invite code ─────────────────────────────────────
  const handleGenerateCode = async () => {
    if (!teamMember?.org_id) return;
    setGenerating(true);
    const code = makeCode();
    const { error } = await supabase.from('org_join_codes').insert({
      org_id:     teamMember.org_id,
      code,
      role:       modalRole,
      created_by: teamMember.id,
    });
    setGenerating(false);
    if (error) { Alert.alert('Error generating code', error.message); return; }
    setGeneratedCode(code);
    fetchData();
  };

  // ── Share code ───────────────────────────────────────────────
  const handleShare = async (code: string, role: string) => {
    const meta = ROLE_META[role as InviteRole];
    try {
      await Share.share({
        message:
          `You've been invited to join our company on GovPilot as a ${meta?.label ?? role}!\n\n` +
          `Download the app, go to My Account → My Company → Join a Company, and enter this code:\n\n` +
          `${code}\n\n` +
          `This code is for your use only.`,
      });
    } catch {}
  };

  // ── Deactivate code ──────────────────────────────────────────
  const handleDeactivate = (codeId: string, code: string) => {
    Alert.alert(
      'Deactivate Code',
      `Deactivate ${code}? No one will be able to use it after this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: async () => {
          await supabase.from('org_join_codes').update({ is_active: false }).eq('id', codeId);
          fetchData();
        }},
      ]
    );
  };

  // ── Delete member ────────────────────────────────────────────
  const handleDeleteMember = (tm: TeamMember) => {
    Alert.alert('Remove Member', `Remove ${tm.name} from the team? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('team_members').delete().eq('id', tm.id);
        if (error) Alert.alert('Error', error.message);
        else fetchData();
      }},
    ]);
  };

  // ── Close modal + reset ───────────────────────────────────────
  const closeModal = () => {
    setShowModal(false);
    setGeneratedCode(null);
    setModalRole('member');
  };

  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── INVITE CODES (owner/admin only) ─────────────────── */}
        {isOwnerOrAdmin && (
          <View style={s.section}>
            {/* Section header */}
            <View style={s.sectionHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>🔑 Invite Codes</Text>
                <Text style={s.sectionSub}>Each code gives one person access with a specific role</Text>
              </View>
              <TouchableOpacity style={s.newBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
                <Text style={s.newBtnText}>＋ New</Text>
              </TouchableOpacity>
            </View>

            {/* Code list */}
            {joinCodes.length === 0 && (
              <Text style={s.emptyHint}>No invite codes yet. Tap ＋ New to create one.</Text>
            )}
            {joinCodes.map((jc) => {
              const meta = ROLE_META[jc.role as InviteRole] ?? ROLE_META.member;
              return (
                <View key={jc.id} style={[s.codeCard, !jc.is_active && { opacity: 0.45 }]}>
                  {/* Code + role badge */}
                  <View style={s.codeCardTop}>
                    <Text style={[s.codeText, !jc.is_active && { color: theme.color.textMuted }]}>
                      {jc.code}
                    </Text>
                    <View style={[s.rolePill, { borderColor: meta.color + '55', backgroundColor: meta.color + '18' }]}>
                      <Text style={[s.rolePillText, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
                    </View>
                  </View>
                  {/* Meta + actions */}
                  <View style={s.codeCardBottom}>
                    <Text style={s.codeMeta}>
                      {jc.use_count} use{jc.use_count !== 1 ? 's' : ''} · {jc.is_active ? 'Active' : 'Deactivated'} · {new Date(jc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                    {jc.is_active && (
                      <View style={s.codeActions}>
                        <TouchableOpacity style={s.shareBtn} onPress={() => handleShare(jc.code, jc.role)} activeOpacity={0.75}>
                          <Text style={s.shareBtnText}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeactivate(jc.id, jc.code)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={{ color: theme.color.danger, fontSize: 16, fontWeight: '700' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── TEAM MEMBERS ────────────────────────────────────── */}
        <View style={s.sectionDivider}>
          <Text style={s.sectionDividerText}>TEAM MEMBERS ({teamMembers.length})</Text>
        </View>

        {teamMembers.map((tm) => {
          const isYou    = tm.id === teamMember?.id;
          const canEdit  = isOwnerOrAdmin && !isYou && tm.role !== 'owner';
          const myColor  =
            tm.role === 'owner'  ? theme.color.primary :
            tm.role === 'admin'  ? theme.color.warning :
            tm.role === 'viewer' ? theme.color.textMuted :
            theme.color.success;

          return (
            <View key={tm.id} style={s.memberCard}>
              {/* Top: avatar + name/email + delete */}
              <View style={s.memberTop}>
                <View style={[s.avatar, { backgroundColor: myColor + '22' }]}>
                  <Text style={[s.avatarText, { color: myColor }]}>
                    {(tm.name ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={s.memberInfo}>
                  <Text style={s.memberName} numberOfLines={1}>
                    {tm.name}{isYou ? ' (you)' : ''}
                  </Text>
                  <Text style={s.memberEmail} numberOfLines={1}>
                    {tm.email}{tm.phone ? ` · ${tm.phone}` : ''}
                  </Text>
                </View>
                {canEdit && (
                  <TouchableOpacity
                    onPress={() => handleDeleteMember(tm)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={s.deleteBtn}
                  >
                    <Text style={s.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Role chips */}
              {tm.role === 'owner' ? (
                <View style={s.ownerChip}>
                  <Text style={s.ownerChipText}>👑 Owner</Text>
                </View>
              ) : (
                <View style={s.chipRow}>
                  {(['admin', 'member', 'viewer'] as InviteRole[]).map((r) => {
                    const active = tm.role === r;
                    const meta   = ROLE_META[r];
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          s.chip,
                          active
                            ? { borderColor: meta.color, backgroundColor: meta.color + '20' }
                            : { borderColor: theme.color.border, backgroundColor: theme.color.bgBase },
                        ]}
                        onPress={() => canEdit && handleChangeRole(tm, r)}
                        disabled={!canEdit}
                        activeOpacity={canEdit ? 0.7 : 1}
                      >
                        <Text style={[s.chipText, { color: active ? meta.color : theme.color.textMuted }]}>
                          {meta.icon} {meta.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Role description */}
              {canEdit && (
                <Text style={s.roleDesc}>
                  {ROLE_META[tm.role as InviteRole]?.desc ?? ''}
                </Text>
              )}
            </View>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── INVITE CODE MODAL ────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>

            {/* ── Step 2: code generated ── */}
            {generatedCode ? (
              <>
                <Text style={s.modalTitle}>✅ Invite Code Ready</Text>
                <Text style={s.modalSub}>Share this code with the person you want to invite. They enter it in My Account → Join a Company.</Text>

                <View style={s.codeDisplay}>
                  <Text style={s.codeDisplayText}>{generatedCode}</Text>
                  <View style={[s.rolePill, { borderColor: ROLE_META[modalRole].color + '55', backgroundColor: ROLE_META[modalRole].color + '18', alignSelf: 'center' }]}>
                    <Text style={[s.rolePillText, { color: ROLE_META[modalRole].color }]}>
                      {ROLE_META[modalRole].icon} {ROLE_META[modalRole].label}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={s.shareFullBtn}
                  onPress={() => handleShare(generatedCode, modalRole)}
                  activeOpacity={0.8}
                >
                  <Text style={s.shareFullBtnText}>📤 Share Code</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.doneBtn} onPress={closeModal}>
                  <Text style={s.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ── Step 1: pick role ── */
              <>
                <Text style={s.modalTitle}>New Invite Code</Text>
                <Text style={s.modalSub}>Choose the role this person will have when they join.</Text>

                {(['admin', 'member', 'viewer'] as InviteRole[]).map((r) => {
                  const meta   = ROLE_META[r];
                  const active = modalRole === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[s.roleOption, active && { borderColor: meta.color, backgroundColor: meta.color + '12' }]}
                      onPress={() => setModalRole(r)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.roleOptionLabel, active && { color: meta.color }]}>
                          {meta.icon} {meta.label}
                        </Text>
                        <Text style={s.roleOptionDesc}>{meta.desc}</Text>
                      </View>
                      <View style={[s.radioOuter, active && { borderColor: meta.color }]}>
                        {active && <View style={[s.radioInner, { backgroundColor: meta.color }]} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[s.generateBtn, generating && { opacity: 0.6 }]}
                  onPress={handleGenerateCode}
                  disabled={generating}
                  activeOpacity={0.8}
                >
                  {generating
                    ? <ActivityIndicator color={theme.color.white} />
                    : <Text style={s.generateBtnText}>Generate Code</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.doneBtn} onPress={closeModal}>
                  <Text style={s.doneBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  scroll: { padding: theme.spacing.space4, gap: 12 },

  // ── Invite codes section ─────────────────────────────────────
  section: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    borderWidth:     1,
    borderColor:     theme.color.primary + '30',
    padding:         theme.spacing.space4,
    gap:             12,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sectionTitle: { ...theme.typography.body, fontWeight: '700', fontSize: 15 },
  sectionSub:   { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  newBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  newBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 14 },
  emptyHint:  { ...theme.typography.caption, color: theme.color.textMuted, textAlign: 'center', paddingVertical: 8 },

  // Code card
  codeCard: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    padding:         theme.spacing.space3,
    gap:             8,
  },
  codeCardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  codeCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeText: {
    fontSize:      18,
    fontWeight:    '800',
    color:         theme.color.primary,
    letterSpacing: 1.5,
    fontVariant:   ['tabular-nums'] as any,
  },
  codeMeta:    { ...theme.typography.caption, color: theme.color.textMuted },
  codeActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareBtn: {
    backgroundColor: theme.color.primary + '15',
    borderRadius:    theme.radius.sm,
    borderWidth:     1,
    borderColor:     theme.color.primary + '40',
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  shareBtnText: { color: theme.color.primary, fontWeight: '700', fontSize: 12 },

  rolePill: {
    borderWidth:     1,
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  rolePillText: { fontSize: 12, fontWeight: '700' },

  // ── Section divider ──────────────────────────────────────────
  sectionDivider: { paddingVertical: 4 },
  sectionDividerText: { ...theme.typography.sectionDivider, color: theme.color.textMuted },

  // ── Member card ──────────────────────────────────────────────
  memberCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.border,
    padding:         theme.spacing.space3,
    gap:             10,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  avatar: {
    width: 42, height: 42,
    borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 17, fontWeight: '700' },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName:  { ...theme.typography.body, fontWeight: '600', fontSize: 15 },
  memberEmail: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 1 },
  deleteBtn:   { paddingStart: 4, flexShrink: 0 },
  deleteBtnText: { color: theme.color.danger, fontSize: 16, fontWeight: '700' },

  // Role chips (3 equal-width chips in a row)
  chipRow: {
    flexDirection: 'row',
    gap:           6,
  },
  chip: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 7,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
  },
  chipText: { fontSize: 12, fontWeight: '700' },

  ownerChip: {
    alignSelf:       'flex-start',
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    backgroundColor: theme.color.primary + '18',
    borderRadius:    theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  ownerChipText: { color: theme.color.primary, fontWeight: '700', fontSize: 13 },
  roleDesc:      { ...theme.typography.caption, color: theme.color.textMuted, paddingStart: 2 },

  // ── Modal ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding:  theme.spacing.space5,
    gap:      theme.spacing.space3,
    paddingBottom: 36,
  },
  modalTitle: { ...theme.typography.heading, fontWeight: '700', fontSize: 18 },
  modalSub:   { ...theme.typography.caption, color: theme.color.textSecondary },

  // Role option rows (step 1)
  roleOption: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:               12,
    borderWidth:       1,
    borderColor:       theme.color.border,
    borderRadius:      theme.radius.md,
    padding:           theme.spacing.space3,
    backgroundColor:   theme.color.bgBase,
  },
  roleOptionLabel: { ...theme.typography.body, fontWeight: '700', fontSize: 15 },
  roleOptionDesc:  { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  radioOuter: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.color.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  generateBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       4,
  },
  generateBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 16 },

  // Code display (step 2)
  codeDisplay: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.primary + '40',
    padding:         theme.spacing.space4,
    alignItems:      'center',
    gap:             10,
  },
  codeDisplayText: {
    fontSize:      28,
    fontWeight:    '900',
    color:         theme.color.primary,
    letterSpacing: 3,
    fontVariant:   ['tabular-nums'] as any,
  },

  shareFullBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: 14,
    alignItems:      'center',
  },
  shareFullBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 16 },

  doneBtn:     { alignItems: 'center', paddingVertical: 10 },
  doneBtnText: { color: theme.color.textMuted, fontSize: 15, fontWeight: '600' },
});
