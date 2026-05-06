// src/screens/auth/LoginScreen.tsx
// Single-input login: accepts EITHER a real email OR a phone number.
// `normalizeToEmail()` converts phone → internal `p<digits>@cleartrack.internal`
// before sending to Supabase, so phone-only users can still sign in after
// signing out (no DB migration needed for existing phone-registered accounts).

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import supabase from '../../lib/supabase';
import { theme } from '../../theme';
import { RootStackParamList } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { normalizeIdentifier } from '../../lib/authHelpers';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Map raw Supabase error messages to friendly text
function friendlyAuthError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('invalid login') || r.includes('invalid credentials') || r.includes('incorrect'))
    return 'Incorrect email/phone or password. Please try again.';
  if (r.includes('not confirmed') || r.includes('email not confirmed'))
    return 'Your email address has not been confirmed yet. Check your inbox for a confirmation link, or ask your administrator to disable email confirmation in Supabase.';
  if (r.includes('too many'))
    return 'Too many attempts. Please wait a few minutes and try again.';
  if (r.includes('user not found') || r.includes('no user'))
    return 'No account found with these credentials.';
  return raw; // show actual message for anything else
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation  = useNavigation<Nav>();
  const { t } = useTranslation();

  // `identifier` is what the user types — either an email or a phone number.
  // We keep the variable named `email` for minimal diff with the rest of the file.
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);

  // Width of the "GovPilot" title (measured via onLayout) — used to size the
  // logo image above so its width matches the title's width exactly.
  const [titleWidth,  setTitleWidth]  = useState<number | null>(null);

  // (No dynamic keyboard switching — phone numbers type fine on the
  //  email-address keyboard, and switching mid-word would block letter input
  //  before the user has a chance to type `@`.)

  // Forgot-password inline form
  const [showForgot,   setShowForgot]   = useState(false);
  const [forgotEmail,  setForgotEmail]  = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent,   setForgotSent]   = useState(false);

  // ─── Sign in ────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    setLoading(true);

    const trimmed = email.trim();
    const looksLikePhone = !trimmed.includes('@');

    // Resolve the actual Supabase Auth email to sign in with.
    //
    // For phone input we try the `lookup_auth_email_by_phone` RPC first — this
    // returns the user's REAL auth email by scanning team_members.phone. That
    // way, owners who registered by email but later added a phone in their
    // profile can log in with either identifier.
    //
    // If the RPC returns NULL (no match) we fall back to the local conversion
    // (`p<digits>@cleartrack.internal`) which still works for users whose auth
    // identity actually IS their phone (registered via phone originally).
    let supabaseEmail: string;
    if (looksLikePhone) {
      try {
        const { data, error: rpcErr } = await supabase
          .rpc('lookup_auth_email_by_phone', { p_phone: trimmed });
        if (!rpcErr && typeof data === 'string' && data.length > 0) {
          supabaseEmail = data;
        } else {
          supabaseEmail = normalizeIdentifier(trimmed);
        }
      } catch {
        // RPC not deployed yet, or transient network error — fall back.
        supabaseEmail = normalizeIdentifier(trimmed);
      }
    } else {
      supabaseEmail = normalizeIdentifier(trimmed);
    }

    const { error } = await signIn(supabaseEmail, password);
    setLoading(false);
    if (error) {
      Alert.alert(t('loginFailed'), friendlyAuthError(error));
    }
  };

  // ─── Forgot password ─────────────────────────────────────────

  const openForgot = () => {
    setForgotEmail(email.trim()); // pre-fill from whatever they typed
    setForgotSent(false);
    setShowForgot(true);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim().toLowerCase(),
      { redirectTo: 'https://ministry-papers.netlify.app' },
    );
    setForgotLoading(false);
    if (error) {
      Alert.alert(t('error'), error.message);
    } else {
      setForgotSent(true);
    }
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={40}
      >
        {/* Logo / Header */}
        {/* Icon's width/height auto-fit to the "GovPilot" title width below it
            (measured via onLayout, single-pass). */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/icon.png')}
            style={[
              styles.logoImage,
              titleWidth ? { width: titleWidth, height: titleWidth } : null,
            ]}
            resizeMode="contain"
          />
          <Text
            style={styles.title}
            onLayout={(e) => {
              if (titleWidth) return;
              const w = e.nativeEvent.layout.width;
              if (w > 0) setTitleWidth(w);
            }}
          >
            GovPilot
          </Text>
          <Text style={styles.subtitle}>{t('govFileTracking')}</Text>
          <Text style={styles.poweredBy}>
            Powered by <Text style={styles.poweredByKts}>KTS</Text>
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>{t('email').toUpperCase()} OR PHONE</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com  or  +961 70 123 456"
              placeholderTextColor={theme.color.textMuted}
              // email-address keyboard supports both formats: it has letters,
              // digits, `+`, `@`, and `.` — so the user can type either an
              // email or a phone number without the keyboard switching.
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>{t('password').toUpperCase()}</Text>
              <TouchableOpacity onPress={openForgot} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.forgotLink}>{t('forgotPassword')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.color.textMuted}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPass(v => !v)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={theme.color.white} />
              : <Text style={styles.buttonText}>{t('signIn')}</Text>}
          </TouchableOpacity>

          {/* ─── Forgot password panel ─── */}
          {showForgot && (
            <View style={styles.forgotCard}>
              {forgotSent ? (
                <>
                  <Text style={styles.forgotTitle}>✅ {t('resetSent')}</Text>
                  <Text style={styles.forgotDesc}>
                    <Text style={{ fontWeight: '700' }}>{forgotEmail}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => setShowForgot(false)}>
                    <Text style={styles.forgotClose}>{t('close')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.forgotTitle}>{t('resetPassword')}</Text>
                  <Text style={styles.forgotDesc}>
                    {t('enterEmail')}
                  </Text>
                  <TextInput
                    style={styles.forgotInput}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="your@email.com"
                    placeholderTextColor={theme.color.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.forgotBtnRow}>
                    <TouchableOpacity
                      style={styles.forgotCancelBtn}
                      onPress={() => setShowForgot(false)}
                    >
                      <Text style={styles.forgotCancelText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.forgotSendBtn, forgotLoading && styles.buttonDisabled]}
                      onPress={handleForgotPassword}
                      disabled={forgotLoading}
                      activeOpacity={0.8}
                    >
                      {forgotLoading
                        ? <ActivityIndicator color={theme.color.white} size="small" />
                        : <Text style={styles.forgotSendText}>{t('sendResetLink')}</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

        </View>

        {/* Sign up link */}
        <View style={styles.signupRow}>
          <Text style={styles.signupText}>{t('noAccount')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.signupLink}>{t('createAccount')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>{t('poweredBy')}</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32, gap: 32 },
  header:    { alignItems: 'center', gap: 10 },
  logoImage: {
    width:        72,
    height:       72,
    borderRadius: theme.radius.xl,
    marginBottom: 4,
  },
  title:        { ...theme.typography.heading, fontSize: 26, fontWeight: '800' },
  subtitle:     { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '500' },
  poweredBy:    { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '500', marginTop: 2 },
  poweredByKts: { ...theme.typography.body, fontWeight: '800', color: theme.color.textSecondary },

  // Tabs
  tabs: {
    flexDirection:   'row',
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.border,
    padding:         4,
    gap:             4,
  },
  tab: {
    flex:           1,
    paddingVertical: 10,
    alignItems:     'center',
    borderRadius:   theme.radius.md,
  },
  tabActive:     { backgroundColor: theme.color.primary },
  tabText:       { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: theme.color.white },

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

  // Password row
  passwordLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotLink:       { ...theme.typography.caption, color: theme.color.primary, fontWeight: '600' },
  passwordRow:      { position: 'relative' },
  passwordInput:    { paddingEnd: 52 },
  eyeBtn:           { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  eyeIcon:          { fontSize: 18 },

  // Sign in button
  button:         { backgroundColor: theme.color.primary, borderRadius: theme.radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: theme.spacing.space2 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: theme.color.white, fontSize: 16, fontWeight: '700' },

  // Forgot password card
  forgotCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.border,
    padding:         theme.spacing.space4,
    gap:             12,
  },
  forgotTitle:      { ...theme.typography.body, fontWeight: '700', color: theme.color.textPrimary },
  forgotDesc:       { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 20 },
  forgotInput: {
    backgroundColor:   theme.color.bgBase,
    borderWidth:       1,
    borderColor:       theme.color.border,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   12,
    color:             theme.color.textPrimary,
    fontSize:          15,
  },
  forgotBtnRow:    { flexDirection: 'row', gap: 8 },
  forgotCancelBtn: { flex: 1, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingVertical: 10, alignItems: 'center' },
  forgotCancelText:{ ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  forgotSendBtn:   { flex: 2, backgroundColor: theme.color.primary, borderRadius: theme.radius.md, paddingVertical: 10, alignItems: 'center' },
  forgotSendText:  { color: theme.color.white, fontWeight: '700', fontSize: 14 },
  forgotClose:     { ...theme.typography.body, color: theme.color.primary, fontWeight: '600', textAlign: 'center' },

  // Phone note
  phoneNote: { ...theme.typography.caption, color: theme.color.textMuted, textAlign: 'center' },

  // Bottom
  signupRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupText: { ...theme.typography.body, color: theme.color.textSecondary },
  signupLink: { ...theme.typography.body, color: theme.color.primary, fontWeight: '700' },
  footer:     { ...theme.typography.label, color: theme.color.border, textAlign: 'center' },
});
