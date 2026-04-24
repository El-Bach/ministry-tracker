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
import { theme } from '../../theme';
import { RootStackParamList } from '../../types';
import { normalizeToEmail } from '../../lib/authHelpers';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type LoginMode = 'email' | 'phone';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<Nav>();

  const [mode,     setMode]     = useState<LoginMode>('email');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const identifier = mode === 'email' ? email : phone;

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
      Alert.alert('Login Failed', 'Incorrect credentials. Please try again.');
    }
  };

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setEmail('');
    setPhone('');
    setPassword('');
  };

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
            <Text style={styles.label}>PASSWORD</Text>
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
            {loading ? (
              <ActivityIndicator color={theme.color.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
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
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 32 },
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
  title:     { ...theme.typography.heading, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subtitle:  { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '500', letterSpacing: 0.3 },

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
  tabActive: {
    backgroundColor: theme.color.primary,
  },
  tabText: {
    ...theme.typography.label,
    color:      theme.color.textSecondary,
    fontWeight: '600',
    fontSize:   14,
  },
  tabTextActive: {
    color: theme.color.white,
  },

  form:    { gap: 18 },
  field:   { gap: 6 },
  label:   { ...theme.typography.sectionDivider, letterSpacing: 1.2 },
  input: {
    backgroundColor:  theme.color.bgSurface,
    borderWidth:      1,
    borderColor:      theme.color.border,
    borderRadius:     theme.radius.lg,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:  14,
    color:            theme.color.textPrimary,
    fontSize:         15,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingEnd: 52,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  button: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       theme.spacing.space2,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: theme.color.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  signupRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupText: { ...theme.typography.body, color: theme.color.textSecondary },
  signupLink: { ...theme.typography.body, color: theme.color.primary, fontWeight: '700' },
  footer:     { ...theme.typography.label, color: theme.color.border, textAlign: 'center' },
});
