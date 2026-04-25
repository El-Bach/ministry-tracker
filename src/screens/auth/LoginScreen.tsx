// src/screens/auth/LoginScreen.tsx
// Separate Email tab and Phone tab login.
// Both use the same Supabase auth via normalizeToEmail().

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import supabase from '../../lib/supabase';
import { theme } from '../../theme';
import { RootStackParamList } from '../../types';
import { normalizeToEmail } from '../../lib/authHelpers';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type LoginMode = 'email' | 'phone';

// Map raw Supabase error messages to friendly text
function friendlyAuthError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('invalid login') || r.includes('invalid credentials') || r.includes('incorrect'))
    return 'Incorrect email or password. Please try again.';
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

  const [mode,     setMode]     = useState<LoginMode>('email');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Forgot-password inline form
  const [showForgot,   setShowForgot]   = useState(false);
  const [forgotEmail,  setForgotEmail]  = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent,   setForgotSent]   = useState(false);

  const identifier = mode === 'email' ? email : phone;

  // ─── Sign in ────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Required', mode === 'email'
        ? 'Please enter your email address and password.'
        : 'Please enter your phone number and password.');
      return;
    }
    setLoading(true);
    const supabaseEmail = normalizeToEmail(identifier);
    const { error } = await signIn(supabaseEmail, password);
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', friendlyAuthError(error));
    }
  };

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setEmail('');
    setPhone('');
    setPassword('');
    setShowForgot(false);
    setForgotSent(false);
  };

  // ─── Forgot password ─────────────────────────────────────────

  const openForgot = () => {
    setForgotEmail(email.trim()); // pre-fill from whatever they typed
    setForgotSent(false);
    setShowForgot(true);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim().toLowerCase(),
      { redirectTo: 'https://ministry-papers.netlify.app' },
    );
    setForgotLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
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
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>⊞</Text>
          </View>
          <Text style={styles.title}>GovPilot</Text>
          <Text style={styles.subtitle}>Government File Tracking</Text>
        </View>

        {/* Mode toggle tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'email' && styles.tabActive]}
            onPress={() => switchMode('email')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'email' && styles.tabTextActive]}>
              ✉️  Email
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'phone' && styles.tabActive]}
            onPress={() => switchMode('phone')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'phone' && styles.tabTextActive]}>
              📱  Phone
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'email' ? (
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={theme.color.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+961 70 123 456"
                placeholderTextColor={theme.color.textMuted}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <View style={styles.field}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>PASSWORD</Text>
              {/* Forgot password link — email mode only */}
              {mode === 'email' && (
                <TouchableOpacity onPress={openForgot} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              )}
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
              : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>

          {/* ─── Forgot password panel ─── */}
          {showForgot && mode === 'email' && (
            <View style={styles.forgotCard}>
              {forgotSent ? (
                <>
                  <Text style={styles.forgotTitle}>✅ Email sent</Text>
                  <Text style={styles.forgotDesc}>
                    Check your inbox at <Text style={{ fontWeight: '700' }}>{forgotEmail}</Text> for a password-reset link.
                  </Text>
                  <TouchableOpacity onPress={() => setShowForgot(false)}>
                    <Text style={styles.forgotClose}>Close</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.forgotTitle}>Reset your password</Text>
                  <Text style={styles.forgotDesc}>
                    Enter your email address and we'll send you a link to reset your password.
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
                      <Text style={styles.forgotCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.forgotSendBtn, forgotLoading && styles.buttonDisabled]}
                      onPress={handleForgotPassword}
                      disabled={forgotLoading}
                      activeOpacity={0.8}
                    >
                      {forgotLoading
                        ? <ActivityIndicator color={theme.color.white} size="small" />
                        : <Text style={styles.forgotSendText}>Send Reset Email</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Phone mode: no forgot-password support */}
          {mode === 'phone' && (
            <Text style={styles.phoneNote}>
              To reset your password, contact your organization administrator.
            </Text>
          )}
        </View>

        {/* Sign up link */}
        <View style={styles.signupRow}>
          <Text style={styles.signupText}>New to GovPilot? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.signupLink}>Create an account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Your data is private and secure</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32, gap: 32 },
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
  logoIcon:  { fontSize: 32, color: theme.color.white },
  title:     { ...theme.typography.heading, fontSize: 26, fontWeight: '800' },
  subtitle:  { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '500' },

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
