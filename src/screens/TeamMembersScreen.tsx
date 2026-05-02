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
  Switch,
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

  // Edit modal (shared for code invitee info + team member info)
  const [editModal,       setEditModal]       = useState<{ type: 'code' | 'member'; id: string } | null>(null);
  const [editName,        setEditName]        = useState('');
  const [editPhone,       setEditPhone]       = useState('');
  const [editEmail,       setEditEmail]       = useState('');
  const [editSaving,      setEditSaving]      = useState(false);

  // Custom field definitions + values (member edit only)
  const [fieldDefs,       setFieldDefs]       = useState<any[]>([]);
  const [fieldValues,     setFieldValues]     = useState<Record<string, any>>({});
  const [loadingFields,   setLoadingFields]   = useState(false);

  // Search bar
  const [search, setSearch] = useState('');

  // All field defs + all member field values (for search)
  const [allFieldDefs,   setAllFieldDefs]   = useState<any[]>([]);
  const [allFieldValues, setAllFieldValues] = useState<Record<string, Record<string, string>>>({});

  // ── Fetch ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const [tmRes, codeRes, defsRes, valsRes] = await Promise.all([
      supabase.from('team_members').select('*').eq('org_id', teamMember?.org_id ?? '').order('name'),
      supabase
        .from('org_join_codes')
        .select('*')
        .eq('org_id', teamMember?.org_id ?? '')
        .order('created_at', { ascending: false }),
      supabase.from('team_member_field_definitions').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('team_member_field_values').select('*'),
    ]);
    if (tmRes.data)   setTeamMembers(tmRes.data as any[]);
    if (codeRes.data) setJoinCodes(codeRes.data);
    if (defsRes.data) setAllFieldDefs(defsRes.data);
    if (valsRes.data) {
      const valMap: Record<string, Record<string, string>> = {};
      valsRes.data.forEach((v: any) => {
        if (!valMap[v.team_member_id]) valMap[v.team_member_id] = {};
        valMap[v.team_member_id][v.field_id] = String(v.value_boolean ?? v.value_number ?? v.value_text ?? '');
      });
      setAllFieldValues(valMap);
    }
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

  // ── Generate invite code (inner — skips checks) ─────────────
  const doGenerateCode = async (fullPhone: string | null) => {
    if (!teamMember?.org_id) return;
    setGenerating(true);
    const code = await makeCode();
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

  // ── Generate invite code (with duplicate guard) ──────────────
  const handleGenerateCode = async () => {
    if (!teamMember?.org_id) return;

    const fullPhone  = inviteePhone.trim()
      ? normalizePhone(`${inviteeCountry}${inviteePhone.trim()}`)
      : null;
    const trimmedName = inviteeName.trim();

    // ── Phone duplicate: hard block ─────────────────────────────
    if (fullPhone) {
      const [tmPhoneRes, codePhoneRes] = await Promise.all([
        supabase
          .from('team_members')
          .select('name')
          .eq('org_id', teamMember.org_id)
          .eq('phone', fullPhone)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('org_join_codes')
          .select('invitee_name')
          .eq('org_id', teamMember.org_id)
          .eq('invitee_phone', fullPhone)
          .is('deleted_at', null)
          .maybeSingle(),
      ]);
      if (tmPhoneRes.data) {
        Alert.alert(
          '📵 Phone Already Registered',
          `"${tmPhoneRes.data.name ?? 'A team member'}" already has this phone number.\n\nEach member must register with a unique phone number. Please enter a different number.`,
        );
        return;
      }
      if (codePhoneRes.data) {
        Alert.alert(
          '📵 Phone Already Used',
          `An active invite code for "${codePhoneRes.data.invitee_name ?? 'someone'}" already uses this phone number.\n\nRevoke that code first, or use a different number.`,
        );
        return;
      }
    }

    // ── Name duplicate: soft warning ────────────────────────────
    if (trimmedName) {
      const { data: sameName } = await supabase
        .from('team_members')
        .select('name')
        .eq('org_id', teamMember.org_id)
        .ilike('name', trimmedName)
        .is('deleted_at', null)
        .maybeSingle();
      if (sameName) {
        Alert.alert(
          '👤 Name Already Exists',
          `A team member named "${sameName.name}" already exists.\n\nIs this a different person?`,
          [
            { text: 'Cancel',       style: 'cancel' },
            { text: 'Yes, Continue', onPress: () => doGenerateCode(fullPhone) },
          ],
        );
        return;
      }
    }

    await doGenerateCode(fullPhone);
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

  // ── Edit invitee / member info ───────────────────────────────
  // If the code's invitee has already joined as a team member, open the full
  // member edit (with custom fields). Only fall back to the 3-field code edit
  // when the code hasn't been used yet and there is no linked member row.
  const openEditCode = async (jc: any) => {
    // Check if someone already joined using this code
    const linkedMember = teamMembers.find(tm => (tm as any).joined_via_code === jc.id && !tm.deleted_at);
    if (linkedMember) {
      // Route to the full member edit — same experience as tapping the member card
      await openEditMember(linkedMember);
      return;
    }
    // Code not yet used — edit the pre-registered invitee details only
    setEditName(jc.invitee_name ?? '');
    setEditPhone(jc.invitee_phone ?? '');
    setEditEmail(jc.invitee_email ?? '');
    setFieldDefs([]);
    setFieldValues({});
    setEditModal({ type: 'code', id: jc.id });
  };

  const openEditMember = async (tm: any) => {
    setEditName(tm.name ?? '');
    setEditPhone(tm.phone ?? '');
    setEditEmail(tm.email ?? '');
    setFieldDefs([]);
    setFieldValues({});
    setEditModal({ type: 'member', id: tm.id });
    // Load custom field definitions + existing values for this member
    setLoadingFields(true);
    const [defsRes, valsRes] = await Promise.all([
      supabase.from('team_member_field_definitions').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('team_member_field_values').select('*').eq('team_member_id', tm.id),
    ]);
    if (defsRes.data) setFieldDefs(defsRes.data);
    if (valsRes.data) {
      const vals: Record<string, any> = {};
      valsRes.data.forEach((v: any) => {
        vals[v.field_id] = v.value_boolean ?? v.value_number ?? v.value_text ?? '';
      });
      setFieldValues(vals);
    }
    setLoadingFields(false);
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setEditSaving(true);
    if (editModal.type === 'code') {
      await supabase.from('org_join_codes').update({
        invitee_name:  editName.trim()  || null,
        invitee_phone: editPhone.trim() || null,
        invitee_email: editEmail.trim().toLowerCase() || null,
      }).eq('id', editModal.id);
    } else {
      await supabase.from('team_members').update({
        name:  editName.trim()  || undefined,
        phone: editPhone.trim() || null,
      }).eq('id', editModal.id);
      // Also sync the linked invite code's invitee_name so the code card stays in sync
      const member = teamMembers.find(tm => tm.id === editModal.id);
      if (member?.joined_via_code && editName.trim()) {
        await supabase.from('org_join_codes').update({
          invitee_name: editName.trim(),
        }).eq('id', member.joined_via_code);
      }
      // Save custom field values
      for (const def of fieldDefs) {
        const raw = fieldValues[def.id];
        if (raw === undefined || raw === null || raw === '') continue;
        const isBoolean = def.field_type === 'boolean';
        const isNumber  = def.field_type === 'number' || def.field_type === 'currency';
        await supabase.from('team_member_field_values').upsert({
          team_member_id: editModal.id,
          field_id:       def.id,
          value_boolean:  isBoolean ? raw          : null,
          value_number:   isNumber  ? (parseFloat(String(raw).replace(/,/g, '')) || null) : null,
          value_text:     !isBoolean && !isNumber ? String(raw) : null,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'team_member_id,field_id' });
      }
    }
    setEditSaving(false);
    setEditModal(null);
    fetchData();
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

  // ── Search filter ────────────────────────────────────────────
  const searchQ = search.toLowerCase().trim();

  // Match a team member row against the query
  const matchesMember = (tm: any): boolean => {
    if (!searchQ) return true;
    // Core fields: name, email, phone, role
    const coreText = [tm.name, tm.email, tm.phone, tm.role]
      .filter(Boolean).join(' ').toLowerCase();
    if (coreText.includes(searchQ)) return true;
    // Custom field VALUES only (not labels — matching labels would return all members)
    const vals = allFieldValues[tm.id] ?? {};
    for (const def of allFieldDefs) {
      const raw = vals[def.id];
      if (raw !== undefined && raw !== null && raw !== '' &&
          String(raw).toLowerCase().includes(searchQ)) return true;
    }
    return false;
  };

  // Match an invite code row against the query
  // Includes the code number itself so you can type "ABCD" and find the card
  const matchesCode = (jc: any): boolean => {
    if (!searchQ) return true;
    const meta = ROLE_META[jc.role as InviteRole];
    const text = [
      jc.code,
      jc.invitee_name,
      jc.invitee_phone,
      jc.invitee_email,
      jc.role,
      meta?.label,
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(searchQ);
  };

  const activeMembers  = teamMembers.filter(tm => !tm.deleted_at);
  const deletedMembers = teamMembers.filter(tm => !!tm.deleted_at);
  const activeCodes    = joinCodes.filter(jc => !jc.deleted_at);
  const revokedCodes   = joinCodes.filter(jc => !!jc.deleted_at);

  const filteredActive       = activeMembers.filter(matchesMember);
  const filteredDeleted      = deletedMembers.filter(matchesMember);
  const filteredActiveCodes  = activeCodes.filter(matchesCode);
  const filteredRevokedCodes = revokedCodes.filter(matchesCode);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>

      {/* ── SEARCH BAR ──────────────────────────────────────── */}
      <View style={s.searchBar}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search members, email, phone, role…"
          placeholderTextColor={theme.color.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── INVITE CODES (owner/admin only) ─────────────────── */}
        {isOwnerOrAdmin && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>
                  🔑 Invite Codes{searchQ && (activeCodes.length + revokedCodes.length) > 0
                    ? ` (${filteredActiveCodes.length + filteredRevokedCodes.length} of ${activeCodes.length + revokedCodes.length})`
                    : ''}
                </Text>
                <Text style={s.sectionSub}>Each code gives one person access with a specific role</Text>
              </View>
              <TouchableOpacity style={s.newBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
                <Text style={s.newBtnText}>＋ New</Text>
              </TouchableOpacity>
            </View>

            {activeCodes.length === 0 && revokedCodes.length === 0 && (
              <Text style={s.emptyHint}>No invite codes yet. Tap ＋ New to create one.</Text>
            )}
            {searchQ && filteredActiveCodes.length === 0 && filteredRevokedCodes.length === 0 &&
              (activeCodes.length > 0 || revokedCodes.length > 0) && (
              <Text style={s.emptyHint}>No codes match "{search}"</Text>
            )}

            {/* Active codes */}
            {filteredActiveCodes.map((jc) => {
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
                  <TouchableOpacity style={s.inviteeRow} onPress={() => openEditCode(jc)} activeOpacity={0.7}>
                    {jc.invitee_name
                      ? <Text style={s.inviteeName}>👤 {jc.invitee_name}</Text>
                      : <Text style={s.inviteeAdd}>👤 Add name…</Text>}
                    {jc.invitee_phone && <Text style={s.inviteeMeta}>📱 {jc.invitee_phone}</Text>}
                    {jc.invitee_email && <Text style={s.inviteeMeta}>📧 {jc.invitee_email}</Text>}
                    <Text style={s.editHint}>✎</Text>
                  </TouchableOpacity>

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
            {filteredRevokedCodes.length > 0 && (
              <>
                <Text style={s.revokedLabel}>REVOKED CODES</Text>
                {filteredRevokedCodes.map((jc) => {
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
                          {jc.invitee_name  && <Text style={[s.inviteeName, s.revokedText]}>👤 {jc.invitee_name}</Text>}
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
          <Text style={s.sectionDividerText}>
            TEAM MEMBERS ({filteredActive.length}{searchQ && filteredActive.length !== activeMembers.length ? ` of ${activeMembers.length}` : ''})
          </Text>
        </View>

        {filteredActive.length === 0 && searchQ ? (
          <Text style={s.emptyHint}>No members match "{search}"</Text>
        ) : null}

        {filteredActive.map((tm) => {
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
                <TouchableOpacity style={s.memberInfo} onPress={() => openEditMember(tm)} activeOpacity={0.7}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.memberName} numberOfLines={1}>
                      {tm.name}{isYou ? ' (you)' : ''}
                    </Text>
                    <Text style={s.editHint}>✎</Text>
                  </View>
                  <Text style={s.memberEmail} numberOfLines={1}>
                    {tm.email}{tm.phone ? ` · ${tm.phone}` : ''}
                  </Text>
                </TouchableOpacity>
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
        {filteredDeleted.length > 0 && (
          <>
            <View style={s.sectionDivider}>
              <Text style={s.sectionDividerText}>STOPPED ({filteredDeleted.length}) — swipe left to remove permanently</Text>
            </View>
            {filteredDeleted.map((tm) => (
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

      {/* ── EDIT INFO MODAL ──────────────────────────────────── */}
      <Modal visible={!!editModal} transparent animationType="slide" onRequestClose={() => setEditModal(null)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditModal(null)} />
          <KeyboardAwareScrollView
            style={s.editSheet}
            contentContainerStyle={{ paddingBottom: 36 }}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            extraScrollHeight={40}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.editSheetTitle}>✎ Edit Member Info</Text>

            {/* ── Core fields ── */}
            <Text style={s.editLabel}>Name</Text>
            <TextInput
              style={s.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              placeholderTextColor={theme.color.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Text style={s.editLabel}>Phone</Text>
            <TextInput
              style={s.editInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+961 71 000 000"
              placeholderTextColor={theme.color.textMuted}
              keyboardType="phone-pad"
              autoCorrect={false}
            />

            {editModal?.type === 'code' && (
              <>
                <Text style={s.editLabel}>Email</Text>
                <TextInput
                  style={s.editInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            {/* ── Custom fields (member only) ── */}
            {editModal?.type === 'member' && (
              loadingFields ? (
                <ActivityIndicator color={theme.color.primary} style={{ marginTop: 16 }} />
              ) : fieldDefs.length > 0 ? (
                <>
                  <View style={s.editFieldsDivider}>
                    <Text style={s.editFieldsDividerText}>ADDITIONAL INFO</Text>
                  </View>
                  {fieldDefs.map((def) => {
                    const val = fieldValues[def.id];
                    const isBoolean  = def.field_type === 'boolean';
                    const isNumber   = def.field_type === 'number' || def.field_type === 'currency';
                    const isTextarea = def.field_type === 'textarea';
                    const isSelect   = def.field_type === 'select';
                    const keyboard   = isNumber ? 'numeric' : def.field_type === 'email' ? 'email-address' : def.field_type === 'phone' ? 'phone-pad' : 'default';

                    return (
                      <View key={def.id}>
                        <Text style={s.editLabel}>{def.label.toUpperCase()}{def.is_required ? ' *' : ''}</Text>
                        {isBoolean ? (
                          <View style={s.editBoolRow}>
                            <Text style={{ color: theme.color.textSecondary, fontSize: 14 }}>
                              {val ? 'Yes' : 'No'}
                            </Text>
                            <Switch
                              value={!!val}
                              onValueChange={(v) => setFieldValues(prev => ({ ...prev, [def.id]: v }))}
                              trackColor={{ false: theme.color.border, true: theme.color.primary + '88' }}
                              thumbColor={val ? theme.color.primary : theme.color.textMuted}
                            />
                          </View>
                        ) : isSelect && def.options ? (
                          <View style={s.editSelectRow}>
                            {(typeof def.options === 'string' ? JSON.parse(def.options) : def.options).map((opt: string) => (
                              <TouchableOpacity
                                key={opt}
                                style={[s.editSelectChip, val === opt && s.editSelectChipActive]}
                                onPress={() => setFieldValues(prev => ({ ...prev, [def.id]: opt }))}
                              >
                                <Text style={[s.editSelectChipText, val === opt && s.editSelectChipTextActive]}>
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <TextInput
                            style={[s.editInput, isTextarea && { height: 80, textAlignVertical: 'top' }]}
                            value={val !== undefined && val !== null ? String(val) : ''}
                            onChangeText={(t) => setFieldValues(prev => ({ ...prev, [def.id]: t }))}
                            placeholder={def.label}
                            placeholderTextColor={theme.color.textMuted}
                            keyboardType={keyboard}
                            multiline={isTextarea}
                            autoCapitalize={def.field_type === 'email' ? 'none' : 'sentences'}
                            autoCorrect={false}
                          />
                        )}
                      </View>
                    );
                  })}
                </>
              ) : null
            )}

            <TouchableOpacity
              style={[s.editSaveBtn, editSaving && { opacity: 0.6 }]}
              onPress={handleSaveEdit}
              disabled={editSaving}
              activeOpacity={0.8}
            >
              <Text style={s.editSaveBtnText}>{editSaving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.editCancelBtn} onPress={() => setEditModal(null)}>
              <Text style={s.editCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  scroll: { padding: theme.spacing.space4, paddingTop: theme.spacing.space3, gap: 12 },

  // ── Search bar ───────────────────────────────────────────────
  searchBar: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  theme.color.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   10,
    gap:               8,
  },
  searchIcon:  { fontSize: 16, color: theme.color.textMuted },
  searchInput: {
    flex:     1,
    fontSize: 15,
    color:    theme.color.textPrimary,
    paddingVertical: 0,
  },
  searchClear: { fontSize: 14, color: theme.color.textMuted, paddingStart: 4 },

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

  inviteeRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  inviteeName: { fontSize: 16, fontWeight: '700', color: theme.color.textPrimary },
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

  // ── Edit info modal ──────────────────────────────────────────
  editSheet: {
    backgroundColor:  theme.color.bgSurface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding:          theme.spacing.space5,
    paddingBottom:    36,
    gap:              theme.spacing.space2,
  },
  editSheetTitle: {
    ...theme.typography.heading,
    color:        theme.color.textPrimary,
    marginBottom: theme.spacing.space3,
    textAlign:    'center',
  },
  editLabel: {
    ...theme.typography.caption,
    color:      theme.color.textMuted,
    fontWeight: '700',
    marginTop:  theme.spacing.space2,
  },
  editInput: {
    ...theme.typography.body,
    color:           theme.color.textPrimary,
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space3,
    marginTop:       4,
  },
  editSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       theme.spacing.space4,
  },
  editSaveBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 16 },
  editCancelBtn:   { alignItems: 'center', paddingVertical: 10 },
  editCancelBtnText: { color: theme.color.textMuted, fontSize: 15, fontWeight: '600' },

  // ── Inline edit hint ─────────────────────────────────────────
  editHint:   { fontSize: 13, color: theme.color.textMuted, marginStart: 2 },
  inviteeAdd: { fontSize: 14, color: theme.color.textMuted, fontStyle: 'italic' },

  // ── Custom field section divider ─────────────────────────────
  editFieldsDivider: {
    marginTop:        theme.spacing.space4,
    marginBottom:     theme.spacing.space2,
    borderTopWidth:   1,
    borderTopColor:   theme.color.border,
    paddingTop:       theme.spacing.space3,
  },
  editFieldsDividerText: {
    ...theme.typography.sectionDivider,
    color: theme.color.primary,
  },

  // ── Boolean field row ────────────────────────────────────────
  editBoolRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.bgBase,
    borderWidth:    1,
    borderColor:    theme.color.border,
    borderRadius:   theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    marginTop:      4,
  },

  // ── Select field chips ───────────────────────────────────────
  editSelectRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    marginTop:      6,
  },
  editSelectChip: {
    borderWidth:       1,
    borderColor:       theme.color.border,
    borderRadius:      theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical:   6,
    backgroundColor:   theme.color.bgBase,
  },
  editSelectChipActive: {
    borderColor:      theme.color.primary,
    backgroundColor:  theme.color.primary + '18',
  },
  editSelectChipText: {
    fontSize:   13,
    fontWeight: '600',
    color:      theme.color.textSecondary,
  },
  editSelectChipTextActive: {
    color: theme.color.primary,
  },
});
