// src/screens/auth/OnboardingScreen.tsx
// Post-registration wizard: set up first service, first stage, invite teammates
// Session 26 — Phase 1 commercialization

import React, { useState, useEffect } from 'react';
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
import supabase from '../../lib/supabase';
import { theme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { normalizeToEmail } from '../../lib/authHelpers';
import { DEFAULT_COUNTRY } from '../../components/PhoneInput';

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const { teamMember, organization, refreshTeamMember, signOut } = useAuth();

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Verify company name (pre-filled from registration)
  const [companyName, setCompanyName] = useState(organization?.name ?? '');

  // Step 2 — First service + stage
  const [serviceName, setServiceName] = useState('');
  const [stageName,   setStageName]   = useState('');

  // Step 3 — Invite team member (optional)
  const [inviteName,       setInviteName]       = useState('');
  const [inviteMode,       setInviteMode]       = useState<'email' | 'phone'>('email');
  const [inviteEmail,      setInviteEmail]      = useState('');
  const [invitePhone,      setInvitePhone]      = useState('');
  const [inviteCountry,    setInviteCountry]    = useState(DEFAULT_COUNTRY.code);

  // Local org data — fetched fresh on mount to avoid the race condition where
  // onAuthStateChange fires before RegisterScreen's INSERT INTO team_members completes.
  const [localOrgId,    setLocalOrgId]    = useState<string | null>(organization?.id ?? null);
  const [localMemberId, setLocalMemberId] = useState<string | null>(teamMember?.id ?? null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Get current auth user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsInitializing(false); return; }

      // Query team_members directly — bypass stale useAuth hook state
      const { data: tm } = await supabase
        .from('team_members')
        .select('id, org_id, role')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!tm) {
        // Row not found yet (extreme race condition) — let user see wizard
        setIsInitializing(false);
        return;
      }

      // Invited employee (non-owner) — they don't need onboarding at all.
      // Their org already exists. Call refreshTeamMember() to update useAuth
      // state and let navigation/index.tsx switch to Main automatically.
      if (tm.role !== 'owner') {
        await refreshTeamMember();
        return;  // navigation will unmount this screen
      }

      // New org owner — load org name so step 1 form is pre-filled correctly
      setLocalOrgId(tm.org_id);
      setLocalMemberId(tm.id);
      if (tm.org_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', tm.org_id)
          .maybeSingle();
        if (org?.name) setCompanyName(org.name);
      }
      setIsInitializing(false);
    };
    init();
  }, []);

  // ─── Step handlers ───────────────────────────────────────────

  const handleStep1 = async () => {
    if (!companyName.trim()) { Alert.alert('Required', 'Please enter your company name.'); return; }
    if (!localOrgId) { setStep(2); return; }
    setLoading(true);
    const { error } = await supabase
      .from('organizations')
      .update({ name: companyName.trim() })
      .eq('id', localOrgId);
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setStep(2);
  };

  const handleStep2 = async () => {
    const orgId = localOrgId ?? teamMember?.org_id;
    if (!orgId) { setStep(3); return; }

    if (serviceName.trim() || stageName.trim()) {
      setLoading(true);
      try {
        let ministryId: string | undefined;
        if (stageName.trim()) {
          const { data: minData, error: minErr } = await supabase
            .from('ministries')
            .insert({ name: stageName.trim(), type: 'parent', org_id: orgId })
            .select()
            .single();
          if (minErr) throw minErr;
          ministryId = minData.id;
        }

        if (serviceName.trim()) {
          const { data: svcData, error: svcErr } = await supabase
            .from('services')
            .insert({
              name: serviceName.trim(),
              org_id: orgId,
              estimated_duration_days: 0,
              base_price_usd: 0,
              base_price_lbp: 0,
            })
            .select()
            .single();
          if (svcErr) throw svcErr;

          if (ministryId) {
            await supabase.from('service_default_stages').insert({
              service_id: svcData.id,
              ministry_id: ministryId,
              stop_order: 1,
            });
          }
        }
      } catch (err: any) {
        Alert.alert('Error', err.message);
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    setStep(3);
  };

  const handleStep3 = async () => {
    const orgId    = localOrgId    ?? teamMember?.org_id;
    const memberId = localMemberId ?? teamMember?.id;

    const rawIdentifier = inviteMode === 'email'
      ? inviteEmail.trim()
      : invitePhone.trim() ? `${inviteCountry}${invitePhone.trim()}` : '';

    if (inviteName.trim() && rawIdentifier && orgId) {
      setLoading(true);
      const normalizedEmail = normalizeToEmail(rawIdentifier);
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('invitations')
        .insert({
          org_id:     orgId,
          email:      normalizedEmail,
          role:       'member',
          invited_by: memberId,
          expires_at: expires,
        });
      setLoading(false);
      if (error && !error.message.includes('duplicate')) {
        Alert.alert('Error', error.message);
        return;
      }
    }
    // Done — refresh so navigator picks up the complete teamMember and exits onboarding
    setLoading(true);
    await refreshTeamMember();
    setLoading(false);
  };

  const handleSkipStep3 = async () => {
    setLoading(true);
    await refreshTeamMember();
    setLoading(false);
  };

  // ─── UI helpers ──────────────────────────────────────────────

  const StepIndicator = () => (
    <View style={s.stepRow}>
      {[1, 2, 3].map(n => (
        <View key={n} style={[s.stepDot, step >= n && s.stepDotActive]} />
      ))}
    </View>
  );

  // ─── Initializing spinner ────────────────────────────────────

  if (isInitializing) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.initLoader}>
          <ActivityIndicator size="large" color={theme.color.primary} />
          <Text style={s.initText}>Setting up your account…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Wizard ──────────────────────────────────────────────────

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
            <Text style={s.logoIcon}>🚀</Text>
          </View>
          <Text style={s.title}>Let's get you set up</Text>
          <Text style={s.subtitle}>Step {step} of {TOTAL_STEPS}</Text>
          <StepIndicator />
        </View>

        {/* ─── Step 1: Company name ─── */}
        {step === 1 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Your Company</Text>
            <Text style={s.cardDesc}>Confirm your company or office name. This is what your team will see.</Text>
            <View style={s.field}>
              <Text style={s.label}>COMPANY / OFFICE NAME</Text>
              <TextInput
                style={s.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Your company name"
                placeholderTextColor={theme.color.textMuted}
                autoCapitalize="words"
              />
            </View>
            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleStep1}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={theme.color.white} />
                : <Text style={s.btnText}>Continue →</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Step 2: First service + stage ─── */}
        {step === 2 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Your First Service</Text>
            <Text style={s.cardDesc}>Add the type of service you handle and its first stage. You can add more later in the app.</Text>
            <View style={s.field}>
              <Text style={s.label}>SERVICE NAME</Text>
              <TextInput
                style={s.input}
                value={serviceName}
                onChangeText={setServiceName}
                placeholder="Notarization, Car Plate Transfer..."
                placeholderTextColor={theme.color.textMuted}
                autoCapitalize="words"
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>FIRST STAGE NAME</Text>
              <TextInput
                style={s.input}
                value={stageName}
                onChangeText={setStageName}
                placeholder="Ministry of Interior, Notary..."
                placeholderTextColor={theme.color.textMuted}
                autoCapitalize="words"
              />
            </View>
            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleStep2}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={theme.color.white} />
                : <Text style={s.btnText}>Continue →</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={() => setStep(3)} disabled={loading}>
              <Text style={s.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Step 3: Invite teammate ─── */}
        {step === 3 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Invite a Teammate</Text>
            <Text style={s.cardDesc}>
              Add a colleague to your organization. They'll receive an invitation and join automatically when they sign up.
            </Text>

            {/* Teammate name */}
            <View style={s.field}>
              <Text style={s.label}>TEAMMATE NAME</Text>
              <TextInput
                style={s.input}
                value={inviteName}
                onChangeText={setInviteName}
                placeholder="Full name"
                placeholderTextColor={theme.color.textMuted}
                autoCapitalize="words"
              />
            </View>

            {/* Email / Phone toggle — separate inputs, no auto-detection */}
            <View style={s.field}>
              <Text style={s.label}>CONTACT</Text>
              <View style={s.modeRow}>
                <TouchableOpacity
                  style={[s.modeBtn, inviteMode === 'email' && s.modeBtnActive]}
                  onPress={() => setInviteMode('email')}
                >
                  <Text style={[s.modeBtnText, inviteMode === 'email' && s.modeBtnTextActive]}>
                    ✉️ Email
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modeBtn, inviteMode === 'phone' && s.modeBtnActive]}
                  onPress={() => setInviteMode('phone')}
                >
                  <Text style={[s.modeBtnText, inviteMode === 'phone' && s.modeBtnTextActive]}>
                    📱 Phone
                  </Text>
                </TouchableOpacity>
              </View>

              {inviteMode === 'email' ? (
                <TextInput
                  style={s.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="colleague@email.com"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : (
                <View style={s.phoneRow}>
                  <View style={s.countryBox}>
                    <Text style={s.countryFlag}>🇱🇧</Text>
                    <Text style={s.countryCode}>{inviteCountry}</Text>
                  </View>
                  <TextInput
                    style={[s.input, s.phoneInput]}
                    value={invitePhone}
                    onChangeText={setInvitePhone}
                    placeholder="70 123 456"
                    placeholderTextColor={theme.color.textMuted}
                    keyboardType="phone-pad"
                    autoCorrect={false}
                  />
                </View>
              )}
            </View>

            {/* Invite & Continue */}
            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleStep3}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={theme.color.white} />
                : <Text style={s.btnText}>Invite & Continue →</Text>}
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity
              style={[s.skipBtn, loading && s.btnDisabled]}
              onPress={handleSkipStep3}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={theme.color.textMuted} />
                : <Text style={s.skipText}>Skip — I'll invite later</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Sign out link */}
        <TouchableOpacity style={s.signoutBtn} onPress={signOut} disabled={loading}>
          <Text style={s.signoutText}>Sign out</Text>
        </TouchableOpacity>

      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: theme.color.bgBase },
  initLoader:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  initText:    { ...theme.typography.body, color: theme.color.textSecondary },
  container:   { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 28 },
  header:      { alignItems: 'center', gap: 10 },
  logoBox: {
    width:           64,
    height:          64,
    borderRadius:    theme.radius.xl,
    backgroundColor: theme.color.primary,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    4,
  },
  logoIcon:      { fontSize: 32 },
  title:         { ...theme.typography.heading, fontSize: 24, fontWeight: '800' },
  subtitle:      { ...theme.typography.body, color: theme.color.textSecondary },
  stepRow:       { flexDirection: 'row', gap: 8, marginTop: 8 },
  stepDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.color.border },
  stepDotActive: { backgroundColor: theme.color.primary },
  card: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    padding:         theme.spacing.space5,
    gap:             18,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  cardTitle:  { ...theme.typography.heading, fontSize: 20, fontWeight: '700' },
  cardDesc:   { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 22 },
  field:      { gap: 8 },
  label:      { ...theme.typography.sectionDivider, letterSpacing: 1.1 },
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
  // Email / phone toggle
  modeRow: {
    flexDirection: 'row',
    gap:           8,
  },
  modeBtn: {
    flex:            1,
    paddingVertical: 8,
    borderRadius:    theme.radius.md,
    alignItems:      'center',
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  modeBtnActive:     { backgroundColor: theme.color.primary + '18', borderColor: theme.color.primary },
  modeBtnText:       { fontSize: 14, fontWeight: '600', color: theme.color.textMuted },
  modeBtnTextActive: { color: theme.color.primary },
  // Phone row
  phoneRow: {
    flexDirection: 'row',
    gap:           8,
    alignItems:    'center',
  },
  countryBox: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.lg,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 13,
  },
  countryFlag: { fontSize: 16 },
  countryCode: { color: theme.color.textPrimary, fontWeight: '600', fontSize: 15 },
  phoneInput:  { flex: 1 },
  // Buttons
  btn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 15,
    alignItems:      'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: theme.color.white, fontSize: 16, fontWeight: '700' },
  skipBtn:     { alignItems: 'center', paddingVertical: 6 },
  skipText:    { ...theme.typography.body, color: theme.color.textMuted },
  signoutBtn:  { alignItems: 'center', marginTop: 8 },
  signoutText: { ...theme.typography.label, color: theme.color.border },
});
