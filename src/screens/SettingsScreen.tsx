// src/screens/SettingsScreen.tsx
// Admin settings: manage ministries, sub-ministries, services, status labels, team members

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
 Switch,
 KeyboardAvoidingView,
 Platform,
 I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AsyncStorage from '@react-native-async-storage/async-storage';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Ministry, Service, StatusLabel, TeamMember } from '../types';

// ─── Section wrapper ──────────────────────────────────────────
function Section({
 title,
 count,
 children,
 onAdd,
}: {
 title: string;
 count: number;
 children: React.ReactNode;
 onAdd: () => void;
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
 <TouchableOpacity
 style={ss.addBtn}
 onPress={(e) => {
 e.stopPropagation();
 onAdd();
 }}
 >
 <Text style={ss.addBtnText}>+ Add</Text>
 </TouchableOpacity>
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
 onDelete,
}: {
 label: string;
 sublabel?: string;
 accent?: string;
 onDelete: () => void;
}) {
 return (
 <View style={ss.listItem}>
 {accent && <View style={[ss.accentDot, { backgroundColor: accent }]} />}
 <View style={{ flex: 1 }}>
 <Text style={ss.listItemLabel}>{label}</Text>
 {sublabel && <Text style={ss.listItemSub}>{sublabel}</Text>}
 </View>
 <TouchableOpacity onPress={onDelete} style={ss.deleteBtn}>
 <Text style={ss.deleteBtnText}>✕</Text>
 </TouchableOpacity>
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
type ActiveModal =
 | 'ministry'
 | 'subministry'
 | 'service'
 | 'status'
 | 'member'
 | null;

export default function SettingsScreen() {
 const { teamMember, signOut } = useAuth();

 const [ministries, setMinistries] = useState<Ministry[]>([]);
 const [services, setServices] = useState<Service[]>([]);
 const [statusLabels, setStatusLabels] = useState<StatusLabel[]>([]);
 const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
 const [loading, setLoading] = useState(true);

 const navigation = useNavigation<any>();
 const [activeModal, setActiveModal] = useState<ActiveModal>(null);
 const [saving, setSaving] = useState(false);
 const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});

 // Service stages modal
 const [showSvcStages, setShowSvcStages] = useState(false);
 const [svcStagesId, setSvcStagesId] = useState<string | null>(null);
 const [svcStagesName, setSvcStagesName] = useState('');
 const [svcStages, setSvcStages] = useState<Array<{ id: string; ministry_id: string; ministry_name: string; stop_order: number }>>([]);
 const [loadingSvcStages, setLoadingSvcStages] = useState(false);
 const [svcNewStageName, setSvcNewStageName] = useState('');
 const [addingSvcStage, setAddingSvcStage] = useState(false);
 const [showSvcStagePicker, setShowSvcStagePicker] = useState(false);

 // New service creation (dedicated modal, replaces ModalForm)
 const [showCreateSvc, setShowCreateSvc] = useState(false);
 const [newSvcName, setNewSvcName] = useState('');
 const [newSvcPriceUSD, setNewSvcPriceUSD] = useState('');
 const [newSvcPriceLBP, setNewSvcPriceLBP] = useState('');
 const [newSvcStageNames, setNewSvcStageNames] = useState<string[]>([]);
 const [newSvcStageInput, setNewSvcStageInput] = useState('');
 const [savingNewSvc, setSavingNewSvc] = useState(false);

 // RTL
 const [isRTL, setIsRTL] = useState(false);
 useEffect(() => {
   AsyncStorage.getItem('@rtl_enabled').then((val) => setIsRTL(val === 'true'));
 }, []);

 const toggleRTL = async (value: boolean) => {
   setIsRTL(value);
   await AsyncStorage.setItem('@rtl_enabled', value ? 'true' : 'false');
   Alert.alert(
     'Restart Required',
     'Please close and reopen the app to apply the layout direction change.',
     [{ text: 'OK' }]
   );
 };

 const fetchData = useCallback(async () => {
 const [miniRes, svcRes, lblRes, tmRes] = await Promise.all([
 supabase.from('ministries').select('*').order('type').order('name'),
 supabase.from('services').select('*, ministry:ministries(*)').order('name'),
 supabase.from('status_labels').select('*').order('sort_order'),
 supabase.from('team_members').select('*').order('name'),
 ]);
 if (miniRes.data) setMinistries(miniRes.data as Ministry[]);
 if (svcRes.data) setServices(svcRes.data as Service[]);
 if (lblRes.data) setStatusLabels(lblRes.data as StatusLabel[]);
 if (tmRes.data) setTeamMembers(tmRes.data as TeamMember[]);
 setLoading(false);
 }, []);

 useEffect(() => { fetchData(); }, [fetchData]);

 const setField = (key: string, value: string | boolean) =>
 setFormValues((prev) => ({ ...prev, [key]: value }));

 const openModal = (type: ActiveModal, defaults: Record<string, string | boolean> = {}) => {
 setFormValues(defaults);
 setActiveModal(type);
 };

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

 // ─── Service stages helpers ───────────────────────────────
 const loadSvcStages = async (serviceId: string) => {
   setLoadingSvcStages(true);
   const { data } = await supabase
     .from('service_default_stages')
     .select('*, ministry:ministries(id, name)')
     .eq('service_id', serviceId)
     .order('stop_order');
   setSvcStages(
     (data ?? []).map((d: any) => ({
       id: d.id,
       ministry_id: d.ministry_id,
       ministry_name: d.ministry?.name ?? '',
       stop_order: d.stop_order,
     }))
   );
   setLoadingSvcStages(false);
 };

 const openSvcStages = (service: Service) => {
   setSvcStagesId(service.id);
   setSvcStagesName(service.name);
   loadSvcStages(service.id);
   setShowSvcStages(true);
 };

 const removeSvcStage = async (stageId: string) => {
   await supabase.from('service_default_stages').delete().eq('id', stageId);
   setSvcStages((prev) => prev.filter((s) => s.id !== stageId));
 };

 const moveSvcStage = async (idx: number, dir: -1 | 1) => {
   const arr = [...svcStages];
   const target = idx + dir;
   if (target < 0 || target >= arr.length) return;
   [arr[idx], arr[target]] = [arr[target], arr[idx]];
   await Promise.all([
     supabase.from('service_default_stages').update({ stop_order: idx + 1 }).eq('id', arr[idx].id),
     supabase.from('service_default_stages').update({ stop_order: target + 1 }).eq('id', arr[target].id),
   ]);
   setSvcStages(arr.map((s, i) => ({ ...s, stop_order: i + 1 })));
 };

 const addSvcStageFromMinistry = async (ministry: Ministry) => {
   if (!svcStagesId) return;
   if (svcStages.find((s) => s.ministry_id === ministry.id)) return;
   const nextOrder = svcStages.length + 1;
   const { data, error } = await supabase
     .from('service_default_stages')
     .insert({ service_id: svcStagesId, ministry_id: ministry.id, stop_order: nextOrder })
     .select()
     .single();
   if (!error && data) {
     setSvcStages((prev) => [...prev, { id: data.id, ministry_id: ministry.id, ministry_name: ministry.name, stop_order: nextOrder }]);
   }
   setShowSvcStagePicker(false);
 };

 const addSvcStageNew = async () => {
   if (!svcNewStageName.trim() || !svcStagesId) return;
   setAddingSvcStage(true);
   const { data: mData, error: mErr } = await supabase
     .from('ministries')
     .insert({ name: svcNewStageName.trim(), type: 'parent' })
     .select()
     .single();
   if (mErr) { Alert.alert('Error', mErr.message); setAddingSvcStage(false); return; }
   const nextOrder = svcStages.length + 1;
   const { data, error } = await supabase
     .from('service_default_stages')
     .insert({ service_id: svcStagesId, ministry_id: mData.id, stop_order: nextOrder })
     .select()
     .single();
   setAddingSvcStage(false);
   if (!error && data) {
     setSvcStages((prev) => [...prev, { id: data.id, ministry_id: mData.id, ministry_name: mData.name, stop_order: nextOrder }]);
     fetchData();
   }
   setSvcNewStageName('');
 };

 // ─── Save handlers ────────────────────────────────────────
 const saveMinistry = async () => {
 const name = (formValues.name as string)?.trim();
 if (!name) { Alert.alert('Required', 'Ministry name is required.'); return; }
 setSaving(true);
 const { error } = await supabase.from('ministries').insert({
 name,
 type: 'parent',
 });
 setSaving(false);
 if (error) Alert.alert('Error', error.message);
 else { setActiveModal(null); fetchData(); }
 };

 const saveSubMinistry = async () => {
 const name = (formValues.name as string)?.trim();
 const parentId = formValues.parentId as string;
 if (!name) { Alert.alert('Required', 'Sub-ministry name is required.'); return; }
 if (!parentId) { Alert.alert('Required', 'Select a parent ministry.'); return; }
 setSaving(true);
 const { error } = await supabase.from('ministries').insert({
 name,
 type: 'child',
 parent_id: parentId,
 });
 setSaving(false);
 if (error) Alert.alert('Error', error.message);
 else { setActiveModal(null); fetchData(); }
 };

 const handleCreateService = async () => {
 if (!newSvcName.trim()) { Alert.alert('Required', 'Service name is required.'); return; }
 setSavingNewSvc(true);
 const { data: svcData, error: svcErr } = await supabase
   .from('services')
   .insert({
     name: newSvcName.trim(),
     estimated_duration_days: 0,
     base_price_usd: parseFloat(newSvcPriceUSD) || 0,
     base_price_lbp: parseFloat(newSvcPriceLBP.replace(/,/g, '')) || 0,
   })
   .select().single();
 if (svcErr) { Alert.alert('Error', svcErr.message); setSavingNewSvc(false); return; }
 // Create ministries + link as default stages
 const names = newSvcStageNames.filter((n) => n.trim());
 for (let i = 0; i < names.length; i++) {
   const { data: mData } = await supabase
     .from('ministries').insert({ name: names[i].trim(), type: 'parent' }).select().single();
   if (mData) {
     await supabase.from('service_default_stages').insert({
       service_id: svcData.id, ministry_id: mData.id, stop_order: i + 1,
     });
   }
 }
 setSavingNewSvc(false);
 setNewSvcName('');
 setNewSvcPriceUSD('');
 setNewSvcPriceLBP('');
 setNewSvcStageNames([]);
 setNewSvcStageInput('');
 setShowCreateSvc(false);
 fetchData();
 };

 const saveStatus = async () => {
 const label = (formValues.label as string)?.trim();
 const color = (formValues.color as string)?.trim() || '#6366f1';
 if (!label) { Alert.alert('Required', 'Status label is required.'); return; }
 setSaving(true);
 const maxOrder = Math.max(0, ...statusLabels.map((s) => s.sort_order));
 const { error } = await supabase.from('status_labels').insert({
 label,
 color,
 sort_order: maxOrder + 1,
 });
 setSaving(false);
 if (error) Alert.alert('Error', error.message);
 else { setActiveModal(null); fetchData(); }
 };

 const saveMember = async () => {
 const name = (formValues.name as string)?.trim();
 const email = (formValues.email as string)?.trim().toLowerCase();
 const role = (formValues.role as string)?.trim() || 'Agent';
 const phone = (formValues.phone as string)?.trim() || null;
 if (!name || !email) { Alert.alert('Required', 'Name and email are required.'); return; }
 setSaving(true);
 // Create auth user (Supabase Admin API not available client-side; insert profile only)
 // In production: use Supabase Edge Function to create auth user + insert profile
 const { error } = await supabase.from('team_members').insert({ name, email, role, phone });
 setSaving(false);
 if (error) Alert.alert('Error', error.message);
 else {
 setActiveModal(null);
 fetchData();
 Alert.alert(
 'Member Added',
 `${name} has been added. Remember to create their Supabase Auth account so they can log in.`
 );
 }
 };

 const parentMinistries = ministries.filter((m) => m.type === 'parent');
 const subMinistries = ministries.filter((m) => m.type === 'child');

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
 <Text style={ss.title}>Settings</Text>
 </View>

 <ScrollView contentContainerStyle={ss.scroll}>
 {/* Current user card */}
 <View style={ss.profileCard}>
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
 <View>
 <Text style={ss.profileName}>{teamMember?.name ?? '—'}</Text>
 <Text style={ss.profileRole}>{teamMember?.role ?? '—'}</Text>
 <Text style={ss.profileEmail}>{teamMember?.email ?? '—'}</Text>
 </View>
 </View>

 {/* Client Fields */}
 <TouchableOpacity
 style={ss.navCard}
 onPress={() => navigation.navigate('ClientFieldsSettings')}
 activeOpacity={0.75}
 >
 <View style={ss.navCardLeft}>
 <Text style={ss.navCardIcon}>⊞</Text>
 <View>
 <Text style={ss.navCardTitle}>Client Fields</Text>
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
 <Text style={ss.navCardTitle}>Financial Report</Text>
 <Text style={ss.navCardSubtitle}>P&L across all files — filter by client or service</Text>
 </View>
 </View>
 <Text style={ss.navCardChevron}>›</Text>
 </TouchableOpacity>

 {/* Ministries */}
 <Section
 title="Ministries"
 count={parentMinistries.length}
 onAdd={() => openModal('ministry', { name: '' })}
 >
 {parentMinistries.map((m) => (
 <ListItem
 key={m.id}
 label={m.name}
 sublabel="Parent ministry"
 onDelete={() => deleteRecord('ministries', m.id, m.name)}
 />
 ))}
 </Section>

 {/* Sub-ministries */}
 <Section
 title="Sub-Ministries"
 count={subMinistries.length}
 onAdd={() =>
 openModal('subministry', {
 name: '',
 parentId: parentMinistries[0]?.id ?? '',
 })
 }
 >
 {subMinistries.map((m) => {
 const parent = parentMinistries.find((p) => p.id === m.parent_id);
 return (
 <ListItem
 key={m.id}
 label={m.name}
 sublabel={parent ? `Under: ${parent.name}` : 'No parent'}
 onDelete={() => deleteRecord('ministries', m.id, m.name)}
 />
 );
 })}
 </Section>

 {/* Services */}
 <Section
 title="Services"
 count={services.length}
 onAdd={() => { setNewSvcName(''); setNewSvcStageNames([]); setNewSvcStageInput(''); setShowCreateSvc(true); }}
 >
 {services.map((sv) => (
 <View key={sv.id} style={ss.svcItem}>
   <View style={{ flex: 1 }}>
     <Text style={ss.listItemLabel}>{sv.name}</Text>
     {(sv.base_price_usd > 0 || sv.base_price_lbp > 0) && (
       <Text style={ss.svcPriceText}>
         {sv.base_price_usd > 0 ? `$${sv.base_price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
         {sv.base_price_usd > 0 && sv.base_price_lbp > 0 ? '  ·  ' : ''}
         {sv.base_price_lbp > 0 ? `ل.ل${sv.base_price_lbp.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
       </Text>
     )}
   </View>
   <TouchableOpacity style={ss.stagesBtn} onPress={() => openSvcStages(sv)}>
     <Text style={ss.stagesBtnText}>✎ Stages</Text>
   </TouchableOpacity>
   <TouchableOpacity onPress={() => deleteRecord('services', sv.id, sv.name)} style={ss.deleteBtn}>
     <Text style={ss.deleteBtnText}>✕</Text>
   </TouchableOpacity>
 </View>
 ))}
 </Section>

 {/* Status Labels */}
 <Section
 title="Status Labels"
 count={statusLabels.length}
 onAdd={() => openModal('status', { label: '', color: '#6366f1' })}
 >
 {statusLabels.map((sl) => (
 <ListItem
 key={sl.id}
 label={sl.label}
 accent={sl.color}
 sublabel={sl.color}
 onDelete={() => deleteRecord('status_labels', sl.id, sl.label)}
 />
 ))}
 </Section>

 {/* Team Members */}
 <Section
 title="Team Members"
 count={teamMembers.length}
 onAdd={() => openModal('member', { name: '', email: '', role: 'Agent', phone: '' })}
 >
 {teamMembers.map((tm) => (
 <ListItem
 key={tm.id}
 label={tm.name}
 sublabel={`${tm.role} · ${tm.email}`}
 onDelete={() =>
 tm.id === teamMember?.id
 ? Alert.alert('Cannot Delete', 'You cannot remove your own account.')
 : deleteRecord('team_members', tm.id, tm.name)
 }
 />
 ))}
 </Section>

 {/* RTL toggle */}
 <View style={ss.rtlRow}>
   <View style={{ flex: 1 }}>
     <Text style={ss.rtlLabel}>Arabic / RTL Layout</Text>
     <Text style={ss.rtlSub}>Right-to-left layout for Arabic workflows</Text>
   </View>
   <Switch
     value={isRTL}
     onValueChange={toggleRTL}
     trackColor={{ false: theme.color.border, true: theme.color.primary }}
     thumbColor={isRTL ? theme.color.white : theme.color.textSecondary}
   />
 </View>

 {/* Sign out */}
 <TouchableOpacity
 style={ss.signOutBtn}
 onPress={() =>
 Alert.alert('Sign Out', 'Are you sure?', [
 { text: 'Cancel', style: 'cancel' },
 { text: 'Sign Out', style: 'destructive', onPress: signOut },
 ])
 }
 >
 <Text style={ss.signOutText}>Sign Out</Text>
 </TouchableOpacity>

 <Text style={ss.version}>Ministry Tracker v1.0.0</Text>
 </ScrollView>

 {/* Ministry modal */}
 <ModalForm
 visible={activeModal === 'ministry'}
 title="New Ministry"
 fields={[{ key: 'name', label: 'MINISTRY NAME', placeholder: 'Ministry of Finance' }]}
 values={formValues}
 onChange={setField}
 onSubmit={saveMinistry}
 onClose={() => setActiveModal(null)}
 saving={saving}
 />

 {/* Sub-ministry modal */}
 <ModalForm
 visible={activeModal === 'subministry'}
 title="New Sub-Ministry"
 fields={[
 { key: 'name', label: 'SUB-MINISTRY NAME', placeholder: 'Tax Department' },
 {
 key: 'parentId',
 label: 'PARENT MINISTRY',
 options: parentMinistries.map((m) => ({ value: m.id, label: m.name })),
 },
 ]}
 values={formValues}
 onChange={setField}
 onSubmit={saveSubMinistry}
 onClose={() => setActiveModal(null)}
 saving={saving}
 />

 {/* Create service modal */}
 <Modal
 visible={showCreateSvc}
 transparent
 animationType="slide"
 onRequestClose={() => setShowCreateSvc(false)}
 >
 <View style={mf.overlay}>
   <KeyboardAvoidingView
     behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
     style={{ flex: 1, justifyContent: 'flex-end' }}
   >
     <View style={[mf.sheet, { maxHeight: '85%' }]}>
       <View style={mf.header}>
         <Text style={mf.title}>New Service</Text>
         <TouchableOpacity onPress={() => setShowCreateSvc(false)}>
           <Text style={mf.close}>✕</Text>
         </TouchableOpacity>
       </View>
       <ScrollView contentContainerStyle={mf.body} keyboardShouldPersistTaps="handled">
         {/* Service name */}
         <View style={mf.field}>
           <Text style={mf.label}>SERVICE NAME</Text>
           <TextInput
             style={mf.input}
             value={newSvcName}
             onChangeText={setNewSvcName}
             placeholder="Trade License Renewal"
             placeholderTextColor={theme.color.textMuted}
             autoFocus
           />
         </View>

         {/* Base price */}
         <View style={mf.field}>
           <Text style={mf.label}>BASE PRICE</Text>
           <View style={{ flexDirection: 'row', gap: 8 }}>
             <View style={{ flex: 1 }}>
               <Text style={ss.priceInputLabel}>USD ($)</Text>
               <TextInput
                 style={mf.input}
                 value={newSvcPriceUSD}
                 onChangeText={setNewSvcPriceUSD}
                 placeholder="0.00"
                 placeholderTextColor={theme.color.textMuted}
                 keyboardType="decimal-pad"
               />
             </View>
             <View style={{ flex: 1 }}>
               <Text style={ss.priceInputLabel}>LBP (ل.ل)</Text>
               <TextInput
                 style={mf.input}
                 value={newSvcPriceLBP}
                 onChangeText={(v) => {
                   const d = v.replace(/,/g, '');
                   if (d === '' || /^\d*$/.test(d)) setNewSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US'));
                 }}
                 placeholder="0"
                 placeholderTextColor={theme.color.textMuted}
                 keyboardType="number-pad"
               />
             </View>
           </View>
         </View>

         {/* Stages */}
         <View style={mf.field}>
           <Text style={mf.label}>DEFAULT STAGES</Text>
           {newSvcStageNames.map((name, idx) => (
             <View key={idx} style={ss.newSvcStageRow}>
               <View style={ss.svcStageIndex}>
                 <Text style={ss.svcStageIndexText}>{idx + 1}</Text>
               </View>
               <Text style={ss.svcStageName}>{name}</Text>
               <TouchableOpacity onPress={() => setNewSvcStageNames((prev) => prev.filter((_, i) => i !== idx))}>
                 <Text style={ss.svcStageRemove}>✕</Text>
               </TouchableOpacity>
             </View>
           ))}
           <View style={ss.svcNewStageRow}>
             <TextInput
               style={[mf.input, { flex: 1 }]}
               value={newSvcStageInput}
               onChangeText={setNewSvcStageInput}
               placeholder="Stage name"
               placeholderTextColor={theme.color.textMuted}
               onSubmitEditing={() => {
                 if (newSvcStageInput.trim()) {
                   setNewSvcStageNames((prev) => [...prev, newSvcStageInput.trim()]);
                   setNewSvcStageInput('');
                 }
               }}
               returnKeyType="done"
             />
             <TouchableOpacity
               style={ss.svcAddPlusBtn}
               onPress={() => {
                 if (newSvcStageInput.trim()) {
                   setNewSvcStageNames((prev) => [...prev, newSvcStageInput.trim()]);
                   setNewSvcStageInput('');
                 }
               }}
             >
               <Text style={ss.svcAddPlusBtnText}>+</Text>
             </TouchableOpacity>
           </View>
         </View>

         <TouchableOpacity
           style={[mf.submitBtn, savingNewSvc && mf.submitBtnDisabled]}
           onPress={handleCreateService}
           disabled={savingNewSvc}
         >
           {savingNewSvc
             ? <ActivityIndicator color={theme.color.white} />
             : <Text style={mf.submitText}>Create Service</Text>}
         </TouchableOpacity>
       </ScrollView>
     </View>
   </KeyboardAvoidingView>
 </View>
 </Modal>

 {/* Status label modal */}
 <ModalForm
 visible={activeModal === 'status'}
 title="New Status Label"
 fields={[
 { key: 'label', label: 'STATUS NAME', placeholder: 'Pending Signature' },
 {
 key: 'color',
 label: 'HEX COLOR',
 placeholder: '#6366f1',
 },
 ]}
 values={formValues}
 onChange={setField}
 onSubmit={saveStatus}
 onClose={() => setActiveModal(null)}
 saving={saving}
 />

 {/* Team member modal */}
 <ModalForm
 visible={activeModal === 'member'}
 title="New Team Member"
 fields={[
 { key: 'name', label: 'FULL NAME', placeholder: 'Ahmad Khalil' },
 {
 key: 'email',
 label: 'EMAIL',
 placeholder: 'ahmad@company.com',
 keyboardType: 'email-address',
 },
 { key: 'role', label: 'ROLE', placeholder: 'Agent' },
 { key: 'phone', label: 'PHONE (optional)', placeholder: '+961 70 000 000', keyboardType: 'phone-pad' },
 ]}
 values={formValues}
 onChange={setField}
 onSubmit={saveMember}
 onClose={() => setActiveModal(null)}
 saving={saving}
 />

 {/* ── SERVICE STAGES MODAL ── */}
 <Modal
 visible={showSvcStages}
 transparent
 animationType="slide"
 onRequestClose={() => setShowSvcStages(false)}
 >
 <View style={mf.overlay}>
   <KeyboardAvoidingView
     behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
     style={{ flex: 1, justifyContent: 'flex-end' }}
   >
     <View style={[mf.sheet, { maxHeight: '90%' }]}>
       <View style={mf.header}>
         <View style={{ flex: 1 }}>
           <Text style={mf.title}>Default Stages</Text>
           <Text style={ss.stagesModalSubtitle}>{svcStagesName}</Text>
         </View>
         <TouchableOpacity onPress={() => { setShowSvcStages(false); setShowSvcStagePicker(false); setSvcNewStageName(''); }}>
           <Text style={mf.close}>✕</Text>
         </TouchableOpacity>
       </View>

       <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
         {loadingSvcStages ? (
           <ActivityIndicator color={theme.color.primary} style={{ marginVertical: 24 }} />
         ) : (
           <>
             {svcStages.length === 0 && (
               <Text style={ss.stagesEmpty}>No default stages yet. Add stages below.</Text>
             )}
             {svcStages.map((stage, idx) => (
               <View key={stage.id} style={ss.svcStageRow}>
                 <View style={ss.svcStageIndex}>
                   <Text style={ss.svcStageIndexText}>{idx + 1}</Text>
                 </View>
                 <Text style={ss.svcStageName} numberOfLines={1}>{stage.ministry_name}</Text>
                 <View style={ss.svcStageActions}>
                   <TouchableOpacity onPress={() => moveSvcStage(idx, -1)} disabled={idx === 0}>
                     <Text style={[ss.svcStageArrow, idx === 0 && ss.svcStageDisabled]}>↑</Text>
                   </TouchableOpacity>
                   <TouchableOpacity onPress={() => moveSvcStage(idx, 1)} disabled={idx === svcStages.length - 1}>
                     <Text style={[ss.svcStageArrow, idx === svcStages.length - 1 && ss.svcStageDisabled]}>↓</Text>
                   </TouchableOpacity>
                   <TouchableOpacity onPress={() => removeSvcStage(stage.id)}>
                     <Text style={ss.svcStageRemove}>✕</Text>
                   </TouchableOpacity>
                 </View>
               </View>
             ))}

             {/* Pick from existing ministries */}
             <TouchableOpacity
               style={ss.svcAddBtn}
               onPress={() => setShowSvcStagePicker((v) => !v)}
             >
               <Text style={ss.svcAddBtnText}>
                 {showSvcStagePicker ? '− Cancel' : '+ Add Existing Stage'}
               </Text>
             </TouchableOpacity>

             {showSvcStagePicker && (
               <View style={ss.svcPickerList}>
                 {ministries
                   .filter((m) => !svcStages.find((s) => s.ministry_id === m.id))
                   .map((m) => (
                     <TouchableOpacity
                       key={m.id}
                       style={ss.svcPickerItem}
                       onPress={() => addSvcStageFromMinistry(m)}
                     >
                       <Text style={ss.svcPickerItemText}>{m.name}</Text>
                       <Text style={ss.svcPickerAdd}>+</Text>
                     </TouchableOpacity>
                   ))}
                 {ministries.filter((m) => !svcStages.find((s) => s.ministry_id === m.id)).length === 0 && (
                   <Text style={ss.stagesEmpty}>All ministries already added</Text>
                 )}
               </View>
             )}

             {/* Create new stage */}
             <View style={ss.svcNewStageRow}>
               <TextInput
                 style={[mf.input, { flex: 1 }]}
                 value={svcNewStageName}
                 onChangeText={setSvcNewStageName}
                 placeholder="New stage name..."
                 placeholderTextColor={theme.color.textMuted}
               />
               <TouchableOpacity
                 style={[ss.svcNewStageBtn, addingSvcStage && { opacity: 0.5 }]}
                 onPress={addSvcStageNew}
                 disabled={addingSvcStage}
               >
                 {addingSvcStage
                   ? <ActivityIndicator color={theme.color.white} size="small" />
                   : <Text style={ss.svcNewStageBtnText}>+ Create</Text>}
               </TouchableOpacity>
             </View>
           </>
         )}
       </ScrollView>
     </View>
   </KeyboardAvoidingView>
 </View>
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
});
