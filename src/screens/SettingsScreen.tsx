// src/screens/SettingsScreen.tsx
// Settings: account, notifications, team members, RTL, sign out

import React, { useState, useEffect, useCallback } from 'react';
import {
 View,
 Text,
 StyleSheet,
 ScrollView,
 TouchableOpacity,
 TextInput,
 Alert,
 ActivityIndicator,
 Modal,
 KeyboardAvoidingView,
 Platform,
 I18nManager,
 Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { TeamMember } from '../types';
import { normalizeToEmail, isPhoneInput } from '../lib/authHelpers';
import { LANGUAGES, Language, saveLanguage, getCurrentLang, useTranslation } from '../lib/i18n';
import { DEFAULT_COUNTRY, Country, SORTED_COUNTRIES } from '../components/PhoneInput';
import { FlatList } from 'react-native';

// ─── Section wrapper ──────────────────────────────────────────
function Section({
 title,
 count,
 children,
 onAdd,
 addLabel,
}: {
 title: string;
 count: number;
 children: React.ReactNode;
 onAdd?: () => void;
 addLabel?: string;
}) {
 const [expanded, setExpanded] = useState(false);
 return (
 <View style={ss.section}>
 <TouchableOpacity
 style={ss.sectionHeader}
 onPress={() => setExpanded((v) => !v)}
 activeOpacity={0.7}
 >
 <View>
 <Text style={ss.sectionTitle}>{title}</Text>
 <Text style={ss.sectionCount}>{count} items</Text>
 </View>
 <View style={ss.sectionHeaderRight}>
 {onAdd && (
   <TouchableOpacity
     style={ss.addBtn}
     onPress={(e) => { e.stopPropagation(); onAdd(); }}
   >
     <Text style={ss.addBtnText}>{addLabel ?? '+ Add'}</Text>
   </TouchableOpacity>
 )}
 <Text style={[ss.chevron, expanded && ss.chevronOpen]}>›</Text>
 </View>
 </TouchableOpacity>
 {expanded && <View style={ss.sectionBody}>{children}</View>}
 </View>
 );
}

// ─── Reusable list item with delete ──────────────────────────
function ListItem({
 label,
 sublabel,
 accent,
 badge,
 badgeColor,
 onDelete,
}: {
 label: string;
 sublabel?: string;
 accent?: string;
 badge?: string;
 badgeColor?: string;
 onDelete?: () => void;
}) {
 return (
 <View style={ss.listItem}>
 {accent && <View style={[ss.accentDot, { backgroundColor: accent }]} />}
 <View style={{ flex: 1 }}>
   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
     <Text style={ss.listItemLabel}>{label}</Text>
     {badge && (
       <View style={[ss.roleBadge, { backgroundColor: (badgeColor ?? '#6366f1') + '22', borderColor: (badgeColor ?? '#6366f1') + '55' }]}>
         <Text style={[ss.roleBadgeText, { color: badgeColor ?? '#6366f1' }]}>{badge}</Text>
       </View>
     )}
   </View>
   {sublabel && <Text style={ss.listItemSub}>{sublabel}</Text>}
 </View>
 {onDelete && (
   <TouchableOpacity onPress={onDelete} style={ss.deleteBtn}>
     <Text style={ss.deleteBtnText}>✕</Text>
   </TouchableOpacity>
 )}
 </View>
 );
}

// ─── Modal form ───────────────────────────────────────────────
interface ModalFormProps {
 visible: boolean;
 title: string;
 fields: Array<{
 key: string;
 label: string;
 placeholder?: string;
 keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
 isSwitch?: boolean;
 switchValue?: boolean;
 options?: Array<{ value: string; label: string }>;
 }>;
 values: Record<string, string | boolean>;
 onChange: (key: string, value: string | boolean) => void;
 onSubmit: () => void;
 onClose: () => void;
 saving?: boolean;
}

function ModalForm({
 visible,
 title,
 fields,
 values,
 onChange,
 onSubmit,
 onClose,
 saving,
}: ModalFormProps) {
 return (
 <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
 <View style={mf.overlay}>
 <KeyboardAvoidingView
 behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
 style={{ flex: 1, justifyContent: 'flex-end' }}
 >
 <View style={mf.sheet}>
 <View style={mf.header}>
 <Text style={mf.title}>{title}</Text>
 <TouchableOpacity onPress={onClose}>
 <Text style={mf.close}>✕</Text>
 </TouchableOpacity>
 </View>
 <ScrollView contentContainerStyle={mf.body}>
 {fields.map((field) => (
 <View key={field.key} style={mf.field}>
 <Text style={mf.label}>{field.label}</Text>
 {field.isSwitch ? (
 <Switch
 value={values[field.key] as boolean}
 onValueChange={(v) => onChange(field.key, v)}
 trackColor={{ false: theme.color.border, true: theme.color.primary }}
 thumbColor={theme.color.white}
 />
 ) : field.options ? (
 <View style={mf.optionRow}>
 {field.options.map((opt) => (
 <TouchableOpacity
 key={opt.value}
 style={[
 mf.option,
 values[field.key] === opt.value && mf.optionActive,
 ]}
 onPress={() => onChange(field.key, opt.value)}
 >
 <Text
 style={[
 mf.optionText,
 values[field.key] === opt.value && mf.optionTextActive,
 ]}
 >
 {opt.label}
 </Text>
 </TouchableOpacity>
 ))}
 </View>
 ) : (
 <TextInput
 style={mf.input}
 value={values[field.key] as string}
 onChangeText={(v) => onChange(field.key, v)}
 placeholder={field.placeholder}
 placeholderTextColor={theme.color.textMuted}
 keyboardType={field.keyboardType ?? 'default'}
 />
 )}
 </View>
 ))}
 <TouchableOpacity
 style={[mf.submitBtn, saving && mf.submitBtnDisabled]}
 onPress={onSubmit}
 disabled={saving}
 >
 {saving ? (
 <ActivityIndicator color={theme.color.white} />
 ) : (
 <Text style={mf.submitText}>Save</Text>
 )}
 </TouchableOpacity>
 </ScrollView>
 </View>
 </KeyboardAvoidingView>
 </View>
 </Modal>
 );
}

const mf = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor:      theme.color.bgSurface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:            '85%',
    ...theme.shadow.modal,
    zIndex:               theme.zIndex.modal,
  },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    padding:           theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  title:             { ...theme.typography.heading, color: theme.color.textPrimary },
  close:             { color: theme.color.textSecondary, fontSize: 22, padding: 4 },
  body:              { padding: theme.spacing.space4, gap: theme.spacing.space4, paddingBottom: 40 },
  field:             { gap: 6 },
  label:             { ...theme.typography.sectionDivider, letterSpacing: 1 },
  input: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space3,
    color:           theme.color.textPrimary,
    fontSize:        15,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  optionRow:       { flexDirection: 'row', gap: 10 },
  option: {
    flex:            1,
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  optionActive:     { borderColor: theme.color.primary, backgroundColor: theme.color.primary + '22' },
  optionText:       { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  optionTextActive: { color: theme.color.primaryText },
  submitBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       theme.spacing.space2,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { color: theme.color.white, fontSize: 16, fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────
export default function SettingsScreen() {
 const { teamMember, signOut, isAdmin } = useAuth();
 const { t, setLang, lang } = useTranslation();

 const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
 const [loading, setLoading] = useState(true);

 const navigation = useNavigation<any>();
 const [saving, setSaving] = useState(false);

 // Invite member state
 const [showInviteModal, setShowInviteModal] = useState(false);
 const [inviteEmail, setInviteEmail] = useState('');
 const [inviteRole, setInviteRole]   = useState<'admin' | 'member' | 'viewer'>('member');
 const [inviting, setInviting]       = useState(false);
 const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; email: string; role: string; expires_at: string }>>([]);

 // Help & FAQ modals
 const [showHelp, setShowHelp] = useState(false);
 const [showFaq,  setShowFaq]  = useState(false);
 const [openFaqId, setOpenFaqId] = useState<number | null>(null);

 // Language
 const [currentLang, setCurrentLangState] = useState(getCurrentLang());
 const [showLangModal, setShowLangModal] = useState(false);
 const [langSearch, setLangSearch] = useState('');

 const handleSelectLang = async (selectedLang: Language) => {
   await setLang(selectedLang.code);  // saves AND triggers re-render
   setCurrentLangState(selectedLang.code);
   const needsRTL = selectedLang.rtl ?? false;
   if (needsRTL !== I18nManager.isRTL) {
     I18nManager.forceRTL(needsRTL);
     Alert.alert('Restart Required', 'Please close and reopen the app to apply the language direction.', [{ text: 'OK' }]);
   }
   setShowLangModal(false);
 };

 // Contact Us
 const [showContactModal, setShowContactModal] = useState(false);
 const [contactSubject, setContactSubject] = useState('');
 const [contactMessage, setContactMessage] = useState('');
 const [contactName, setContactName] = useState(teamMember?.name ?? '');
 const [contactEmail, setContactEmail] = useState(teamMember?.email ?? '');
 const [sendingContact, setSendingContact] = useState(false);

 const handleSendContact = async () => {
   if (!contactSubject.trim() || !contactMessage.trim()) {
     Alert.alert('Required', 'Please fill in subject and message.');
     return;
   }
   setSendingContact(true);

   try {
     // Call Edge Function to send email via Resend
     const { error: fnError } = await supabase.functions.invoke('send-contact-email', {
       body: {
         sender_name:  contactName.trim()  || teamMember?.name  || '',
         sender_email: contactEmail.trim() || teamMember?.email || '',
         subject:      contactSubject.trim(),
         message:      contactMessage.trim(),
       },
     });

     if (fnError) throw fnError;

     // Also save to DB as audit trail
     await supabase.from('contact_messages').insert({
       sender_name:  contactName.trim()  || teamMember?.name,
       sender_email: contactEmail.trim() || teamMember?.email,
       subject:      contactSubject.trim(),
       message:      contactMessage.trim(),
       org_id:       teamMember?.org_id,
     }).throwOnError();

     setSendingContact(false);
     setShowContactModal(false);
     setContactSubject('');
     setContactMessage('');
     Alert.alert('Message Sent ✅', 'Your message has been sent to our team. We will get back to you shortly.');

   } catch (err: any) {
     setSendingContact(false);
     Alert.alert('Failed to Send', err?.message ?? 'Something went wrong. Please try again.');
   }
 };

 // Report a Bug
 const [showBugModal, setShowBugModal] = useState(false);
 const [bugTitle, setBugTitle] = useState('');
 const [bugDesc, setBugDesc] = useState('');
 const [sendingBug, setSendingBug] = useState(false);

 const handleSendBug = async () => {
   if (!bugTitle.trim() || !bugDesc.trim()) {
     Alert.alert('Required', 'Please fill in both fields.');
     return;
   }
   setSendingBug(true);
   try {
     const { error: fnError } = await supabase.functions.invoke('send-contact-email', {
       body: {
         sender_name:  teamMember?.name  ?? '',
         sender_email: teamMember?.email ?? '',
         subject:      `[BUG] ${bugTitle.trim()}`,
         message:      bugDesc.trim(),
       },
     });
     if (fnError) throw fnError;

     await supabase.from('contact_messages').insert({
       sender_name:  teamMember?.name,
       sender_email: teamMember?.email,
       subject:      `[BUG] ${bugTitle.trim()}`,
       message:      bugDesc.trim(),
       org_id:       teamMember?.org_id,
     }).throwOnError();

     setSendingBug(false);
     setShowBugModal(false);
     setBugTitle('');
     setBugDesc('');
     Alert.alert('Bug Reported ✅', 'Thank you! We\'ll investigate and fix it as soon as possible.');
   } catch (err: any) {
     setSendingBug(false);
     Alert.alert('Failed to Send', err?.message ?? 'Something went wrong. Please try again.');
   }
 };

 // Team member role editing
 const [editMemberModal, setEditMemberModal] = useState<TeamMember | null>(null);
 const [editMemberRole, setEditMemberRole] = useState<string>('member');

 const handleEditMember = (tm: TeamMember) => {
   setEditMemberModal(tm);
   setEditMemberRole(tm.role);
 };

 const handleSaveMemberRole = async () => {
   if (!editMemberModal) return;
   const { error } = await supabase
     .from('team_members')
     .update({ role: editMemberRole })
     .eq('id', editMemberModal.id);
   if (error) { Alert.alert('Error', error.message); return; }
   setEditMemberModal(null);
   fetchData();
 };

 // Invite modal — separate email + phone
 const [inviteInputType, setInviteInputType] = useState<'email' | 'phone'>('email');
 const [invitePhone, setInvitePhone] = useState('');
 const [inviteCountryCode, setInviteCountryCode] = useState(DEFAULT_COUNTRY.code);

 const fetchData = useCallback(async () => {
 const [tmRes, invRes] = await Promise.all([
 supabase.from('team_members').select('*').order('name'),
 supabase.from('invitations').select('id, email, role, expires_at').is('accepted_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
 ]);
 if (tmRes.data) setTeamMembers(tmRes.data as TeamMember[]);
 if (invRes.data) setPendingInvites(invRes.data as any[]);
 setLoading(false);
 }, []);

 useEffect(() => { fetchData(); }, [fetchData]);

 // ─── Delete helpers ───────────────────────────────────────
 const confirmDelete = (label: string, onConfirm: () => void) => {
 Alert.alert(
 'Delete',
 `Delete "${label}"? This cannot be undone.`,
 [
 { text: 'Cancel', style: 'cancel' },
 { text: 'Delete', style: 'destructive', onPress: onConfirm },
 ]
 );
 };

 const deleteRecord = async (table: string, id: string, label: string) => {
 confirmDelete(label, async () => {
 const { error } = await supabase.from(table).delete().eq('id', id);
 if (error) Alert.alert('Error', error.message);
 else fetchData();
 });
 };

 const sendInvite = async () => {
   const trimEmail = normalizeToEmail(inviteEmail.trim());
   if (inviteEmail.trim().length < 4) { Alert.alert('Required', 'Enter an email or phone number.'); return; }
   if (!teamMember?.org_id) return;
   setInviting(true);
   // Create invitation row — token is auto-generated by DB default
   const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
   const { data: inv, error } = await supabase
     .from('invitations')
     .insert({
       org_id:     teamMember.org_id,
       email:      trimEmail,
       role:       inviteRole,
       invited_by: teamMember.id,
       expires_at: expires,
     })
     .select('token')
     .single();
   setInviting(false);
   if (error) { Alert.alert('Error', error.message); return; }
   setShowInviteModal(false);
   setInviteEmail('');
   setInviteRole('member');
   fetchData();
   Alert.alert(
     '✉️ Invite Sent',
     `Invitation created for ${trimEmail}.\n\nAsk them to download the app and register with this email — they will automatically join your organization.`,
     [{ text: 'OK' }]
   );
 };

 const revokeInvite = async (inviteId: string, email: string) => {
   Alert.alert('Revoke Invite', `Remove pending invite for ${email}?`, [
     { text: 'Cancel', style: 'cancel' },
     { text: 'Revoke', style: 'destructive', onPress: async () => {
       await supabase.from('invitations').delete().eq('id', inviteId);
       fetchData();
     }},
   ]);
 };

 if (loading) {
 return (
 <View style={ss.center}>
 <ActivityIndicator color={theme.color.primary} size="large" />
 </View>
 );
 }

 return (
 <SafeAreaView style={ss.safe} edges={['top', 'bottom']}>
 <View style={ss.header}>
 <Text style={ss.title}>{t('settings')}</Text>
 </View>

 <ScrollView contentContainerStyle={ss.scroll}>
 {/* Current user card — tappable → Account screen */}
 <TouchableOpacity style={ss.profileCard} onPress={() => navigation.navigate('Account')} activeOpacity={0.8}>
 <View style={ss.profileAvatar}>
 <Text style={ss.profileAvatarText}>
 {(teamMember?.name ?? '?')
 .split(' ')
 .map((n) => n[0])
 .join('')
 .toUpperCase()
 .slice(0, 2)}
 </Text>
 </View>
 <View style={{ flex: 1 }}>
 <Text style={ss.profileName}>{teamMember?.name ?? '—'}</Text>
 <Text style={ss.profileRole}>{teamMember?.role ?? '—'}</Text>
 <Text style={ss.profileEmail}>{teamMember?.email ?? '—'}</Text>
 </View>
 <Text style={{ color: theme.color.primary, fontSize: 22 }}>›</Text>
 </TouchableOpacity>

 {/* My Account */}
 <TouchableOpacity style={ss.navCard} onPress={() => navigation.navigate('Account')} activeOpacity={0.75}>
 <View style={ss.navCardLeft}>
 <Text style={ss.navCardIcon}>👤</Text>
 <View>
 <Text style={ss.navCardTitle}>{t('myAccount')}</Text>
 <Text style={ss.navCardSubtitle}>Edit profile, change password, org settings</Text>
 </View>
 </View>
 <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Team Members — directly after My Account */}
 <TouchableOpacity style={ss.navCard} onPress={() => navigation.navigate('TeamMembers')} activeOpacity={0.75}>
   <View style={ss.navCardLeft}>
     <Text style={ss.navCardIcon}>👥</Text>
     <View>
       <Text style={ss.navCardTitle}>{t('teamMembers')}</Text>
       <Text style={ss.navCardSubtitle}>{teamMembers.length} members{pendingInvites.length > 0 ? ` · ${pendingInvites.length} pending` : ''}</Text>
     </View>
   </View>
   <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Visibility & Permissions — owner/admin only */}
 {(teamMember?.role === 'owner' || teamMember?.role === 'admin') && (
   <TouchableOpacity style={ss.navCard} onPress={() => navigation.navigate('VisibilitySettings')} activeOpacity={0.75}>
     <View style={ss.navCardLeft}>
       <Text style={ss.navCardIcon}>🔒</Text>
       <View>
         <Text style={ss.navCardTitle}>Visibility & Permissions</Text>
         <Text style={ss.navCardSubtitle}>Control what members and viewers can see and do</Text>
       </View>
     </View>
     <Text style={ss.navCardChevron}>›</Text>
   </TouchableOpacity>
 )}

 {/* Client Fields */}
 <TouchableOpacity
 style={ss.navCard}
 onPress={() => navigation.navigate('ClientFieldsSettings')}
 activeOpacity={0.75}
 >
 <View style={ss.navCardLeft}>
 <Text style={ss.navCardIcon}>⊞</Text>
 <View>
 <Text style={ss.navCardTitle}>{t('clientFields')}</Text>
 <Text style={ss.navCardSubtitle}>Customize what info to collect per client</Text>
 </View>
 </View>
 <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Team Member Fields */}
 <TouchableOpacity
 style={ss.navCard}
 onPress={() => navigation.navigate('TeamMemberFields')}
 activeOpacity={0.75}
 >
 <View style={ss.navCardLeft}>
 <Text style={ss.navCardIcon}>👥</Text>
 <View>
 <Text style={ss.navCardTitle}>Team Member Fields</Text>
 <Text style={ss.navCardSubtitle}>Custom fields for team member profiles</Text>
 </View>
 </View>
 <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Financial Report */}
 <TouchableOpacity
 style={ss.navCard}
 onPress={() => navigation.navigate('FinancialReport')}
 activeOpacity={0.75}
 >
 <View style={ss.navCardLeft}>
 <Text style={ss.navCardIcon}>📊</Text>
 <View>
 <Text style={ss.navCardTitle}>{t('financialReport')}</Text>
 <Text style={ss.navCardSubtitle}>P&L across all files — filter by client or service</Text>
 </View>
 </View>
 <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Notifications */}
 <TouchableOpacity
 style={ss.navCard}
 onPress={() => navigation.navigate('NotificationSettings')}
 activeOpacity={0.75}
 >
 <View style={ss.navCardLeft}>
 <Text style={ss.navCardIcon}>🔔</Text>
 <View>
 <Text style={ss.navCardTitle}>{t('notifications')}</Text>
 <Text style={ss.navCardSubtitle}>Types, muted members, and push preferences</Text>
 </View>
 </View>
 <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Language */}
 <TouchableOpacity style={ss.navCard} onPress={() => { setLangSearch(''); setShowLangModal(true); }} activeOpacity={0.75}>
   <View style={ss.navCardLeft}>
     <Text style={ss.navCardIcon}>🌐</Text>
     <View>
       <Text style={ss.navCardTitle}>{t('language')}</Text>
       <Text style={ss.navCardSubtitle}>{LANGUAGES.find(l => l.code === lang)?.name ?? 'English'}</Text>
     </View>
   </View>
   <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* ── SUPPORT SECTION DIVIDER ── */}
 <Text style={ss.sectionDividerLabel}>{t('support').toUpperCase()}</Text>

 {/* Help Guide */}
 <TouchableOpacity style={ss.navCard} onPress={() => setShowHelp(true)} activeOpacity={0.75}>
   <View style={ss.navCardLeft}>
     <Text style={ss.navCardIcon}>📖</Text>
     <View>
       <Text style={ss.navCardTitle}>{t('helpGuide')}</Text>
       <Text style={ss.navCardSubtitle}>How to use every feature of GovPilot</Text>
     </View>
   </View>
   <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* FAQ */}
 <TouchableOpacity style={ss.navCard} onPress={() => setShowFaq(true)} activeOpacity={0.75}>
   <View style={ss.navCardLeft}>
     <Text style={ss.navCardIcon}>💬</Text>
     <View>
       <Text style={ss.navCardTitle}>{t('faq')}</Text>
       <Text style={ss.navCardSubtitle}>Frequently asked questions</Text>
     </View>
   </View>
   <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Report a Bug */}
 <TouchableOpacity style={ss.navCard} onPress={() => setShowBugModal(true)} activeOpacity={0.75}>
   <View style={ss.navCardLeft}>
     <Text style={ss.navCardIcon}>🐛</Text>
     <View>
       <Text style={ss.navCardTitle}>{t('reportBug')}</Text>
       <Text style={ss.navCardSubtitle}>Tell us what went wrong</Text>
     </View>
   </View>
   <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Contact Us */}
 <TouchableOpacity style={ss.navCard} onPress={() => { setContactName(teamMember?.name ?? ''); setContactEmail(teamMember?.email ?? ''); setShowContactModal(true); }} activeOpacity={0.75}>
   <View style={ss.navCardLeft}>
     <Text style={ss.navCardIcon}>✉️</Text>
     <View>
       <Text style={ss.navCardTitle}>{t('contactUs')}</Text>
       <Text style={ss.navCardSubtitle}>management@kts-lb.com</Text>
     </View>
   </View>
   <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Sign out */}
 <TouchableOpacity
 style={ss.signOutBtn}
 onPress={() =>
 Alert.alert(t('signOut'), 'Are you sure?', [
 { text: t('cancel'), style: 'cancel' },
 { text: t('signOut'), style: 'destructive', onPress: signOut },
 ])
 }
 >
 <Text style={ss.signOutText}>{t('signOut')}</Text>
 </TouchableOpacity>

 <Text style={ss.version}>GovPilot v1.0.0</Text>
 </ScrollView>


 {/* ── HELP GUIDE MODAL ── */}
 <Modal visible={showHelp} transparent={false} animationType="slide" onRequestClose={() => setShowHelp(false)}>
   <SafeAreaView style={ss.helpOverlay} edges={['top', 'bottom']}>
     <View style={ss.helpSheet}>
       <View style={ss.helpHeader}>
         <Text style={ss.helpTitle}>📖 Help Guide</Text>
         <TouchableOpacity onPress={() => setShowHelp(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
           <Text style={ss.helpClose}>✕</Text>
         </TouchableOpacity>
       </View>
       <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
         {[
           {
             icon: '📁',
             title: 'Creating a File',
             steps: [
               'Go to the Dashboard and tap ＋ New File.',
               'Select or create a client — enter their name, phone, and reference contact.',
               'Choose a service — this loads its default stages automatically.',
               'Set a contract price (optional) and a due date, then tap Create.',
             ],
           },
           {
             icon: '🗂',
             title: 'Managing Stages',
             steps: [
               'Open a file → tap ✎ Edit Stages to add, remove, or reorder stages.',
               'Each stage has its own status: Pending → In Review → Done (or Rejected).',
               'Tap the status badge on a stage to update it — you can also add a rejection reason.',
               'Set a city 📍 per stage to track where each step happens.',
               'Stages with due dates appear on the Calendar with color-coded dots.',
             ],
           },
           {
             icon: '👥',
             title: 'Assigning People',
             steps: [
               'File-level: open a file and tap the Assignee row to assign a team member.',
               'Stage-level: each stage has its own assignee chip — tap 👤 to assign.',
               'Network contacts (external agents/lawyers) can be assigned at stage level too.',
               'Assigned members receive a push notification when a stage is updated.',
             ],
           },
           {
             icon: '📄',
             title: 'Documents',
             steps: [
               'Inside a file, scroll to DOCUMENTS and tap 📷 Scan or 🖼 Library.',
               'Frame your document inside the A4 guide and capture.',
               'Give it a name and optionally link it to a stage requirement.',
               'Documents can be viewed in-app or shared as a file via the share button.',
             ],
           },
           {
             icon: '💰',
             title: 'Financial Tracking',
             steps: [
               'Inside a file, scroll to FINANCIALS to see the contract price and balance.',
               'Tap ＋ Add to record an expense or a payment received.',
               'Swipe right on any Dashboard card for a quick-add finance shortcut.',
               'Visit Financial Report (Settings) for a full P&L across all files.',
             ],
           },
           {
             icon: '📅',
             title: 'Calendar',
             steps: [
               'The Calendar tab shows all files with a due date as colored dots.',
               'Overdue stages appear in red — tap a date to see the day\'s stages.',
               'Set a stage due date inside the file detail under each stage row.',
             ],
           },
           {
             icon: '🔍',
             title: 'Search',
             steps: [
               'Tap the 🔍 icon on the Dashboard to open Global Search.',
               'Search across files, clients, stages, and documents at once.',
               'Tap any result to navigate directly to that file or client.',
             ],
           },
           {
             icon: '🌐',
             title: 'Network (Contacts)',
             steps: [
               'Go to Create → 👥 Network to manage your external contacts.',
               'Add lawyers, agents, or any external parties with name, phone, and reference.',
               'Import multiple contacts at once using 📥 Import (paste from Excel).',
               'Contacts can be assigned to specific stages inside a file.',
             ],
           },
         ].map((section, i) => (
           <View key={i} style={ss.helpSection}>
             <View style={ss.helpSectionHeader}>
               <Text style={ss.helpSectionIcon}>{section.icon}</Text>
               <Text style={ss.helpSectionTitle}>{section.title}</Text>
             </View>
             {section.steps.map((step, j) => (
               <View key={j} style={ss.helpStep}>
                 <View style={ss.helpStepDot} />
                 <Text style={ss.helpStepText}>{step}</Text>
               </View>
             ))}
           </View>
         ))}
       </ScrollView>
     </View>
   </SafeAreaView>
 </Modal>

 {/* ── FAQ MODAL ── */}
 <Modal visible={showFaq} transparent={false} animationType="slide" onRequestClose={() => setShowFaq(false)}>
   <SafeAreaView style={ss.helpOverlay} edges={['top', 'bottom']}>
     <View style={ss.helpSheet}>
       <View style={ss.helpHeader}>
         <Text style={ss.helpTitle}>💬 Frequently Asked Questions</Text>
         <TouchableOpacity onPress={() => setShowFaq(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
           <Text style={ss.helpClose}>✕</Text>
         </TouchableOpacity>
       </View>
       <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
         {[
           {
             q: 'How do I create a new file?',
             a: 'From the Dashboard, tap the ＋ New File button. Select a client, choose a service (which loads stages automatically), set a price and due date, then tap Create.',
           },
           {
             q: 'How do I change a file\'s status?',
             a: 'Open the file, find the stage you want to update, and tap its status badge. You\'ll see a list of all available statuses. The file\'s overall status is always the most critical active stage.',
           },
           {
             q: 'What is the difference between stages and status?',
             a: 'Stages are the steps a file goes through (e.g. Submit Documents → Ministry Review → Signature). Each stage has its own status. The file\'s overall status reflects the most urgent stage status.',
           },
           {
             q: 'Can I assign a file to multiple people?',
             a: 'Each file has one main assignee. However, every individual stage can have its own assigned person — so different team members or external contacts can handle different stages of the same file.',
           },
           {
             q: 'What is the difference between Team Members and Network?',
             a: 'Team Members are your colleagues who log in to GovPilot. Network (external assignees) are outside contacts like lawyers or agents — they don\'t have app accounts but can be assigned to stages for tracking.',
           },
           {
             q: 'How do I track payments?',
             a: 'Open a file, scroll to FINANCIALS. The contract price is the agreed fee. Use ＋ Add to record expenses or payments received. The balance shows (payments received − expenses).',
           },
           {
             q: 'What happens when all stages are Done?',
             a: 'The file is automatically archived and marked as closed. It moves from the Active list to the Archive list on the Dashboard. You can still view it and its financial history.',
           },
           {
             q: 'How do I delete a file?',
             a: 'Swipe left on any file card on the Dashboard and tap ✕ Delete. You\'ll be asked to confirm. Alternatively, open the file and use the ⋯ menu in the header.',
           },
           {
             q: 'Can I use the app offline?',
             a: 'Comments and some actions are queued offline and sync when your connection returns. However, loading files, updating stages, and uploading documents require an internet connection.',
           },
           {
             q: 'How do I import multiple clients or stages at once?',
             a: 'In Create → Clients modal, tap 📥 Import and paste rows copied directly from Excel (columns: Name, Phone, Reference Name, Reference Phone). For stages, use the same import button in the Stages modal.',
           },
           {
             q: 'How do I set a city for a stage?',
             a: 'In a file, each stage row has a 📍 city chip. Tap it to select or search a city. You can also set a default city per stage type in Create → Stages — new files will auto-fill that city.',
           },
           {
             q: 'How do I add requirements to a stage?',
             a: 'Inside a file, each stage has a 📋 Requirements button. Tap it to add documents, tasks, or signature requirements. You can also define template requirements per stage type in Create → Stages → 📋 Req.',
           },
           {
             q: 'How do I print or share a file summary?',
             a: 'Open the file and tap the 🖨 print icon in the header. This generates a formatted PDF summary of the file, stages, and financials which you can share or print.',
           },
           {
             q: 'How do I invite a team member?',
             a: 'Go to Settings → Team Members → ✉️ Invite. Enter their email or phone number and choose their role. They register in the app with that same identifier and are automatically added to your organization.',
           },
         ].map((item, i) => (
           <TouchableOpacity
             key={i}
             style={[ss.faqItem, openFaqId === i && ss.faqItemOpen]}
             onPress={() => setOpenFaqId(v => v === i ? null : i)}
             activeOpacity={0.75}
           >
             <View style={ss.faqQuestion}>
               <Text style={ss.faqQ}>{item.q}</Text>
               <Text style={[ss.faqChevron, openFaqId === i && ss.faqChevronOpen]}>›</Text>
             </View>
             {openFaqId === i && (
               <Text style={ss.faqA}>{item.a}</Text>
             )}
           </TouchableOpacity>
         ))}
       </ScrollView>
     </View>
   </SafeAreaView>
 </Modal>


 {/* ── EDIT MEMBER ROLE MODAL ── */}
 <Modal visible={!!editMemberModal} transparent animationType="fade" onRequestClose={() => setEditMemberModal(null)}>
   <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
     <View style={ss.inviteOverlay}>
       <View style={ss.inviteSheet}>
         <Text style={ss.inviteTitle}>Edit {editMemberModal?.name}</Text>
         <Text style={ss.inviteDesc}>Change this team member's role.</Text>
         <View style={ss.field}>
           <Text style={ss.fieldLabel}>ROLE</Text>
           <View style={ss.roleRow}>
             {(['admin', 'member', 'viewer'] as const).map((r) => (
               <TouchableOpacity
                 key={r}
                 style={[ss.roleChip, editMemberRole === r && ss.roleChipActive]}
                 onPress={() => setEditMemberRole(r)}
               >
                 <Text style={[ss.roleChipText, editMemberRole === r && ss.roleChipTextActive]}>
                   {r === 'admin' ? '🔑 Admin' : r === 'member' ? '👤 Member' : '👁 Viewer'}
                 </Text>
               </TouchableOpacity>
             ))}
           </View>
           <Text style={ss.roleDesc}>
             {editMemberRole === 'admin'  ? 'Can manage settings, invite members, view all data' :
              editMemberRole === 'member' ? 'Can create and edit files, add stages and documents' :
              'Read-only access — cannot create or edit any records'}
           </Text>
         </View>
         <TouchableOpacity style={ss.inviteBtn} onPress={handleSaveMemberRole}>
           <Text style={ss.inviteBtnText}>{t('save')}</Text>
         </TouchableOpacity>
         <TouchableOpacity style={ss.inviteCancelBtn} onPress={() => setEditMemberModal(null)}>
           <Text style={ss.inviteCancelText}>{t('cancel')}</Text>
         </TouchableOpacity>
       </View>
     </View>
   </KeyboardAvoidingView>
 </Modal>

 {/* ── INVITE MEMBER MODAL ── */}
 <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
   <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
     <View style={ss.inviteOverlay}>
       <View style={ss.inviteSheet}>
         <Text style={ss.inviteTitle}>✉️ Invite Team Member</Text>
         <Text style={ss.inviteDesc}>They will automatically join your organization when they register.</Text>

         {/* Email / Phone tabs */}
         <View style={ss.roleRow}>
           <TouchableOpacity
             style={[ss.roleChip, inviteInputType === 'email' && ss.roleChipActive]}
             onPress={() => setInviteInputType('email')}
           >
             <Text style={[ss.roleChipText, inviteInputType === 'email' && ss.roleChipTextActive]}>✉️ Email</Text>
           </TouchableOpacity>
           <TouchableOpacity
             style={[ss.roleChip, inviteInputType === 'phone' && ss.roleChipActive]}
             onPress={() => setInviteInputType('phone')}
           >
             <Text style={[ss.roleChipText, inviteInputType === 'phone' && ss.roleChipTextActive]}>📱 Phone</Text>
           </TouchableOpacity>
         </View>

         <View style={ss.field}>
           {inviteInputType === 'email' ? (
             <>
               <Text style={ss.fieldLabel}>EMAIL ADDRESS</Text>
               <TextInput
                 style={ss.fieldInput}
                 value={inviteEmail}
                 onChangeText={setInviteEmail}
                 placeholder="their@email.com"
                 placeholderTextColor={theme.color.textMuted}
                 keyboardType="email-address"
                 autoCapitalize="none"
                 autoCorrect={false}
               />
             </>
           ) : (
             <>
               <Text style={ss.fieldLabel}>PHONE NUMBER</Text>
               <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                 <TouchableOpacity
                   style={[ss.fieldInput, { flex: 0, minWidth: 100, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                   onPress={() => {}}
                 >
                   <Text>{SORTED_COUNTRIES.find(c => c.code === inviteCountryCode)?.flag ?? '🇱🇧'}</Text>
                   <Text style={{ color: theme.color.textPrimary, fontWeight: '600' }}>{inviteCountryCode}</Text>
                 </TouchableOpacity>
                 <TextInput
                   style={[ss.fieldInput, { flex: 1 }]}
                   value={invitePhone}
                   onChangeText={setInvitePhone}
                   placeholder="70 123 456"
                   placeholderTextColor={theme.color.textMuted}
                   keyboardType="phone-pad"
                 />
               </View>
             </>
           )}
         </View>

         <View style={ss.field}>
           <Text style={ss.fieldLabel}>ROLE</Text>
           <View style={ss.roleRow}>
             {(['admin', 'member', 'viewer'] as const).map((r) => (
               <TouchableOpacity
                 key={r}
                 style={[ss.roleChip, inviteRole === r && ss.roleChipActive]}
                 onPress={() => setInviteRole(r)}
               >
                 <Text style={[ss.roleChipText, inviteRole === r && ss.roleChipTextActive]}>
                   {r === 'admin' ? '🔑 Admin' : r === 'member' ? '👤 Member' : '👁 Viewer'}
                 </Text>
               </TouchableOpacity>
             ))}
           </View>
           <Text style={ss.roleDesc}>
             {inviteRole === 'admin'  ? 'Can manage settings, invite members, view all data' :
              inviteRole === 'member' ? 'Can create and edit files, add stages and documents' :
              'Read-only access — cannot create or edit any records'}
           </Text>
         </View>

         <TouchableOpacity
           style={[ss.inviteBtn, inviting && { opacity: 0.6 }]}
           onPress={sendInvite}
           disabled={inviting}
         >
           {inviting
             ? <ActivityIndicator color={theme.color.white} />
             : <Text style={ss.inviteBtnText}>Send Invite</Text>
           }
         </TouchableOpacity>
         <TouchableOpacity style={ss.inviteCancelBtn} onPress={() => setShowInviteModal(false)}>
           <Text style={ss.inviteCancelText}>{t('cancel')}</Text>
         </TouchableOpacity>
       </View>
     </View>
   </KeyboardAvoidingView>
 </Modal>

 {/* ── LANGUAGE PICKER MODAL ── */}
 <Modal visible={showLangModal} transparent animationType="slide" onRequestClose={() => setShowLangModal(false)}>
   <View style={ss.helpOverlay}>
     <View style={ss.helpSheet}>
       <View style={ss.helpHeader}>
         <Text style={ss.helpTitle}>🌐 {t('language')}</Text>
         <TouchableOpacity onPress={() => setShowLangModal(false)}>
           <Text style={ss.helpClose}>✕</Text>
         </TouchableOpacity>
       </View>
       <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
         <TextInput
           style={ss.fieldInput}
           value={langSearch}
           onChangeText={setLangSearch}
           placeholder={t('searchPlaceholder')}
           placeholderTextColor={theme.color.textMuted}
           autoCorrect={false}
           autoCapitalize="none"
         />
       </View>
       <FlatList
         data={LANGUAGES.filter(l => langSearch ? l.name.toLowerCase().includes(langSearch.toLowerCase()) || l.nameEn.toLowerCase().includes(langSearch.toLowerCase()) : true)}
         keyExtractor={(l) => l.code}
         keyboardShouldPersistTaps="always"
         renderItem={({ item }) => (
           <TouchableOpacity
             style={[ss.tmRow, item.code === lang && { backgroundColor: theme.color.primary + '12' }]}
             onPress={() => handleSelectLang(item)}
             activeOpacity={0.7}
           >
             <Text style={{ fontSize: 24, width: 36 }}>{item.flag}</Text>
             <View style={{ flex: 1 }}>
               <Text style={ss.tmName}>{item.name}</Text>
               <Text style={ss.tmEmail}>{item.nameEn}{item.rtl ? ' · RTL' : ''}</Text>
             </View>
             {item.code === lang && (
               <Text style={{ color: theme.color.primary, fontWeight: '700' }}>✓</Text>
             )}
           </TouchableOpacity>
         )}
       />
     </View>
   </View>
 </Modal>

 {/* ── CONTACT US MODAL ── */}
 <Modal visible={showContactModal} transparent={false} animationType="slide" onRequestClose={() => setShowContactModal(false)}>
   <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bgBase }} edges={['top', 'bottom']}>
     {/* Header — fixed at top */}
     <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
       <Text style={{ ...theme.typography.heading, fontSize: 20, fontWeight: '700', color: theme.color.textPrimary }}>✉️ Contact Us</Text>
       <TouchableOpacity onPress={() => setShowContactModal(false)} style={{ padding: 8, marginRight: -4 }}>
         <Text style={{ color: theme.color.textMuted, fontSize: 22, fontWeight: '600' }}>✕</Text>
       </TouchableOpacity>
     </View>
     {/* Scrollable body */}
     <ScrollView
       style={{ flex: 1 }}
       contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
       keyboardShouldPersistTaps="handled"
       showsVerticalScrollIndicator={false}
     >
       <Text style={ss.inviteDesc}>Our team at management@kts-lb.com will respond as soon as possible.</Text>

       <View style={ss.field}>
         <Text style={ss.fieldLabel}>YOUR NAME</Text>
         <TextInput
           style={ss.fieldInput}
           value={contactName}
           onChangeText={setContactName}
           placeholder="Full name"
           placeholderTextColor={theme.color.textMuted}
         />
       </View>

       <View style={ss.field}>
         <Text style={ss.fieldLabel}>YOUR EMAIL</Text>
         <TextInput
           style={ss.fieldInput}
           value={contactEmail}
           onChangeText={setContactEmail}
           placeholder="your@email.com"
           placeholderTextColor={theme.color.textMuted}
           keyboardType="email-address"
           autoCapitalize="none"
         />
       </View>

       <View style={ss.field}>
         <Text style={ss.fieldLabel}>SUBJECT</Text>
         <TextInput
           style={ss.fieldInput}
           value={contactSubject}
           onChangeText={setContactSubject}
           placeholder="What is your message about?"
           placeholderTextColor={theme.color.textMuted}
         />
       </View>

       <View style={ss.field}>
         <Text style={ss.fieldLabel}>MESSAGE</Text>
         <TextInput
           style={[ss.fieldInput, { height: 160, textAlignVertical: 'top', paddingTop: 12 }]}
           value={contactMessage}
           onChangeText={setContactMessage}
           placeholder="Describe your question, feedback, or request..."
           placeholderTextColor={theme.color.textMuted}
           multiline
         />
       </View>

       <TouchableOpacity
         style={[ss.inviteBtn, sendingContact && { opacity: 0.6 }]}
         onPress={handleSendContact}
         disabled={sendingContact}
       >
         {sendingContact
           ? <ActivityIndicator color={theme.color.white} />
           : <Text style={ss.inviteBtnText}>Send Message</Text>
         }
       </TouchableOpacity>
     </ScrollView>
   </SafeAreaView>
 </Modal>

 {/* ── REPORT BUG MODAL ── */}
 <Modal visible={showBugModal} transparent={false} animationType="slide" onRequestClose={() => setShowBugModal(false)}>
   <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bgBase }} edges={['top', 'bottom']}>
     {/* Header — fixed at top */}
     <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
       <Text style={{ ...theme.typography.heading, fontSize: 20, fontWeight: '700', color: theme.color.textPrimary }}>🐛 Report a Bug</Text>
       <TouchableOpacity onPress={() => setShowBugModal(false)} style={{ padding: 8, marginRight: -4 }}>
         <Text style={{ color: theme.color.textMuted, fontSize: 22, fontWeight: '600' }}>✕</Text>
       </TouchableOpacity>
     </View>
     {/* Scrollable body */}
     <ScrollView
       style={{ flex: 1 }}
       contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
       keyboardShouldPersistTaps="handled"
       showsVerticalScrollIndicator={false}
     >
       <Text style={ss.inviteDesc}>Describe what happened and how to reproduce it. We'll fix it ASAP.</Text>

       <View style={ss.field}>
         <Text style={ss.fieldLabel}>BUG TITLE</Text>
         <TextInput
           style={ss.fieldInput}
           value={bugTitle}
           onChangeText={setBugTitle}
           placeholder="Short description of the bug"
           placeholderTextColor={theme.color.textMuted}
         />
       </View>

       <View style={ss.field}>
         <Text style={ss.fieldLabel}>DESCRIPTION</Text>
         <TextInput
           style={[ss.fieldInput, { height: 180, textAlignVertical: 'top', paddingTop: 12 }]}
           value={bugDesc}
           onChangeText={setBugDesc}
           placeholder="Steps to reproduce:&#10;1. Go to...&#10;2. Tap...&#10;3. See error..."
           placeholderTextColor={theme.color.textMuted}
           multiline
         />
       </View>

       <TouchableOpacity
         style={[ss.inviteBtn, sendingBug && { opacity: 0.6 }]}
         onPress={handleSendBug}
         disabled={sendingBug}
       >
         {sendingBug
           ? <ActivityIndicator color={theme.color.white} />
           : <Text style={ss.inviteBtnText}>Submit Bug Report</Text>
         }
       </TouchableOpacity>
     </ScrollView>
   </SafeAreaView>
 </Modal>

 </SafeAreaView>
 );
}

const ss = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  header: {
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space4,
    paddingBottom:     theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  title:  { ...theme.typography.heading, fontSize: 24, fontWeight: '800' },
  scroll: { padding: theme.spacing.space4, gap: theme.spacing.space3, paddingBottom: 60 },
  profileCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    marginBottom:    4,
  },
  profileAvatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: theme.color.primary,
    justifyContent:  'center',
    alignItems:      'center',
  },
  profileAvatarText: { color: theme.color.white, fontSize: 18, fontWeight: '800' },
  profileName:       { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  profileRole:       { ...theme.typography.label, color: theme.color.primary, fontWeight: '600', marginTop: 2 },
  profileEmail:      { ...theme.typography.label, color: theme.color.textMuted, marginTop: 1 },
  section: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.color.border,
    overflow:        'hidden',
  },
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        14,
  },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle:       { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15, fontWeight: '700' },
  sectionCount:       { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '600', marginTop: 2 },
  chevron:            { color: theme.color.border, fontSize: 22, fontWeight: '700' },
  chevronOpen:        { color: theme.color.primary, transform: [{ rotate: '90deg' }] },
  addBtn: {
    backgroundColor: theme.color.primary + '22',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
  },
  addBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  sectionBody: {
    borderTopWidth:  1,
    borderTopColor:  theme.color.border,
  },
  listItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
    gap:               10,
  },
  accentDot:       { width: 10, height: 10, borderRadius: 5 },
  listItemLabel:   { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  listItemSub:     { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  svcPriceText:    { ...theme.typography.caption, color: theme.color.primary, fontWeight: '600', marginTop: 2 },
  priceInputLabel: { ...theme.typography.caption, color: theme.color.textSecondary, marginBottom: 4 },
  deleteBtn:       { padding: 4 },
  deleteBtnText:   { color: theme.color.danger, fontSize: 16 },
  svcItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  stagesBtn: {
    backgroundColor: theme.color.primary + '22',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    marginEnd:       10,
  },
  stagesBtnText:     { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  svcAddPlusBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    width:           44,
    height:          44,
    justifyContent:  'center',
    alignItems:      'center',
  },
  svcAddPlusBtnText: { color: theme.color.white, fontSize: 22, fontWeight: '700', lineHeight: 26 },
  newSvcStageRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space2,
    paddingHorizontal: theme.spacing.space3,
    marginBottom:    6,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  stagesModalSubtitle: { ...theme.typography.label, color: theme.color.textMuted, marginTop: 2 },
  stagesEmpty:         { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', paddingVertical: theme.spacing.space2 },
  svcStageRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.space3,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  svcStageIndex: {
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: theme.color.border,
    justifyContent:  'center',
    alignItems:      'center',
  },
  svcStageIndexText: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: '700' },
  svcStageName:      { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  svcStageActions:   { flexDirection: 'row', gap: 10, alignItems: 'center' },
  svcStageArrow:     { color: theme.color.primary, fontSize: 18, fontWeight: '700' },
  svcStageDisabled:  { opacity: 0.25 },
  svcStageRemove:    { color: theme.color.danger, fontSize: 16 },
  svcAddBtn: {
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.md,
    paddingVertical: 10,
    alignItems:      'center',
  },
  svcAddBtnText: { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600' },
  svcPickerList: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    overflow:        'hidden',
  },
  svcPickerItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  svcPickerItemText: { ...theme.typography.body, color: theme.color.textSecondary },
  svcPickerAdd:      { color: theme.color.primary, fontSize: 20, fontWeight: '700' },
  svcNewStageRow:    { flexDirection: 'row', gap: 10, alignItems: 'center' },
  svcNewStageBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.space3,
    justifyContent:  'center',
  },
  svcNewStageBtnText: { color: theme.color.white, fontSize: 13, fontWeight: '700' },
  rtlRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  rtlLabel: { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15, fontWeight: '600' },
  rtlSub:   { ...theme.typography.label, color: theme.color.textMuted, marginTop: 2 },
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
  navCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    borderWidth:     1,
    borderColor:     theme.color.primary + '33',
  },
  navCardLeft:     { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space3 },
  navCardIcon:     { fontSize: 22, color: theme.color.primary },
  navCardTitle:    { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 15, fontWeight: '700' },
  navCardSubtitle: { ...theme.typography.label, color: theme.color.textMuted, marginTop: 2 },
  navCardChevron:  { color: theme.color.primary, fontSize: 24, fontWeight: '700' },
  version: {
    color:     theme.color.bgSurface,
    fontSize:  12,
    textAlign: 'center',
    marginTop: theme.spacing.space2,
  },

  // Role badge on list items
  roleBadge: {
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth:     1,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Pending invites
  // Team member row (in team modal)
  tmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border + '44',
    gap: 10,
  },
  tmAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  tmAvatarText: { fontSize: 16, fontWeight: '700' },
  tmName: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600', fontSize: 14 },
  tmEmail: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },

  invitesHeader: { paddingVertical: 8, paddingHorizontal: 4 },
  invitesHeaderText: { ...theme.typography.sectionDivider, letterSpacing: 1 },
  pendingInviteRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.space3,
    backgroundColor: theme.color.warning + '0D',
    borderRadius:    theme.radius.md,
    marginBottom:    6,
    borderWidth:     1,
    borderColor:     theme.color.warning + '33',
  },
  pendingInviteEmail: { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600' },
  pendingInviteRole:  { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 2 },
  revokeBtn: {
    backgroundColor: theme.color.danger + '18',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth:     1,
    borderColor:     theme.color.danger + '44',
  },
  revokeBtnText: { ...theme.typography.caption, color: theme.color.danger, fontWeight: '700' },

  // Invite modal
  inviteOverlay: {
    flex:            1,
    backgroundColor: theme.color.overlayDark,
    justifyContent:  'flex-end',
  },
  inviteSheet: {
    backgroundColor: theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding:         theme.spacing.space5,
    gap:             18,
    paddingBottom:   40,
  },
  inviteTitle: { ...theme.typography.heading, fontSize: 20, fontWeight: '700' },
  inviteDesc:  { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 22 },
  field:       { gap: 6 },
  fieldLabel:  { ...theme.typography.sectionDivider, letterSpacing: 1.1 },
  fieldInput: {
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.lg,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: 12,
    color:           theme.color.textPrimary,
    fontSize:        15,
  },
  roleRow:          { flexDirection: 'row', gap: 8 },
  roleChip: {
    flex:              1,
    paddingVertical:   9,
    borderRadius:      theme.radius.md,
    alignItems:        'center',
    backgroundColor:   theme.color.bgBase,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  roleChipActive:     { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  roleChipText:       { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '600' },
  roleChipTextActive: { color: theme.color.white },
  roleDesc:           { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 4 },
  inviteBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 15,
    alignItems:      'center',
  },
  inviteBtnText:    { color: theme.color.white, fontSize: 16, fontWeight: '700' },
  inviteCancelBtn:  { alignItems: 'center', paddingVertical: 4 },
  inviteCancelText: { ...theme.typography.body, color: theme.color.textMuted },
  inviteIdHint:     { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 4 },

  // Support section divider label
  sectionDividerLabel: {
    ...theme.typography.sectionDivider,
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    marginTop: theme.spacing.space2,
    marginBottom: -4,
  },

  // Team Members bottom sheet
  teamModalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent:  'flex-end',
  },
  teamModalSheet: {
    backgroundColor:       theme.color.bgSurface,
    borderTopLeftRadius:   20,
    borderTopRightRadius:  20,
    paddingHorizontal:     theme.spacing.space5,
    paddingTop:            theme.spacing.space3,
    paddingBottom:         theme.spacing.space6,
    maxHeight:             '80%',
    gap:                   12,
  },
  teamModalHandle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: theme.color.border,
    alignSelf:       'center',
    marginBottom:    8,
  },

  // Help & FAQ shared modal chrome
  helpOverlay: {
    flex:            1,
    backgroundColor: theme.color.bgSurface,
  },
  helpSheet: {
    flex:    1,
    padding: theme.spacing.space5,
    gap:     16,
  },
  helpHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  helpTitle: {
    ...theme.typography.heading,
    fontSize:   20,
    fontWeight: '700',
    flex:       1,
  },
  helpClose: {
    color:    theme.color.textMuted,
    fontSize: 18,
    padding:  4,
  },

  // Help guide sections
  helpSection: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     theme.color.border,
    gap:             8,
  },
  helpSectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  4,
  },
  helpSectionIcon:  { fontSize: 20 },
  helpSectionTitle: {
    ...theme.typography.body,
    color:      theme.color.textPrimary,
    fontSize:   15,
    fontWeight: '700',
  },
  helpStep: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },
  helpStepDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: theme.color.primary,
    marginTop:       6,
    flexShrink:      0,
  },
  helpStepText: {
    ...theme.typography.body,
    color:      theme.color.textSecondary,
    lineHeight: 22,
    flex:       1,
  },

  // FAQ accordion items
  faqItem: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    marginBottom:    8,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  faqItemOpen: {
    borderColor:     theme.color.primary + '55',
    backgroundColor: theme.color.primary + '08',
  },
  faqQuestion: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            12,
  },
  faqQ: {
    ...theme.typography.body,
    color:      theme.color.textPrimary,
    fontWeight: '600',
    flex:       1,
    lineHeight: 22,
  },
  faqChevron: {
    color:    theme.color.border,
    fontSize: 22,
    fontWeight: '700',
  },
  faqChevronOpen: {
    color:     theme.color.primary,
    transform: [{ rotate: '90deg' }],
  },
  faqA: {
    ...theme.typography.body,
    color:      theme.color.textSecondary,
    lineHeight: 22,
    marginTop:  10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
});
