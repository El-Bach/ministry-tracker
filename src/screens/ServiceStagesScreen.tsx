// src/screens/ServiceStagesScreen.tsx
// Manage default stages for a service: add (from picker or new), rename, reorder, delete

import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, RouteProp } from '@react-navigation/native';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import { DashboardStackParamList } from '../types';

type RouteType = RouteProp<DashboardStackParamList, 'ServiceStages'>;

interface Stage {
  id: string;          // service_default_stages.id
  ministry_id: string;
  name: string;
  stop_order: number;
}

interface Ministry {
  id: string;
  name: string;
}

export default function ServiceStagesScreen() {
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const { teamMember } = useAuth();
  const orgId = teamMember?.org_id ?? '';
  const { serviceId, serviceName } = route.params;

  const [stages, setStages] = useState<Stage[]>([]);
  const [allMinistries, setAllMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);

  // Picker modal
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [newMiniName, setNewMiniName] = useState('');
  const [adding, setAdding] = useState(false);
  const [stageDirectorySearch, setStageDirectorySearch] = useState('');
  const [deletingMiniId, setDeletingMiniId] = useState<string | null>(null);

  // Inline rename
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [stagesRes, miniRes] = await Promise.all([
      supabase
        .from('service_default_stages')
        .select('*, ministry:ministries(id, name)')
        .eq('service_id', serviceId)
        .order('stop_order'),
      supabase.from('ministries').select('id, name').eq('org_id', orgId).order('name'),
    ]);
    setStages(
      (stagesRes.data ?? []).map((d: any) => ({
        id: d.id,
        ministry_id: d.ministry?.id ?? d.ministry_id,
        name: d.ministry?.name ?? '—',
        stop_order: d.stop_order,
      }))
    );
    setAllMinistries((miniRes.data ?? []) as Ministry[]);
    setLoading(false);
  }, [serviceId]);

  useEffect(() => { load(); }, [load]);

  // Ministries not already in this service's stages
  const availableMinistries = allMinistries.filter(
    (m) => !stages.find((s) => s.ministry_id === m.id)
  );

  const filteredMinistries = [...(pickerQuery
    ? availableMinistries.filter((m) => m.name.toLowerCase().includes(pickerQuery.toLowerCase()))
    : availableMinistries
  )].sort((a, b) => a.name.localeCompare(b.name, ['ar', 'en'], { sensitivity: 'base' }));

  const addExistingMinistry = async (ministry: Ministry) => {
    setAdding(true);
    const nextOrder = stages.length + 1;
    const { data, error } = await supabase
      .from('service_default_stages')
      .insert({ service_id: serviceId, ministry_id: ministry.id, stop_order: nextOrder })
      .select()
      .single();
    setAdding(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setStages((prev) => [...prev, { id: data.id, ministry_id: ministry.id, name: ministry.name, stop_order: nextOrder }]);
    setShowPicker(false);
    setPickerQuery('');
  };

  const addNewMinistry = async () => {
    if (!newMiniName.trim()) return;
    const duplicate = allMinistries.find(
      (m) => m.name.trim().toLowerCase() === newMiniName.trim().toLowerCase()
    );
    if (duplicate) {
      Alert.alert(t('warning'), `"${duplicate.name}" — ${t('duplicateClient')}`);
      return;
    }
    setAdding(true);
    const { data: mData, error: mErr } = await supabase
      .from('ministries')
      .insert({ name: newMiniName.trim(), type: 'child', org_id: orgId })
      .select()
      .single();
    if (mErr) { Alert.alert(t('error'), mErr.message); setAdding(false); return; }
    const nextOrder = stages.length + 1;
    const { data, error } = await supabase
      .from('service_default_stages')
      .insert({ service_id: serviceId, ministry_id: mData.id, stop_order: nextOrder })
      .select()
      .single();
    setAdding(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setAllMinistries((prev) => [...prev, { id: mData.id, name: mData.name }]);
    setStages((prev) => [...prev, { id: data.id, ministry_id: mData.id, name: newMiniName.trim(), stop_order: nextOrder }]);
    setNewMiniName('');
    setShowPicker(false);
    setPickerQuery('');
  };

  const removeStage = (stage: Stage) => {
    Alert.alert(t('deleteStage'), `${t('confirmDelete')} — "${stage.name}"`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await supabase.from('service_default_stages').delete().eq('id', stage.id);
          setStages((prev) => prev.filter((s) => s.id !== stage.id));
        },
      },
    ]);
  };

  const deleteMinistryFromDirectory = (ministry: Ministry) => {
    Alert.alert(
      t('deleteStage'),
      `${t('confirmDelete')} "${ministry.name}"`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            setDeletingMiniId(ministry.id);
            await supabase.from('ministries').delete().eq('id', ministry.id);
            setAllMinistries((prev) => prev.filter((m) => m.id !== ministry.id));
            setDeletingMiniId(null);
          },
        },
      ]
    );
  };

  const moveStage = async (idx: number, dir: -1 | 1) => {
    const arr = [...stages];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    await Promise.all([
      supabase.from('service_default_stages').update({ stop_order: idx + 1 }).eq('id', arr[idx].id),
      supabase.from('service_default_stages').update({ stop_order: target + 1 }).eq('id', arr[target].id),
    ]);
    setStages(arr.map((s, i) => ({ ...s, stop_order: i + 1 })));
  };

  const startRename = (idx: number) => { setEditingIdx(idx); setEditingName(stages[idx].name); };
  const cancelRename = () => setEditingIdx(null);

  const saveRename = async () => {
    if (editingIdx === null || !editingName.trim()) return;
    setSavingRename(true);
    const stage = stages[editingIdx];
    await supabase.from('ministries').update({ name: editingName.trim() }).eq('id', stage.ministry_id);
    setSavingRename(false);
    setStages((prev) => prev.map((s, i) => (i === editingIdx ? { ...s, name: editingName.trim() } : s)));
    setAllMinistries((prev) => prev.map((m) => m.id === stage.ministry_id ? { ...m, name: editingName.trim() } : m));
    setEditingIdx(null);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={s.container}
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.headerCard}>
          <Text style={s.headerLabel}>{t('service').toUpperCase()}</Text>
          <Text style={s.headerName}>{serviceName}</Text>
          <Text style={s.headerSub}>{stages.length} {t('stages').toLowerCase()}</Text>
        </View>

        {/* Stage list */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>{t('stages').toUpperCase()}</Text>

          {loading ? (
            <ActivityIndicator color={theme.color.primary} style={{ marginVertical: 20 }} />
          ) : stages.length === 0 ? (
            <Text style={s.emptyText}>{t('noStagesYetAddBelow')}</Text>
          ) : (
            stages.map((stage, idx) => (
              <View key={stage.id} style={[s.stageRow, idx < stages.length - 1 && s.stageRowBorder]}>
                <View style={s.stageOrder}>
                  <Text style={s.stageOrderText}>{idx + 1}</Text>
                </View>

                {editingIdx === idx ? (
                  <TextInput
                    style={s.renameInput}
                    value={editingName}
                    onChangeText={setEditingName}
                    autoFocus
                    onSubmitEditing={saveRename}
                  />
                ) : (
                  <Text style={s.stageName} numberOfLines={1}>{stage.name}</Text>
                )}

                <View style={s.stageActions}>
                  {editingIdx === idx ? (
                    <>
                      <TouchableOpacity onPress={saveRename} disabled={savingRename} style={s.actionBtn}>
                        {savingRename
                          ? <ActivityIndicator size="small" color={theme.color.success} />
                          : <Text style={s.confirmText}>✓</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={cancelRename} style={s.actionBtn}>
                        <Text style={s.cancelText}>✕</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => moveStage(idx, -1)} disabled={idx === 0} style={s.actionBtn}>
                        <Text style={[s.moveText, idx === 0 && s.disabled]}>↑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => moveStage(idx, 1)} disabled={idx === stages.length - 1} style={s.actionBtn}>
                        <Text style={[s.moveText, idx === stages.length - 1 && s.disabled]}>↓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => startRename(idx)} style={s.actionBtn}>
                        <Text style={s.editText}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeStage(stage)} style={s.actionBtn}>
                        <Text style={s.removeText}>✕</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Add stage button */}
        <TouchableOpacity style={s.addStageBtn} onPress={() => { setPickerQuery(''); setNewMiniName(''); setShowPicker(true); }}>
          <Text style={s.addStageBtnText}>+ {t('addStageBtn')}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Stage picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={p.overlay}
        >
          <View style={p.sheet}>
            <View style={p.header}>
              <Text style={p.title}>{t('addStageBtn')}</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={p.close}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search existing */}
            <TextInput
              style={p.search}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder={t("searchStage")}
              placeholderTextColor={theme.color.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <FlatList
              data={filteredMinistries}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 240 }}
              ListEmptyComponent={
                <Text style={p.emptyText}>
                  {pickerQuery ? t('noStagesMatch') : t('allStagesAlreadyAdded')}
                </Text>
              }
              renderItem={({ item }) => (
                <View style={p.item}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => addExistingMinistry(item)}>
                    <Text style={p.itemText}>{item.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={p.itemDeleteBtn}
                    onPress={() => deleteMinistryFromDirectory(item)}
                    disabled={deletingMiniId === item.id}
                  >
                    {deletingMiniId === item.id
                      ? <ActivityIndicator size="small" color={theme.color.danger} />
                      : <Text style={p.itemDeleteText}>🗑</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => addExistingMinistry(item)}>
                    <Text style={p.itemAdd}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            />

            {/* Create new */}
            <View style={p.createSection}>
              <Text style={p.createLabel}>{t('createStage').toUpperCase()}</Text>
              <View style={p.createRow}>
                <TextInput
                  style={p.createInput}
                  value={newMiniName}
                  onChangeText={setNewMiniName}
                  placeholder={t("stageName")}
                  placeholderTextColor={theme.color.textMuted}
                  onSubmitEditing={addNewMinistry}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[p.createBtn, (!newMiniName.trim() || adding) && p.createBtnDisabled]}
                  onPress={addNewMinistry}
                  disabled={!newMiniName.trim() || adding}
                >
                  {adding
                    ? <ActivityIndicator color={theme.color.white} size="small" />
                    : <Text style={p.createBtnText}>+ Add</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  container: { padding: theme.spacing.space4, paddingBottom: 40 },
  headerCard: {
    backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg,
    padding: theme.spacing.space4, borderWidth: 1, borderColor: theme.color.border, marginBottom: theme.spacing.space3,
  },
  headerLabel: { ...theme.typography.sectionDivider, letterSpacing: 0.5, marginBottom: 4 },
  headerName:  { ...theme.typography.heading, fontSize: 18, fontWeight: '800' },
  headerSub:   { ...theme.typography.label, color: theme.color.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg,
    padding: theme.spacing.space4, borderWidth: 1, borderColor: theme.color.border, marginBottom: theme.spacing.space3,
  },
  sectionLabel: { ...theme.typography.sectionDivider, letterSpacing: 0.5, marginBottom: theme.spacing.space3 },
  emptyText:    { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', paddingVertical: theme.spacing.space2 },
  stageRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.space3 },
  stageRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.color.border },
  stageOrder: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: theme.color.primary + '22',
    borderWidth: 1, borderColor: theme.color.primary + '55',
    justifyContent: 'center', alignItems: 'center', marginEnd: theme.spacing.space3,
  },
  stageOrderText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  stageName:      { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  renameInput: {
    flex: 1, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md,
    paddingHorizontal: 10, paddingVertical: theme.spacing.space2,
    color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize,
    borderWidth: 1, borderColor: theme.color.primary, marginEnd: 6,
  },
  stageActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn:    { padding: 6 },
  moveText:     { color: theme.color.textSecondary, fontSize: 16 },
  editText:     { color: theme.color.primaryText, fontSize: 15 },
  removeText:   { color: theme.color.danger, fontSize: 15 },
  confirmText:  { color: theme.color.success, fontSize: 18, fontWeight: '700' },
  cancelText:   { color: theme.color.textSecondary, fontSize: 16 },
  disabled:     { opacity: 0.25 },
  addStageBtn: {
    borderWidth: 1.5, borderColor: theme.color.primary + '55', borderStyle: 'dashed',
    borderRadius: theme.radius.lg, paddingVertical: 14, alignItems: 'center',
    backgroundColor: theme.color.primary + '08',
  },
  addStageBtnText: { ...theme.typography.body, color: theme.color.primary, fontSize: 15, fontWeight: '700' },
});

const p = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.color.bgSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%', paddingBottom: 24, ...theme.shadow.modal, zIndex: theme.zIndex.modal,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.space4, borderBottomWidth: 1, borderBottomColor: theme.color.border,
  },
  title:  { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  close:  { color: theme.color.textSecondary, fontSize: 20, padding: 4 },
  search: {
    margin: theme.spacing.space3, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3, paddingVertical: 10, color: theme.color.textPrimary,
    fontSize: theme.typography.body.fontSize, borderWidth: 1, borderColor: theme.color.border,
  },
  emptyText: { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', padding: theme.spacing.space4 },
  item: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.space4,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.color.bgBase,
  },
  itemText: { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  itemAdd:  { color: theme.color.primary, fontSize: 22, fontWeight: '300' },
  itemDeleteBtn: { paddingHorizontal: 8, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },
  itemDeleteText: { fontSize: 15 },
  createSection: { padding: theme.spacing.space4, borderTopWidth: 1, borderTopColor: theme.color.border, marginTop: 4 },
  createLabel:   { ...theme.typography.sectionDivider, letterSpacing: 0.5, marginBottom: 10 },
  createRow:     { flexDirection: 'row', alignItems: 'center' },
  createInput: {
    flex: 1, backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3, paddingVertical: 11,
    color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize,
    borderWidth: 1, borderColor: theme.color.border, marginEnd: 10,
  },
  createBtn:         { backgroundColor: theme.color.primary, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space4, paddingVertical: 11 },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText:     { color: theme.color.white, fontSize: theme.typography.body.fontSize, fontWeight: '700' },
});
