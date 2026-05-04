// src/screens/StageRequirementsScreen.tsx
// Manage requirements for a specific task stage (stop)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image,
  Linking,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import supabase from '../lib/supabase';
import SignedImage from '../components/SignedImage';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import { StopRequirement, DashboardStackParamList } from '../types';

type ReqRoute = RouteProp<DashboardStackParamList, 'StageRequirements'>;

const REQ_TYPES = [
  { value: 'document',    label: 'Document',    icon: '📄' },
  { value: 'form',        label: 'Form',         icon: '📝' },
  { value: 'signature',   label: 'Signature',    icon: '✍️' },
  { value: 'approval',    label: 'Approval',     icon: '✅' },
  { value: 'payment',     label: 'Payment',      icon: '💳' },
  { value: 'certificate', label: 'Certificate',  icon: '🏅' },
  { value: 'other',       label: 'Other',        icon: '📌' },
];

function typeLabel(val: string) {
  return REQ_TYPES.find((t) => t.value === val)?.label ?? val;
}
function typeIcon(val: string) {
  return REQ_TYPES.find((t) => t.value === val)?.icon ?? '📌';
}

export default function StageRequirementsScreen() {
  const route = useRoute<ReqRoute>();
  const { t } = useTranslation();
  const { stopId, stageName, taskId } = route.params;
  const { teamMember } = useAuth();

  const [requirements, setRequirements] = useState<StopRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  // Client info for WhatsApp
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingReq, setEditingReq] = useState<StopRequirement | null>(null);
  const [title, setTitle] = useState('');
  const [reqType, setReqType] = useState('document');
  const [notes, setNotes] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Type picker
  const [showTypePicker, setShowTypePicker] = useState(false);

  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stop_requirements')
      .select('*, creator:team_members!created_by(name)')
      .eq('stop_id', stopId)
      .order('sort_order', { ascending: true });
    if (!error && data) setRequirements(data as StopRequirement[]);
    setLoading(false);
  }, [stopId]);

  useEffect(() => {
    fetchRequirements();
    // Fetch client phone for WhatsApp
    supabase
      .from('tasks')
      .select('client:clients(name, phone)')
      .eq('id', taskId)
      .maybeSingle()
      .then(({ data }) => {
        const c = (data as any)?.client;
        if (c) {
          setClientName(c.name ?? '');
          setClientPhone(c.phone ?? '');
        }
      });
  }, [fetchRequirements, taskId]);

  function openAdd() {
    setEditingReq(null);
    setTitle('');
    setReqType('document');
    setNotes('');
    setIsCompleted(false);
    setAttachmentUrl('');
    setAttachmentName('');
    setShowModal(true);
  }

  function openEdit(req: StopRequirement) {
    setEditingReq(req);
    setTitle(req.title);
    setReqType(req.req_type);
    setNotes(req.notes ?? '');
    setIsCompleted(req.is_completed);
    setAttachmentUrl(req.attachment_url ?? '');
    setAttachmentName(req.attachment_name ?? '');
    setShowModal(true);
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert(t('required'), t('fieldRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editingReq) {
        const { error } = await supabase
          .from('stop_requirements')
          .update({
            title: title.trim(),
            req_type: reqType,
            notes: notes.trim() || null,
            is_completed: isCompleted,
            attachment_url: attachmentUrl || null,
            attachment_name: attachmentName || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingReq.id);
        if (error) throw error;
      } else {
        const maxOrder = requirements.length > 0
          ? Math.max(...requirements.map((r) => r.sort_order))
          : 0;
        const { error } = await supabase
          .from('stop_requirements')
          .insert({
            stop_id: stopId,
            title: title.trim(),
            req_type: reqType,
            notes: notes.trim() || null,
            is_completed: isCompleted,
            attachment_url: attachmentUrl || null,
            attachment_name: attachmentName || null,
            sort_order: maxOrder + 1,
            created_by: teamMember?.id ?? null,
          });
        if (error) throw error;
      }
      setShowModal(false);
      fetchRequirements();
    } catch (e: any) {
      Alert.alert(t('error'), e.message ?? t('failedToSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(req: StopRequirement) {
    Alert.alert(
      'Delete Requirement',
      `Delete "${req.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('stop_requirements')
              .delete()
              .eq('id', req.id);
            if (!error) fetchRequirements();
          },
        },
      ]
    );
  }

  async function toggleCompleted(req: StopRequirement) {
    const newVal = !req.is_completed;
    const { error } = await supabase
      .from('stop_requirements')
      .update({ is_completed: newVal, updated_at: new Date().toISOString() })
      .eq('id', req.id);
    if (error) return;

    const updated = requirements.map(r => r.id === req.id ? { ...r, is_completed: newVal } : r);
    setRequirements(updated);

    // Auto-complete: if ALL requirements are now done → mark stage Done
    if (newVal && updated.length > 0 && updated.every(r => r.is_completed)) {
      const now = new Date().toISOString();
      await supabase.from('task_route_stops')
        .update({ status: 'Done', updated_at: now })
        .eq('id', stopId);

      await supabase.from('status_updates').insert({
        task_id: taskId,
        stop_id: stopId,
        new_status: 'Done',
      });

      // Check if ALL stops are done → archive task
      const { data: allStops } = await supabase
        .from('task_route_stops').select('id,status').eq('task_id', taskId);
      const allDone = allStops?.every(s => s.id === stopId ? true : s.status === 'Done') ?? false;
      if (allDone) {
        await supabase.from('tasks')
          .update({ current_status: 'Done', is_archived: true, updated_at: now })
          .eq('id', taskId);
        Alert.alert(t('done'), t('savedSuccess'));
      } else {
        Alert.alert(t('done'), t('savedSuccess'));
      }
    }
  }

  // ─── Attachment: pick from library ──────────────────────────
  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('warning'), t('fieldRequired'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadAsset(result.assets[0]);
    }
  }

  // ─── Attachment: scan/camera ─────────────────────────────────
  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('warning'), t('fieldRequired'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadAsset(result.assets[0]);
    }
  }

  async function uploadAsset(asset: ImagePicker.ImagePickerAsset) {
    setUploading(true);
    try {
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `req_${Date.now()}.${ext}`;
      const filePath = `attachments/${stopId}/${fileName}`;

      // Fetch the file as blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, blob, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      // Bucket is private — store just the storage path (not a public URL).
      // Display sites use refreshSignedUrl() / SignedImage which handle either.
      const displayName = asset.fileName ?? fileName;

      setAttachmentUrl(filePath);
      setAttachmentName(displayName);

      // Create task_documents record for audit trail (mirrors DocumentScannerModal)
      await supabase.from('task_documents').insert({
        task_id: taskId,
        file_name: fileName,
        display_name: displayName,
        file_url: filePath,
        file_type: ext,
        uploaded_by: teamMember?.id ?? null,
        requirement_id: editingReq?.id ?? null,
      });
    } catch (e: any) {
      Alert.alert(t('error'), e.message ?? t('somethingWrong'));
    } finally {
      setUploading(false);
    }
  }

  function showAttachmentOptions() {
    Alert.alert(
      'Attach Document',
      'Choose source',
      [
        { text: 'Camera / Scan', onPress: pickFromCamera },
        { text: 'Photo Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  function removeAttachment() {
    setAttachmentUrl('');
    setAttachmentName('');
  }

  // ─── WhatsApp send (all requirements) ──────────────────────
  function sendWhatsApp() {
    if (!clientPhone) {
      Alert.alert(t('warning'), t('fieldRequired'));
      return;
    }
    const clean = clientPhone.replace(/\s+/g, '').replace(/^\+/, '');
    const lines: string[] = [];
    lines.push(`📋 *${stageName}*`);
    if (clientName) lines.push(`👤 ${clientName}`);
    lines.push('');
    requirements.forEach((req, i) => {
      const status = req.is_completed ? '✅' : '⬜';
      lines.push(`${status} *${i + 1}. ${req.title}*`);
      if (req.notes && /[a-zA-Z0-9؀-ۿ]/.test(req.notes)) {
        lines.push(`   📝 ${req.notes}`);
      }
      if (req.attachment_url) {
        lines.push(`   📎 ${req.attachment_name || 'Attachment'}`);
      }
    });
    lines.push('');
    lines.push(`${done}/${total} completed`);
    lines.push('');
    if (teamMember?.name) lines.push(`_Generated by ${teamMember.name}_`);
    lines.push('_GovPilot, Powered by KTS_');
    const msg = lines.join('\n');
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert(t('error'), t('somethingWrong'))
    );
  }

  // ─── WhatsApp send (single requirement) ─────────────────────
  function sendWhatsAppSingle(req: StopRequirement) {
    if (!clientPhone) {
      Alert.alert(t('warning'), t('fieldRequired'));
      return;
    }
    const clean = clientPhone.replace(/\s+/g, '').replace(/^\+/, '');
    const lines: string[] = [];
    lines.push(`📋 *${stageName}*`);
    if (clientName) lines.push(`👤 ${clientName}`);
    lines.push('');
    const status = req.is_completed ? '✅' : '⬜';
    lines.push(`${status} *${req.title}*`);
    lines.push(`  🏷 ${typeLabel(req.req_type)}`);
    if (req.notes && /[a-zA-Z0-9؀-ۿ]/.test(req.notes)) {
      lines.push(`  📝 ${req.notes}`);
    }
    if (req.attachment_url) {
      lines.push(`  📎 ${req.attachment_name || 'Attachment'}`);
    }
    lines.push('');
    if (teamMember?.name) lines.push(`_Generated by ${teamMember.name}_`);
    lines.push('_GovPilot, Powered by KTS_');
    const msg = lines.join('\n');
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert(t('error'), t('somethingWrong'))
    );
  }

  // ─── Counts ──────────────────────────────────────────────────
  const total = requirements.length;
  const done = requirements.filter((r) => r.is_completed).length;

  // ─── Render ──────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header summary */}
        <View style={s.summaryRow}>
          <Text style={s.summaryText}>
            {done}/{total} completed
          </Text>
          <View style={s.summaryActions}>
            <TouchableOpacity style={s.waBtn} onPress={sendWhatsApp}>
              <Text style={s.waBtnText}>💬 WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.addBtn} onPress={openAdd}>
              <Text style={s.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.color.primary} style={{ marginTop: 40 }} />
        ) : requirements.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyText}>No requirements yet</Text>
            <Text style={s.emptyHint}>Tap + Add Requirement to get started</Text>
          </View>
        ) : (
          requirements.map((req) => (
            <View key={req.id} style={s.reqCard}>
              {/* Completion toggle + title row */}
              <View style={s.reqTopRow}>
                <TouchableOpacity
                  style={[s.checkbox, req.is_completed && s.checkboxDone]}
                  onPress={() => toggleCompleted(req)}
                >
                  {req.is_completed && <Text style={s.checkmark}>✓</Text>}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={s.reqTitleRow}>
                    <Text style={[s.reqTitle, req.is_completed && s.reqTitleDone]}>
                      {req.title}
                    </Text>
                    {/* Notes indicator */}
                    {!!(req.notes && /[a-zA-Z0-9؀-ۿ]/.test(req.notes)) && (
                      <View style={s.infoBadge}>
                        <Text style={s.infoIcon}>📝</Text>
                      </View>
                    )}
                    {/* Attachment indicator */}
                    {!!req.attachment_url && (
                      <View style={s.attachBadge}>
                        <Text style={s.attachBadgeIcon}>📎</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.reqMeta}>
                    <View style={s.typePill}>
                      <Text style={s.typeIcon}>{typeIcon(req.req_type)}</Text>
                      <Text style={s.typeText}>{typeLabel(req.req_type)}</Text>
                    </View>
                    {req.creator?.name && (
                      <Text style={s.creatorText}>by {req.creator.name}</Text>
                    )}
                  </View>
                </View>
                <View style={s.reqActions}>
                  <TouchableOpacity style={s.waReqBtn} onPress={() => sendWhatsAppSingle(req)}>
                    <Text style={s.waReqBtnText}>💬</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.editReqBtn} onPress={() => openEdit(req)}>
                    <Text style={s.editReqBtnText}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.delReqBtn} onPress={() => handleDelete(req)}>
                    <Text style={s.delReqBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notes */}
              {!!req.notes && (
                <Text style={s.reqNotes}>{req.notes}</Text>
              )}

              {/* Attachment preview */}
              {!!req.attachment_url && (
                <View style={s.attachPreview}>
                  {/\.(jpg|jpeg|png|gif|webp)$/i.test(req.attachment_url) ? (
                    <SignedImage
                      source={req.attachment_url}
                      style={s.attachImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={s.attachFile}>
                      <Text style={s.attachFileIcon}>📎</Text>
                      <Text style={s.attachFileName} numberOfLines={1}>
                        {req.attachment_name || 'Attachment'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </KeyboardAwareScrollView>

      {/* ── Add / Edit Modal ── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.modalSheet}>
            {/* Modal header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {editingReq ? 'Edit Requirement' : 'New Requirement'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              style={{ flex: 1 }}
              enableOnAndroid
              enableAutomaticScroll
              extraScrollHeight={60}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title */}
              <Text style={s.fieldLabel}>Title *</Text>
              <TextInput
                style={s.input}
                placeholder={t("title")}
                placeholderTextColor={theme.color.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              {/* Type picker trigger */}
              <Text style={s.fieldLabel}>Type</Text>
              <TouchableOpacity
                style={s.typeTrigger}
                onPress={() => setShowTypePicker(true)}
              >
                <Text style={s.typeTriggerIcon}>{typeIcon(reqType)}</Text>
                <Text style={s.typeTriggerText}>{typeLabel(reqType)}</Text>
                <Text style={s.typeTriggerArrow}>▼</Text>
              </TouchableOpacity>

              {/* Notes */}
              <Text style={s.fieldLabel}>Notes</Text>
              <TextInput
                style={[s.input, s.textArea]}
                placeholder={t("notes")}
                placeholderTextColor={theme.color.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Completed toggle */}
              <View style={s.completedRow}>
                <Text style={s.fieldLabel}>Mark as completed</Text>
                <Switch
                  value={isCompleted}
                  onValueChange={setIsCompleted}
                  trackColor={{ false: theme.color.border, true: theme.color.success }}
                  thumbColor={isCompleted ? theme.color.white : theme.color.textSecondary}
                />
              </View>

              {/* Attachment */}
              <Text style={s.fieldLabel}>Attachment</Text>
              {attachmentUrl ? (
                <View style={s.attachPreviewModal}>
                  {/\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentUrl) ? (
                    <Image
                      source={{ uri: attachmentUrl }}
                      style={s.attachImageModal}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={s.attachFile}>
                      <Text style={s.attachFileIcon}>📎</Text>
                      <Text style={[s.attachFileName, { flex: 1 }]} numberOfLines={1}>
                        {attachmentName || 'Attachment'}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity style={s.removeAttachBtn} onPress={removeAttachment}>
                    <Text style={s.removeAttachText}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.attachBtn}
                  onPress={showAttachmentOptions}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={theme.color.primary} size="small" />
                  ) : (
                    <>
                      <Text style={s.attachBtnIcon}>📎</Text>
                      <Text style={s.attachBtnText}>Attach / Scan Document</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Save button */}
              <TouchableOpacity
                style={[s.saveBtn, saving && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.color.white} size="small" />
                ) : (
                  <Text style={s.saveBtnText}>
                    {editingReq ? 'Save Changes' : 'Add Requirement'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </KeyboardAwareScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Type Picker Modal ── */}
      <Modal
        visible={showTypePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowTypePicker(false)}
      >
        <TouchableOpacity
          style={s.typePickerOverlay}
          activeOpacity={1}
          onPress={() => setShowTypePicker(false)}
        >
          <View style={s.typePickerSheet}>
            <Text style={s.typePickerTitle}>Select Type</Text>
            {REQ_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[s.typePickerRow, reqType === t.value && s.typePickerRowSelected]}
                onPress={() => {
                  setReqType(t.value);
                  setShowTypePicker(false);
                }}
              >
                <Text style={s.typePickerIcon}>{t.icon}</Text>
                <Text style={[s.typePickerLabel, reqType === t.value && s.typePickerLabelSelected]}>
                  {t.label}
                </Text>
                {reqType === t.value && <Text style={s.typePickerCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.bgBase },
  scrollContent: { padding: theme.spacing.space4, paddingBottom: 40 },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.space4,
  },
  summaryText: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize },
  summaryActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: theme.spacing.space2,
    borderRadius: theme.radius.md,
  },
  waBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.typography.label.fontSize },
  addBtn: {
    backgroundColor: theme.color.primary,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.space2,
    borderRadius: theme.radius.md,
  },
  addBtnText: { color: theme.color.white, fontWeight: '700', fontSize: theme.typography.label.fontSize },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: theme.spacing.space3 },
  emptyText: { color: theme.color.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize },

  // Requirement card
  reqCard: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: theme.spacing.space3,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  reqTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    flexShrink: 0,
  },
  checkboxDone: { backgroundColor: theme.color.success, borderColor: theme.color.success },
  checkmark: { color: theme.color.white, fontSize: 18, fontWeight: '800' },
  reqTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  reqTitle: { color: theme.color.textPrimary, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  reqTitleDone: { color: theme.color.textSecondary, textDecorationLine: 'line-through' },
  infoBadge: {
    backgroundColor: theme.color.primary + '22',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.color.primary + '55',
  },
  infoIcon: { fontSize: 11 },
  attachBadge: {
    backgroundColor: theme.color.warning + '22',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.color.warning + '55',
  },
  attachBadgeIcon: { fontSize: 11 },
  reqMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical: 3,
    gap: 4,
  },
  typeIcon: { fontSize: 12 },
  typeText: { color: theme.color.textSecondary, fontSize: theme.typography.caption.fontSize, fontWeight: '600' },
  creatorText: { color: theme.color.textSecondary, fontSize: theme.typography.caption.fontSize },
  reqActions: { flexDirection: 'row', gap: 5, marginStart: 4 },
  waReqBtn: {
    backgroundColor: '#25D366' + '22',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#25D366' + '55',
  },
  waReqBtnText: { fontSize: 13 },
  editReqBtn: {
    backgroundColor: theme.color.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  editReqBtnText: { color: theme.color.textSecondary, fontSize: theme.typography.body.fontSize },
  delReqBtn: {
    backgroundColor: theme.color.danger + '33',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  delReqBtnText: { color: theme.color.danger, fontSize: theme.typography.label.fontSize },
  reqNotes: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize, marginTop: theme.spacing.space2, lineHeight: 18 },

  // Attachment
  attachPreview: { marginTop: 10 },
  attachImage: { width: '100%', height: 160, borderRadius: theme.radius.md },
  attachFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgBase,
    padding: 10,
    borderRadius: theme.radius.md,
    gap: theme.spacing.space2,
  },
  attachFileIcon: { fontSize: 20 },
  attachFileName: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize, flex: 1 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlayDark,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.color.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : theme.spacing.space4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.space5,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  modalTitle: { color: theme.color.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: theme.color.textSecondary, fontSize: 20 },

  fieldLabel: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize, fontWeight: '600', marginBottom: 6, marginTop: 14, paddingHorizontal: theme.spacing.space5 },
  input: {
    backgroundColor: theme.color.bgBase,
    color: theme.color.textPrimary,
    borderRadius: theme.radius.md + 2,
    padding: theme.spacing.space3,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginHorizontal: theme.spacing.space5,
  },
  textArea: { minHeight: 80 },

  typeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md + 2,
    padding: theme.spacing.space3,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginHorizontal: theme.spacing.space5,
    gap: theme.spacing.space2,
  },
  typeTriggerIcon: { fontSize: 18 },
  typeTriggerText: { color: theme.color.textPrimary, fontSize: 15, flex: 1 },
  typeTriggerArrow: { color: theme.color.textSecondary, fontSize: 12 },

  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: theme.spacing.space5,
    marginTop: 14,
  },

  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md + 2,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderStyle: 'dashed',
    marginHorizontal: theme.spacing.space5,
    gap: theme.spacing.space2,
  },
  attachBtnIcon: { fontSize: 18 },
  attachBtnText: { color: theme.color.primary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },

  attachPreviewModal: { marginHorizontal: theme.spacing.space5 },
  attachImageModal: { width: '100%', height: 140, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2 },
  removeAttachBtn: { alignSelf: 'flex-start' },
  removeAttachText: { color: theme.color.danger, fontSize: theme.typography.label.fontSize },

  saveBtn: {
    backgroundColor: theme.color.primary,
    margin: theme.spacing.space5,
    marginTop: theme.spacing.space6,
    padding: 14,
    borderRadius: theme.radius.md + 2,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 15 },

  // Type picker modal
  typePickerOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typePickerSheet: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.space4,
    width: '80%',
  },
  typePickerTitle: {
    color: theme.color.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.space3,
    textAlign: 'center',
  },
  typePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.space3,
    paddingHorizontal: theme.spacing.space2,
    borderRadius: theme.radius.md,
    gap: 10,
  },
  typePickerRowSelected: { backgroundColor: theme.color.bgBase },
  typePickerIcon: { fontSize: 18 },
  typePickerLabel: { color: theme.color.textSecondary, fontSize: 15, flex: 1 },
  typePickerLabelSelected: { color: theme.color.textPrimary, fontWeight: '600' },
  typePickerCheck: { color: theme.color.primary, fontSize: 16, fontWeight: '700' },
});
