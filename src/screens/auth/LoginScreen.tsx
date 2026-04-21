// src/screens/auth/LoginScreen.tsx
// Email + password OR phone number + password login
// Session 26: phone-as-username (Option A) — normalizeToEmail() converts phone to internal email

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
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
import {
  normalizeToEmail,
  isPhoneInput,
  IDENTIFIER_LABEL,
  IDENTIFIER_PLACEHOLDER,
} from '../../lib/authHelpers';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<Nav>();
  const [identifier, setIdentifier] = useState('');   // email or phone
  const [password,   setPassword]   = useState('');
  const [loading,    setLoading]    = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email or phone number and password.');
      return;
    }
    setLoading(true);
    const email = normalizeToEmail(identifier);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', 'Incorrect phone/email or password. Please try again.');
    }
  };

  const isPhone = isPhoneInput(identifier) && identifier.trim().length > 3;

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

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>{IDENTIFIER_LABEL}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder={IDENTIFIER_PLACEHOLDER}
                placeholderTextColor={theme.color.textMuted}
                keyboardType={isPhone ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {/* Live indicator */}
              {identifier.trim().length > 2 && (
                <View style={[styles.typeTag, isPhone ? styles.typeTagPhone : styles.typeTagEmail]}>
                  <Text style={styles.typeTagText}>{isPhone ? '📱' : '✉️'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.color.textMuted}
              secureTextEntry
            />
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
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 40 },
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
  logoIcon:    { fontSize: 32, color: theme.color.white },
  title:       { ...theme.typography.heading, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subtitle:    { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '500', letterSpacing: 0.3 },
  form:        { gap: 20 },
  field:       { gap: 6 },
  label:       { ...theme.typography.sectionDivider, letterSpacing: 1.2 },
  inputRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    width:         36,
    height:        36,
    borderRadius:  theme.radius.md,
    justifyContent: 'center',
    alignItems:    'center',
    borderWidth:   1,
  },
  typeTagPhone: { backgroundColor: theme.color.success + '18', borderColor: theme.color.success + '44' },
  typeTagEmail: { backgroundColor: theme.color.primary + '18', borderColor: theme.color.primary + '44' },
  typeTagText:  { fontSize: 18 },
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
