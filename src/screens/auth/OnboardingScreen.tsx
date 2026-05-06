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
import { useTranslation } from '../../lib/i18n';
import { useAuth } from '../../hooks/useAuth';
import { normalizeToEmail } from '../../lib/authHelpers';
import { DEFAULT_COUNTRY } from '../../components/PhoneInput';

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const { teamMember, organization, refreshTeamMember, signOut } = useAuth();
  const { t } = useTranslation();

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
  const [isInitializing,  setIsInitializing]  = useState(true);
  const [setupIncomplete, setSetupIncomplete] = useState(false);

  // ─── helpers ─────────────────────────────────────────────────

  // Fetch the current user's team_members row directly from DB.
  // Retries up to `maxAttempts` times with a 600 ms delay between tries to
  // handle the race condition where onAuthStateChange fires before
  // RegisterScreen's INSERT INTO team_members has finished.
  const fetchOwnRow = async (maxAttempts = 6) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await supabase
        .from('team_members')
        .select('id, org_id, role')
        .eq('auth_id', user.id)
        .maybeSingle();
      if (data) return data as { id: string; org_id: string; role: string };
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 600));
    }
    return null;
  };

  useEffect(() => {
    const init = async () => {
      // Retry-aware fetch — handles the timing race between
      // RegisterScreen's INSERTs and this screen mounting.
      const tm = await fetchOwnRow();

      if (!tm) {
        // After ~3 seconds of retries, still no row — registration was
        // incomplete (most likely the SQL migration hasn't been run yet).
        setSetupIncomplete(true);
        setIsInitializing(false);
        return;
      }

      // Invited employee (non-owner) — they don't need the wizard at all.
      // Their org already exists and is fully configured.
      if (tm.role !== 'owner') {
        await refreshTeamMember();
        return;  // navigation/index.tsx will switch to Main
      }

      // New org owner — load org name so step 1 is pre-filled correctly
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
    if (!companyName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    if (!localOrgId) { setStep(2); return; }
    setLoading(true);
    const { error } = await supabase
      .from('organizations')
      .update({ name: companyName.trim() })
      .eq('id', localOrgId);
    setLoading(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
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
        Alert.alert(t('error'), err.message);
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    setStep(3);
  };

  // Shared exit: mark onboarding complete + refresh useAuth state so navigation switches to Main.
  // If no team_members row is found after refresh (registration was incomplete),
  // show an actionable error instead of silently doing nothing.
  const finishOnboarding = async () => {
    setLoading(true);
    // Mark onboarding complete so AuthContext no longer needs the time-window heuristic
    if (teamMember?.id) {
      await supabase.from('team_members')
        .update({ has_completed_onboarding: true })
        .eq('id', teamMember.id);
    }
    await refreshTeamMember();

    // Verify the row actually exists now (stale closure — query DB directly)
    const tm = await fetchOwnRow(1);  // single attempt — INSERT already happened or not
    setLoading(false);

    if (!tm) {
      // Registration was incomplete — team_members row was never created.
      // This usually means the required SQL migration hasn't been run.
      Alert.alert(
        'Account Setup Incomplete',
        'Your account profile could not be found. Please sign out and register again after the administrator has applied the required database update.',
        [
          { text: t('signOut'), style: 'destructive', onPress: signOut },
          { text: t('tryAgain'), onPress: finishOnboarding },
        ]
      );
    }
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
        Alert.alert(t('error'), error.message);
        return;
      }
    }
    await finishOnboarding();
  };

  const handleSkipStep3 = async () => {
    await finishOnboarding();
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
          <Text style={s.initText}>{t('settingUpAccount')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Setup incomplete (registration failed mid-way) ──────────

  if (setupIncomplete) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.initLoader}>
          <Text style={s.incompleteIcon}>⚠️</Text>
          <Text style={s.incompleteTitle}>{t('setupIncomplete')}</Text>
          <Text style={s.incompleteDesc}>
            Your account was created but the profile setup did not finish.
            Please sign out and register again.
          </Text>
          <TouchableOpacity style={s.incompleteBtn} onPress={signOut} activeOpacity={0.8}>
            <Text style={s.incompleteBtnText}>{t('signOutAndTryAgain')}</Text>
          </TouchableOpacity>
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
          <Text style={s.title}>{t('letsGetSetUp')}</Text>
          <Text style={s.subtitle}>{t('step')} {step} / {TOTAL_STEPS}</Text>
          <Text style={s.poweredBy}>
            Powered by <Text style={s.poweredByKts}>KTS</Text>
          </Text>
          <StepIndicator />
        </View>

        {/* ─── Step 1: Company name ─── */}
        {step === 1 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('yourCompanyTitle')}</Text>
            <Text style={s.cardDesc}>{t('confirmOrgName')}</Text>
            <View style={s.field}>
              <Text style={s.label}>COMPANY / OFFICE NAME</Text>
              <TextInput
                style={s.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder={t('orgName')}
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
                : <Text style={s.btnText}>{t('continueArrow')}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Step 2: First service + stage ─── */}
        {step === 2 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('yourFirstService')}</Text>
            <Text style={s.cardDesc}>{t('firstServiceDesc')}</Text>
            <View style={s.field}>
              <Text style={s.label}>SERVICE NAME</Text>
              <TextInput
                style={s.input}
                value={serviceName}
                onChangeText={setServiceName}
                placeholder={t('serviceName')}
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
                placeholder={t('stageName')}
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
                : <Text style={s.btnText}>{t('continueArrow')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={() => setStep(3)} disabled={loading}>
              <Text style={s.skipText}>{t('skipForNow')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Step 3: Invite teammate ─── */}
        {step === 3 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('inviteTeammate')}</Text>
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
                placeholder={t('fullName')}
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
                  placeholder={t('email')}
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
                : <Text style={s.btnText}>{t('inviteAndContinue')}</Text>}
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity
              style={[s.skipBtn, loading && s.btnDisabled]}
              onPress={handleSkipStep3}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={theme.color.textMuted} />
                : <Text style={s.skipText}>{t('skipInviteLater')}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Sign out link */}
        <TouchableOpacity style={s.signoutBtn} onPress={signOut} disabled={loading}>
          <Text style={s.signoutText}>{t('signOut')}</Text>
        </TouchableOpacity>

      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: theme.color.bgBase },
  initLoader:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 32 },
  initText:    { ...theme.typography.body, color: theme.color.textSecondary, textAlign: 'center' },
  // Setup-incomplete error state
  incompleteIcon:    { fontSize: 48 },
  incompleteTitle:   { ...theme.typography.heading, fontSize: 20, fontWeight: '700' },
  incompleteDesc:    { ...theme.typography.body, color: theme.color.textSecondary, textAlign: 'center', lineHeight: 22 },
  incompleteBtn: {
    marginTop:       8,
    backgroundColor: theme.color.danger,
    borderRadius:    theme.radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  incompleteBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },
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
  poweredBy:     { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  poweredByKts:  { fontSize: 13, fontWeight: '800', color: theme.color.textSecondary, letterSpacing: 0.5 },
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
