// src/screens/auth/RegisterScreen.tsx
// Registration — invite code FIRST, then account details.
// Flow A (invited):  Step 1: enter code → validate → Step 2: name/phone/password → register_join_org
// Flow B (new org):  "Create Organization" path → company name + email + password → register_new_org
// Session 29: code-first flow, phone lock enforcement, no company name for invited users

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
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
} from '../../lib/authHelpers';
import PhoneInput, { DEFAULT_COUNTRY } from '../../components/PhoneInput';
import { useTranslation } from '../../lib/i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Mode ─────────────────────────────────────────────────────
type ScreenMode = 'code' | 'details' | 'neworg';

interface CodePreview {
  orgName:      string;
  role:         string;
  inviteeName:  string | null;
  hasPhoneLock: boolean;   // code requires a matching phone (phone not returned for security)
  orgId:        string;
}

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();

  // ── Step 1: invite code
  const [mode,         setMode]         = useState<ScreenMode>('code');
  const [inviteCode,   setInviteCode]   = useState('');
  const [validating,   setValidating]   = useState(false);
  const [codePreview,  setCodePreview]  = useState<CodePreview | null>(null);

  // ── Step 2: account details (invited)
  const [fullName,     setFullName]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [countryCode,  setCountryCode]  = useState(DEFAULT_COUNTRY.code);
  const [password,     setPassword]     = useState('');
  const [confirmPass,  setConfirmPass]  = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,      setLoading]      = useState(false);

  // ── New Org path
  const [orgName,      setOrgName]      = useState('');
  const [orgEmail,     setOrgEmail]     = useState('');
  const [orgFullName,  setOrgFullName]  = useState('');
  const [orgPassword,  setOrgPassword]  = useState('');
  const [orgConfirm,   setOrgConfirm]   = useState('');
  const [showOrgPass,  setShowOrgPass]  = useState(false);
  const [showOrgConf,  setShowOrgConf]  = useState(false);
  const [orgLoading,   setOrgLoading]   = useState(false);

  // ── Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fadeTransition = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }).start();
    });
  };

  // ─────────────────────────────────────────────────────────────
  // Step 1 — Validate invite code
  // ─────────────────────────────────────────────────────────────
  const handleValidateCode = async () => {
    const cleaned = inviteCode.trim().toUpperCase();
    if (!cleaned) {
      Alert.alert(t('enterCode'), t('fieldRequired'));
      return;
    }
    setValidating(true);
    try {
      // Call SECURITY DEFINER RPC — never exposes invitee_phone or all codes to the caller
      const { data, error } = await supabase.rpc('lookup_invite_code', { p_code: cleaned });

      if (error || !data) {
        Alert.alert(t('codeNotFound'), t('codeNotFound'));
        return;
      }

      const preview: CodePreview = {
        orgName:      data.org_name ?? 'the organization',
        role:         data.role ?? 'member',
        inviteeName:  data.invitee_name ?? null,
        hasPhoneLock: data.has_phone_lock ?? false,
        orgId:        data.org_id,
      };
      setCodePreview(preview);

      // Pre-fill name from code if set
      if (preview.inviteeName) setFullName(preview.inviteeName);

      fadeTransition(() => setMode('details'));
    } catch (e: any) {
      Alert.alert(t('error'), e.message ?? t('somethingWrong'));
    } finally {
      setValidating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Step 2 — Register + join org
  // ─────────────────────────────────────────────────────────────
  const handleRegisterInvited = async () => {
    if (!codePreview) return;

    if (!fullName.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    if (!phone.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('warning'), t('passwordTooShort'));
      return;
    }
    if (password !== confirmPass) {
      Alert.alert(t('warning'), t('passwordsMatch'));
      return;
    }

    const fullPhone    = `${countryCode}${phone.trim()}`;
    const authEmail    = normalizeToEmail(fullPhone);
    const realPhone    = normalizePhone(fullPhone);

    // Phone lock: if inviteePhone is set, the entered phone must match
    if (codePreview.inviteePhone && codePreview.inviteePhone !== fullPhone) {
      Alert.alert(t('warning'), t('phoneLocked'));
      return;
    }

    setLoading(true);
    try {
      // 1. Create auth account — or sign in if account already exists (returning member)
      let userId: string | undefined;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password,
      });

      if (authError) {
        const msg = authError.message ?? '';
        const isExisting =
          msg.toLowerCase().includes('already') ||
          msg.toLowerCase().includes('registered') ||
          msg.toLowerCase().includes('exists') ||
          (authError as any).status === 422;

        if (isExisting) {
          // Account exists — try signing in with the provided password
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password,
          });
          if (signInError) {
            // Exists but wrong password — tell them to use their old password
            throw new Error(
              'You already have an account. Please use the same password you registered with before, then tap "Create Account & Join" again.'
            );
          }
          userId = signInData.user?.id;
        } else {
          throw new Error(authError.message);
        }
      } else {
        userId = authData.user?.id;
      }

      if (!userId) throw new Error('Account creation failed. Please try again.');

      // 2. Join org via SECURITY DEFINER RPC (bypasses RLS — handles both new and returning members)
      const { error: joinErr } = await supabase.rpc('register_join_org_by_code', {
        p_code:  inviteCode.trim().toUpperCase(),
        p_name:  fullName.trim(),
        p_email: authEmail,
        p_phone: realPhone,
      });
      if (joinErr) throw new Error('Failed to join organization: ' + joinErr.message);

    } catch (err: any) {
      const msg: string = (err.message ?? 'Something went wrong.')
        .replace(/p\d+@cleartrack\.internal/g, fullPhone)
        .replace(/\+?\d{7,}@cleartrack\.internal/g, fullPhone);
      Alert.alert(t('error'), msg);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // New Org path — create organization + owner account
  // ─────────────────────────────────────────────────────────────
  const handleCreateOrg = async () => {
    if (!orgFullName.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    if (!orgEmail.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(orgEmail.trim())) {
      Alert.alert(t('error'), t('invalidEmail'));
      return;
    }
    if (!orgName.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    if (orgPassword.length < 6) {
      Alert.alert(t('warning'), t('passwordTooShort'));
      return;
    }
    if (orgPassword !== orgConfirm) {
      Alert.alert(t('warning'), t('passwordsMatch'));
      return;
    }

    const authEmail = orgEmail.trim().toLowerCase();

    setOrgLoading(true);
    try {
      // 1. Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: orgPassword,
      });
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Account creation failed. Please try again.');

      // 2. Create org via SECURITY DEFINER RPC
      const slug = orgName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { error: createErr } = await supabase.rpc('register_new_org', {
        p_org_name: orgName.trim(),
        p_org_slug: `${slug}-${Date.now()}`,
        p_name:     orgFullName.trim(),
        p_email:    authEmail,
        p_phone:    null,
      });
      if (createErr) throw new Error('Failed to create organization: ' + createErr.message);

    } catch (err: any) {
      Alert.alert(t('error'), err.message ?? t('somethingWrong'));
    } finally {
      setOrgLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAwareScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={80}
      >
        {/* ── Logo header ── */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoIcon}>⊞</Text>
          </View>
          <Text style={s.title}>
            {mode === 'neworg' ? t('createOrganization') : t('createAccount')}
          </Text>
          <Text style={s.subtitle}>
            {mode === 'code'    && t('enterInviteCode')}
            {mode === 'details' && `${t('youInvitedTo')} ${codePreview?.orgName ?? ''} (${capitalize(codePreview?.role ?? '')})`}
            {mode === 'neworg'  && t('newOrgFlow')}
          </Text>
          <Text style={s.poweredBy}>
            {t('poweredBy')}
          </Text>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ══════════════════════════════════════════════════
              STEP 1 — Invite code entry
          ══════════════════════════════════════════════════ */}
          {mode === 'code' && (
            <View style={s.form}>
              <View style={s.field}>
                <Text style={s.label}>{t('inviteCode').toUpperCase()}</Text>
                <TextInput
                  style={[s.input, s.codeInput]}
                  value={inviteCode}
                  onChangeText={(v) => {
                    // Strip everything except letters/digits, uppercase
                    const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    // Auto-insert dash after position 4, cap at 8 chars (XXXX-XXXX)
                    const capped = raw.slice(0, 8);
                    const formatted = capped.length > 4
                      ? `${capped.slice(0, 4)}-${capped.slice(4)}`
                      : capped;
                    setInviteCode(formatted);
                  }}
                  placeholder="XXXX-XXXX"
                  placeholderTextColor={theme.color.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleValidateCode}
                />
              </View>

              <TouchableOpacity
                style={[s.button, validating && s.buttonDisabled]}
                onPress={handleValidateCode}
                disabled={validating}
                activeOpacity={0.8}
              >
                {validating ? (
                  <ActivityIndicator color={theme.color.white} />
                ) : (
                  <Text style={s.buttonText}>{t('validateCode')} →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════════════════════════════════════════════
              STEP 2 — Account details (invited user)
          ══════════════════════════════════════════════════ */}
          {mode === 'details' && codePreview && (
            <View style={s.form}>
              {/* Welcome banner */}
              <View style={s.welcomeBanner}>
                <Text style={s.welcomeIcon}>🎉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.welcomeTitle}>
                    {codePreview.inviteeName
                      ? `${t('welcomeTo')} ${codePreview.inviteeName}!`
                      : `✓ ${t('success')}`}
                  </Text>
                  <Text style={s.welcomeSub}>
                    {t('youInvitedTo')} <Text style={{ fontWeight: '700' }}>{codePreview.orgName}</Text>{' '}
                    (<Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{codePreview.role}</Text>)
                  </Text>
                </View>
              </View>

              {/* Full name */}
              <View style={s.field}>
                <Text style={s.label}>{t('fullName').toUpperCase()}</Text>
                <TextInput
                  style={s.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t('fullName')}
                  placeholderTextColor={theme.color.textMuted}
                  autoCapitalize="words"
                  editable={!codePreview.inviteeName} // locked if pre-filled
                />
                {!!codePreview.inviteeName && (
                  <Text style={s.lockedHint}>🔒</Text>
                )}
              </View>

              {/* Phone — locked if code has inviteePhone */}
              <View style={s.field}>
                <Text style={s.label}>{t('phoneNumber').toUpperCase()}</Text>
                {codePreview.inviteePhone ? (
                  // Locked display
                  <View style={[s.input, s.lockedInput]}>
                    <Text style={s.lockedText}>{codePreview.inviteePhone}</Text>
                    <Text style={s.lockIcon}>🔒</Text>
                  </View>
                ) : (
                  <PhoneInput
                    value={phone}
                    onChangeText={setPhone}
                    countryCode={countryCode}
                    onCountryChange={setCountryCode}
                    placeholder="70 123 456"
                  />
                )}
                {!!codePreview.inviteePhone && (
                  <Text style={s.lockedHint}>🔒</Text>
                )}
              </View>

              {/* Password */}
              <View style={s.field}>
                <Text style={s.label}>{t('password').toUpperCase()}</Text>
                <View style={s.passWrap}>
                  <TextInput
                    style={s.passInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('passwordTooShort')}
                    placeholderTextColor={theme.color.textMuted}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                    <Text style={s.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.label}>{t('confirmPassword').toUpperCase()}</Text>
                <View style={s.passWrap}>
                  <TextInput
                    style={s.passInput}
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    placeholder={t('confirmPassword')}
                    placeholderTextColor={theme.color.textMuted}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                    <Text style={s.eyeIcon}>{showConfirm ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[s.button, loading && s.buttonDisabled]}
                onPress={handleRegisterInvited}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={theme.color.white} />
                ) : (
                  <Text style={s.buttonText}>{t('createAccount')}</Text>
                )}
              </TouchableOpacity>

              {/* Back to code step */}
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => fadeTransition(() => { setMode('code'); setCodePreview(null); })}
                activeOpacity={0.7}
              >
                <Text style={s.backBtnText}>← {t('back')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════════════════════════════════════════════
              NEW ORG path — create organization
          ══════════════════════════════════════════════════ */}
          {mode === 'neworg' && (
            <View style={s.form}>
              <View style={s.field}>
                <Text style={s.label}>{t('fullName').toUpperCase()}</Text>
                <TextInput
                  style={s.input}
                  value={orgFullName}
                  onChangeText={setOrgFullName}
                  placeholder={t('fullName')}
                  placeholderTextColor={theme.color.textMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>{t('email').toUpperCase()}</Text>
                <TextInput
                  style={s.input}
                  value={orgEmail}
                  onChangeText={setOrgEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>{t('orgName').toUpperCase()}</Text>
                <TextInput
                  style={s.input}
                  value={orgName}
                  onChangeText={setOrgName}
                  placeholder={t('orgName')}
                  placeholderTextColor={theme.color.textMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>{t('password').toUpperCase()}</Text>
                <View style={s.passWrap}>
                  <TextInput
                    style={s.passInput}
                    value={orgPassword}
                    onChangeText={setOrgPassword}
                    placeholder={t('passwordTooShort')}
                    placeholderTextColor={theme.color.textMuted}
                    secureTextEntry={!showOrgPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowOrgPass(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                    <Text style={s.eyeIcon}>{showOrgPass ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.label}>{t('confirmPassword').toUpperCase()}</Text>
                <View style={s.passWrap}>
                  <TextInput
                    style={s.passInput}
                    value={orgConfirm}
                    onChangeText={setOrgConfirm}
                    placeholder={t('confirmPassword')}
                    placeholderTextColor={theme.color.textMuted}
                    secureTextEntry={!showOrgConf}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowOrgConf(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                    <Text style={s.eyeIcon}>{showOrgConf ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[s.button, orgLoading && s.buttonDisabled]}
                onPress={handleCreateOrg}
                disabled={orgLoading}
                activeOpacity={0.8}
              >
                {orgLoading ? (
                  <ActivityIndicator color={theme.color.white} />
                ) : (
                  <Text style={s.buttonText}>{t('createOrganization')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.backBtn}
                onPress={() => fadeTransition(() => setMode('code'))}
                activeOpacity={0.7}
              >
                <Text style={s.backBtnText}>← {t('inviteCode')}</Text>
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>

        {/* ── Bottom links ── */}
        <View style={s.bottomLinks}>
          {mode !== 'neworg' && (
            <TouchableOpacity
              style={s.createOrgBtn}
              onPress={() => fadeTransition(() => setMode('neworg'))}
              activeOpacity={0.75}
            >
              <Text style={s.createOrgBtnText}>🏢 {t('createOrganization')}</Text>
            </TouchableOpacity>
          )}

          <View style={s.loginRow}>
            <Text style={s.loginText}>{t('haveAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={s.loginLink}>{t('signIn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────
function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32, gap: 24 },

  // Header
  header: { alignItems: 'center', gap: 10 },
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
  poweredBy:    { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  poweredByKts: { fontSize: 13, fontWeight: '800', color: theme.color.textSecondary, letterSpacing: 0.5 },

  // Form
  form:  { gap: 18 },
  field: { gap: 6 },
  label: { ...theme.typography.sectionDivider, letterSpacing: 1.2 },
  input: {
    backgroundColor:   theme.color.bgSurface,
    borderWidth:       1,
    borderColor:       theme.color.border,
    borderRadius:      theme.radius.lg,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   14,
    color:             theme.color.textPrimary,
    fontSize:          15,
  },
  codeInput: {
    fontSize:    20,
    fontWeight:  '700',
    letterSpacing: 3,
    textAlign:   'center',
  },
  lockedInput: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.bgBase,
    borderColor:    theme.color.border,
    opacity:        0.75,
  },
  lockedText: { color: theme.color.textSecondary, fontSize: 15 },
  lockIcon:   { fontSize: 14 },
  lockedHint: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },

  // Welcome banner
  welcomeBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: theme.color.success + '18',
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space3,
    borderWidth:     1,
    borderColor:     theme.color.success + '44',
  },
  welcomeIcon:  { fontSize: 24 },
  welcomeTitle: { ...theme.typography.body, color: theme.color.success, fontWeight: '700' },
  welcomeSub:   { ...theme.typography.label, color: theme.color.textSecondary, marginTop: 2 },

  // Password
  passWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgSurface,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.lg,
    paddingEnd:      4,
  },
  passInput: {
    flex:              1,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   14,
    color:             theme.color.textPrimary,
    fontSize:          15,
  },
  eyeBtn:  { padding: 10 },
  eyeIcon: { fontSize: 18 },

  // Buttons
  button: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       theme.spacing.space2,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: theme.color.white, fontSize: 16, fontWeight: '700' },

  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { color: theme.color.textMuted, fontSize: 14, fontWeight: '500' },

  // Bottom section
  bottomLinks: { gap: 16, marginTop: 8 },
  createOrgBtn: {
    alignItems:       'center',
    paddingVertical:  12,
    borderRadius:     theme.radius.md,
    borderWidth:      1,
    borderColor:      theme.color.border,
    backgroundColor:  theme.color.bgSurface,
  },
  createOrgBtnText: { color: theme.color.textSecondary, fontSize: 14, fontWeight: '600' },
  loginRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText:   { ...theme.typography.body, color: theme.color.textSecondary },
  loginLink:   { ...theme.typography.body, color: theme.color.primary, fontWeight: '700' },
});
