// src/screens/AccountScreen.tsx
// User profile: view/edit name & phone, change password, org info, sign out
// Session 26

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { emailToDisplay, isPhoneInput, normalizeToEmail } from '../lib/authHelpers';

const ROLE_COLORS: Record<string, string> = {
  owner:  theme.color.primary,
  admin:  theme.color.warning,
  member: theme.color.success,
  viewer: theme.color.textMuted,
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:     { label: 'Free Plan',     color: theme.color.textMuted },
  starter:  { label: 'Starter Plan',  color: theme.color.success },
  business: { label: 'Business Plan', color: theme.color.primary },
};

export default function AccountScreen() {
  const navigation = useNavigation();
  const { teamMember, organization, signOut, refreshTeamMember, isOwner } = useAuth();

  const [editName,      setEditName]      = useState(teamMember?.name ?? '');
  const [editPhone,     setEditPhone]     = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [showPwdModal,  setShowPwdModal]  = useState(false);
  const [currentPwd,    setCurrentPwd]    = useState('');
  const [newPwd,        setNewPwd]        = useState('');
  const [confirmPwd,    setConfirmPwd]    = useState('');
  const [changingPwd,   setChangingPwd]   = useState(false);

  const [showOrgModal,  setShowOrgModal]  = useState(false);
  const [editOrgName,   setEditOrgName]   = useState(organization?.name ?? '');
  const [savingOrg,     setSavingOrg]     = useState(false);

  useEffect(() => {
    if (teamMember) {
      setEditName(teamMember.name ?? '');
      // Show real phone if stored separately, or derive from email if phone-based login
      const displayPhone = teamMember.phone
        ?? (teamMember.email?.endsWith('@cleartrack.internal') ? teamMember.email.replace('@cleartrack.internal', '') : '');
      setEditPhone(displayPhone);
    }
  }, [teamMember]);

  // Display identifier for this user (phone or email)
  const displayIdentifier = teamMember?.email
    ? emailToDisplay(teamMember.email)
    : '—';
  const identifierIsPhone = isPhoneInput(displayIdentifier);

  const saveProfile = async () => {
    if (!editName.trim()) { Alert.alert('Required', 'Name cannot be empty.'); return; }
    if (!teamMember?.id) return;
    setSavingProfile(true);
    const updates: Record<string, string> = { name: editName.trim() };
    if (editPhone.trim()) updates.phone = editPhone.trim();
    const { error } = await supabase.from('team_members').update(updates).eq('id', teamMember.id);
    setSavingProfile(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await refreshTeamMember();
    Alert.alert('Saved', 'Your profile has been updated.');
  };

  const changePassword = async () => {
    if (!newPwd || newPwd.length < 6) { Alert.alert('Weak Password', 'New password must be at least 6 characters.'); return; }
    if (newPwd !== confirmPwd) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    setChangingPwd(true);
    // Re-authenticate first by signing in with current password
    const email = teamMember?.email ?? '';
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPwd });
    if (signInErr) {
      setChangingPwd(false);
      Alert.alert('Wrong Password', 'Current password is incorrect.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setChangingPwd(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowPwdModal(false);
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    Alert.alert('Password Changed', 'Your password has been updated successfully.');
  };

  const saveOrgName = async () => {
    if (!editOrgName.trim()) { Alert.alert('Required', 'Organization name cannot be empty.'); return; }
    if (!organization?.id) return;
    setSavingOrg(true);
    const { error } = await supabase.from('organizations').update({ name: editOrgName.trim() }).eq('id', organization.id);
    setSavingOrg(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowOrgModal(false);
    await refreshTeamMember();
    Alert.alert('Saved', 'Organization name updated.');
  };

  const roleBadgeColor = ROLE_COLORS[teamMember?.role ?? 'member'] ?? theme.color.primary;
  const planInfo = PLAN_LABELS[organization?.plan ?? 'free'] ?? PLAN_LABELS.free;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.container}>

        {/* Avatar / identity */}
        <View style={s.avatarCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(teamMember?.name ?? '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.avatarName}>{teamMember?.name ?? '—'}</Text>
            <View style={s.identifierRow}>
              <Text style={s.identifierIcon}>{identifierIsPhone ? '📱' : '✉️'}</Text>
              <Text style={s.identifierText}>{displayIdentifier}</Text>
            </View>
          </View>
          <View style={[s.roleBadge, { backgroundColor: roleBadgeColor + '22', borderColor: roleBadgeColor + '55' }]}>
            <Text style={[s.roleBadgeText, { color: roleBadgeColor }]}>{teamMember?.role ?? 'member'}</Text>
          </View>
        </View>

        {/* Organization card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>🏢 Organization</Text>
            {isOwner && (
              <TouchableOpacity onPress={() => { setEditOrgName(organization?.name ?? ''); setShowOrgModal(true); }}>
                <Text style={s.editLink}>✎ Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.orgName}>{organization?.name ?? '—'}</Text>
          <View style={[s.planBadge, { backgroundColor: planInfo.color + '18', borderColor: planInfo.color + '33' }]}>
            <Text style={[s.planBadgeText, { color: planInfo.color }]}>{planInfo.label}</Text>
          </View>
        </View>

        {/* Edit profile */}
        <View style={s.card}>
          <Text style={s.cardTitle}>👤 Edit Profile</Text>
          <View style={s.field}>
            <Text style={s.label}>DISPLAY NAME</Text>
            <TextInput
              style={s.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              placeholderTextColor={theme.color.textMuted}
              autoCapitalize="words"
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>PHONE NUMBER (optional)</Text>
            <TextInput
              style={s.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+961 70 123 456"
              placeholderTextColor={theme.color.textMuted}
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity
            style={[s.saveBtn, savingProfile && s.btnDisabled]}
            onPress={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile
              ? <ActivityIndicator color={theme.color.white} size="small" />
              : <Text style={s.saveBtnText}>Save Profile</Text>}
          </TouchableOpacity>
        </View>

        {/* Security */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🔒 Security</Text>
          <TouchableOpacity style={s.actionRow} onPress={() => setShowPwdModal(true)}>
            <Text style={s.actionRowText}>Change Password</Text>
            <Text style={s.actionRowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={s.signOutBtn}
          onPress={() =>
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ])
          }
        >
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={s.version}>ClearTrack v1.0.0</Text>
      </ScrollView>

      {/* ── Change Password Modal ── */}
      <Modal visible={showPwdModal} transparent animationType="slide" onRequestClose={() => setShowPwdModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>Change Password</Text>
              <View style={s.field}>
                <Text style={s.label}>CURRENT PASSWORD</Text>
                <TextInput style={s.input} value={currentPwd} onChangeText={setCurrentPwd} secureTextEntry placeholder="Current password" placeholderTextColor={theme.color.textMuted} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>NEW PASSWORD</Text>
                <TextInput style={s.input} value={newPwd} onChangeText={setNewPwd} secureTextEntry placeholder="Min. 6 characters" placeholderTextColor={theme.color.textMuted} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>CONFIRM NEW PASSWORD</Text>
                <TextInput style={s.input} value={confirmPwd} onChangeText={setConfirmPwd} secureTextEntry placeholder="Repeat new password" placeholderTextColor={theme.color.textMuted} />
              </View>
              <TouchableOpacity style={[s.saveBtn, changingPwd && s.btnDisabled]} onPress={changePassword} disabled={changingPwd}>
                {changingPwd ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.saveBtnText}>Update Password</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPwdModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Org Name Modal (owner only) ── */}
      <Modal visible={showOrgModal} transparent animationType="slide" onRequestClose={() => setShowOrgModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>Organization Name</Text>
              <View style={s.field}>
                <Text style={s.label}>COMPANY / OFFICE NAME</Text>
                <TextInput style={s.input} value={editOrgName} onChangeText={setEditOrgName} autoCapitalize="words" placeholder="Your company name" placeholderTextColor={theme.color.textMuted} />
              </View>
              <TouchableOpacity style={[s.saveBtn, savingOrg && s.btnDisabled]} onPress={saveOrgName} disabled={savingOrg}>
                {savingOrg ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowOrgModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: theme.color.bgBase },
  container:  { padding: theme.spacing.space4, gap: 16, paddingBottom: 40 },

  // Avatar card
  avatarCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    padding:         theme.spacing.space4,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  avatar: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: theme.color.primary,
    justifyContent:  'center',
    alignItems:      'center',
  },
  avatarText:      { fontSize: 24, color: theme.color.white, fontWeight: '700' },
  avatarName:      { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 17, fontWeight: '700' },
  identifierRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  identifierIcon:  { fontSize: 13 },
  identifierText:  { ...theme.typography.label, color: theme.color.textSecondary },
  roleBadge: {
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth:     1,
  },
  roleBadgeText:   { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  // Generic card
  card: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    padding:         theme.spacing.space4,
    gap:             14,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle:  { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15, fontWeight: '700' },
  editLink:   { ...theme.typography.label, color: theme.color.primary, fontWeight: '700' },
  orgName:    { ...theme.typography.heading, fontSize: 18, fontWeight: '700' },
  planBadge: {
    alignSelf:       'flex-start',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth:     1,
  },
  planBadgeText: { fontSize: 12, fontWeight: '700' },

  // Form
  field:  { gap: 6 },
  label:  { ...theme.typography.sectionDivider, letterSpacing: 1.1 },
  input: {
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.lg,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: 13,
    color:           theme.color.textPrimary,
    fontSize:        15,
  },
  saveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 14,
    alignItems:      'center',
  },
  btnDisabled:   { opacity: 0.6 },
  saveBtnText:   { color: theme.color.white, fontSize: 15, fontWeight: '700' },
  actionRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 4,
  },
  actionRowText:    { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15 },
  actionRowChevron: { color: theme.color.primary, fontSize: 22, fontWeight: '700' },

  // Sign out
  signOutBtn: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    paddingVertical: 16,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     theme.color.danger + '44',
    marginTop:       theme.spacing.space2,
  },
  signOutText: { color: theme.color.danger, fontSize: 16, fontWeight: '700' },
  version:     { ...theme.typography.caption, color: theme.color.border, textAlign: 'center' },

  // Modals
  modalOverlay: {
    flex:            1,
    backgroundColor: theme.color.overlayDark,
    justifyContent:  'flex-end',
  },
  modalSheet: {
    backgroundColor:      theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding:              theme.spacing.space5,
    gap:                  16,
    paddingBottom:        40,
  },
  modalTitle:  { ...theme.typography.heading, fontSize: 20, fontWeight: '700' },
  cancelBtn:   { alignItems: 'center', paddingVertical: 4 },
  cancelText:  { ...theme.typography.body, color: theme.color.textMuted },
});
