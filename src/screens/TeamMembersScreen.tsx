// src/screens/TeamMembersScreen.tsx
// Team members list + invite code management
// Session 29 overhaul:
//   - Soft-delete members (grey card) → swipe-left to permanently remove
//   - Owner row: never deletable
//   - Invite codes: name + phone fields, show created_at, soft-delete
//   - Revoking a code also soft-deletes the linked member
//   - Updated share message

import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as Crypto from 'expo-crypto';
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
  TextInput,
  Animated,
  PanResponder,
  Platform,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { TeamMember } from '../types';
import PhoneInput, { DEFAULT_COUNTRY } from '../components/PhoneInput';
import { normalizePhone } from '../lib/authHelpers';

type InviteRole = 'admin' | 'member' | 'viewer';

async function makeCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = await Crypto.getRandomBytesAsync(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const ROLE_META: Record<InviteRole, { label: string; icon: string; color: string; desc: string }> = {
  admin:  { label: 'Admin',  icon: '🔑', color: theme.color.warning,   desc: 'Can manage settings, invite members, view all data' },
  member: { label: 'Member', icon: '👤', color: theme.color.success,   desc: 'Can create and edit files, add stages and documents' },
  viewer: { label: 'Viewer', icon: '👁', color: theme.color.textMuted, desc: 'Limited access — view and update stages only' },
};

const SWIPE_WIDTH = 100;

// ── Swipeable member row (soft-deleted only) ───────────────────
function SwipeableMemberRow({
  children,
  onPermanentDelete,
}: {
  children: React.ReactNode;
  onPermanentDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -SWIPE_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_WIDTH / 2) {
          Animated.spring(translateX, { toValue: -SWIPE_WIDTH, useNativeDriver: true }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const opacity = translateX.interpolate({
    inputRange: [-SWIPE_WIDTH, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ overflow: 'hidden', borderRadius: theme.radius.lg, marginBottom: 10 }}>
      {/* Delete action behind */}
      <Animated.View style={[s.permDeleteAction, { opacity }]}>
        <TouchableOpacity style={s.permDeleteBtn} onPress={onPermanentDelete} activeOpacity={0.8}>
          <Text style={s.permDeleteText}>🗑 Remove{'\n'}Permanently</Text>
        </TouchableOpacity>
      </Animated.View>
      {/* Card on top */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TeamMembersScreen() {
  const { teamMember } = useAuth();
  const isOwnerOrAdmin = teamMember?.role === 'owner' || teamMember?.role === 'admin';

  const [loading,     setLoading]     = useState(true);
  const [teamMembers, setTeamMembers] = useState<(TeamMember & { deleted_at?: string | null; joined_via_code?: string | null })[]>([]);
  const [joinCodes,   setJoinCodes]   = useState<any[]>([]);

  // Invite code modal
  const [showModal,     setShowModal]     = useState(false);
  const [modalRole,     setModalRole]     = useState<InviteRole>('member');
  const [inviteeName,   setInviteeName]   = useState('');
  const [inviteePhone,  setInviteePhone]  = useState('');
  const [inviteeCountry,setInviteeCountry]= useState(DEFAULT_COUNTRY.code);
  const [inviteeEmail,  setInviteeEmail]  = useState('');
  const [generating,    setGenerating]    = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedCode,    setCopiedCode]    = useState<string | null>(null);

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
    if (tmRes.data)   setTeamMembers(tmRes.data as any[]);
    if (codeRes.data) setJoinCodes(codeRes.data);
    setLoading(false);
  }, [teamMember?.org_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Role change (owner only, with confirmation) ──────────────
  const handleChangeRole = (tm: TeamMember, newRole: string) => {
    if (tm.role === newRole) return;
    const meta = ROLE_META[newRole as InviteRole];
    Alert.alert(
      'Change Role',
      `Change ${tm.name}'s role from ${tm.role} to ${meta?.label ?? newRole}?\n\n${meta?.desc ?? ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          const { error } = await supabase.from('team_members').update({ role: newRole }).eq('id', tm.id);
          if (error) { Alert.alert('Error', error.message); return; }
          fetchData();
        }},
      ]
    );
  };

  // ── Soft-delete member ───────────────────────────────────────
  const handleSoftDelete = (tm: TeamMember) => {
    Alert.alert(
      'Stop Access',
      `Stop ${tm.name} from using the app? Their data is kept. You can permanently remove them after.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop Access', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('team_members')
            .update({ deleted_at: new Date().toISOString(), deleted_by: teamMember?.id })
            .eq('id', tm.id);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        }},
      ]
    );
  };

  // ── Permanent delete (already soft-deleted) ──────────────────
  const handlePermanentDelete = (tm: TeamMember) => {
    Alert.alert(
      '⚠️ Permanently Remove',
      `Remove ${tm.name} completely? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove Forever', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('team_members').delete().eq('id', tm.id);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        }},
      ]
    );
  };

  // ── Generate invite code ─────────────────────────────────────
  const handleGenerateCode = async () => {
    if (!teamMember?.org_id) return;
    setGenerating(true);
    const code = await makeCode();
    const fullPhone = inviteePhone.trim()
      ? normalizePhone(`${inviteeCountry}${inviteePhone.trim()}`)
      : null;
    const { error } = await supabase.from('org_join_codes').insert({
      org_id:        teamMember.org_id,
      code,
      role:          modalRole,
      created_by:    teamMember.id,
      invitee_name:  inviteeName.trim() || null,
      invitee_phone: fullPhone,
      invitee_email: inviteeEmail.trim().toLowerCase() || null,
    });
    setGenerating(false);
    if (error) { Alert.alert('Error generating code', error.message); return; }
    setGeneratedCode(code);
    fetchData();
  };

  // ── Copy code ────────────────────────────────────────────────
  const handleCopy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ── Send code by email ───────────────────────────────────────
  const handleSendEmail = (code: string, role: string) => {
    const meta    = ROLE_META[role as InviteRole];
    const to      = inviteeEmail.trim();
    const subject = encodeURIComponent(`Your GovPilot Invite Code: ${code}`);
    const body    = encodeURIComponent(
      `You've been invited to join our company on GovPilot as a ${meta.label}.\n\n` +
      `Download GovPilot, then create a new account using this code:\n\n` +
      `${code}\n\n` +
      `This code is for your use only${inviteePhone.trim() ? ' on this mobile number' : ''}.\n`
    );
    Linking.openURL(`mailto:${to}?subject=${subject}&body=${body}`);
  };

  // ── Share code ───────────────────────────────────────────────
  const handleShare = async (code: string, role: string, inviteeName?: string) => {
    const meta = ROLE_META[role as InviteRole];
    const orgName = ''; // org name not needed in message per spec
    try {
      await Share.share({
        message:
          `You've been invited to join our company on GovPilot as a ${meta?.label ?? role}.\n\n` +
          `Download GovPilot, then create a new account using this code:\n\n` +
          `${code}\n\n` +
          `This code is for your use only on this mobile number.`,
      });
    } catch {}
  };

  // ── Soft-delete code (revoke access) ────────────────────────
  const handleDeactivateCode = (codeId: string, code: string) => {
    Alert.alert(
      'Revoke Code',
      `Revoke code ${code}?\n\nThe linked employee will be stopped from using the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: async () => {
          const now = new Date().toISOString();
          // Soft-delete the code
          await supabase.from('org_join_codes')
            .update({ deleted_at: now, deleted_by: teamMember?.id })
            .eq('id', codeId);
          // Also soft-delete any member who joined via this code
          await supabase.from('team_members')
            .update({ deleted_at: now, deleted_by: teamMember?.id })
            .eq('joined_via_code', codeId);
          fetchData();
        }},
      ]
    );
  };

  // ── Permanently delete a revoked code ───────────────────────
  const handleDeleteRevokedCode = (codeId: string, code: string) => {
    Alert.alert(
      '🗑 Delete Code',
      `Permanently delete revoked code ${code}?\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('org_join_codes').delete().eq('id', codeId);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        }},
      ]
    );
  };

  // ── Close modal + reset ───────────────────────────────────────
  const closeModal = () => {
    setShowModal(false);
    setGeneratedCode(null);
    setModalRole('member');
    setInviteeName('');
    setInviteePhone('');
    setInviteeCountry(DEFAULT_COUNTRY.code);
    setInviteeEmail('');
  };

  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  const activeMembers  = teamMembers.filter(tm => !tm.deleted_at);
  const deletedMembers = teamMembers.filter(tm => !!tm.deleted_at);
  const activeCodes    = joinCodes.filter(jc => !jc.deleted_at);
  const revokedCodes   = joinCodes.filter(jc => !!jc.deleted_at);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── INVITE CODES (owner/admin only) ─────────────────── */}
        {isOwnerOrAdmin && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>🔑 Invite Codes</Text>
                <Text style={s.sectionSub}>Each code gives one person access with a specific role</Text>
              </View>
              <TouchableOpacity style={s.newBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
                <Text style={s.newBtnText}>＋ New</Text>
              </TouchableOpacity>
            </View>

            {activeCodes.length === 0 && revokedCodes.length === 0 && (
              <Text style={s.emptyHint}>No invite codes yet. Tap ＋ New to create one.</Text>
            )}

            {/* Active codes */}
            {activeCodes.map((jc) => {
              const meta = ROLE_META[jc.role as InviteRole] ?? ROLE_META.member;
              return (
                <View key={jc.id} style={s.codeCard}>
                  <View style={s.codeCardTop}>
                    <Text style={s.codeText}>{jc.code}</Text>
                    <View style={[s.rolePill, { borderColor: meta.color + '55', backgroundColor: meta.color + '18' }]}>
                      <Text style={[s.rolePillText, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
                    </View>
                  </View>

                  {/* Invitee info */}
                  {(jc.invitee_name || jc.invitee_phone || jc.invitee_email) && (
                    <View style={s.inviteeRow}>
                      {jc.invitee_name  && <Text style={s.inviteeMeta}>👤 {jc.invitee_name}</Text>}
                      {jc.invitee_phone && <Text style={s.inviteeMeta}>📱 {jc.invitee_phone}</Text>}
                      {jc.invitee_email && <Text style={s.inviteeMeta}>📧 {jc.invitee_email}</Text>}
                    </View>
                  )}

                  <View style={s.codeCardBottom}>
                    <Text style={s.codeMeta}>
                      {jc.use_count} use{jc.use_count !== 1 ? 's' : ''} · Created {fmtDateTime(jc.created_at)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDeactivateCode(jc.id, jc.code)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: theme.color.danger, fontSize: 16, fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Revoked codes (grey) */}
            {revokedCodes.length > 0 && (
              <>
                <Text style={s.revokedLabel}>REVOKED CODES</Text>
                {revokedCodes.map((jc) => {
                  const meta = ROLE_META[jc.role as InviteRole] ?? ROLE_META.member;
                  return (
                    <View key={jc.id} style={[s.codeCard, s.codeCardRevoked]}>
                      <View style={s.codeCardTop}>
                        <Text style={[s.codeText, s.revokedText]}>{jc.code}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[s.rolePill, { borderColor: '#66666655', backgroundColor: '#66666618' }]}>
                            <Text style={[s.rolePillText, { color: '#888' }]}>{meta.icon} {meta.label}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDeleteRevokedCode(jc.id, jc.code)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={{ color: theme.color.danger, fontSize: 15, fontWeight: '700' }}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {(jc.invitee_name || jc.invitee_phone || jc.invitee_email) && (
                        <View style={s.inviteeRow}>
                          {jc.invitee_name  && <Text style={[s.inviteeMeta, s.revokedText]}>👤 {jc.invitee_name}</Text>}
                          {jc.invitee_phone && <Text style={[s.inviteeMeta, s.revokedText]}>📱 {jc.invitee_phone}</Text>}
                          {jc.invitee_email && <Text style={[s.inviteeMeta, s.revokedText]}>📧 {jc.invitee_email}</Text>}
                        </View>
                      )}
                      <Text style={[s.codeMeta, s.revokedText]}>
                        Revoked {fmtDateTime(jc.deleted_at)} · {jc.use_count} use{jc.use_count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ── ACTIVE TEAM MEMBERS ──────────────────────────────── */}
        <View style={s.sectionDivider}>
          <Text style={s.sectionDividerText}>TEAM MEMBERS ({activeMembers.length})</Text>
        </View>

        {activeMembers.map((tm) => {
          const isYou     = tm.id === teamMember?.id;
          const isOwner   = tm.role === 'owner';
          // Role chips: only owner can change roles (not self, not another owner)
          const canEdit   = teamMember?.role === 'owner' && !isYou && !isOwner;
          // Stop access: owner can stop admins/members/viewers. Admins can stop members/viewers.
          // Nobody can stop another owner or themselves.
          const canStop   = !isYou && !isOwner && (
            teamMember?.role === 'owner' ||
            (teamMember?.role === 'admin' && tm.role !== 'admin')
          );

          const myColor =
            tm.role === 'owner'  ? theme.color.primary :
            tm.role === 'admin'  ? theme.color.warning :
            tm.role === 'viewer' ? theme.color.textMuted :
            theme.color.success;

          return (
            <View key={tm.id} style={[s.memberCard, { marginBottom: 10 }]}>
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
                {canStop && (
                  <TouchableOpacity
                    onPress={() => handleSoftDelete(tm)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={s.deleteBtn}
                  >
                    <Text style={s.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isOwner ? (
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

              {canEdit && !isOwner && (
                <Text style={s.roleDesc}>
                  {ROLE_META[tm.role as InviteRole]?.desc ?? ''}
                </Text>
              )}
            </View>
          );
        })}

        {/* ── STOPPED MEMBERS (soft-deleted, grey) ────────────── */}
        {deletedMembers.length > 0 && (
          <>
            <View style={s.sectionDivider}>
              <Text style={s.sectionDividerText}>STOPPED ({deletedMembers.length}) — swipe left to remove permanently</Text>
            </View>
            {deletedMembers.map((tm) => (
              <SwipeableMemberRow
                key={tm.id}
                onPermanentDelete={() => handlePermanentDelete(tm)}
              >
                <View style={[s.memberCard, s.memberCardStopped]}>
                  <View style={s.memberTop}>
                    <View style={[s.avatar, { backgroundColor: '#55555522' }]}>
                      <Text style={[s.avatarText, { color: '#888' }]}>
                        {(tm.name ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={s.memberInfo}>
                      <Text style={[s.memberName, s.stoppedText]} numberOfLines={1}>
                        {tm.name}
                      </Text>
                      <Text style={[s.memberEmail, s.stoppedText]} numberOfLines={1}>
                        {tm.email}
                      </Text>
                      {tm.deleted_at && (
                        <Text style={s.stoppedAt}>
                          Stopped {fmtDateTime(tm.deleted_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={s.stoppedBadge}>
                    <Text style={s.stoppedBadgeText}>⛔ Access Revoked</Text>
                  </View>
                </View>
              </SwipeableMemberRow>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── INVITE CODE MODAL ────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
        >
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>

              {generatedCode ? (
                /* ── Step 2: code generated ── */
                <>
                  <Text style={s.modalTitle}>✅ Invite Code Ready</Text>
                  <Text style={s.modalSub}>
                    Share this code with {inviteeName.trim() || 'the person'} so they can download GovPilot and create an account.
                  </Text>

                  <View style={s.codeDisplay}>
                    <Text style={s.codeDisplayText}>{generatedCode}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <View style={[s.rolePill, { borderColor: ROLE_META[modalRole].color + '55', backgroundColor: ROLE_META[modalRole].color + '18' }]}>
                        <Text style={[s.rolePillText, { color: ROLE_META[modalRole].color }]}>
                          {ROLE_META[modalRole].icon} {ROLE_META[modalRole].label}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[s.copyBtn, copiedCode === generatedCode && s.copyBtnDone]}
                        onPress={() => generatedCode && handleCopy(generatedCode)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.copyBtnText, copiedCode === generatedCode && { color: theme.color.success }]}>
                          {copiedCode === generatedCode ? '✓ Copied!' : '📋 Copy'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {inviteeName.trim() ? <Text style={s.codeForText}>For: {inviteeName.trim()}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={s.shareFullBtn}
                    onPress={() => handleShare(generatedCode, modalRole, inviteeName)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.shareFullBtnText}>📤 Share Code</Text>
                  </TouchableOpacity>
                  {inviteeEmail.trim() ? (
                    <TouchableOpacity
                      style={[s.shareFullBtn, { backgroundColor: theme.color.bgSurface, borderWidth: 1, borderColor: theme.color.primary }]}
                      onPress={() => handleSendEmail(generatedCode, modalRole)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.shareFullBtnText, { color: theme.color.primary }]}>📧 Send Email to {inviteeEmail.trim()}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={s.doneBtn} onPress={closeModal}>
                    <Text style={s.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* ── Step 1: configure code ── */
                <>
                  <Text style={s.modalTitle}>New Invite Code</Text>
                  <Text style={s.modalSub}>Fill in who this code is for and choose their role.</Text>

                  {/* Invitee name */}
                  <View style={s.formField}>
                    <Text style={s.formLabel}>EMPLOYEE NAME</Text>
                    <TextInput
                      style={s.formInput}
                      value={inviteeName}
                      onChangeText={setInviteeName}
                      placeholder="Full name"
                      placeholderTextColor={theme.color.textMuted}
                      autoCorrect={false}
                    />
                  </View>

                  {/* Invitee phone */}
                  <View style={s.formField}>
                    <Text style={s.formLabel}>EMPLOYEE PHONE NUMBER</Text>
                    <PhoneInput
                      value={inviteePhone}
                      onChangeText={setInviteePhone}
                      countryCode={inviteeCountry}
                      onCountryChange={c => setInviteeCountry(c.code)}
                      placeholder="70 123 456"
                    />
                    <Text style={s.formHint}>The invitee can only register with this phone number.</Text>
                  </View>

                  {/* Invitee email */}
                  <View style={s.formField}>
                    <Text style={s.formLabel}>EMPLOYEE EMAIL (OPTIONAL)</Text>
                    <TextInput
                      style={s.formInput}
                      value={inviteeEmail}
                      onChangeText={setInviteeEmail}
                      placeholder="employee@example.com"
                      placeholderTextColor={theme.color.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={s.formHint}>Send the invite code directly to their inbox.</Text>
                  </View>

                  {/* Role picker */}
                  <View style={s.formField}>
                    <Text style={s.formLabel}>ROLE</Text>
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
                  </View>

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
        </KeyboardAwareScrollView>
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

  revokedLabel: {
    ...theme.typography.sectionDivider,
    color: theme.color.textMuted,
    marginTop: 4,
  },

  // Code card
  codeCard: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    padding:         theme.spacing.space3,
    gap:             6,
  },
  codeCardRevoked: {
    backgroundColor: theme.color.bgBase,
    borderColor:     '#44444444',
    opacity:         0.65,
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
  revokedText: { color: '#888' },
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

  inviteeRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  inviteeMeta: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '600' },

  rolePill: {
    borderWidth:     1,
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  rolePillText: { fontSize: 12, fontWeight: '700' },
  copyBtn: {
    borderWidth:       1,
    borderColor:       theme.color.border,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical:   3,
    backgroundColor:   theme.color.bgSurface,
  },
  copyBtnDone: {
    borderColor:     theme.color.success + '55',
    backgroundColor: theme.color.success + '12',
  },
  copyBtnText: { fontSize: 12, fontWeight: '700', color: theme.color.textSecondary },

  // ── Section divider ──────────────────────────────────────────
  sectionDivider:     { paddingVertical: 4 },
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
  memberCardStopped: {
    backgroundColor: theme.color.bgBase,
    borderColor:     '#44444444',
  },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:    { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 17, fontWeight: '700' },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName:  { ...theme.typography.body, fontWeight: '600', fontSize: 15 },
  memberEmail: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 1 },
  deleteBtn:   { paddingStart: 4, flexShrink: 0 },
  deleteBtnText: { color: theme.color.danger, fontSize: 16, fontWeight: '700' },

  stoppedText: { color: '#888' },
  stoppedAt:   { ...theme.typography.caption, color: theme.color.danger + 'aa', marginTop: 2 },
  stoppedBadge: {
    alignSelf:       'flex-start',
    borderWidth:     1,
    borderColor:     '#55555555',
    backgroundColor: '#33333322',
    borderRadius:    theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  stoppedBadgeText: { color: '#888', fontWeight: '700', fontSize: 12 },

  // Permanent delete swipe action
  permDeleteAction: {
    position:        'absolute',
    right:           0,
    top:             0,
    bottom:          0,
    width:           SWIPE_WIDTH,
    backgroundColor: theme.color.danger,
    borderRadius:    theme.radius.lg,
    justifyContent:  'center',
    alignItems:      'center',
  },
  permDeleteBtn:  { flex: 1, justifyContent: 'center', alignItems: 'center', width: SWIPE_WIDTH },
  permDeleteText: { color: theme.color.white, fontSize: 11, fontWeight: '700', textAlign: 'center' },

  // Role chips
  chipRow: { flexDirection: 'row', gap: 6 },
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
  modalOverlay: { justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor:    theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding:    theme.spacing.space5,
    gap:        theme.spacing.space3,
    paddingBottom: 36,
  },
  modalTitle: { ...theme.typography.heading, fontWeight: '700', fontSize: 18 },
  modalSub:   { ...theme.typography.caption, color: theme.color.textSecondary },

  // Form fields inside modal
  formField: { gap: 6 },
  formLabel: { ...theme.typography.sectionDivider, color: theme.color.textSecondary },
  formInput: {
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    borderWidth:       1,
    borderColor:       theme.color.border,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   12,
    color:             theme.color.textPrimary,
    fontSize:          15,
  },
  formHint: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },

  // Role option rows
  roleOption: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             12,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    backgroundColor: theme.color.bgBase,
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
  codeForText: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2 },

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
