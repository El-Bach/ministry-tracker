// src/screens/AccountScreen.tsx
// User profile: view/edit name & phone, change password, org info, sign out + plan upgrade
// Session 26 / 28

import React, { useState, useEffect, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { DashboardStackParamList } from '../types';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { emailToDisplay, isPhoneInput, normalizeToEmail } from '../lib/authHelpers';
import { SUPPORT_EMAIL, PRIVACY_URL, TERMS_URL, PLAN_LIMITS } from '../lib/config';
import { useTranslation, TranslationKey } from '../lib/i18n';

const ROLE_COLORS: Record<string, string> = {
  owner:  theme.color.primary,
  admin:  theme.color.warning,
  member: theme.color.success,
  viewer: theme.color.textMuted,
};

const PLAN_LABELS: Record<string, { labelKey: TranslationKey; color: string }> = {
  free:     { labelKey: 'planFreeLabel',    color: theme.color.textMuted },
  basic:    { labelKey: 'planBasicLabel',   color: theme.color.primary },
  premium:  { labelKey: 'planPremiumLabel', color: '#F59E0B' },
  starter:  { labelKey: 'planBasicLabel',   color: theme.color.success },
  business: { labelKey: 'planBasicLabel',   color: theme.color.primary },
};

// ── Pricing plans definition ───────────────────────────────────────────────
const PLANS: Array<{
  key: string;
  nameKey: TranslationKey;
  emoji: string;
  tagline: TranslationKey;
  monthlyPrice: number;
  annualPrice: number;
  color: string;
  accentBg: string;
  badge?: string;
  features: Array<{ textKey: TranslationKey; included: boolean; info?: string }>;
}> = [
  {
    key: 'free',
    nameKey: 'planNameFree',
    emoji: '🌱',
    tagline: 'planFreeTagline',
    monthlyPrice: 0,
    annualPrice: 0,
    color: theme.color.textMuted,
    accentBg: theme.color.bgBase,
    features: [
      { textKey: 'feat3Members',          included: true  },
      { textKey: 'feat25Files',           included: true  },
      { textKey: 'featDocScanning',       included: true  },
      { textKey: 'featBasicFinancial',    included: true  },
      { textKey: 'featStageTracking',     included: true  },
      { textKey: 'featReportsExport',     included: false },
      { textKey: 'featPDFUpload',         included: false },
      { textKey: 'featPrioritySupport',   included: false },
      { textKey: 'featUnlimitedMembers',  included: false },
    ],
  },
  {
    key: 'basic',
    nameKey: 'planNameBasic',
    emoji: '⚡',
    tagline: 'planStarterTagline',
    monthlyPrice: 29,
    annualPrice: 19,
    color: theme.color.primary,
    accentBg: theme.color.primary + '10',
    badge: 'POPULAR',
    features: [
      { textKey: 'feat10Members',             included: true  },
      { textKey: 'featUnlimitedFiles',         included: true  },
      { textKey: 'featDocScanning',            included: true  },
      { textKey: 'featFullFinancial',          included: true  },
      { textKey: 'featStageTracking',          included: true  },
      { textKey: 'featReportsExport',          included: true  },
      { textKey: 'featPDFUpload',              included: true  },
      { textKey: 'featPriorityEmailSupport',   included: true  },
      { textKey: 'featUnlimitedMembers',       included: false },
    ],
  },
  {
    key: 'premium',
    nameKey: 'planNamePremium',
    emoji: '👑',
    tagline: 'planBusinessTagline',
    monthlyPrice: 69,
    annualPrice: 49,
    color: '#F59E0B',
    accentBg: '#F59E0B10',
    features: [
      { textKey: 'featUnlimitedMembers',  included: true  },
      { textKey: 'featUnlimitedFiles',    included: true  },
      { textKey: 'featDocScanning',       included: true  },
      { textKey: 'featFullFinancial',     included: true  },
      { textKey: 'featStageTracking',     included: true  },
      { textKey: 'featReportsExport',     included: true  },
      { textKey: 'featPDFUpload',         included: true  },
      { textKey: 'featDedicatedManager',  included: true, info: 'A specific KTS team member is personally assigned to your account — they handle your support, answer questions, and help you directly. You get a direct contact, not a generic support queue.' },
    ],
  },
];

type PlanKey = 'free' | 'basic' | 'premium' | 'starter' | 'business';
// PLAN_LIMITS imported from src/lib/config.ts

export default function AccountScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<DashboardStackParamList, 'Account'>>();
  const { teamMember, organization, signOut, refreshTeamMember, isOwner } = useAuth();
  const { t } = useTranslation();

  // First-launch phone-prompt mode: navigated here from Dashboard with highlightPhone=true
  // when the owner has no phone yet. Highlights the phone field in light red to guide them.
  const [highlightPhone, setHighlightPhone] = useState<boolean>(route.params?.highlightPhone === true);

  const [editName,      setEditName]      = useState(teamMember?.name ?? '');
  const [editPhone,     setEditPhone]     = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [showPwdModal,  setShowPwdModal]  = useState(false);
  const [currentPwd,    setCurrentPwd]    = useState('');
  const [newPwd,        setNewPwd]        = useState('');
  const [confirmPwd,    setConfirmPwd]    = useState('');
  const [changingPwd,   setChangingPwd]   = useState(false);

  const [editOrgName,    setEditOrgName]    = useState(organization?.name ?? '');
  const [savingOrg,      setSavingOrg]      = useState(false);
  const [editingOrgName, setEditingOrgName] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);

  const [showPlansModal, setShowPlansModal] = useState(false);
  const [billingAnnual,  setBillingAnnual]  = useState(false);
  const [usage,          setUsage]          = useState<{ members: number; files: number } | null>(null);
  const [fetchingUsage,  setFetchingUsage]  = useState(false);

  // Join company via code
  const [joinCode,       setJoinCode]       = useState('');
  const [joiningCompany, setJoiningCompany] = useState(false);

  useEffect(() => {
    if (teamMember) {
      setEditName(teamMember.name ?? '');
      const displayPhone = teamMember.phone
        ?? (teamMember.email?.endsWith('@cleartrack.internal') ? emailToDisplay(teamMember.email) : '');
      setEditPhone(displayPhone);
    }
  }, [teamMember]);

  useEffect(() => {
    if (organization?.name) setEditOrgName(organization.name);
  }, [organization]);

  // Fetch live usage counts whenever the plans modal opens
  const fetchUsage = useCallback(async () => {
    if (!teamMember?.org_id) return;
    setFetchingUsage(true);
    const [membersRes, filesRes] = await Promise.all([
      supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', teamMember.org_id)
        .is('deleted_at', null),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', teamMember.org_id)
        .eq('is_archived', false),
    ]);
    setUsage({ members: membersRes.count ?? 0, files: filesRes.count ?? 0 });
    setFetchingUsage(false);
  }, [teamMember?.org_id]);

  useEffect(() => {
    if (showPlansModal) fetchUsage();
  }, [showPlansModal, fetchUsage]);

  // Display identifier for this user (phone or email)
  const displayIdentifier = teamMember?.email
    ? emailToDisplay(teamMember.email)
    : '—';
  const identifierIsPhone = isPhoneInput(displayIdentifier);

  const saveProfile = async () => {
    if (!editName.trim())  { Alert.alert(t('required'), t('fieldRequired')); return; }
    if (!editPhone.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    if (!teamMember?.id) return;
    setSavingProfile(true);
    const updates: Record<string, string> = { name: editName.trim(), phone: editPhone.trim() };
    const { error } = await supabase.from('team_members').update(updates).eq('id', teamMember.id);
    setSavingProfile(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    await refreshTeamMember();
    if (highlightPhone) {
      setHighlightPhone(false);
      Alert.alert(t('saved'), t('savedSuccess'), [
        { text: t('ok'), onPress: () => navigation.goBack() },
      ]);
      return;
    }
    Alert.alert(t('saved'), t('savedSuccess'));
  };

  const changePassword = async () => {
    if (!newPwd || newPwd.length < 6) { Alert.alert(t('warning'), t('passwordTooShort')); return; }
    if (newPwd !== confirmPwd) { Alert.alert(t('warning'), t('passwordsMatch')); return; }
    setChangingPwd(true);
    const email = teamMember?.email ?? '';
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPwd });
    if (signInErr) {
      setChangingPwd(false);
      Alert.alert(t('error'), t('loginFailed'));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setChangingPwd(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setShowPwdModal(false);
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    Alert.alert(t('success'), t('savedSuccess'));
  };

  const saveOrgName = async () => {
    if (!editOrgName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    if (!organization?.id) return;
    setSavingOrg(true);
    const { error } = await supabase.from('organizations').update({ name: editOrgName.trim() }).eq('id', organization.id);
    setSavingOrg(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setEditingOrgName(false);
    await refreshTeamMember();
  };

  const handleJoinCompany = async () => {
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 8) { Alert.alert(t('codeNotFound'), t('codeNotFound')); return; }
    setJoiningCompany(true);

    // Use SECURITY DEFINER RPC so the org_id change on team_members bypasses
    // RLS (the FOR ALL policy blocks changing org_id to a different org via
    // a plain UPDATE because the new org_id ≠ current auth_org_id()).
    const { data, error } = await supabase.rpc('join_org_by_code', { p_code: cleaned });

    setJoiningCompany(false);
    if (error) {
      const msg = error.message?.includes('not found')
        ? 'No company found with this code. Please check and try again.'
        : error.message?.includes('deactivated')
        ? 'This code has been deactivated. Ask your admin for a new one.'
        : error.message ?? 'Something went wrong.';
      Alert.alert(t('error'), msg);
      return;
    }

    setJoinCode('');
    await refreshTeamMember();
    const orgName = (data as any)?.org_name ?? '';
    Alert.alert(`✅ ${t('success')}`, `${t('welcomeTo')} ${orgName}`);
  };

  const roleBadgeColor = ROLE_COLORS[teamMember?.role ?? 'member'] ?? theme.color.primary;
  const currentPlanKey = (organization?.plan ?? 'free') as PlanKey;
  const planInfo = PLAN_LABELS[currentPlanKey] ?? PLAN_LABELS.free;

  const handleUpgradePress = (planKey: string) => {
    const planLabel = planKey.charAt(0).toUpperCase() + planKey.slice(1);
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to upgrade my GovPilot account to the ${planLabel} plan.\n\nOrganization: ${organization?.name ?? '—'}\nEmail: ${teamMember?.email ?? '—'}\nMobile: ${teamMember?.phone ?? '—'}`,
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Upgrade to ${planLabel} Plan&body=${body}`);
  };

  const handleDeleteAccount = () => {
    if (teamMember?.role === 'owner') {
      Alert.alert(
        'Cannot Delete Owner Account',
        'You must transfer ownership to another admin before deleting your account. Go to Team Members and promote another member to owner first.',
      );
      return;
    }
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and remove you from your organization. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              // Step 1: soft-delete team_members row via RPC
              const { error: rpcError } = await supabase.rpc('delete_my_account');
              if (rpcError) throw rpcError;

              // Step 2: call Edge Function to hard-delete the auth.users row
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData?.session?.access_token;
              const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
              if (token && supabaseUrl) {
                await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {}); // best-effort — user is already soft-deleted
              }

              // Step 3: sign out
              await signOut();
            } catch (e: any) {
              setDeletingAccount(false);
              const msg = e?.message?.includes('Transfer ownership')
                ? t('transferOwnershipError')
                : e?.message ?? t('somethingWrong');
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

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
        <View style={[s.card, { borderColor: planInfo.color + '55' }]}>
          <Text style={s.cardTitle}>{t('myCompanyTitle')}</Text>

          {/* Tap-to-edit company name */}
          {isOwner ? (
            editingOrgName ? (
              <View style={s.orgEditRow}>
                <TextInput
                  style={s.orgNameInput}
                  value={editOrgName}
                  onChangeText={setEditOrgName}
                  placeholder={t('companyNamePlaceholder')}
                  placeholderTextColor={theme.color.textMuted}
                  autoCapitalize="words"
                  autoFocus
                />
                <TouchableOpacity
                  style={[s.orgSaveBtn, savingOrg && { opacity: 0.6 }]}
                  onPress={saveOrgName}
                  disabled={savingOrg}
                >
                  {savingOrg
                    ? <ActivityIndicator color={theme.color.white} size="small" />
                    : <Text style={s.orgSaveBtnText}>{t('save')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.orgCancelBtn}
                  onPress={() => { setEditingOrgName(false); setEditOrgName(organization?.name ?? ''); }}
                >
                  <Text style={s.orgCancelBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.orgNameTap}
                onPress={() => setEditingOrgName(true)}
                activeOpacity={0.7}
              >
                <Text style={s.orgName}>{organization?.name ?? '—'}</Text>
                <Text style={s.orgNameEditHint}>✎</Text>
              </TouchableOpacity>
            )
          ) : (
            <Text style={s.orgName}>{organization?.name ?? '—'}</Text>
          )}

          {/* Plan row — tappable → opens plans */}
          <TouchableOpacity style={s.planRow} onPress={() => setShowPlansModal(true)} activeOpacity={0.75}>
            <View style={[s.planBadge, { backgroundColor: planInfo.color + '18', borderColor: planInfo.color + '33' }]}>
              <Text style={[s.planBadgeText, { color: planInfo.color }]}>{t(planInfo.labelKey)}</Text>
            </View>
            <Text style={[s.viewPlansLink, { color: planInfo.color }]}>
              {currentPlanKey === 'free' ? t('viewPlansBtn') : t('managePlanBtn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Join a Company — shown for non-owners */}
        {teamMember?.role !== 'owner' && (
          <View style={s.card}>
            <View>
              <Text style={s.cardTitle}>{t('joinCompanyTitle')}</Text>
              <Text style={s.joinDesc}>{t('joinOrgDesc')}</Text>
            </View>
            {organization?.name ? (
              <View style={s.currentOrgRow}>
                <Text style={s.currentOrgLabel}>{t('currentCompanyLabel')}</Text>
                <Text style={s.currentOrgName}>{organization.name}</Text>
              </View>
            ) : null}
            <View style={s.joinRow}>
              <TextInput
                style={[s.input, s.joinInput]}
                value={joinCode}
                onChangeText={(v) => setJoinCode(v.toUpperCase())}
                placeholder="XXXX-XXXX"
                placeholderTextColor={theme.color.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
              />
              <TouchableOpacity
                style={[s.joinBtn, joiningCompany && s.btnDisabled]}
                onPress={handleJoinCompany}
                disabled={joiningCompany}
              >
                {joiningCompany
                  ? <ActivityIndicator color={theme.color.white} size="small" />
                  : <Text style={s.joinBtnText}>{t('joinBtn')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Edit profile */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('editProfileCardTitle')}</Text>
          <View style={s.field}>
            <Text style={s.label}>{t('fullName').toUpperCase()}</Text>
            <TextInput
              style={s.input}
              value={editName}
              onChangeText={setEditName}
              placeholder={t('fullName')}
              placeholderTextColor={theme.color.textMuted}
              autoCapitalize="words"
            />
          </View>
          <View style={s.field}>
            <Text style={[s.label, highlightPhone && { color: '#dc2626' }]}>
              {t('phoneLabel').toUpperCase()} {highlightPhone ? '← ' + t('tapToSet') : ''}
            </Text>
            <TextInput
              style={[s.input, highlightPhone && { backgroundColor: '#fee2e2', borderColor: '#dc2626' }]}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+961 70 123 456"
              placeholderTextColor={theme.color.textMuted}
              keyboardType="phone-pad"
              autoFocus={highlightPhone}
            />
            <Text style={s.fieldHint}>
              {identifierIsPhone ? t('phoneHintLogin') : t('phoneHintContact')}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.saveBtn, savingProfile && s.btnDisabled]}
            onPress={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile
              ? <ActivityIndicator color={theme.color.white} size="small" />
              : <Text style={s.saveBtnText}>{t('saveProfileBtn')}</Text>}
          </TouchableOpacity>
        </View>

        {/* Security */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('securityCardTitle')}</Text>
          <TouchableOpacity style={s.actionRow} onPress={() => setShowPwdModal(true)}>
            <Text style={s.actionRowText}>{t('changePassword')}</Text>
            <Text style={s.actionRowChevron}>›</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity
            style={s.actionRow}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount
              ? <ActivityIndicator color={theme.color.danger} size="small" />
              : <Text style={[s.actionRowText, { color: theme.color.danger }]}>{t('deleteAccount')}</Text>}
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={s.signOutBtn}
          onPress={() =>
            Alert.alert(t('signOut'), t('areYouSure'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('signOut'), style: 'destructive', onPress: signOut },
            ])
          }
        >
          <Text style={s.signOutText}>{t('signOut')}</Text>
        </TouchableOpacity>

        {/* Legal links */}
        <View style={s.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={s.legalLink}>{t('privacyPolicy')}</Text>
          </TouchableOpacity>
          <Text style={s.legalDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={s.legalLink}>{t('termsOfService')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.version}>GovPilot v1.0.0</Text>
      </ScrollView>

      {/* ── Change Password Modal ── */}
      <Modal visible={showPwdModal} transparent animationType="slide" onRequestClose={() => setShowPwdModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>{t('changePassword')}</Text>
              <View style={s.field}>
                <Text style={s.label}>{t('password').toUpperCase()}</Text>
                <TextInput style={s.input} value={currentPwd} onChangeText={setCurrentPwd} secureTextEntry placeholder={t('password')} placeholderTextColor={theme.color.textMuted} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>{t('changePassword').toUpperCase()}</Text>
                <TextInput style={s.input} value={newPwd} onChangeText={setNewPwd} secureTextEntry placeholder={t('passwordTooShort')} placeholderTextColor={theme.color.textMuted} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>{t('confirmPassword').toUpperCase()}</Text>
                <TextInput style={s.input} value={confirmPwd} onChangeText={setConfirmPwd} secureTextEntry placeholder={t('confirmPassword')} placeholderTextColor={theme.color.textMuted} />
              </View>
              <TouchableOpacity style={[s.saveBtn, changingPwd && s.btnDisabled]} onPress={changePassword} disabled={changingPwd}>
                {changingPwd ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.saveBtnText}>{t('updatePasswordBtn')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPwdModal(false)}>
                <Text style={s.cancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Plans / Upgrade Modal ── */}
      <Modal visible={showPlansModal} transparent animationType="slide" onRequestClose={() => setShowPlansModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.plansSheet}>
            {/* Header */}
            <View style={s.plansHeader}>
              <View>
                <Text style={s.plansTitle}>{t('planChoosePlan')}</Text>
                <Text style={s.plansSubtitle}>{t('planStarterTagline')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPlansModal(false)} style={s.plansClose}>
                <Text style={s.plansCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Monthly / Annual toggle */}
            <View style={s.billingToggleRow}>
              <TouchableOpacity
                style={[s.billingBtn, !billingAnnual && s.billingBtnActive]}
                onPress={() => setBillingAnnual(false)}
              >
                <Text style={[s.billingBtnText, !billingAnnual && s.billingBtnTextActive]}>{t('planMonthly')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.billingBtn, billingAnnual && s.billingBtnActive]}
                onPress={() => setBillingAnnual(true)}
              >
                <Text style={[s.billingBtnText, billingAnnual && s.billingBtnTextActive]}>{t('planYearly')}</Text>
                <View style={s.savingBadge}><Text style={s.savingBadgeText}>{t('save33Label')}</Text></View>
              </TouchableOpacity>
            </View>

            {/* ── Live usage ── */}
            {fetchingUsage ? (
              <ActivityIndicator color={theme.color.primary} style={{ marginBottom: 12 }} />
            ) : usage ? (() => {
              const limits  = PLAN_LIMITS[currentPlanKey] ?? { members: null, files: null };
              const items = [
                { label: t('teamMembersUsage'), current: usage.members, limit: limits.members },
                { label: t('activeFilesUsage'),  current: usage.files,   limit: limits.files   },
              ];
              const anyOver = items.some(({ current, limit }) => limit !== null && current > limit);
              return (
                <View style={s.usageCard}>
                  <Text style={s.usageCardTitle}>{t('currentUsageTitle')}</Text>
                  {items.map(({ label, current, limit }) => {
                    const over = limit !== null && current > limit;
                    const pct  = limit != null ? Math.min(current / limit, 1) : 0;
                    return (
                      <View key={label} style={s.usageItem}>
                        <View style={s.usageLabelRow}>
                          <Text style={s.usageLabel}>{label}</Text>
                          <Text style={[s.usageCount, over && s.usageCountOver]}>
                            {current}
                            <Text style={s.usageLimit}>{limit != null ? ` / ${limit}` : ' / ∞'}</Text>
                          </Text>
                        </View>
                        <View style={s.usageBarBg}>
                          <View style={[
                            s.usageBarFg,
                            { width: `${(limit != null ? pct : 0) * 100}%` as any },
                            over ? s.usageBarOver : s.usageBarOk,
                          ]} />
                        </View>
                        {over && (
                          <Text style={s.usageOverHint}>{t('overPlanLimitHint')}</Text>
                        )}
                      </View>
                    );
                  })}
                  {anyOver && (
                    <Text style={s.usageOverBanner}>{t('overPlanBannerMsg')}</Text>
                  )}
                </View>
              );
            })() : null}

            {/* Plan cards */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.plansScroll}>
              {PLANS.map((plan) => {
                const isCurrent = currentPlanKey === plan.key;
                const price = billingAnnual ? plan.annualPrice : plan.monthlyPrice;
                const billingLabel = billingAnnual ? t('billedAnnuallyLabel') : t('perMonthLabel');
                return (
                  <View
                    key={plan.key}
                    style={[
                      s.planCard,
                      { borderColor: isCurrent ? plan.color : plan.color + '40',
                        backgroundColor: isCurrent ? plan.accentBg : theme.color.bgSurface },
                      isCurrent && s.planCardCurrent,
                    ]}
                  >
                    {/* Badge row — no overlap */}
                    {(isCurrent || ('badge' in plan && plan.badge && !isCurrent)) && (
                      <View style={s.badgeRow}>
                        <View style={[s.popularBadge, { backgroundColor: isCurrent ? plan.color + 'CC' : plan.color }]}>
                          <Text style={s.popularBadgeText}>{isCurrent ? t('currentPlanBadge') : (plan as any).badge}</Text>
                        </View>
                      </View>
                    )}

                    {/* Plan name + price */}
                    <View style={s.planCardTop}>
                      <Text style={s.planEmoji}>{plan.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.planName, { color: plan.color }]}>{t(plan.nameKey)}</Text>
                        <Text style={s.planTagline}>{t(plan.tagline)}</Text>
                      </View>
                      <View style={s.priceBlock}>
                        {price === 0 ? (
                          <Text style={[s.priceFree, { color: plan.color }]}>{t('freeLabel')}</Text>
                        ) : (
                          <>
                            <Text style={[s.priceAmount, { color: plan.color }]}>${price}</Text>
                            <Text style={s.pricePeriod}>{billingLabel}</Text>
                          </>
                        )}
                      </View>
                    </View>

                    {/* Features */}
                    <View style={s.featureList}>
                      {plan.features.map((f, idx) => (
                        <View key={idx} style={s.featureRow}>
                          <Text style={[s.featureIcon, { color: f.included ? plan.color : theme.color.border }]}>
                            {f.included ? '✓' : '✕'}
                          </Text>
                          <Text style={[s.featureText, !f.included && s.featureTextDimmed]}>{t(f.textKey)}</Text>
                          {f.info ? (
                            <TouchableOpacity
                              onPress={() => Alert.alert('ℹ️ ' + t(f.textKey), f.info)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <View style={s.infoBtn}>
                                <Text style={s.infoBtnText}>?</Text>
                              </View>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))}
                    </View>

                    {/* CTA button */}
                    <TouchableOpacity
                      style={[
                        s.planCta,
                        isCurrent
                          ? s.planCtaCurrent
                          : { backgroundColor: plan.color },
                      ]}
                      onPress={() => !isCurrent && handleUpgradePress(plan.key)}
                      disabled={isCurrent}
                      activeOpacity={isCurrent ? 1 : 0.8}
                    >
                      <Text style={[s.planCtaText, isCurrent && s.planCtaTextCurrent]}>
                        {isCurrent ? t('ctaCurrentPlan') : plan.key === 'free' ? t('ctaDowngrade') : t('ctaUpgradeNow')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              <Text style={s.planFootnote}>
                {t('planFootnoteText')}{'\n'}
                <Text
                  style={{ color: theme.color.primary, fontWeight: '700' }}
                  onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Activate GovPilot Plan`)}
                >
                  {SUPPORT_EMAIL}
                </Text>
              </Text>
            </ScrollView>
          </View>
        </View>
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
  orgNameTap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orgNameEditHint: { fontSize: 16, color: theme.color.primary, marginTop: 2 },
  orgEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orgCancelBtn: { padding: 6 },
  orgCancelBtnText: { color: theme.color.textMuted, fontSize: 18 },
  orgNameInput: {
    flex:              1,
    backgroundColor:   theme.color.bgBase,
    borderWidth:       1,
    borderColor:       theme.color.border,
    borderRadius:      theme.radius.lg,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    color:             theme.color.textPrimary,
    fontSize:          16,
    fontWeight:        '700',
  },
  orgSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  orgSaveBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  planRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    gap:             10,
  },
  planBadge: {
    alignSelf:       'flex-start',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth:     1,
  },
  planBadgeText: { fontSize: 12, fontWeight: '700' },
  upgradeBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  upgradeBtnText: { color: theme.color.white, fontSize: 13, fontWeight: '700' },
  viewPlansLink:  { fontSize: 13, fontWeight: '700' },
  joinDesc: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 4 },
  currentOrgRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currentOrgLabel: { ...theme.typography.caption, color: theme.color.textMuted },
  currentOrgName: { ...theme.typography.caption, color: theme.color.primary, fontWeight: '700' },
  joinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  joinInput: { flex: 1, fontSize: 18, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
  joinBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  joinBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 15 },

  // ── Plans Modal ──────────────────────────────────────────────
  plansSheet: {
    backgroundColor:      theme.color.bgBase,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    maxHeight:            '92%',
    paddingTop:           theme.spacing.space5,
  },
  plansHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    paddingHorizontal: theme.spacing.space5,
    marginBottom:    theme.spacing.space4,
  },
  plansTitle:   { fontSize: 22, fontWeight: '800', color: theme.color.textPrimary },
  plansSubtitle:{ fontSize: 13, color: theme.color.textMuted, marginTop: 2 },
  plansClose: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: theme.color.bgSurface,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  plansCloseText: { color: theme.color.textSecondary, fontSize: 14, fontWeight: '700' },

  billingToggleRow: {
    flexDirection:   'row',
    marginHorizontal: theme.spacing.space5,
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         3,
    marginBottom:    theme.spacing.space4,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  billingBtn: {
    flex:            1,
    paddingVertical: 9,
    borderRadius:    theme.radius.md,
    alignItems:      'center',
    flexDirection:   'row',
    justifyContent:  'center',
    gap:             6,
  },
  billingBtnActive: { backgroundColor: theme.color.primary },
  billingBtnText:   { fontSize: 14, fontWeight: '600', color: theme.color.textMuted },
  billingBtnTextActive: { color: theme.color.white },
  savingBadge: {
    backgroundColor: theme.color.success + 'CC',
    borderRadius:    10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savingBadgeText: { color: theme.color.white, fontSize: 10, fontWeight: '800' },

  plansScroll: { paddingHorizontal: theme.spacing.space4, gap: 14, paddingBottom: 40 },

  planCard: {
    borderRadius:    theme.radius.xl,
    borderWidth:     2,
    padding:         theme.spacing.space4,
    gap:             10,
  },
  planCardCurrent: { borderWidth: 2 },

  badgeRow: {
    flexDirection:   'row',
    marginBottom:    4,
  },
  popularBadge: {
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf:       'flex-start',
  },
  popularBadgeText: { color: theme.color.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  planCardTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  planEmoji:    { fontSize: 28, marginTop: 2 },
  planName:     { fontSize: 18, fontWeight: '800' },
  planTagline:  { fontSize: 12, color: theme.color.textMuted, marginTop: 2 },
  priceBlock:   { alignItems: 'flex-end' },
  priceFree:    { fontSize: 22, fontWeight: '800' },
  priceAmount:  { fontSize: 26, fontWeight: '900', lineHeight: 28 },
  pricePeriod:  { fontSize: 11, color: theme.color.textMuted, textAlign: 'right' },

  featureList:  { gap: 8 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureIcon:  { fontSize: 13, fontWeight: '800', width: 16, textAlign: 'center' },
  featureText:  { fontSize: 13, color: theme.color.textSecondary, flex: 1 },
  featureTextDimmed: { color: theme.color.border },
  infoBtn: {
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: theme.color.border,
    justifyContent:  'center',
    alignItems:      'center',
  },
  infoBtnText: { color: theme.color.textPrimary, fontSize: 10, fontWeight: '800', lineHeight: 12 },

  planCta: {
    borderRadius:    theme.radius.lg,
    paddingVertical: 13,
    alignItems:      'center',
  },
  planCtaCurrent: {
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  planCtaText:        { color: theme.color.white, fontSize: 15, fontWeight: '700' },
  planCtaTextCurrent: { color: theme.color.textMuted },

  planFootnote: {
    textAlign:  'center',
    fontSize:   12,
    color:      theme.color.textMuted,
    lineHeight: 18,
    marginTop:  4,
  },

  // ── Usage card (inside plans modal) ──────────────────────────
  usageCard: {
    marginHorizontal: theme.spacing.space4,
    marginBottom:     theme.spacing.space4,
    backgroundColor:  theme.color.bgSurface,
    borderRadius:     theme.radius.lg,
    borderWidth:      1,
    borderColor:      theme.color.border,
    padding:          theme.spacing.space3,
    gap:              10,
  },
  usageCardTitle: {
    ...theme.typography.sectionDivider,
    color:       theme.color.textMuted,
    marginBottom: 2,
  },
  usageItem:     { gap: 5 },
  usageLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usageLabel:    { ...theme.typography.label, color: theme.color.textSecondary, fontSize: 13 },
  usageCount:    { fontSize: 13, fontWeight: '700', color: theme.color.textPrimary },
  usageCountOver: { color: theme.color.danger },
  usageLimit:    { fontWeight: '400', color: theme.color.textMuted },
  usageBarBg: {
    height:          6,
    borderRadius:    4,
    backgroundColor: theme.color.bgBase,
    overflow:        'hidden',
  },
  usageBarFg:   { height: 6, borderRadius: 4 },
  usageBarOk:   { backgroundColor: theme.color.success },
  usageBarOver: { backgroundColor: theme.color.danger },
  usageOverHint: { fontSize: 11, color: theme.color.danger, fontWeight: '600' },
  usageOverBanner: {
    fontSize:        12,
    color:           theme.color.danger,
    fontWeight:      '600',
    backgroundColor: theme.color.danger + '12',
    borderRadius:    theme.radius.md,
    padding:         8,
    borderWidth:     1,
    borderColor:     theme.color.danger + '30',
    lineHeight:      18,
  },

  // Form
  field:     { gap: 6 },
  fieldHint: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
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
  saveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 14,
    alignItems:      'center',
  },
  btnDisabled:   { opacity: 0.6 },
  saveBtnText:   { color: theme.color.white, fontSize: 15, fontWeight: '700' },
  divider: {
    height:          1,
    backgroundColor: theme.color.border,
    marginVertical:  2,
  },
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
  version:     { ...theme.typography.caption, color: theme.color.border, textAlign: 'center', marginTop: 4 },
  legalRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: theme.spacing.space4, marginBottom: 4 },
  legalLink:   { ...theme.typography.caption, color: theme.color.textMuted },
  legalDot:    { ...theme.typography.caption, color: theme.color.border },

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
