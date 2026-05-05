// src/components/MinistryContactsSheet.tsx
//
// Bottom-sheet for managing ministry-side contacts at a stage. These are
// people who work AT the ministry (officer, clerk, department head we call
// to push files through) — NOT our internal staff (those live in Network /
// assignees).
//
// Flow:
//   • List of ministry_contacts for the given ministry
//   • Tap phone → call / WhatsApp Alert
//   • + Add contact → inline form (name + phone + position + presence + notes)
//   • Per-card: ✎ Edit (inline) and ✕ Delete (confirm)
//
// readOnly mode (passed by TaskDetail) hides + Add and per-card edit/delete,
// keeps the phone-tap interaction so staff can call from the file detail screen.
//
// pick mode (passed by TaskDetail) flips the sheet from a viewer into a
// multi-select picker: each card gets a checkbox, the header shows a "Done"
// button instead of a plain close, and tapping Done invokes onSavePick with
// the selected ids. Edit affordances are hidden in pick mode (managing the
// pool still happens in CreateScreen → Manage > Stages).

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, KeyboardAvoidingView, Platform, Alert, Linking, StyleSheet,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import PhoneInput, { DEFAULT_COUNTRY } from './PhoneInput';
import { MinistryContact } from '../types';

interface Props {
  visible: boolean;
  ministryId: string | null;
  ministryName: string;
  readOnly?: boolean;
  /**
   * pick mode shows checkboxes + a Done button. Used by TaskDetail to let
   * the user pin a subset of contacts to a stage. Default 'browse' = the
   * existing list/edit view used by CreateScreen.
   */
  mode?: 'browse' | 'pick';
  /** Pre-checked contact ids (only used in pick mode) */
  initialSelected?: string[];
  /** Called with the final id set when the user taps Done (pick mode only) */
  onSavePick?: (selectedIds: string[]) => Promise<void> | void;
  onClose: () => void;
}

function openPhone(phone: string, name?: string) {
  const clean = phone.replace(/[^0-9+]/g, '');
  Alert.alert(name ?? phone, phone, [
    { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
    { text: '💬 WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export function MinistryContactsSheet({
  visible, ministryId, ministryName, readOnly, mode = 'browse',
  initialSelected, onSavePick, onClose,
}: Props) {
  const { t } = useTranslation();
  const { teamMember } = useAuth();
  const orgId = teamMember?.org_id ?? '';

  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<MinistryContact[]>([]);

  // Pick mode state — selected ids + Done-button busy flag
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [savingPick, setSavingPick] = useState(false);

  // Add-new form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneCC, setNewPhoneCC] = useState(DEFAULT_COUNTRY.code);
  const [newPosition, setNewPosition] = useState('');
  const [newPresence, setNewPresence] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit existing
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneCC, setEditPhoneCC] = useState(DEFAULT_COUNTRY.code);
  const [editPosition, setEditPosition] = useState('');
  const [editPresence, setEditPresence] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const resetAddForm = () => {
    setShowAdd(false);
    setNewName(''); setNewPhone(''); setNewPhoneCC(DEFAULT_COUNTRY.code);
    setNewPosition(''); setNewPresence(''); setNewNotes('');
  };
  const resetEditForm = () => {
    setEditId(null);
    setEditName(''); setEditPhone(''); setEditPhoneCC(DEFAULT_COUNTRY.code);
    setEditPosition(''); setEditPresence(''); setEditNotes('');
  };

  const load = async () => {
    if (!ministryId || !orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from('ministry_contacts')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('sort_order')
      .order('created_at');
    setContacts((data as MinistryContact[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (visible && ministryId) load();
    else { resetAddForm(); resetEditForm(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ministryId]);

  // Seed pick selection whenever the sheet (re)opens in pick mode.
  useEffect(() => {
    if (visible && mode === 'pick') {
      setPicked(new Set(initialSelected ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, ministryId]);

  const togglePicked = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDone = async () => {
    if (!onSavePick) { onClose(); return; }
    setSavingPick(true);
    try {
      await onSavePick(Array.from(picked));
      onClose();
    } catch (e: any) {
      Alert.alert(t('error'), e?.message ?? 'Failed to save selection');
    } finally {
      setSavingPick(false);
    }
  };

  // Split a stored phone like "+96170123456" into { cc:'+961', local:'70123456' }
  // for the edit form. Falls back to default cc if no match.
  const splitStoredPhone = (stored: string | null | undefined): { cc: string; local: string } => {
    if (!stored) return { cc: DEFAULT_COUNTRY.code, local: '' };
    if (stored.startsWith('+')) {
      // try longest country-code prefix (4 → 1 digits)
      for (let len = 5; len >= 2; len--) {
        const candidate = stored.slice(0, len);
        // we don't have COUNTRIES here without re-import; common case is +961
        if (stored.length > len) return { cc: candidate, local: stored.slice(len) };
      }
    }
    return { cc: DEFAULT_COUNTRY.code, local: stored };
  };

  const startEdit = (c: MinistryContact) => {
    const { cc, local } = splitStoredPhone(c.phone);
    setEditId(c.id);
    setEditName(c.name);
    setEditPhone(local);
    setEditPhoneCC(cc);
    setEditPosition(c.position ?? '');
    setEditPresence(c.presence ?? '');
    setEditNotes(c.notes ?? '');
  };

  const handleAdd = async () => {
    if (!newName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    if (!ministryId || !orgId) return;
    setSaving(true);
    const fullPhone = newPhone.trim() ? `${newPhoneCC}${newPhone.trim()}` : null;
    const { error } = await supabase.from('ministry_contacts').insert({
      ministry_id: ministryId,
      org_id:      orgId,
      name:        newName.trim(),
      phone:       fullPhone,
      position:    newPosition.trim() || null,
      presence:    newPresence.trim() || null,
      notes:       newNotes.trim()    || null,
      sort_order:  contacts.length,
      created_by:  teamMember?.id ?? null,
    });
    setSaving(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    resetAddForm();
    await load();
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    if (!editName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingEdit(true);
    const fullPhone = editPhone.trim() ? `${editPhoneCC}${editPhone.trim()}` : null;
    const { error } = await supabase
      .from('ministry_contacts')
      .update({
        name:     editName.trim(),
        phone:    fullPhone,
        position: editPosition.trim() || null,
        presence: editPresence.trim() || null,
        notes:    editNotes.trim()    || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editId);
    setSavingEdit(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    resetEditForm();
    await load();
  };

  const handleDelete = (c: MinistryContact) => {
    Alert.alert(
      'Delete contact',
      `Remove ${c.name} from ${ministryName}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('ministry_contacts').delete().eq('id', c.id);
            if (error) { Alert.alert(t('error'), error.message); return; }
            await load();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }}>
          <View style={s.sheet}>
            <View style={s.header}>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{ministryName}</Text>
                <Text style={s.subtitle}>
                  {mode === 'pick'
                    ? `${picked.size} selected · ${contacts.length} available`
                    : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`}
                </Text>
              </View>
              {mode === 'pick' ? (
                <TouchableOpacity style={s.doneBtn} onPress={handleDone} disabled={savingPick}>
                  {savingPick
                    ? <ActivityIndicator color={theme.color.white} size="small" />
                    : <Text style={s.doneBtnText}>{t('done') || 'Done'}</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
              )}
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={s.sectionLabel}>👥 MINISTRY CONTACTS</Text>

              {loading ? (
                <ActivityIndicator color={theme.color.primary} style={{ marginVertical: 24 }} />
              ) : contacts.length === 0 ? (
                <Text style={s.emptyText}>
                  No contacts yet.{!readOnly && ' Tap "+ Add contact" below to add the first one.'}
                </Text>
              ) : (
                contacts.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.card, mode === 'pick' && picked.has(c.id) && s.cardPicked]}
                    activeOpacity={mode === 'pick' ? 0.7 : 1}
                    onPress={mode === 'pick' ? () => togglePicked(c.id) : undefined}
                  >
                    {editId === c.id ? (
                      <View style={{ gap: 8 }}>
                        <TextInput style={s.input} value={editName} onChangeText={setEditName} placeholder="Name *" placeholderTextColor={theme.color.textMuted} />
                        <PhoneInput value={editPhone} onChangeText={setEditPhone} countryCode={editPhoneCC} onCountryChange={(cc) => setEditPhoneCC(cc.code)} placeholder="Phone (optional)" />
                        <TextInput style={s.input} value={editPosition} onChangeText={setEditPosition} placeholder="Position (e.g. Department Head)" placeholderTextColor={theme.color.textMuted} />
                        <TextInput style={s.input} value={editPresence} onChangeText={setEditPresence} placeholder="Presence (e.g. Mon–Fri 9am–2pm)" placeholderTextColor={theme.color.textMuted} />
                        <TextInput style={[s.input, { height: 60 }]} value={editNotes} onChangeText={setEditNotes} placeholder="Notes" placeholderTextColor={theme.color.textMuted} multiline textAlignVertical="top" />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit} disabled={savingEdit}>
                            {savingEdit ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.saveBtnText}>{t('save')}</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity style={s.cancelBtn} onPress={resetEditForm}>
                            <Text style={s.cancelBtnText}>{t('cancel')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        {mode === 'pick' && (
                          <View style={[s.checkbox, picked.has(c.id) && s.checkboxChecked]}>
                            {picked.has(c.id) && <Text style={s.checkboxTick}>✓</Text>}
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={s.cardName}>{c.name}</Text>
                          {c.position && <Text style={s.cardPosition}>{c.position}</Text>}
                          {c.phone && (
                            mode === 'pick' ? (
                              <Text style={s.cardPhone}>📞 {c.phone}</Text>
                            ) : (
                              <TouchableOpacity onPress={() => openPhone(c.phone!, c.name)}>
                                <Text style={s.cardPhone}>📞 {c.phone}</Text>
                              </TouchableOpacity>
                            )
                          )}
                          {c.presence && <Text style={s.cardPresence}>🕐 {c.presence}</Text>}
                          {c.notes && <Text style={s.cardNotes}>{c.notes}</Text>}
                        </View>
                        {mode !== 'pick' && !readOnly && (
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity style={s.iconBtn} onPress={() => startEdit(c)}>
                              <Text style={s.iconBtnText}>✎</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.iconBtnDanger} onPress={() => handleDelete(c)}>
                              <Text style={s.iconBtnDangerText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}

              {/* + Add contact — available in both browse and pick mode so the
                  user can add a missing contact without leaving TaskDetail */}
              {!readOnly && !showAdd && (
                <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
                  <Text style={s.addBtnText}>+ Add contact</Text>
                </TouchableOpacity>
              )}

              {!readOnly && showAdd && (
                <View style={s.addPanel}>
                  <Text style={s.helperText}>NEW MINISTRY CONTACT</Text>
                  <TextInput style={s.input} value={newName} onChangeText={setNewName} placeholder="Name *" placeholderTextColor={theme.color.textMuted} autoFocus />
                  <PhoneInput value={newPhone} onChangeText={setNewPhone} countryCode={newPhoneCC} onCountryChange={(cc) => setNewPhoneCC(cc.code)} placeholder="Phone (optional)" />
                  <TextInput style={s.input} value={newPosition} onChangeText={setNewPosition} placeholder="Position (e.g. Department Head)" placeholderTextColor={theme.color.textMuted} />
                  <TextInput style={s.input} value={newPresence} onChangeText={setNewPresence} placeholder="Presence (e.g. Mon–Fri 9am–2pm)" placeholderTextColor={theme.color.textMuted} />
                  <TextInput style={[s.input, { height: 60 }]} value={newNotes} onChangeText={setNewNotes} placeholder="Notes" placeholderTextColor={theme.color.textMuted} multiline textAlignVertical="top" />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={s.saveBtn} onPress={handleAdd} disabled={saving}>
                      {saving ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.saveBtnText}>{t('save')}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={s.cancelBtn} onPress={resetAddForm}>
                      <Text style={s.cancelBtnText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: theme.color.overlayDark },
  sheet:      { backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.lg, marginHorizontal: theme.spacing.space3, maxHeight: '90%' as any, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title:      { fontSize: 16, fontWeight: '700', color: theme.color.textPrimary },
  subtitle:   { fontSize: 12, color: theme.color.textMuted, marginTop: 2 },
  close:      { fontSize: 22, color: theme.color.textMuted, paddingHorizontal: 8 },
  sectionLabel:{ fontSize: 11, fontWeight: '700', color: theme.color.textMuted, letterSpacing: 0.5, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  card:       { backgroundColor: theme.color.bgBase, marginHorizontal: 14, marginBottom: 8, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border },
  cardPicked: { borderColor: theme.color.primary, backgroundColor: theme.color.primary + '10' },
  checkbox:   { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: theme.color.border, marginRight: 10, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  checkboxTick: { color: theme.color.white, fontSize: 14, fontWeight: '700' },
  doneBtn:    { backgroundColor: theme.color.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: theme.radius.sm, minWidth: 70, alignItems: 'center' },
  doneBtnText:{ color: theme.color.white, fontWeight: '700', fontSize: 14 },
  cardName:   { fontSize: 15, fontWeight: '700', color: theme.color.textPrimary },
  cardPosition:{ fontSize: 12, color: theme.color.primaryText, marginTop: 2 },
  cardPhone:  { fontSize: 13, color: theme.color.primary, marginTop: 4 },
  cardPresence:{ fontSize: 12, fontStyle: 'italic', color: theme.color.textSecondary, marginTop: 4 },
  cardNotes:  { fontSize: 12, color: theme.color.textSecondary, marginTop: 4 },
  iconBtn:    { width: 32, height: 32, borderRadius: theme.radius.sm, backgroundColor: theme.color.primary + '22', alignItems: 'center', justifyContent: 'center' },
  iconBtnText:{ color: theme.color.primary, fontWeight: '700' },
  iconBtnDanger:{ width: 32, height: 32, borderRadius: theme.radius.sm, backgroundColor: theme.color.danger + '22', alignItems: 'center', justifyContent: 'center' },
  iconBtnDangerText: { color: theme.color.danger, fontWeight: '700' },
  emptyText:  { fontSize: 13, color: theme.color.textMuted, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 14 },
  addBtn:     { marginHorizontal: 14, marginTop: 4, padding: 12, backgroundColor: theme.color.primary + '22', borderRadius: theme.radius.md, alignItems: 'center' },
  addBtnText: { color: theme.color.primary, fontWeight: '700' },
  addPanel:   { backgroundColor: theme.color.bgBase, marginHorizontal: 14, marginTop: 4, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, gap: 8 },
  helperText: { fontSize: 11, color: theme.color.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  input:      { backgroundColor: theme.color.bgSurface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, padding: 10, fontSize: 14, color: theme.color.textPrimary },
  saveBtn:    { backgroundColor: theme.color.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: theme.radius.sm, alignItems: 'center' },
  saveBtnText:{ color: theme.color.white, fontWeight: '700' },
  cancelBtn:  { backgroundColor: theme.color.bgSurface, borderWidth: 1, borderColor: theme.color.border, paddingVertical: 10, paddingHorizontal: 18, borderRadius: theme.radius.sm, alignItems: 'center' },
  cancelBtnText:{ color: theme.color.textSecondary, fontWeight: '600' },
});
