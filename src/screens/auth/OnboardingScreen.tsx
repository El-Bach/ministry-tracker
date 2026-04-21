// src/screens/auth/OnboardingScreen.tsx
// Post-registration wizard: set up first service, first stage, invite teammates
// Session 26 — Phase 1 commercialization

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../../lib/supabase';
import { theme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { normalizeToEmail, isPhoneInput, IDENTIFIER_LABEL, IDENTIFIER_PLACEHOLDER } from '../../lib/authHelpers';

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
  const [inviteName,  setInviteName]  = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const handleStep1 = async () => {
    if (!companyName.trim()) { Alert.alert('Required', 'Please enter your company name.'); return; }
    if (!organization?.id) return;
    setLoading(true);
    const { error } = await supabase
      .from('organizations')
      .update({ name: companyName.trim() })
      .eq('id', organization.id);
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setStep(2);
  };

  const handleStep2 = async () => {
    // Both optional — can skip
    const orgId = teamMember?.org_id;
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
    const orgId = teamMember?.org_id;
    if (inviteName.trim() && inviteEmail.trim() && orgId) {
      setLoading(true);
      const normalizedEmail = normalizeToEmail(inviteEmail.trim());
      // Create invitation row so they auto-join on sign-up
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('invitations')
        .insert({
          org_id:     orgId,
          email:      normalizedEmail,
          role:       'member',
          invited_by: teamMember?.id,
          expires_at: expires,
        });
      setLoading(false);
      if (error && !error.message.includes('duplicate')) {
        Alert.alert('Error', error.message);
        return;
      }
    }
    // Done! Refresh so navigator picks up complete teamMember
    await refreshTeamMember();
  };

  const handleSkipStep3 = async () => {
    await refreshTeamMember();
  };

  const stepIndicator = () => (
    <View style={s.stepRow}>
      {[1, 2, 3].map(n => (
        <View key={n} style={[s.stepDot, step >= n && s.stepDotActive]} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoIcon}>🚀</Text>
          </View>
          <Text style={s.title}>Let's get you set up</Text>
          <Text style={s.subtitle}>Step {step} of {TOTAL_STEPS}</Text>
          {stepIndicator()}
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
              {loading ? <ActivityIndicator color={theme.color.white} /> : <Text style={s.btnText}>Continue →</Text>}
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
              {loading ? <ActivityIndicator color={theme.color.white} /> : <Text style={s.btnText}>Continue →</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={() => setStep(3)}>
              <Text style={s.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Step 3: Invite teammate ─── */}
        {step === 3 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Invite a Teammate</Text>
            <Text style={s.cardDesc}>Add a colleague to your organization. They'll sign in using this email and be linked to your account automatically.</Text>
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
            <View style={s.field}>
              <Text style={s.label}>{IDENTIFIER_LABEL}</Text>
              <TextInput
                style={s.input}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder={IDENTIFIER_PLACEHOLDER}
                placeholderTextColor={theme.color.textMuted}
                keyboardType={isPhoneInput(inviteEmail) && inviteEmail.length > 2 ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleStep3}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color={theme.color.white} /> : <Text style={s.btnText}>Invite & Continue →</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={handleSkipStep3} disabled={loading}>
              <Text style={s.skipText}>Skip — I'll invite later</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sign out link */}
        <TouchableOpacity style={s.signoutBtn} onPress={signOut}>
          <Text style={s.signoutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: theme.color.bgBase },
  container:  { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 28 },
  header:     { alignItems: 'center', gap: 10 },
  logoBox: {
    width:           64,
    height:          64,
    borderRadius:    theme.radius.xl,
    backgroundColor: theme.color.primary,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    4,
  },
  logoIcon:   { fontSize: 32 },
  title:      { ...theme.typography.heading, fontSize: 24, fontWeight: '800' },
  subtitle:   { ...theme.typography.body, color: theme.color.textSecondary },
  stepRow:    { flexDirection: 'row', gap: 8, marginTop: 8 },
  stepDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.color.border },
  stepDotActive: { backgroundColor: theme.color.primary },
  card: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    padding:         theme.spacing.space5,
    gap:             18,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  cardTitle: { ...theme.typography.heading, fontSize: 20, fontWeight: '700' },
  cardDesc:  { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 22 },
  field:     { gap: 6 },
  label:     { ...theme.typography.sectionDivider, letterSpacing: 1.1 },
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
  btn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 15,
    alignItems:      'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: theme.color.white, fontSize: 16, fontWeight: '700' },
  skipBtn:     { alignItems: 'center', paddingVertical: 4 },
  skipText:    { ...theme.typography.body, color: theme.color.textMuted },
  signoutBtn:  { alignItems: 'center', marginTop: 8 },
  signoutText: { ...theme.typography.label, color: theme.color.border },
});
