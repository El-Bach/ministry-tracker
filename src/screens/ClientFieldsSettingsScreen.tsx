// src/screens/ClientFieldsSettingsScreen.tsx
// Manage custom client field definitions — add, edit, reorder, toggle active

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { FieldDefinition } from '../components/ClientFieldsForm';

const FIELD_TYPES = [
 { key: 'text', label: 'Text', icon: 'Aa', desc: 'Free text input' },
 { key: 'textarea', label: 'Long Text', icon: '¶', desc: 'Multi-line text' },
 { key: 'number', label: 'Number', icon: '123', desc: 'Numeric value' },
 { key: 'currency', label: 'Currency', icon: '$', desc: 'Money amount' },
 { key: 'email', label: 'Email', icon: '@', desc: 'Email address' },
 { key: 'phone', label: 'Phone', icon: '☏', desc: 'Phone number' },
 { key: 'url', label: 'URL / Link', icon: '🔗', desc: 'Web address' },
 { key: 'date', label: 'Date', icon: '📅', desc: 'DD/MM/YYYY' },
 { key: 'boolean', label: 'Yes / No', icon: '✓', desc: 'Toggle switch' },
 { key: 'select', label: 'Dropdown', icon: '▾', desc: 'Single choice' },
 { key: 'multiselect', label: 'Multi-select', icon: '☑', desc: 'Multiple choices' },
 { key: 'image', label: 'Image / Photo', icon: '🖼', desc: 'Camera or library' },
 { key: 'location', label: 'Location', icon: '📍', desc: 'GPS coordinates' },
 { key: 'id_number', label: 'ID Number', icon: '#', desc: 'National ID, passport, etc.' },
];

export default function ClientFieldsSettingsScreen() {
 const [fields, setFields] = useState<FieldDefinition[]>([]);
  const { t } = useTranslation();
 const [loading, setLoading] = useState(true);
 const [showAddModal, setShowAddModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
 const [saving, setSaving] = useState(false);

 // Form state
 const [formLabel, setFormLabel] = useState('');
 const [formType, setFormType] = useState('text');
 const [formRequired, setFormRequired] = useState(false);
 const [formOptions, setFormOptions] = useState(''); // comma-separated for select types
 const [showTypePicker, setShowTypePicker] = useState(false);

 const load = async () => {
 const { data } = await supabase
 .from('client_field_definitions')
 .select('*')
 .order('sort_order');
 if (data) setFields(data as FieldDefinition[]);
 setLoading(false);
 };

 useEffect(() => { load(); }, []);

 const resetForm = () => {
 setFormLabel('');
 setFormType('text');
 setFormRequired(false);
 setFormOptions('');
 };

 const openAdd = () => {
 resetForm();
 setShowAddModal(true);
 };

 const openEdit = (field: FieldDefinition) => {
 setEditingField(field);
 setFormLabel(field.label);
 setFormType(field.field_type);
 setFormRequired(field.is_required);
 setFormOptions(field.options ? field.options.join(', ') : '');
 setShowEditModal(true);
 };

 const generateKey = (label: string) => {
 const slug = label.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
 return `${slug || 'field'}_${Date.now()}`;
 };

 const handleAdd = async () => {
 if (!formLabel.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
 const needsOptions = ['select', 'multiselect'].includes(formType);
 if (needsOptions && !formOptions.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }
 setSaving(true);
 const options = needsOptions
 ? formOptions.split(',').map((o) => o.trim()).filter(Boolean)
 : null;
 const maxOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.sort_order)) : 0;
 const { error } = await supabase.from('client_field_definitions').insert({
 label: formLabel.trim(),
 field_key: generateKey(formLabel),
 field_type: formType,
 is_required: formRequired,
 is_active: true,
 options: options ? JSON.stringify(options) : null,
 sort_order: maxOrder + 1,
 });
 setSaving(false);
 if (error) { Alert.alert(t('error'), error.message); return; }
 setShowAddModal(false);
 resetForm();
 load();
 };

 const handleEdit = async () => {
 if (!editingField || !formLabel.trim()) return;
 const needsOptions = ['select', 'multiselect'].includes(formType);
 setSaving(true);
 const options = needsOptions
 ? formOptions.split(',').map((o) => o.trim()).filter(Boolean)
 : null;
 const { error } = await supabase
 .from('client_field_definitions')
 .update({
 label: formLabel.trim(),
 field_type: formType,
 is_required: formRequired,
 options: options ? JSON.stringify(options) : null,
 })
 .eq('id', editingField.id);
 setSaving(false);
 if (error) { Alert.alert(t('error'), error.message); return; }
 setShowEditModal(false);
 setEditingField(null);
 load();
 };

 const toggleActive = async (field: FieldDefinition) => {
 await supabase
 .from('client_field_definitions')
 .update({ is_active: !field.is_active })
 .eq('id', field.id);
 load();
 };

 const handleDelete = (field: FieldDefinition) => {
 Alert.alert(
 `${t('delete')} ${t('fieldTypeLabel')}`,
 `${t('delete')} "${field.label}"?`,
 [
 { text: t('cancel'), style: 'cancel' },
 {
 text: t('delete'),
 style: 'destructive',
 onPress: async () => {
 await supabase.from('client_field_definitions').delete().eq('id', field.id);
 load();
 },
 },
 ]
 );
 };

 const moveField = async (index: number, dir: -1 | 1) => {
 const arr = [...fields];
 const target = index + dir;
 if (target < 0 || target >= arr.length) return;
 [arr[index], arr[target]] = [arr[target], arr[index]];
 setFields(arr);
 // Update sort_order in DB
 await Promise.all([
 supabase.from('client_field_definitions')
 .update({ sort_order: arr[index].sort_order })
 .eq('id', arr[index].id),
 supabase.from('client_field_definitions')
 .update({ sort_order: arr[target].sort_order })
 .eq('id', arr[target].id),
 ]);
 // Swap in local state properly
 const updated = arr.map((f, i) => ({ ...f, sort_order: i + 1 }));
 setFields(updated);
 await Promise.all(
 updated.map((f) =>
 supabase.from('client_field_definitions').update({ sort_order: f.sort_order }).eq('id', f.id)
 )
 );
 };

 const typeInfo = (key: string) => FIELD_TYPES.find((t) => t.key === key);
 const needsOptions = ['select', 'multiselect'].includes(formType);

 const FieldForm = () => (
 <ScrollView contentContainerStyle={fm.formScroll}>
 <View style={fm.field}>
 <Text style={fm.label}>FIELD LABEL *</Text>
 <TextInput
 style={fm.input}
 value={formLabel}
 onChangeText={setFormLabel}
 placeholder={t("title")}
 placeholderTextColor={theme.color.textMuted}
 />
 </View>

 <View style={fm.field}>
 <Text style={fm.label}>FIELD TYPE *</Text>
 <TouchableOpacity style={fm.typeBtn} onPress={() => setShowTypePicker(true)}>
 <Text style={fm.typeIcon}>{typeInfo(formType)?.icon}</Text>
 <View style={{ flex: 1 }}>
 <Text style={fm.typeName}>{typeInfo(formType)?.label}</Text>
 <Text style={fm.typeDesc}>{typeInfo(formType)?.desc}</Text>
 </View>
 <Text style={fm.typeChevron}>›</Text>
 </TouchableOpacity>
 </View>

 {needsOptions && (
 <View style={fm.field}>
 <Text style={fm.label}>OPTIONS (comma-separated) *</Text>
 <TextInput
 style={fm.input}
 value={formOptions}
 onChangeText={setFormOptions}
 placeholder="A, B, C"
 placeholderTextColor={theme.color.textMuted}
 />
 </View>
 )}

 <View style={fm.field}>
 <View style={fm.switchRow}>
 <View>
 <Text style={fm.label}>{t('required').toUpperCase()}</Text>
 <Text style={fm.switchDesc}>{t('mustFillCreating')}</Text>
 </View>
 <Switch
 value={formRequired}
 onValueChange={setFormRequired}
 trackColor={{ false: theme.color.border, true: theme.color.primary }}
 thumbColor={theme.color.white}
 />
 </View>
 </View>
 </ScrollView>
 );

 return (
 <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
 <View style={s.header}>
 <View>
 <Text style={s.title}>{t('clientFields')}</Text>
 <Text style={s.subtitle}>{t('clientFieldsSubtitle')}</Text>
 </View>
 <TouchableOpacity style={s.addBtn} onPress={openAdd}>
 <Text style={s.addBtnText}>+ Add Field</Text>
 </TouchableOpacity>
 </View>

 {loading ? (
 <View style={s.center}>
 <ActivityIndicator color={theme.color.primary} size="large" />
 </View>
 ) : (
 <ScrollView contentContainerStyle={s.list}>
 {fields.length === 0 && (
 <View style={s.empty}>
 <Text style={s.emptyText}>{t('noCustomFieldsYet')}</Text>
 <Text style={s.emptySubtext}>{t('tapAddFieldHint')}</Text>
 </View>
 )}
 {fields.map((field, idx) => {
 const ti = typeInfo(field.field_type);
 return (
 <View key={field.id} style={[s.fieldCard, !field.is_active && s.fieldCardInactive]}>
 <View style={s.fieldLeft}>
 <View style={s.fieldIconBox}>
 <Text style={s.fieldIcon}>{ti?.icon ?? '?'}</Text>
 </View>
 <View style={{ flex: 1 }}>
 <View style={s.fieldNameRow}>
 <Text style={[s.fieldName, !field.is_active && s.fieldNameInactive]}>
 {field.label}
 </Text>
 {field.is_required && <Text style={s.requiredTag}>{t('required')}</Text>}
 </View>
 <Text style={s.fieldTypeName}>{ti?.label ?? field.field_type}</Text>
 {field.options && (
 <Text style={s.fieldOptions} numberOfLines={1}>
 {(field.options as unknown as string[]).join(', ')}
 </Text>
 )}
 </View>
 </View>

 <View style={s.fieldRight}>
 {/* Reorder */}
 <View style={s.reorderBtns}>
 <TouchableOpacity onPress={() => moveField(idx, -1)} disabled={idx === 0}>
 <Text style={[s.reorderArrow, idx === 0 && s.disabled]}>↑</Text>
 </TouchableOpacity>
 <TouchableOpacity onPress={() => moveField(idx, 1)} disabled={idx === fields.length - 1}>
 <Text style={[s.reorderArrow, idx === fields.length - 1 && s.disabled]}>↓</Text>
 </TouchableOpacity>
 </View>

 {/* Active toggle */}
 <Switch
 value={field.is_active}
 onValueChange={() => toggleActive(field)}
 trackColor={{ false: theme.color.border, true: theme.color.primary + '55' }}
 thumbColor={field.is_active ? theme.color.primary : theme.color.textMuted}
 style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
 />

 {/* Edit */}
 <TouchableOpacity style={s.editBtn} onPress={() => openEdit(field)}>
 <Text style={s.editBtnText}>✎</Text>
 </TouchableOpacity>

 {/* Delete */}
 <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(field)}>
 <Text style={s.deleteBtnText}>✕</Text>
 </TouchableOpacity>
 </View>
 </View>
 );
 })}
 </ScrollView>
 )}

 {/* ── ADD MODAL ── */}
 <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
 <View style={fm.overlay}>
 <View style={fm.sheet}>
 <View style={fm.header}>
 <Text style={fm.title}>{t('createField')}</Text>
 <TouchableOpacity onPress={() => setShowAddModal(false)}>
 <Text style={fm.close}>✕</Text>
 </TouchableOpacity>
 </View>
 <FieldForm />
 <View style={fm.footer}>
 <TouchableOpacity
 style={[fm.saveBtn, saving && fm.saveBtnDisabled]}
 onPress={handleAdd}
 disabled={saving}
 >
 {saving ? <ActivityIndicator color={theme.color.white} /> :<Text style={fm.saveBtnText}>{t('createField')}</Text>}
 </TouchableOpacity>
 </View>
 </View>
 </View>
 </Modal>

 {/* ── EDIT MODAL ── */}
 <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
 <View style={fm.overlay}>
 <View style={fm.sheet}>
 <View style={fm.header}>
 <Text style={fm.title}>{t('editFieldTitle')}</Text>
 <TouchableOpacity onPress={() => setShowEditModal(false)}>
 <Text style={fm.close}>✕</Text>
 </TouchableOpacity>
 </View>
 <FieldForm />
 <View style={fm.footer}>
 <TouchableOpacity
 style={[fm.saveBtn, saving && fm.saveBtnDisabled]}
 onPress={handleEdit}
 disabled={saving}
 >
 {saving ? <ActivityIndicator color={theme.color.white} /> :<Text style={fm.saveBtnText}>{t('saveChanges')}</Text>}
 </TouchableOpacity>
 </View>
 </View>
 </View>
 </Modal>

 {/* ── TYPE PICKER MODAL ── */}
 <Modal visible={showTypePicker} transparent animationType="slide" onRequestClose={() => setShowTypePicker(false)}>
 <View style={fm.overlay}>
 <View style={fm.sheet}>
 <View style={fm.header}>
 <Text style={fm.title}>{t('fieldTypeLabel')}</Text>
 <TouchableOpacity onPress={() => setShowTypePicker(false)}>
 <Text style={fm.close}>✕</Text>
 </TouchableOpacity>
 </View>
 <ScrollView>
 {FIELD_TYPES.map((ft) => (
 <TouchableOpacity
 key={ft.key}
 style={[fm.typeOption, formType === ft.key && fm.typeOptionSelected]}
 onPress={() => { setFormType(ft.key); setShowTypePicker(false); }}
 >
 <Text style={fm.typeOptionIcon}>{ft.icon}</Text>
 <View style={{ flex: 1 }}>
 <Text style={[fm.typeOptionName, formType === ft.key && fm.typeOptionNameSelected]}>
 {ft.label}
 </Text>
 <Text style={fm.typeOptionDesc}>{ft.desc}</Text>
 </View>
 {formType === ft.key && <Text style={fm.typeOptionCheck}>✓</Text>}
 </TouchableOpacity>
 ))}
 </ScrollView>
 </View>
 </View>
 </Modal>
 </SafeAreaView>
 );
}

const s = StyleSheet.create({
 safe: { flex: 1, backgroundColor: theme.color.bgBase },
 center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
 header: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 paddingHorizontal: theme.spacing.space4,
 paddingTop: theme.spacing.space4,
 paddingBottom: theme.spacing.space3,
 borderBottomWidth: 1,
 borderBottomColor: theme.color.bgSurface,
 },
 title: { color: theme.color.textPrimary, fontSize: 20, fontWeight: '800' },
 subtitle: { color: theme.color.textMuted, fontSize: theme.typography.label.fontSize, marginTop: 2 },
 addBtn: {
 backgroundColor: theme.color.primary,
 borderRadius: theme.radius.md,
 paddingHorizontal: 14,
 paddingVertical: theme.spacing.space2,
 },
 addBtnText: { color: theme.color.white, fontSize: theme.typography.label.fontSize, fontWeight: '700' },
 list: { padding: theme.spacing.space4, gap: 0, paddingBottom: 40 },
 empty: { alignItems: 'center', paddingTop: 60, gap: theme.spacing.space2 },
 emptyText: { color: theme.color.textMuted, fontSize: 16, fontWeight: '700' },
 emptySubtext: { color: theme.color.border, fontSize: theme.typography.label.fontSize },
 fieldCard: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: theme.color.bgSurface,
 borderRadius: theme.radius.md + 2,
 padding: theme.spacing.space3,
 marginBottom: 10,
 borderWidth: 1,
 borderColor: theme.color.border,
 gap: 10,
 },
 fieldCardInactive: { opacity: 0.5 },
 fieldLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
 fieldIconBox: {
 width: 36,
 height: 36,
 borderRadius: theme.radius.md,
 backgroundColor: theme.color.primary + '22',
 justifyContent: 'center',
 alignItems: 'center',
 borderWidth: 1,
 borderColor: theme.color.primary + '33',
 },
 fieldIcon: { fontSize: 16 },
 fieldNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
 fieldName: { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '700' },
 fieldNameInactive: { color: theme.color.textMuted },
 requiredTag: {
 backgroundColor: theme.color.danger + '22',
 color: theme.color.danger,
 fontSize: theme.typography.sectionDivider.fontSize,
 fontWeight: '700',
 paddingHorizontal: 5,
 paddingVertical: 2,
 borderRadius: 4,
 },
 fieldTypeName: { color: theme.color.textSecondary, fontSize: theme.typography.caption.fontSize, marginTop: 2 },
 fieldOptions: { color: theme.color.border, fontSize: 10, marginTop: 2 },
 fieldRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
 reorderBtns: { gap: 2 },
 reorderArrow: { color: theme.color.textMuted, fontSize: 16, padding: 2 },
 disabled: { opacity: 0.25 },
 editBtn: {
 backgroundColor: theme.color.primary + '11',
 borderRadius: theme.radius.sm,
 padding: 6,
 borderWidth: 1,
 borderColor: theme.color.primary + '33',
 },
 editBtnText: { color: theme.color.primaryText, fontSize: theme.typography.body.fontSize },
 deleteBtn: {
 backgroundColor: theme.color.danger + '11',
 borderRadius: theme.radius.sm,
 padding: 6,
 borderWidth: 1,
 borderColor: theme.color.danger + '33',
 },
 deleteBtnText: { color: theme.color.danger, fontSize: theme.typography.body.fontSize },
});

const fm = StyleSheet.create({
 overlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
 sheet: {
 backgroundColor: theme.color.bgSurface,
 borderTopLeftRadius: 20,
 borderTopRightRadius: 20,
 maxHeight: '90%',
 },
 header: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 padding: theme.spacing.space4,
 borderBottomWidth: 1,
 borderBottomColor: theme.color.border,
 },
 title: { color: theme.color.textPrimary, fontSize: 17, fontWeight: '700' },
 close: { color: theme.color.textSecondary, fontSize: 22, padding: 4 },
 formScroll: { padding: theme.spacing.space4, gap: theme.spacing.space4 },
 field: { gap: theme.spacing.space2 },
 label: { ...theme.typography.sectionDivider, color: theme.color.textSecondary },
 input: {
 backgroundColor: theme.color.bgBase,
 borderRadius: theme.radius.md,
 paddingHorizontal: theme.spacing.space3,
 paddingVertical: theme.spacing.space3,
 color: theme.color.textPrimary,
 fontSize: 15,
 borderWidth: 1,
 borderColor: theme.color.border,
 },
 typeBtn: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: theme.color.bgBase,
 borderRadius: theme.radius.md,
 paddingHorizontal: theme.spacing.space3,
 paddingVertical: theme.spacing.space3,
 borderWidth: 1,
 borderColor: theme.color.border,
 gap: 10,
 },
 typeIcon: { fontSize: 18, width: 24, textAlign: 'center' },
 typeName: { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
 typeDesc: { color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, marginTop: 1 },
 typeChevron: { color: theme.color.textMuted, fontSize: 20 },
 switchRow: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 backgroundColor: theme.color.bgBase,
 borderRadius: theme.radius.md,
 paddingHorizontal: theme.spacing.space3,
 paddingVertical: theme.spacing.space3,
 borderWidth: 1,
 borderColor: theme.color.border,
 },
 switchDesc: { color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize, marginTop: 2 },
 footer: {
 padding: theme.spacing.space4,
 borderTopWidth: 1,
 borderTopColor: theme.color.border,
 },
 saveBtn: {
 backgroundColor: theme.color.primary,
 borderRadius: theme.radius.md + 2,
 paddingVertical: 14,
 alignItems: 'center',
 },
 saveBtnDisabled: { opacity: 0.6 },
 saveBtnText: { color: theme.color.white, fontSize: 16, fontWeight: '700' },
 typeOption: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: theme.spacing.space3,
 paddingHorizontal: theme.spacing.space4,
 paddingVertical: 14,
 borderBottomWidth: 1,
 borderBottomColor: theme.color.bgBase,
 },
 typeOptionSelected: { backgroundColor: theme.color.primary + '11' },
 typeOptionIcon: { fontSize: 18, width: 28, textAlign: 'center' },
 typeOptionName: { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
 typeOptionNameSelected: { color: theme.color.primaryText },
 typeOptionDesc: { color: theme.color.textMuted, fontSize: theme.typography.label.fontSize, marginTop: 1 },
 typeOptionCheck: { color: theme.color.success, fontSize: 18 },
});
