// src/screens/auth/RegisterScreen.tsx
// Public registration: create account + organization
// OR join an existing org if invited by email or phone
// Session 26 Phase 1+2+phone — phone-as-username support

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import supabase from '../../lib/supabase';
import { theme } from '../../theme';
import { RootStackParamList } from '../../types';
import {
  normalizeToEmail,
  normalizePhone,
  isPhoneInput,
  IDENTIFIER_LABEL,
  IDENTIFIER_PLACEHOLDER,
} from '../../lib/authHelpers';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();

  const [fullName,    setFullName]    = useState('');
  const [companyName, setCompanyName] = useState('');
  const [identifier,  setIdentifier]  = useState('');   // email or phone
  const [password,    setPassword]    = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading,     setLoading]     = useState(false);

  const [invitePreview, setInvitePreview] = useState<{ orgName: string; role: string } | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);

  const isPhone = isPhoneInput(identifier) && identifier.trim().length > 3;

  const checkInvitation = async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < 4) { setInvitePreview(null); return; }
    setCheckingInvite(true);
    const normalized = normalizeToEmail(trimmed);  // either real email or phone-derived
    const { data } = await supabase
      .from('invitations')
      .select('role, org_id, organizations(name)')
      .eq('email', normalized)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    setCheckingInvite(false);
    if (data) {
      const org = data.organizations as any;
      setInvitePreview({ orgName: org?.name ?? 'an organization', role: data.role });
    } else {
      setInvitePreview(null);
    }
  };

  const handleRegister = async () => {
    const trimmedId = identifier.trim();
    if (!fullName.trim() || !trimmedId || !password) {
      Alert.alert('Required', 'Please fill in name, email/phone and password.');
      return;
    }
    if (!invitePreview && !companyName.trim()) {
      Alert.alert('Required', 'Please enter your company name.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPass) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    // Derive Supabase auth email and real phone (if phone login)
    const authEmail = normalizeToEmail(trimmedId);
    const realPhone = isPhoneInput(trimmedId) ? normalizePhone(trimmedId) : null;

    setLoading(true);
    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password,
      });
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Account creation failed. Please try again.');
      const authUserId = authData.user.id;

      // 2a. Invited user → join existing org
      if (invitePreview) {
        const { data: invite } = await supabase
          .from('invitations')
          .select('id, org_id, role')
          .eq('email', authEmail)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (!invite) throw new Error('Invitation not found or expired. Please ask for a new one.');

        const { error: memberErr } = await supabase
          .from('team_members')
          .upsert({
            name:    fullName.trim(),
            email:   authEmail,
            phone:   realPhone,
            role:    invite.role,
            org_id:  invite.org_id,
            auth_id: authUserId,
          }, { onConflict: 'email' });
        if (memberErr) throw new Error('Failed to join organization: ' + memberErr.message);

        await supabase
          .from('invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invite.id);

      // 2b. New user → create org
      } else {
        const slug = companyName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .insert({ name: companyName.trim(), slug: `${slug}-${Date.now()}`, plan: 'free' })
          .select()
          .single();
        if (orgError) throw new Error('Failed to create organization: ' + orgError.message);

        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            name:    fullName.trim(),
            email:   authEmail,
            phone:   realPhone,
            role:    'owner',
            org_id:  orgData.id,
            auth_id: authUserId,
          });
        if (memberError) throw new Error('Failed to create user profile: ' + memberError.message);

        // Default status labels
        const defaultLabels = [
          { label: 'Submitted',         color: '#6366f1', sort_order: 1, org_id: orgData.id },
          { label: 'In Review',         color: '#f59e0b', sort_order: 2, org_id: orgData.id },
          { label: 'Pending Signature', color: '#8b5cf6', sort_order: 3, org_id: orgData.id },
          { label: 'Done',              color: '#10b981', sort_order: 4, org_id: orgData.id },
          { label: 'Rejected',          color: '#ef4444', sort_order: 5, org_id: orgData.id },
          { label: 'Closed',            color: '#64748b', sort_order: 6, org_id: orgData.id },
        ];
        await supabase.from('status_labels').insert(defaultLabels);
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAwareScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={80}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoIcon}>⊞</Text>
          </View>
          <Text style={s.title}>Create Account</Text>
          <Text style={s.subtitle}>
            {invitePreview
              ? `You've been invited to join ${invitePreview.orgName}`
              : 'Set up your organization and start tracking files'}
          </Text>
        </View>

        {/* Invite banner */}
        {invitePreview && (
          <View style={s.inviteBanner}>
            <Text style={s.inviteBannerIcon}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.inviteBannerTitle}>Invitation found</Text>
              <Text style={s.inviteBannerSub}>
                You'll join <Text style={{ fontWeight: '700' }}>{invitePreview.orgName}</Text> as{' '}
                <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{invitePreview.role}</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Form */}
        <View style={s.form}>
          <View style={s.field}>
            <Text style={s.label}>YOUR NAME</Text>
            <TextInput
              style={s.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor={theme.color.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>{IDENTIFIER_LABEL}</Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={identifier}
                onChangeText={(v) => { setIdentifier(v); checkInvitation(v); }}
                placeholder={IDENTIFIER_PLACEHOLDER}
                placeholderTextColor={theme.color.textMuted}
                keyboardType={isPhone ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {identifier.trim().length > 2 && (
                <View style={[s.typeTag, isPhone ? s.typeTagPhone : s.typeTagEmail]}>
                  <Text style={s.typeTagText}>{isPhone ? '📱' : '✉️'}</Text>
                </View>
              )}
            </View>
            {checkingInvite && <Text style={s.checkingText}>Checking for invitation…</Text>}
          </View>

          {/* Company name — hidden when joining via invite */}
          {!invitePreview && (
            <View style={s.field}>
              <Text style={s.label}>COMPANY / OFFICE NAME</Text>
              <TextInput
                style={s.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Your company or office name"
                placeholderTextColor={theme.color.textMuted}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor={theme.color.textMuted}
              secureTextEntry
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={s.input}
              value={confirmPass}
              onChangeText={setConfirmPass}
              placeholder="Repeat password"
              placeholderTextColor={theme.color.textMuted}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={theme.color.white} />
            ) : (
              <Text style={s.buttonText}>
                {invitePreview ? 'Join Organization' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.loginRow}>
          <Text style={s.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={s.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32, gap: 28 },
  header:    { alignItems: 'center', gap: 10 },
  logoBox: {
    width:           64,
    height:          64,
    borderRadius:    theme.radius.xl,
    backgroundColor: theme.color.primary,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    4,
  },
  logoIcon:     { fontSize: 32, color: theme.color.white },
  title:        { ...theme.typography.heading, fontSize: 26, fontWeight: '800' },
  subtitle:     { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '500', textAlign: 'center' },
  inviteBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: theme.color.success + '18',
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    borderWidth:     1,
    borderColor:     theme.color.success + '44',
  },
  inviteBannerIcon:  { fontSize: 24 },
  inviteBannerTitle: { ...theme.typography.body, color: theme.color.success, fontWeight: '700' },
  inviteBannerSub:   { ...theme.typography.label, color: theme.color.textSecondary, marginTop: 2 },
  checkingText:      { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 4 },
  form:              { gap: 18 },
  field:             { gap: 6 },
  label:             { ...theme.typography.sectionDivider, letterSpacing: 1.2 },
  inputRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: theme.color.bgSurface,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.lg,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: 14,
    color:           theme.color.textPrimary,
    fontSize:        15,
  },
  typeTag: {
    width:          36,
    height:         36,
    borderRadius:   theme.radius.md,
    justifyContent: 'center',
    alignItems:     'center',
    borderWidth:    1,
  },
  typeTagPhone:   { backgroundColor: theme.color.success + '18', borderColor: theme.color.success + '44' },
  typeTagEmail:   { backgroundColor: theme.color.primary + '18', borderColor: theme.color.primary + '44' },
  typeTagText:    { fontSize: 18 },
  button: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       theme.spacing.space2,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: theme.color.white, fontSize: 16, fontWeight: '700' },
  loginRow:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText:      { ...theme.typography.body, color: theme.color.textSecondary },
  loginLink:      { ...theme.typography.body, color: theme.color.primary, fontWeight: '700' },
});
