// src/screens/MinistryRequirementsScreen.tsx
// Manage default requirement templates for a stage (ministry).
// These define what documents/actions are needed to complete this stage type.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { MinistryRequirement, DashboardStackParamList } from '../types';

type RouteType = RouteProp<DashboardStackParamList, 'MinistryRequirements'>;

const REQ_TYPES = [
  { key: 'document',    label: 'Document',    icon: '📄' },
  { key: 'form',        label: 'Form',        icon: '📝' },
  { key: 'signature',   label: 'Signature',   icon: '✍️' },
  { key: 'approval',    label: 'Approval',    icon: '✅' },
  { key: 'payment',     label: 'Payment',     icon: '💰' },
  { key: 'certificate', label: 'Certificate', icon: '🏅' },
  { key: 'other',       label: 'Other',       icon: '📌' },
];

function typeIcon(key: string) {
  return REQ_TYPES.find((t) => t.key === key)?.icon ?? '📌';
}
function typeLabel(key: string) {
  return REQ_TYPES.find((t) => t.key === key)?.label ?? key;
}

export default function MinistryRequirementsScreen() {
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { ministryId, ministryName } = route.params;

  const [reqs, setReqs] = useState<MinistryRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('document');
  const [formNotes, setFormNotes] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchReqs = useCallback(async () => {
    const { data } = await supabase
      .from('ministry_requirements')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('sort_order')
      .order('created_at');
    setReqs((data ?? []) as MinistryRequirement[]);
    setLoading(false);
  }, [ministryId]);

  useEffect(() => { fetchReqs(); }, [fetchReqs]);

  const openAdd = () => {
    setEditingId(null);
    setFormTitle('');
    setFormType('document');
    setFormNotes('');
    setShowModal(true);
  };

  const openEdit = (req: MinistryRequirement) => {
    setEditingId(req.id);
    setFormTitle(req.title);
    setFormType(req.req_type);
    setFormNotes(req.notes ?? '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSaving(true);
    if (editingId) {
      await supabase
        .from('ministry_requirements')
        .update({ title: formTitle.trim(), req_type: formType, notes: formNotes.trim() || null })
        .eq('id', editingId);
    } else {
      const sort_order = reqs.length;
      await supabase
        .from('ministry_requirements')
        .insert({ ministry_id: ministryId, title: formTitle.trim(), req_type: formType, notes: formNotes.trim() || null, sort_order });
    }
    setSaving(false);
    setShowModal(false);
    fetchReqs();
  };

  const handleDelete = (req: MinistryRequirement) => {
    Alert.alert(t('delete'), `${t('confirmDelete')} — "${req.title}"`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('ministry_requirements').delete().eq('id', req.id);
          fetchReqs();
        },
      },
    ]);
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...reqs];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setReqs(updated);
    await Promise.all([
      supabase.from('ministry_requirements').update({ sort_order: index - 1 }).eq('id', updated[index - 1].id),
      supabase.from('ministry_requirements').update({ sort_order: index }).eq('id', updated[index].id),
    ]);
  };

  const moveDown = async (index: number) => {
    if (index === reqs.length - 1) return;
    const updated = [...reqs];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setReqs(updated);
    await Promise.all([
      supabase.from('ministry_requirements').update({ sort_order: index }).eq('id', updated[index].id),
      supabase.from('ministry_requirements').update({ sort_order: index + 1 }).eq('id', updated[index + 1].id),
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {loading ? (
        <ActivityIndicator color={theme.color.primary} style={{ marginTop: 60 }} size="large" />
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {reqs.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyText}>No requirements defined</Text>
              <Text style={s.emptySub}>Add the documents and actions needed to complete this stage</Text>
            </View>
          ) : (
            reqs.map((req, index) => (
              <View key={req.id} style={s.card}>
                <View style={s.cardLeft}>
                  <Text style={s.cardIcon}>{typeIcon(req.req_type)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{req.title}</Text>
                    <Text style={s.cardType}>{typeLabel(req.req_type)}</Text>
                    {req.notes ? <Text style={s.cardNotes} numberOfLines={2}>{req.notes}</Text> : null}
                  </View>
                </View>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.orderBtn} onPress={() => moveUp(index)} disabled={index === 0}>
                    <Text style={[s.orderBtnText, index === 0 && s.orderBtnDisabled]}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.orderBtn} onPress={() => moveDown(index)} disabled={index === reqs.length - 1}>
                    <Text style={[s.orderBtnText, index === reqs.length - 1 && s.orderBtnDisabled]}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(req)}>
                    <Text style={s.editBtnText}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(req)}>
                    <Text style={s.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={openAdd} activeOpacity={0.85}>
        <Text style={s.fabText}>+ Add Requirement</Text>
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={s.modalSheet}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{editingId ? 'Edit Requirement' : 'New Requirement'}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
                {/* Title */}
                <TextInput
                  style={s.input}
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder={`${t("title")} *`}
                  placeholderTextColor={theme.color.textMuted}
                  autoFocus={!editingId}
                />

                {/* Type picker */}
                <TouchableOpacity style={s.typePicker} onPress={() => setShowTypePicker(true)}>
                  <Text style={s.typePickerIcon}>{typeIcon(formType)}</Text>
                  <Text style={s.typePickerLabel}>{typeLabel(formType)}</Text>
                  <Text style={s.typePickerChevron}>›</Text>
                </TouchableOpacity>

                {/* Notes */}
                <TextInput
                  style={[s.input, s.notesInput]}
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder={t("notes")}
                  placeholderTextColor={theme.color.textMuted}
                  multiline
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[s.saveBtn, saving && s.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.color.white} size="small" />
                  ) : (
                    <Text style={s.saveBtnText}>{editingId ? 'Save Changes' : 'Add Requirement'}</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Type picker modal */}
      <Modal visible={showTypePicker} transparent animationType="fade" onRequestClose={() => setShowTypePicker(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowTypePicker(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Requirement Type</Text>
            {REQ_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[s.pickerRow, formType === t.key && s.pickerRowActive]}
                onPress={() => { setFormType(t.key); setShowTypePicker(false); }}
              >
                <Text style={s.pickerIcon}>{t.icon}</Text>
                <Text style={[s.pickerLabel, formType === t.key && s.pickerLabelActive]}>{t.label}</Text>
                {formType === t.key && <Text style={s.pickerCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bgBase },

  list: { padding: theme.spacing.space4, paddingBottom: 100, gap: 10 },

  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: theme.color.textMuted, fontSize: 16, fontWeight: '700' },
  emptySub: { color: theme.color.border, fontSize: theme.typography.label.fontSize, textAlign: 'center', paddingHorizontal: 32 },

  card: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardLeft: { flex: 1, flexDirection: 'row', gap: theme.spacing.space3, alignItems: 'flex-start' },
  cardIcon: { fontSize: 22, marginTop: 1 },
  cardTitle: { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '700' },
  cardType: { color: theme.color.primary, fontSize: theme.typography.caption.fontSize, fontWeight: '600', marginTop: 2 },
  cardNotes: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize, marginTop: 4 },

  cardActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  orderBtn: {
    backgroundColor: theme.color.border,
    borderRadius: theme.radius.sm,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnText: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize, fontWeight: '700' },
  orderBtnDisabled: { color: theme.color.bgSurface },
  editBtn: {
    backgroundColor: theme.color.primary + '22',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.color.primary + '44',
  },
  editBtnText: { color: theme.color.primaryText, fontSize: theme.typography.body.fontSize },
  deleteBtn: {
    backgroundColor: theme.color.danger + '33',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteBtnText: { color: theme.color.danger, fontSize: theme.typography.label.fontSize },

  fab: {
    position: 'absolute',
    bottom: 24,
    left: theme.spacing.space4,
    right: theme.spacing.space4,
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  fabText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: theme.color.overlayDark },
  modalSheet: {
    backgroundColor: theme.color.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: theme.color.border,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.space5,
    paddingTop: theme.spacing.space5,
    paddingBottom: theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  modalTitle: { color: theme.color.textPrimary, fontSize: 17, fontWeight: '700' },
  modalClose: { color: theme.color.textMuted, fontSize: 22 },
  modalBody: { padding: theme.spacing.space5, gap: 14, paddingBottom: 32 },

  input: {
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md + 2,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.space3,
    color: theme.color.textPrimary,
    fontSize: theme.typography.body.fontSize,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  notesInput: { height: 80, paddingTop: theme.spacing.space3 },

  typePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md + 2,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.space3,
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: 10,
  },
  typePickerIcon: { fontSize: 18 },
  typePickerLabel: { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  typePickerChevron: { color: theme.color.primary, fontSize: 20 },

  saveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md + 2,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },

  // Type picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  pickerSheet: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  pickerTitle: {
    ...theme.typography.sectionDivider,
    color: theme.color.textMuted,
    paddingHorizontal: theme.spacing.space4,
    paddingTop: 14,
    paddingBottom: theme.spacing.space2,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    gap: theme.spacing.space3,
  },
  pickerRowActive: { backgroundColor: theme.color.primary + '11' },
  pickerIcon: { fontSize: 18 },
  pickerLabel: { flex: 1, color: theme.color.textSecondary, fontSize: theme.typography.body.fontSize },
  pickerLabelActive: { color: theme.color.textPrimary, fontWeight: '600' },
  pickerCheck: { color: theme.color.primary, fontSize: 16, fontWeight: '700' },
});
