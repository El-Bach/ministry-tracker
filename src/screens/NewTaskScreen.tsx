// src/screens/NewTaskScreen.tsx
// Create new task: client → service → stages route → assignee → due date

import React, { useState, useEffect, useRef } from 'react';
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
 FlatList,
 Switch,
 KeyboardAvoidingView,
 Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar } from 'react-native-calendars';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { FieldDefinition, FieldValue, useFieldDefinitions } from '../components/ClientFieldsForm';
import * as Location from 'expo-location';
import PhoneInput, { DEFAULT_COUNTRY } from '../components/PhoneInput';

// ─── Final closure stage — always last, auto-created ────────────────
const FINAL_STAGE_NAME = 'تسليم المعاملة النهائية و اغلاق الحسابات';

// ─── Field types list placeholder — defined inside component for i18n ──

// ─── Field type icons map ─────────────────────────────────────
const FIELD_TYPE_ICONS: Record<string, string> = {
 text: 'Aa',
 textarea: '¶',
 number: '123',
 currency: '$',
 email: '@',
 phone: '☏',
 url: '🔗',
 date: '📅',
 boolean: '✓',
 select: '▾',
 multiselect: '☑',
 image: '🖼',
 location: '📍',
 id_number: '#',
};

// ─── Dynamic single field input ───────────────────────────────
function DynamicFieldInput({
 definition,
 value,
 onChange,
}: {
 definition: FieldDefinition;
 value?: FieldValue;
 onChange: (v: FieldValue) => void;
}) {
 const { t } = useTranslation();
 const [locLoading, setLocLoading] = React.useState(false);
 const [selectOpen, setSelectOpen] = React.useState(false);
 const ft = definition.field_type;
 const base = { field_id: definition.id };

 const textVal = value?.value_text ?? '';
 const numVal = value?.value_number;
 const boolVal = value?.value_boolean ?? false;
 const jsonVal = value?.value_json;

 if (ft === 'text' || ft === 'id_number') {
 return (
 <TextInput style={dfi.input} value={textVal}
 onChangeText={(v) => onChange({ ...base, value_text: v })}
 placeholder={definition.label} placeholderTextColor={theme.color.textMuted} />
 );
 }
 if (ft === 'textarea') {
 return (
 <TextInput style={[dfi.input, dfi.textarea]} value={textVal}
 onChangeText={(v) => onChange({ ...base, value_text: v })}
 placeholder={definition.label} placeholderTextColor={theme.color.textMuted}
 multiline numberOfLines={3} textAlignVertical="top" />
 );
 }
 if (ft === 'number' || ft === 'currency') {
 return (
 <TextInput style={dfi.input}
 value={numVal != null ? String(numVal) : ''}
 onChangeText={(v) => onChange({ ...base, value_number: parseFloat(v) || undefined })}
 placeholder={ft === 'currency' ? '0.00' : '0'}
 placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
 );
 }
 if (ft === 'email') {
 return (
 <TextInput style={dfi.input} value={textVal}
 onChangeText={(v) => onChange({ ...base, value_text: v })}
 placeholder="email@example.com" placeholderTextColor={theme.color.textMuted}
 keyboardType="email-address" autoCapitalize="none" />
 );
 }
 if (ft === 'phone') {
 return (
 <TextInput style={dfi.input} value={textVal}
 onChangeText={(v) => onChange({ ...base, value_text: v })}
 placeholder="+1 234 567 8900" placeholderTextColor={theme.color.textMuted}
 keyboardType="phone-pad" />
 );
 }
 if (ft === 'url') {
 return (
 <TextInput style={dfi.input} value={textVal}
 onChangeText={(v) => onChange({ ...base, value_text: v })}
 placeholder="https://" placeholderTextColor={theme.color.textMuted}
 keyboardType="url" autoCapitalize="none" />
 );
 }
 if (ft === 'date') {
 return (
 <TextInput style={dfi.input} value={textVal}
 onChangeText={(v) => onChange({ ...base, value_text: v })}
 placeholder="DD/MM/YYYY" placeholderTextColor={theme.color.textMuted}
 keyboardType="decimal-pad" />
 );
 }
 if (ft === 'boolean') {
 return (
 <View style={dfi.boolRow}>
 <Text style={dfi.boolLabel}>{boolVal ? t('yes') : t('no')}</Text>
 <Switch value={boolVal}
 onValueChange={(v) => onChange({ ...base, value_boolean: v })}
 trackColor={{ false: theme.color.border, true: theme.color.primary }} thumbColor={theme.color.white} />
 </View>
 );
 }
 if (ft === 'select' || ft === 'multiselect') {
 const opts = definition.options ?? [];
 const isMulti = ft === 'multiselect';
 const selected: string[] = isMulti
 ? ((jsonVal?.selected as string[]) ?? [])
 : (textVal ? [textVal] : []);
 const display = selected.length > 0 ? selected.join(', ') : t('select');
 return (
 <>
 <TouchableOpacity style={dfi.selectBtn} onPress={() => setSelectOpen(true)}>
 <Text style={selected.length > 0 ? dfi.selectVal : dfi.selectPlaceholder}>{display}</Text>
 <Text style={dfi.selectChevron}>›</Text>
 </TouchableOpacity>
 <Modal visible={selectOpen} transparent animationType="fade"
 onRequestClose={() => setSelectOpen(false)}>
 <View style={dfi.modalOverlay}>
 <View style={dfi.modalSheet}>
 <View style={dfi.modalHeader}>
 <Text style={dfi.modalTitle}>{definition.label}</Text>
 <TouchableOpacity onPress={() => setSelectOpen(false)}>
 <Text style={dfi.modalClose}>✕</Text>
 </TouchableOpacity>
 </View>
 <ScrollView>
 {opts.map((opt: string) => {
 const isSel = selected.includes(opt);
 return (
 <TouchableOpacity key={opt}
 style={[dfi.optRow, isSel && dfi.optRowSel]}
 onPress={() => {
 if (isMulti) {
 const next = isSel ? selected.filter((x) => x !== opt) : [...selected, opt];
 onChange({ ...base, value_json: { selected: next } });
 } else {
 onChange({ ...base, value_text: opt });
 setSelectOpen(false);
 }
 }}>
 <Text style={[dfi.optText, isSel && dfi.optTextSel]}>{opt}</Text>
 {isSel && <Text style={dfi.optCheck}>✓</Text>}
 </TouchableOpacity>
 );
 })}
 </ScrollView>
 {isMulti && (
 <TouchableOpacity style={dfi.doneBtn} onPress={() => setSelectOpen(false)}>
 <Text style={dfi.doneBtnText}>{t('done')}</Text>
 </TouchableOpacity>
 )}
 </View>
 </View>
 </Modal>
 </>
 );
 }
 if (ft === 'location') {
 const locVal = jsonVal as { lat: number; lng: number; address?: string } | null;
 return (
 <View style={dfi.locContainer}>
 <TouchableOpacity style={dfi.locBtn} disabled={locLoading}
 onPress={async () => {
 setLocLoading(true);
 try {
 const { status } = await Location.requestForegroundPermissionsAsync();
 if (status !== 'granted') { Alert.alert(t('warning'), t('fieldRequired')); return; }
 const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
 const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
 try {
 const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
 const address = [place.street, place.city, place.country].filter(Boolean).join(', ');
 onChange({ ...base, value_json: { ...coords, address } as Record<string, unknown> });
 } catch { onChange({ ...base, value_json: coords as Record<string, unknown> }); }
 } catch { Alert.alert(t('error'), t('somethingWrong')); }
 finally { setLocLoading(false); }
 }}>
 {locLoading ? <ActivityIndicator color={theme.color.primary} size="small" /> :
 <Text style={dfi.locBtnText}>📍 {locVal ? 'Update Location' : 'Capture Location'}</Text>}
 </TouchableOpacity>
 {locVal && (
 <View style={dfi.locResult}>
 {locVal.address && <Text style={dfi.locAddress}>{locVal.address}</Text>}
 <Text style={dfi.locCoords}>{locVal.lat.toFixed(6)}, {locVal.lng.toFixed(6)}</Text>
 </View>
 )}
 </View>
 );
 }
 if (ft === 'image') {
 return (
 <View style={dfi.imgNote}>
 <Text style={dfi.imgNoteText}>📷 Image upload available after saving the client</Text>
 </View>
 );
 }
 return (
 <TextInput style={dfi.input} value={textVal}
 onChangeText={(v) => onChange({ ...base, value_text: v })}
 placeholder={definition.label} placeholderTextColor={theme.color.textMuted} />
 );
}

const dfi = StyleSheet.create({
  input: {
    backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3, paddingVertical: 10,
    color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize,
    borderWidth: 1, borderColor: theme.color.border,
  },
  textarea:  { minHeight: 64, textAlignVertical: 'top' },
  boolRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.color.border,
  },
  boolLabel:         { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space3, borderWidth: 1, borderColor: theme.color.border,
  },
  selectVal:         { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize },
  selectPlaceholder: { flex: 1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  selectChevron:     { color: theme.color.textMuted, fontSize: 18 },
  locContainer:      { gap: 6 },
  locBtn: {
    backgroundColor: theme.color.primary + '11', borderRadius: theme.radius.md,
    paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: theme.color.primary + '55',
  },
  locBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '600' },
  locResult: {
    backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: 10,
    borderWidth: 1, borderColor: theme.color.border, gap: 3,
  },
  locAddress:   { ...theme.typography.body, color: theme.color.textSecondary },
  locCoords:    { ...theme.typography.caption, color: theme.color.textMuted },
  imgNote: {
    backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, padding: theme.spacing.space3,
    borderWidth: 1, borderColor: theme.color.border,
  },
  imgNoteText:  { ...theme.typography.body, color: theme.color.textMuted },
  modalOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.color.bgSurface, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 32,
    ...theme.shadow.modal, zIndex: theme.zIndex.modal,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.space4, borderBottomWidth: 1, borderBottomColor: theme.color.border,
  },
  modalTitle: { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  modalClose: { color: theme.color.textSecondary, fontSize: 20 },
  optRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.space4,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.color.bgBase,
  },
  optRowSel:   { backgroundColor: theme.color.primary + '11' },
  optText:     { flex: 1, color: theme.color.textPrimary, fontSize: 15 },
  optTextSel:  { color: theme.color.primaryText, fontWeight: '700' },
  optCheck:    { color: theme.color.success, fontSize: 18 },
  doneBtn: {
    margin: theme.spacing.space3, backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center',
  },
  doneBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },
});

// ─── Field picker modal styles ────────────────────────────────
const fp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-start', paddingTop: 60 },
  sheet: {
    backgroundColor: theme.color.bgSurface, borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20, maxHeight: '75%', paddingBottom: 32,
    ...theme.shadow.modal, zIndex: theme.zIndex.modal,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.space4, borderBottomWidth: 1, borderBottomColor: theme.color.border,
  },
  title:  { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  close:  { color: theme.color.textSecondary, fontSize: 20 },
  hint: {
    ...theme.typography.label, color: theme.color.textMuted,
    paddingHorizontal: theme.spacing.space4, paddingTop: 10, paddingBottom: 4,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space3,
    paddingHorizontal: theme.spacing.space4, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.color.bgBase,
  },
  optionIcon: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary + '22',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: theme.color.primary + '33',
  },
  optionIconText:      { fontSize: 15 },
  optionLabel:         { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600' },
  optionType:          { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 1 },
  required: {
    color: theme.color.danger, fontSize: theme.typography.sectionDivider.fontSize, fontWeight: '700',
    backgroundColor: theme.color.danger + '22', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: theme.radius.sm - 2,
  },
  optionAdd:    { color: theme.color.primary, fontSize: 22, fontWeight: '700' },
  empty:        { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', padding: 24 },
  sectionLabel: {
    ...theme.typography.sectionDivider, color: theme.color.border,
    paddingHorizontal: theme.spacing.space4, paddingTop: 14, paddingBottom: 4,
  },
  createToggle: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space3,
    paddingHorizontal: theme.spacing.space4, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.color.bgBase,
  },
  createToggleText: { ...theme.typography.body, color: theme.color.primary, fontWeight: '700', flex: 1 },
  createForm: {
    margin: theme.spacing.space3, backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.lg, padding: 14, gap: theme.spacing.space3,
    borderWidth: 1, borderColor: theme.color.border,
  },
  createField: { gap: 6 },
  createLabel: { ...theme.typography.sectionDivider, color: theme.color.textSecondary, letterSpacing: 1 },
  createInput: {
    backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3, paddingVertical: 11,
    color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize,
    borderWidth: 1, borderColor: theme.color.border,
  },
  typeSelectBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 11,
    borderWidth: 1, borderColor: theme.color.border, gap: 10,
  },
  typeSelectIcon:    { fontSize: 16, width: 22, textAlign: 'center' },
  typeSelectName:    { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  typeSelectChevron: { color: theme.color.textMuted, fontSize: 20 },
  createSwitchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3, paddingVertical: 11,
    borderWidth: 1, borderColor: theme.color.border,
  },
  createSaveBtn: {
    backgroundColor: theme.color.primary, borderRadius: theme.radius.md,
    paddingVertical: 13, alignItems: 'center',
  },
  createSaveBtnDisabled:  { opacity: 0.6 },
  createSaveBtnText:      { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },
  optionSelected:         { backgroundColor: theme.color.primary + '11' },
  optionLabelSelected:    { color: theme.color.primaryText },
  optionCheck:            { color: theme.color.success, fontSize: 18 },
});
import { useAuth } from '../hooks/useAuth';
import { Client, Service, Ministry, TeamMember, City, DashboardStackParamList } from '../types';

// ─── Date helpers ─────────────────────────────────────────────
// Parse DD/MM/YYYY or DD/MM/YY → Date object
function parseDisplayDate(input: string): Date | null {
 const clean = input.trim().replace(/[^0-9/]/g, '');
 const parts = clean.split('/');
 if (parts.length !== 3) return null;
 const day = parseInt(parts[0], 10);
 const month = parseInt(parts[1], 10);
 let year = parseInt(parts[2], 10);
 if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
 if (year < 100) year += 2000; // DD/MM/YY → DD/MM/20YY
 const d = new Date(year, month - 1, day);
 if (isNaN(d.getTime())) return null;
 if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
 return d;
}

// Display format: DD/MM/YYYY
function toDisplay(iso: string): string {
 if (!iso) return '';
 const [y, m, d] = iso.split('-');
 return `${d}/${m}/${y}`;
}

// ISO format for DB: YYYY-MM-DD
function toISO(display: string): string | null {
 const d = parseDisplayDate(display);
 if (!d) return null;
 const yyyy = d.getFullYear();
 const mm = String(d.getMonth() + 1).padStart(2, '0');
 const dd = String(d.getDate()).padStart(2, '0');
 return `${yyyy}-${mm}-${dd}`;
}

// Calendar format: YYYY-MM-DD
function displayToCalendar(display: string): string | undefined {
 const iso = toISO(display);
 return iso ?? undefined;
}

// ─── Generic Picker Modal ─────────────────────────────────────
interface PickerItem { id: string; label: string; subtitle?: string }

function PickerModal({
 visible, title, items, onSelect, onClose, search, multiSelect, selectedIds,
 onItemAction, itemActionLabel, onItemDelete, onAddNew, addNewLabel,
}: {
 visible: boolean;
 title: string;
 items: PickerItem[];
 onSelect: (item: PickerItem) => void;
 onClose: () => void;
 search?: boolean;
 multiSelect?: boolean;
 selectedIds?: string[];
 onItemAction?: (item: PickerItem) => void;
 itemActionLabel?: string;
 onItemDelete?: (item: PickerItem) => void;
 onAddNew?: (initialName?: string) => void;
 addNewLabel?: string;
}) {
 const { t } = useTranslation();
 const [query, setQuery] = useState('');
 const filtered = query
 ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
 : items;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior="padding"
        style={ms.overlay}
      >
        <View style={ms.sheet}>
          <View style={ms.sheetHeader}>
            <Text style={ms.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={() => { setQuery(''); onClose(); }}>
              <Text style={ms.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          {multiSelect && (
            <Text style={ms.multiHint}>{t('tapToAddStagesToRoute')}</Text>
          )}
          {search && (
            <TextInput
              style={ms.sheetSearch}
              value={query}
              onChangeText={setQuery}
              placeholder={t('searchInput')}
              placeholderTextColor={theme.color.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              onAddNew && query.trim() ? (
                <TouchableOpacity
                  style={ms.addNewBtn}
                  onPress={() => { setQuery(''); onClose(); onAddNew(query.trim()); }}
                >
                  <Text style={ms.addNewBtnText}>＋ Create "{query.trim()}" as new client</Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = selectedIds?.includes(item.id);
              return (
                <View style={[ms.sheetItem, isSelected && ms.sheetItemSelected]}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      onSelect(item);
                      if (!multiSelect) { setQuery(''); onClose(); }
                    }}
                  >
                    <View style={ms.sheetItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[ms.sheetItemLabel, isSelected && ms.sheetItemLabelSelected]}>
                          {item.label}
                        </Text>
                        {item.subtitle && (
                          <Text style={ms.sheetItemSub}>{item.subtitle}</Text>
                        )}
                      </View>
                      {isSelected && !onItemAction && <Text style={ms.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  {(onItemAction || onItemDelete) && (
                    <View style={ms.itemActions}>
                      {onItemAction && (
                        <TouchableOpacity
                          style={ms.itemActionBtn}
                          onPress={() => { onItemAction(item); setQuery(''); onClose(); }}
                        >
                          <Text style={ms.itemActionBtnText}>{itemActionLabel ?? '✎'}</Text>
                        </TouchableOpacity>
                      )}
                      {onItemDelete && (
                        <TouchableOpacity
                          style={ms.itemDeleteBtn}
                          onPress={() => onItemDelete(item)}
                        >
                          <Text style={ms.itemDeleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />
          {onAddNew && (
            <TouchableOpacity
              style={ms.addNewFooterBtn}
              onPress={() => { setQuery(''); onClose(); onAddNew(undefined); }}
            >
              <Text style={ms.addNewFooterBtnText}>＋ {addNewLabel ?? t('createBtn')}</Text>
            </TouchableOpacity>
          )}
          {multiSelect && (
            <TouchableOpacity style={ms.doneBtn} onPress={() => { setQuery(''); onClose(); }}>
              <Text style={ms.doneBtnText}>{t('done')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-start', paddingTop: 60 },
  sheet: {
    backgroundColor:         theme.color.bgSurface,
    borderBottomLeftRadius:  20,
    borderBottomRightRadius: 20,
    maxHeight:               '80%',
    paddingBottom:           theme.spacing.space2,
    ...theme.shadow.modal,
    zIndex:                  theme.zIndex.modal,
  },
  sheetHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    padding:           theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  sheetTitle:  { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  closeBtn:    { color: theme.color.textSecondary, fontSize: 20, padding: 4 },
  multiHint: {
    ...theme.typography.label,
    color:             theme.color.textMuted,
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        10,
    paddingBottom:     2,
  },
  sheetSearch: {
    margin:            theme.spacing.space3,
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    color:             theme.color.textPrimary,
    fontSize:          theme.typography.body.fontSize,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  sheetItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  sheetItemSelected:      { backgroundColor: theme.color.primary + '11' },
  sheetItemRow:           { flexDirection: 'row', alignItems: 'center' },
  sheetItemLabel:         { color: theme.color.textPrimary, fontSize: 15, fontWeight: '600' },
  sheetItemLabelSelected: { color: theme.color.primaryText },
  sheetItemSub:           { ...theme.typography.label, color: theme.color.textSecondary, marginTop: 2 },
  checkmark:              { color: theme.color.primary, fontSize: 18, fontWeight: '700', marginStart: theme.spacing.space2 },
  itemActions:            { flexDirection: 'row', alignItems: 'center', marginStart: theme.spacing.space2 },
  itemActionBtn: {
    backgroundColor: theme.color.primary + '22',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical: 4,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    marginEnd:       theme.spacing.space1 + 2,
  },
  itemActionBtnText: { ...theme.typography.caption, color: theme.color.primaryText, fontWeight: '700' },
  itemDeleteBtn:     { padding: 4 },
  itemDeleteBtnText: { color: theme.color.danger, fontSize: 16 },
  doneBtn: {
    margin:          theme.spacing.space3,
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 14,
    alignItems:      'center',
  },
  doneBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },
  addNewBtn: {
    margin:            theme.spacing.space4,
    backgroundColor:   theme.color.primary + '14',
    borderRadius:      theme.radius.lg,
    paddingVertical:   14,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       theme.color.primary + '55',
    borderStyle:       'dashed',
  },
  addNewBtnText: { color: theme.color.primaryText, fontSize: 15, fontWeight: '700' },
  addNewFooterBtn: {
    marginHorizontal:  theme.spacing.space4,
    marginTop:         theme.spacing.space2,
    marginBottom:      theme.spacing.space3,
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.lg,
    paddingVertical:   14,
    alignItems:        'center',
  },
  addNewFooterBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },
});

// ─── Field Row ────────────────────────────────────────────────
function FieldRow({
 label, value, onPress, placeholder,
}: {
 label: string;
 value: string;
 onPress: () => void;
 placeholder?: string;
}) {
 const { t } = useTranslation();
 if (value) {
   // Selected state: show selected value prominently, label becomes small hint
   return (
     <TouchableOpacity style={s.fieldRowSelected} onPress={onPress} activeOpacity={0.7}>
       <View style={{ flex: 1 }}>
         <Text style={s.fieldRowSelectedHint}>{label}</Text>
         <Text style={s.fieldRowSelectedValue}>{value}</Text>
       </View>
       <Text style={s.fieldChevron}>›</Text>
     </TouchableOpacity>
   );
 }
 return (
 <TouchableOpacity style={s.fieldRow} onPress={onPress} activeOpacity={0.7}>
 <Text style={s.fieldLabel}>{label}</Text>
 <View style={s.fieldValue}>
 <Text style={s.fieldPlaceholder}>
 {placeholder || t('select')}
 </Text>
 <Text style={s.fieldChevron}>›</Text>
 </View>
 </TouchableOpacity>
 );
}

// ─── Date Picker Component ────────────────────────────────────
function DatePickerField({
 value,
 onChange,
}: {
 value: string; // DD/MM/YYYY display format
 onChange: (display: string) => void;
}) {
 const [showCalendar, setShowCalendar] = useState(false);
 const [manualInput, setManualInput] = useState(value);

 // Sync manual input when value changes externally
 useEffect(() => {
 setManualInput(value);
 }, [value]);

 const calendarSelected = displayToCalendar(value);
 const markedDates = calendarSelected
 ? { [calendarSelected]: { selected: true, selectedColor: theme.color.primary } }
 : {};

 const handleManualChange = (text: string) => {
 setManualInput(text);
 // Auto-format as user types: insert slashes
 const digits = text.replace(/\D/g, '');
 let formatted = digits;
 if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
 if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + digits.slice(4, 8);
 setManualInput(formatted);
 // Only propagate if it looks complete
 if (formatted.length >= 8) {
 onChange(formatted);
 } else {
 onChange(formatted);
 }
 };

 const handleCalendarSelect = (day: { dateString: string }) => {
 const display = toDisplay(day.dateString);
 onChange(display);
 setManualInput(display);
 setShowCalendar(false);
 };

 return (
 <View style={dp.container}>
 <View style={dp.row}>
 <TextInput
 style={dp.input}
 value={manualInput}
 onChangeText={handleManualChange}
 placeholder="DD/MM/YYYY"
 placeholderTextColor={theme.color.textMuted}
 keyboardType="decimal-pad"
 maxLength={10}
 />
 <TouchableOpacity
 style={[dp.calBtn, showCalendar && dp.calBtnActive]}
 onPress={() => setShowCalendar((v) => !v)}
 >
 <Text style={dp.calBtnText}>📅</Text>
 </TouchableOpacity>
 </View>

 {showCalendar && (
 <View style={dp.calendarWrapper}>
 <Calendar
 current={calendarSelected}
 markedDates={markedDates}
 onDayPress={handleCalendarSelect}
 minDate={new Date().toISOString().split('T')[0]}
 theme={{
 backgroundColor: theme.color.bgBase,
 calendarBackground: theme.color.bgBase,
 textSectionTitleColor: theme.color.textMuted,
 selectedDayBackgroundColor: theme.color.primary,
 selectedDayTextColor: theme.color.white,
 todayTextColor: theme.color.primaryText,
 dayTextColor: theme.color.textSecondary,
 textDisabledColor: theme.color.border,
 arrowColor: theme.color.primary,
 monthTextColor: theme.color.textPrimary,
 textDayFontWeight: '600',
 textMonthFontWeight: '700',
 textDayHeaderFontWeight: '600',
 textDayFontSize: 14,
 textMonthFontSize: 15,
 }}
 />
 </View>
 )}
 </View>
 );
}

const dp = StyleSheet.create({
  container:      { gap: theme.spacing.space2 },
  row:            { flexDirection: 'row', gap: theme.spacing.space2, alignItems: 'center' },
  input: {
    flex:            1,
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space3,
    color:           theme.color.textPrimary,
    fontSize:        15,
    fontWeight:      '600',
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  calBtn: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  calBtnActive: {
    borderColor:     theme.color.primary,
    backgroundColor: theme.color.primary + '22',
  },
  calBtnText:      { fontSize: 20 },
  calendarWrapper: {
    borderRadius: theme.radius.lg,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  theme.color.border,
  },
});

type NewTaskRoute = RouteProp<DashboardStackParamList, 'NewTask'>;
type Nav = NativeStackNavigationProp<DashboardStackParamList>;

// ─── Main Screen ──────────────────────────────────────────────
export default function NewTaskScreen() {
 const navigation = useNavigation<Nav>();
 const route = useRoute<NewTaskRoute>();
 const { teamMember, permissions } = useAuth();
 const { t } = useTranslation();

 const FIELD_TYPES_LIST = [
   { key: 'text',        label: t('fieldText'),        icon: 'Aa',  desc: 'Free text' },
   { key: 'textarea',    label: t('fieldTextarea'),    icon: '¶',   desc: 'Multi-line text' },
   { key: 'number',      label: t('fieldNumber'),      icon: '123', desc: 'Numeric value' },
   { key: 'currency',    label: t('fieldCurrency'),    icon: '$',   desc: 'Money amount' },
   { key: 'email',       label: t('fieldEmail'),       icon: '@',   desc: 'Email address' },
   { key: 'phone',       label: t('fieldPhone'),       icon: '☏',  desc: 'Phone number' },
   { key: 'url',         label: t('fieldUrl'),         icon: '🔗',  desc: 'Web address' },
   { key: 'date',        label: t('fieldDate'),        icon: '📅',  desc: 'DD/MM/YYYY' },
   { key: 'boolean',     label: t('fieldBoolean'),     icon: '✓',   desc: 'Toggle switch' },
   { key: 'select',      label: t('fieldSelect'),      icon: '▾',   desc: 'Single choice' },
   { key: 'multiselect', label: t('fieldMultiselect'), icon: '☑',  desc: 'Multiple choices' },
   { key: 'image',       label: t('fieldImage'),       icon: '🖼',  desc: 'Camera or library' },
   { key: 'location',    label: t('fieldLocation'),    icon: '📍',  desc: 'GPS coordinates' },
   { key: 'id_number',   label: t('fieldIdNumber'),    icon: '#',   desc: 'National ID, etc.' },
 ];

 const [clients, setClients] = useState<Client[]>([]);
 const [services, setServices] = useState<Service[]>([]);
 const [stages, setStages] = useState<Ministry[]>([]);
 const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

 const [selectedClient, setSelectedClient] = useState<Client | null>(null);
 const [selectedService, setSelectedService] = useState<Service | null>(null);
 const [routeStops, setRouteStops] = useState<Ministry[]>([]);
 const [dueDate, setDueDate] = useState(''); // stored as DD/MM/YYYY display format
 const [notes, setNotes] = useState('');

 const [modal, setModal] = useState<'client' | 'service' | 'stage' | null>(null);

 // New client form
 const [showNewClientForm, setShowNewClientForm] = useState(false);
 const [newClientName, setNewClientName] = useState('');
 const [newClientPhone, setNewClientPhone] = useState('');
 const [newClientPhoneCountry, setNewClientPhoneCountry] = useState(DEFAULT_COUNTRY.code);
 const [newClientRefName, setNewClientRefName] = useState('');
 const [newClientRefPhone, setNewClientRefPhone] = useState('');
 const [newClientRefPhoneCountry, setNewClientRefPhoneCountry] = useState(DEFAULT_COUNTRY.code);
 const [customFieldValues, setCustomFieldValues] = useState<Record<string, FieldValue>>({});
 const [activeFieldIds, setActiveFieldIds] = useState<string[]>([]); // fields user chose to add
 const [showFieldPicker, setShowFieldPicker] = useState(false);
 const { fields: allFieldDefs, reload: reloadFieldDefs } = useFieldDefinitions();

 // Inline custom field creation inside the picker
 const [showCreateField, setShowCreateField] = useState(false);
 const [newFieldLabel, setNewFieldLabel] = useState('');
 const [newFieldType, setNewFieldType] = useState('text');
 const [newFieldOptions, setNewFieldOptions] = useState('');
 const [newFieldRequired, setNewFieldRequired] = useState(false);
 const [savingNewField, setSavingNewField] = useState(false);
 const [showFieldTypePicker, setShowFieldTypePicker] = useState(false);


 // New service form
 const [showNewServiceForm, setShowNewServiceForm] = useState(false);
 const [newServiceName, setNewServiceName] = useState('');
 // Each draft stage carries an optional default city — persisted to ministries.city_id on save
 const [newServiceStages, setNewServiceStages] = useState<Array<{ name: string; cityId?: string; cityName?: string }>>([]);
 const [newServiceStageInput, setNewServiceStageInput] = useState('');
 const [savingService, setSavingService] = useState(false);
 // Per-draft-stage city picker state
 const [expandedSvcStageIdx, setExpandedSvcStageIdx] = useState<number | null>(null);
 const [svcStageCitySearch, setSvcStageCitySearch] = useState('');
 const [svcStageCreateOpen, setSvcStageCreateOpen] = useState(false);
 const [svcStageNewCityName, setSvcStageNewCityName] = useState('');
 const [svcStageSavingCity, setSvcStageSavingCity] = useState(false);

 // New stage form
 const [showNewStageForm, setShowNewStageForm] = useState(false);
 const [newStageName, setNewStageName] = useState('');
 const [savingStage, setSavingStage] = useState(false);

 // Per-stage city + assignee (set before creating the task)
 const [allCities, setAllCities] = useState<City[]>([]);
 const [allAssignees, setAllAssignees] = useState<any[]>([]);
 const [openStageDetailId, setOpenStageDetailId] = useState<string | null>(null);
 const [stageCityMap, setStageCityMap] = useState<Record<string, { cityId: string; cityName: string } | null>>({});
 const [stageAssigneeMap, setStageAssigneeMap] = useState<Record<string, { id: string; name: string; isExt: boolean } | null>>({});
 const [stageCitySearch, setStageCitySearch] = useState('');
 const [stageAssigneeSearch, setStageAssigneeSearch] = useState('');
 const [stageDetailTab, setStageDetailTab] = useState<'city' | 'assignee'>('city');

 // Inline create-city form state
 const [showCreateCityForm, setShowCreateCityForm] = useState(false);
 const [newCityName, setNewCityName] = useState('');
 const [savingNewCity, setSavingNewCity] = useState(false);
 const newCityInputRef = useRef<TextInput>(null);

 // Inline create-assignee (external) form state
 const [showCreateExtForm, setShowCreateExtForm] = useState(false);
 const [newExtName, setNewExtName] = useState('');
 const [newExtPhone, setNewExtPhone] = useState('');
 const [newExtReference, setNewExtReference] = useState('');
 const [savingNewExt, setSavingNewExt] = useState(false);
 const newExtNameInputRef = useRef<TextInput>(null);

 const [saving, setSaving] = useState(false);

 // ── Stage city: update local map AND persist as the stage's default city ─
 // (so the city travels with the stage everywhere — Manage Stages, future
 //  files using this stage, etc.)
 const persistStageCity = async (
   stageId: string,
   city: { cityId: string; cityName: string } | null,
 ) => {
   setStageCityMap(m => ({ ...m, [stageId]: city }));
   // Update the ministry's default city. Best-effort — UI already moved on.
   await supabase
     .from('ministries')
     .update({ city_id: city?.cityId ?? null })
     .eq('id', stageId);
   // Keep the local stages cache in sync so it shows immediately if the user
   // re-opens the stage picker for another file in the same session.
   setStages(prev => prev.map(st =>
     st.id === stageId
       ? { ...st, city_id: city?.cityId ?? null, city: city ? { id: city.cityId, name: city.cityName } as any : undefined }
       : st
   ));
 };

 // ── Service-form draft-stage city helpers ───────────────────
 const setDraftStageCity = (idx: number, city: { id: string; name: string } | null) => {
   setNewServiceStages(prev => prev.map((s, i) =>
     i === idx
       ? { ...s, cityId: city?.id, cityName: city?.name }
       : s
   ));
 };

 const createCityForDraftStage = async (idx: number) => {
   const name = svcStageNewCityName.trim();
   if (!name) { Alert.alert(t('required'), t('fieldRequired')); return; }
   setSvcStageSavingCity(true);
   const { data, error } = await supabase
     .from('cities')
     .insert({ name, org_id: teamMember?.org_id ?? null })
     .select()
     .single();
   setSvcStageSavingCity(false);
   if (error) { Alert.alert(t('error'), error.message); return; }
   const created = data as City;
   setAllCities(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
   setDraftStageCity(idx, { id: created.id, name: created.name });
   setSvcStageNewCityName('');
   setSvcStageCreateOpen(false);
   setSvcStageCitySearch('');
 };

 // ── Inline create handlers (city + external assignee) ────────
 const handleCreateCityForStage = async (stageId: string) => {
   const name = newCityName.trim();
   if (!name) { Alert.alert(t('required'), t('fieldRequired')); return; }
   setSavingNewCity(true);
   const { data, error } = await supabase
     .from('cities')
     .insert({ name, org_id: teamMember?.org_id ?? null })
     .select()
     .single();
   setSavingNewCity(false);
   if (error) { Alert.alert(t('error'), error.message); return; }
   const created = data as City;
   setAllCities(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
   await persistStageCity(stageId, { cityId: created.id, cityName: created.name });
   setNewCityName('');
   setShowCreateCityForm(false);
   setStageCitySearch('');
 };

 const handleCreateExtAssigneeForStage = async (stageId: string) => {
   const name = newExtName.trim();
   if (!name) { Alert.alert(t('required'), t('fieldRequired')); return; }
   setSavingNewExt(true);
   const { data, error } = await supabase
     .from('assignees')
     .insert({
       name,
       phone:     newExtPhone.trim()     || null,
       reference: newExtReference.trim() || null,
       created_by: teamMember?.id,
       org_id:     teamMember?.org_id ?? null,
     })
     .select('*, creator:team_members!created_by(name)')
     .single();
   setSavingNewExt(false);
   if (error) { Alert.alert(t('error'), error.message); return; }
   const created = data as any;
   setAllAssignees(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
   setStageAssigneeMap(m => ({ ...m, [stageId]: { id: created.id, name: created.name, isExt: true } }));
   setNewExtName(''); setNewExtPhone(''); setNewExtReference('');
   setShowCreateExtForm(false);
   setStageAssigneeSearch('');
 };

 // ── Required docs bottom-sheet ────────────────────────────
 const [showDocSheet, setShowDocSheet]           = useState(false);
 const [sheetDocs, setSheetDocs]                 = useState<any[]>([]);
 const [sheetDocReqs, setSheetDocReqs]           = useState<Record<string, any[]>>({});
 const [sheetExpandedId, setSheetExpandedId]     = useState<string | null>(null);
 const [loadingSheetDocs, setLoadingSheetDocs]   = useState(false);

 // Inline add-document state (within the Required Docs sheet)
 const [showAddDocForm, setShowAddDocForm] = useState(false);
 const [newDocTitle, setNewDocTitle]       = useState('');
 const [savingNewDoc, setSavingNewDoc]     = useState(false);

 // Stage inline rename
 const [editingStageIdx, setEditingStageIdx] = useState<number | null>(null);
 const [editingStageName, setEditingStageName] = useState('');
 const [savingStageRename, setSavingStageRename] = useState(false);

 // Auto-capture created time from device
 const [createdAt] = useState<Date>(() => new Date());
 const createdDisplay = createdAt.toLocaleDateString('en-GB', {
 day: '2-digit',
 month: '2-digit',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 });

 useEffect(() => {
 loadData();
 // Re-run if org changes (auth resolves later, org switch, etc.)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [teamMember?.org_id]);

 // Refresh clients list after returning from EditClient screen
 useFocusEffect(
   React.useCallback(() => {
     supabase.from('clients').select('*').eq('org_id', teamMember?.org_id ?? '').order('name').then(({ data }) => {
       if (data) setClients(data as Client[]);
     });
     // Refresh stages for selected service
     if (selectedService) {
       loadServiceDefaultStages(selectedService.id);
     }
   }, [selectedService])
 );

 const loadServiceDefaultStages = async (serviceId: string) => {
   const { data } = await supabase
     .from('service_default_stages')
     .select('*, ministry:ministries(*, city:cities(id,name))')
     .eq('service_id', serviceId)
     .order('stop_order');
   if (data && data.length > 0) {
     const ministries = data.map((d: any) => d.ministry as Ministry);
     setRouteStops(ministries);
     // Pre-populate stageCityMap from each ministry's default city
     const cityMap: Record<string, { cityId: string; cityName: string } | null> = {};
     for (const m of ministries) {
       if (m.city_id && (m as any).city?.name) {
         cityMap[m.id] = { cityId: m.city_id, cityName: (m as any).city.name };
       }
     }
     setStageCityMap(cityMap);
   } else {
     setRouteStops([]);
     setStageCityMap({});
   }
 };

 // ── Required docs sheet handlers ──────────────────────────
 const loadServiceDocsForSheet = async (serviceId: string) => {
   setLoadingSheetDocs(true);
   setSheetDocs([]);
   setSheetDocReqs({});
   setSheetExpandedId(null);
   const { data: docs } = await supabase
     .from('service_documents')
     .select('*')
     .eq('service_id', serviceId)
     .order('sort_order');
   const docList = docs ?? [];
   setSheetDocs(docList);
   if (docList.length > 0) {
     const results = await Promise.all(
       docList.map((d: any) =>
         supabase.from('service_document_requirements')
           .select('*').eq('doc_id', d.id).order('sort_order')
       )
     );
     const reqs: Record<string, any[]> = {};
     docList.forEach((d: any, i: number) => { reqs[d.id] = results[i].data ?? []; });
     setSheetDocReqs(reqs);
   }
   setLoadingSheetDocs(false);
 };

 // Add a new required document for the currently selected service
 const handleAddDocFromSheet = async () => {
   const title = newDocTitle.trim();
   if (!title) { Alert.alert(t('required'), t('fieldRequired')); return; }
   if (!selectedService) return;
   setSavingNewDoc(true);
   const maxOrder = sheetDocs.length > 0
     ? Math.max(...sheetDocs.map((d: any) => d.sort_order ?? 0))
     : 0;
   const { data, error } = await supabase
     .from('service_documents')
     .insert({
       service_id: selectedService.id,
       title,
       sort_order: maxOrder + 1,
       org_id:     teamMember?.org_id ?? null,
     })
     .select()
     .single();
   setSavingNewDoc(false);
   if (error) { Alert.alert(t('error'), error.message); return; }
   if (data) {
     setSheetDocs(prev => [...prev, data]);
     setSheetDocReqs(prev => ({ ...prev, [(data as any).id]: [] }));
   }
   setNewDocTitle('');
   setShowAddDocForm(false);
 };

 const handleShareDocsWhatsApp = () => {
   if (!selectedService || sheetDocs.length === 0) return;
   const lines: string[] = [`📋 *${selectedService.name}* — Required Documents:\n`];
   sheetDocs.forEach((doc: any, idx: number) => {
     lines.push(`${idx + 1}. *${doc.title}*`);
     (sheetDocReqs[doc.id] ?? []).forEach((r: any) => lines.push(`   • ${r.title}`));
   });
   if (teamMember?.name) lines.push(`\n_Generated by ${teamMember.name}_`);
   lines.push('_GovPilot, Powered by KTS_');
   const msg = encodeURIComponent(lines.join('\n'));
   Linking.openURL(`https://wa.me/?text=${msg}`).catch(() =>
     Alert.alert(t('error'), t('somethingWrong'))
   );
 };

 const handleDeleteService = (item: PickerItem) => {
   Alert.alert(t('deleteService'), `${t('confirmDelete')} — "${item.label}"`, [
     { text: t('cancel'), style: 'cancel' },
     {
       text: t('delete'), style: 'destructive',
       onPress: async () => {
         await supabase.from('services').delete().eq('id', item.id);
         setServices((prev) => prev.filter((sv) => sv.id !== item.id));
         if (selectedService?.id === item.id) {
           setSelectedService(null);
           setRouteStops([]);
         }
       },
     },
   ]);
 };

 const handleDeleteStage = (item: PickerItem) => {
   Alert.alert(t('deleteStage'), `${t('confirmDelete')} — "${item.label}"`, [
     { text: t('cancel'), style: 'cancel' },
     {
       text: t('delete'), style: 'destructive',
       onPress: async () => {
         await supabase.from('ministries').delete().eq('id', item.id);
         setStages((prev) => prev.filter((m) => m.id !== item.id));
         setRouteStops((prev) => prev.filter((m) => m.id !== item.id));
       },
     },
   ]);
 };


 const handleDeleteClient = (item: PickerItem) => {
   Alert.alert(
     t('delete') + ' ' + t('clients'),
     `${t('confirmDelete')} — "${item.label}"? ${t('cannotUndo')}`,
     [
       { text: t('cancel'), style: 'cancel' },
       {
         text: t('delete'), style: 'destructive',
         onPress: async () => {
           await supabase.from('clients').delete().eq('id', item.id);
           setClients((prev) => prev.filter((c) => c.id !== item.id));
           if (selectedClient?.id === item.id) setSelectedClient(null);
         },
       },
     ]
   );
 };

 const loadData = async () => {
 const orgId = teamMember?.org_id ?? '';
 if (!orgId) return;
 const [c, sv, m, tm, ci, asgn] = await Promise.all([
 supabase.from('clients').select('*').eq('org_id', orgId).order('name'),
 supabase.from('services').select('*').eq('org_id', orgId).order('name'),
 supabase.from('ministries').select('*, city:cities(id,name)').eq('org_id', orgId).eq('type', 'parent').order('name'),
 supabase.from('team_members').select('*').eq('org_id', orgId).is('deleted_at', null).order('name'),
 supabase.from('cities').select('*').eq('org_id', orgId).order('name'),
 supabase.from('assignees').select('*').eq('org_id', orgId).order('name'),
 ]);
 if (c.data) {
   setClients(c.data as Client[]);
   // Pre-select client if navigated from ClientProfile
   const preId = route.params?.preselectedClientId;
   if (preId) {
     const match = (c.data as Client[]).find((cl) => cl.id === preId);
     if (match) setSelectedClient(match);
   }
 }
 if (sv.data) setServices(sv.data as Service[]);
 if (m.data) setStages(m.data as Ministry[]);
 if (tm.data) setTeamMembers(tm.data as TeamMember[]);
 if (ci.data) setAllCities(ci.data as City[]);
 if (asgn.data) setAllAssignees(asgn.data);
 };

 const toggleStage = (stage: Ministry) => {
   if (routeStops.find((r) => r.id === stage.id)) {
     setRouteStops((prev) => prev.filter((r) => r.id !== stage.id));
   } else {
     setRouteStops((prev) => [...prev, stage]);
     // Auto-populate city from ministry's default if it has one and isn't already set
     if (stage.city_id && (stage as any).city?.name) {
       setStageCityMap(prev => ({
         ...prev,
         [stage.id]: prev[stage.id] ?? { cityId: stage.city_id!, cityName: (stage as any).city!.name },
       }));
     }
   }
 };

 const removeRouteStop = (stageId: string) => {
 setRouteStops((prev) => prev.filter((r) => r.id !== stageId));
 };

 const moveStop = (index: number, dir: -1 | 1) => {
 const newRoute = [...routeStops];
 const target = index + dir;
 if (target < 0 || target >= newRoute.length) return;
 [newRoute[index], newRoute[target]] = [newRoute[target], newRoute[index]];
 setRouteStops(newRoute);
 };

 // ─── Create custom field definition on the fly ───────────────
 const handleCreateCustomField = async () => {
 if (!newFieldLabel.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }
 const needsOptions = ['select', 'multiselect'].includes(newFieldType);
 if (needsOptions && !newFieldOptions.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }
 setSavingNewField(true);
 const options = needsOptions
 ? newFieldOptions.split(',').map((o) => o.trim()).filter(Boolean)
 : null;
 const fieldKey = newFieldLabel.toLowerCase().trim()
 .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
 const { data, error } = await supabase
 .from('client_field_definitions')
 .insert({
 label: newFieldLabel.trim(),
 field_key: fieldKey,
 field_type: newFieldType,
 is_required: newFieldRequired,
 is_active: true,
 options: options ? JSON.stringify(options) : null,
 sort_order: 999,
 org_id: teamMember?.org_id ?? null,
 })
 .select()
 .single();
 setSavingNewField(false);
 if (error) { Alert.alert(t('error'), error.message); return; }
 await reloadFieldDefs();
 setActiveFieldIds((prev) => [...prev, data.id]);
 setNewFieldLabel('');
 setNewFieldType('text');
 setNewFieldOptions('');
 setNewFieldRequired(false);
 setShowCreateField(false);
 setShowFieldPicker(false);
 };

 const handleCreateClient = async () => {
 if (!newClientName.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }

 // Duplicate check
 const fullPhone = newClientPhone.trim() ? `${newClientPhoneCountry}${newClientPhone.trim()}` : '';
 const orFilters: string[] = [`name.ilike.${newClientName.trim()}`];
 if (fullPhone) orFilters.push(`phone.eq.${fullPhone}`);
 const { data: existing } = await supabase
   .from('clients')
   .select('id, name, phone, client_id')
   .eq('org_id', teamMember?.org_id ?? '')
   .or(orFilters.join(','))
   .limit(1)
   .maybeSingle();

 if (existing) {
   const reason = (existing as any).name?.toLowerCase() === newClientName.trim().toLowerCase()
     ? `name "${(existing as any).name}"`
     : `phone "${(existing as any).phone}"`;
   Alert.alert(
     t('duplicateClient'),
     `A client already exists with this ${reason} (${(existing as any).client_id}).\n\nCreate anyway?`,
     [
       { text: t('cancel'), style: 'cancel' },
       { text: t('createAnyway'), onPress: () => doCreateClient() },
     ]
   );
   return;
 }
 doCreateClient();
 };

 const doCreateClient = async () => {
 const autoId = `CLT-${Date.now()}`;
 const fullPhone    = newClientPhone.trim()    ? `${newClientPhoneCountry}${newClientPhone.trim()}`       : null;
 const fullRefPhone = newClientRefPhone.trim() ? `${newClientRefPhoneCountry}${newClientRefPhone.trim()}` : null;
 const { data, error } = await supabase
 .from('clients')
 .insert({
 name: newClientName.trim(),
 client_id: autoId,
 phone: fullPhone,
 reference_name: newClientRefName.trim() || null,
 reference_phone: fullRefPhone,
 org_id: teamMember?.org_id ?? null,
 })
 .select()
 .single();
 if (error) { Alert.alert(t('error'), error.message); return; }
 const c = data as Client;

 // Save custom field values
 const fieldEntries = Object.values(customFieldValues).filter((v) =>
 v.value_text != null || v.value_number != null ||
 v.value_boolean != null || v.value_json != null
 );
 if (fieldEntries.length > 0) {
 await supabase.from('client_field_values').insert(
 fieldEntries.map((v) => ({ client_id: c.id, ...v }))
 );
 }

 setClients((prev) => [...prev, c]);
 setSelectedClient(c);
 setShowNewClientForm(false);
 setNewClientName('');
 setNewClientPhone('');
 setNewClientPhoneCountry(DEFAULT_COUNTRY.code);
 setNewClientRefName('');
 setNewClientRefPhone('');
 setNewClientRefPhoneCountry(DEFAULT_COUNTRY.code);
 setCustomFieldValues({});
 setActiveFieldIds([]);
 };

 const handleCreateService = async () => {
   if (!newServiceName.trim()) {
     Alert.alert(t('required'), t('fieldRequired'));
     return;
   }
   // Duplicate check (case-insensitive, scoped to current org)
   const { data: dupSvc } = await supabase
     .from('services')
     .select('id, name')
     .eq('org_id', teamMember?.org_id ?? '')
     .ilike('name', newServiceName.trim())
     .limit(1)
     .maybeSingle();
   if (dupSvc) {
     Alert.alert(
       `${t('duplicate')} ${t('service')}`,
       `A service named "${(dupSvc as any).name}" already exists.\n\nCreate anyway?`,
       [
         { text: t('cancel'), style: 'cancel' },
         { text: t('createAnyway'), onPress: () => doCreateService() },
       ],
     );
     return;
   }
   doCreateService();
 };

 const doCreateService = async () => {
   setSavingService(true);
   const { data, error } = await supabase
     .from('services')
     .insert({ name: newServiceName.trim(), estimated_duration_days: 0, org_id: teamMember?.org_id ?? null })
     .select()
     .single();
   if (error) { Alert.alert(t('error'), error.message); setSavingService(false); return; }
   const sv = data as Service;
   // Create ministries + link as default stages — silently reuse existing
   // ministries (same name in this org) instead of creating duplicates.
   const stageMinistries: Ministry[] = [];
   const cityMapForRouteStops: Record<string, { cityId: string; cityName: string } | null> = {};
   const pendingInput = newServiceStageInput.trim();
   const drafts: Array<{ name: string; cityId?: string; cityName?: string }> = [
     ...newServiceStages.filter((d) => d.name.trim()),
     ...(pendingInput ? [{ name: pendingInput }] : []),
   ];
   for (let i = 0; i < drafts.length; i++) {
     const draft = drafts[i];
     // Look up existing parent ministry with same name in this org
     const { data: existing } = await supabase
       .from('ministries')
       .select('*, city:cities(id,name)')
       .eq('org_id', teamMember?.org_id ?? '')
       .eq('type', 'parent')
       .ilike('name', draft.name)
       .limit(1)
       .maybeSingle();
     let ministry: Ministry | null = (existing as Ministry) ?? null;
     if (!ministry) {
       // New ministry — include the chosen city as the default
       const { data: mData } = await supabase
         .from('ministries')
         .insert({
           name:    draft.name,
           type:    'parent',
           org_id:  teamMember?.org_id ?? null,
           city_id: draft.cityId ?? null,
         })
         .select('*, city:cities(id,name)')
         .single();
       ministry = (mData as Ministry) ?? null;
     }
     if (ministry) {
       await supabase.from('service_default_stages').insert({
         service_id: sv.id, ministry_id: ministry.id, stop_order: i + 1,
       });
       stageMinistries.push(ministry);
       // Pre-populate the per-stage city map for this file from either the
       // draft's chosen city OR the existing ministry's default city
       const cityId = draft.cityId ?? ministry.city_id;
       const cityName = draft.cityName ?? (ministry as any).city?.name;
       if (cityId && cityName) {
         cityMapForRouteStops[ministry.id] = { cityId, cityName };
       }
     }
   }
   setSavingService(false);
   setServices((prev) => [...prev, sv]);
   setSelectedService(sv);
   setRouteStops(stageMinistries);
   setStageCityMap((prev) => ({ ...prev, ...cityMapForRouteStops }));
   // Merge into stages cache without creating UI duplicates
   setStages((prev) => {
     const seen = new Set(prev.map(s => s.id));
     return [...prev, ...stageMinistries.filter(s => !seen.has(s.id))];
   });
   setShowNewServiceForm(false);
   setNewServiceName('');
   setNewServiceStages([]);
   setNewServiceStageInput('');
   setExpandedSvcStageIdx(null);
   setSvcStageCitySearch('');
   setSvcStageCreateOpen(false);
   setSvcStageNewCityName('');
 };

 const handleCreateStage = async () => {
 if (!newStageName.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }
 // Duplicate check
 const { data: dupStage } = await supabase
   .from('ministries')
   .select('id, name')
   .eq('org_id', teamMember?.org_id ?? '')
   .eq('type', 'parent')
   .ilike('name', newStageName.trim())
   .limit(1)
   .maybeSingle();
 if (dupStage) {
   Alert.alert(
     `${t('duplicate')} ${t('stage')}`,
     `A stage named "${(dupStage as any).name}" already exists.\n\nCreate anyway?`,
     [
       { text: t('cancel'), style: 'cancel' },
       { text: t('createAnyway'), onPress: () => doCreateStage() },
     ],
   );
   return;
 }
 doCreateStage();
 };

 const doCreateStage = async () => {
 setSavingStage(true);
 const { data, error } = await supabase
 .from('ministries')
 .insert({ name: newStageName.trim(), type: 'parent', org_id: teamMember?.org_id ?? null })
 .select()
 .single();
 setSavingStage(false);
 if (error) { Alert.alert(t('error'), error.message); return; }
 const stage = data as Ministry;
 setStages((prev) => [...prev, stage]);
 setRouteStops((prev) => {
   const next = [...prev, stage];
   // Save as default stage for current service
   if (selectedService) {
     supabase.from('service_default_stages').insert({
       service_id: selectedService.id,
       ministry_id: stage.id,
       stop_order: next.length,
     }).then(() => {});
   }
   return next;
 });
 setShowNewStageForm(false);
 setNewStageName('');
 };

 const handleRenameStage = async () => {
 if (!editingStageName.trim() || editingStageIdx === null) return;
 const stage = routeStops[editingStageIdx];
 setSavingStageRename(true);
 const { error } = await supabase
   .from('ministries')
   .update({ name: editingStageName.trim() })
   .eq('id', stage.id);
 setSavingStageRename(false);
 if (error) { Alert.alert(t('error'), error.message); return; }
 const newName = editingStageName.trim();
 setRouteStops((prev) => prev.map((s, i) => i === editingStageIdx ? { ...s, name: newName } : s));
 setStages((prev) => prev.map((s) => s.id === stage.id ? { ...s, name: newName } : s));
 setEditingStageIdx(null);
 setEditingStageName('');
 };

 const validate = (): string | null => {
 if (!selectedClient) return t('pickClient');
 if (!selectedService) return t('pickService');
 if (routeStops.length === 0) return t('noStagesAddFirst');
 if (dueDate.trim()) {
 const iso = toISO(dueDate);
 if (!iso) return t('invalidPhone'); // reuse generic invalid msg
 }
 return null;
 };

 const handleSave = async () => {
 const err = validate();
 if (err) { Alert.alert(t('warning'), err); return; }

 const dueDateISO = dueDate.trim() ? toISO(dueDate) : null;

 setSaving(true);
 try {
 const { data: taskData, error: taskErr } = await supabase
 .from('tasks')
 .insert({
 client_id: selectedClient!.id,
 service_id: selectedService!.id,
 current_status: 'Submitted',
 due_date: dueDateISO,
 notes: notes.trim() || null,
 price_usd: (selectedService as any).base_price_usd ?? 0,
 price_lbp: (selectedService as any).base_price_lbp ?? 0,
 created_at: createdAt.toISOString(),
 updated_at: createdAt.toISOString(),
 org_id: teamMember?.org_id ?? null,
 assigned_to: teamMember?.id ?? null,
 })
 .select()
 .single();

 if (taskErr) throw taskErr;

 const stops = routeStops.map((m, idx) => ({
 task_id: taskData.id,
 ministry_id: m.id,
 stop_order: idx + 1,
 status: 'Pending',
 city_id: stageCityMap[m.id]?.cityId ?? null,
 assigned_to: stageAssigneeMap[m.id]?.isExt === false ? (stageAssigneeMap[m.id]?.id ?? null) : null,
 ext_assignee_id: stageAssigneeMap[m.id]?.isExt === true ? (stageAssigneeMap[m.id]?.id ?? null) : null,
 }));

 const { error: stopsErr } = await supabase.from('task_route_stops').insert(stops);
 if (stopsErr) throw stopsErr;

 // Auto-append the final closure stage (always last)
 const { data: existingFinalMin } = await supabase
   .from('ministries')
   .select('id')
   .eq('name', FINAL_STAGE_NAME)
   .maybeSingle();
 let finalMinistryId = existingFinalMin?.id ?? null;
 if (!finalMinistryId) {
   const { data: newMin, error: minErr } = await supabase
     .from('ministries')
     .insert({ name: FINAL_STAGE_NAME, type: 'parent', org_id: teamMember?.org_id ?? null })
     .select()
     .single();
   if (minErr) throw minErr;
   finalMinistryId = newMin.id;
 }
 await supabase.from('task_route_stops').insert({
   task_id: taskData.id,
   ministry_id: finalMinistryId,
   stop_order: stops.length + 1,
   status: 'Pending',
 });

 await supabase.from('status_updates').insert({
 task_id: taskData.id,
 updated_by: teamMember?.id,
 new_status: 'Submitted',
 });

 Alert.alert(t('success'), t('savedSuccess'), [
 { text: t('ok'), onPress: () => navigation.goBack() },
 ]);
 } catch (e: unknown) {
 Alert.alert(t('error'), (e as Error).message ?? t('failedToSave'));
 } finally {
 setSaving(false);
 }
 };

 return (
 <SafeAreaView style={s.safe} edges={['bottom']}>
 <KeyboardAwareScrollView
   contentContainerStyle={s.container}
   keyboardShouldPersistTaps="handled"
   enableOnAndroid={true}
   enableAutomaticScroll={true}
   enableResetScrollToCoords={false}
   extraScrollHeight={120}
   extraHeight={120}
 >

 {/* ── CLIENT ── */}
 <View style={s.section}>
 <Text style={s.sectionTitle}>{t('clients').toUpperCase()}</Text>
 <FieldRow
 label={t('clients')}
 value={selectedClient ? selectedClient.name : ''}
 onPress={() => setModal('client')}
 />
 <TouchableOpacity
 style={s.addInlineBtn}
 onPress={() => setShowNewClientForm((v) => !v)}
 >
 <Text style={s.addInlineBtnText}>
 {showNewClientForm ? `− ${t('cancel')}` : t('createNewClient')}
 </Text>
 </TouchableOpacity>
 {showNewClientForm && (
 <View style={s.inlineForm}>
 <TextInput
 style={s.inlineInput}
 value={newClientName}
 onChangeText={setNewClientName}
 placeholder={t('fullNameRequired')}
 placeholderTextColor={theme.color.textMuted}
 />
 <PhoneInput
 value={newClientPhone}
 onChangeText={setNewClientPhone}
 countryCode={newClientPhoneCountry}
 onCountryChange={(c) => setNewClientPhoneCountry(c.code)}
 placeholder={t('phoneNumber')}
 style={{ marginBottom: 10 }}
 />
 <TextInput
 style={s.inlineInput}
 value={newClientRefName}
 onChangeText={setNewClientRefName}
 placeholder={t('referenceName')}
 placeholderTextColor={theme.color.textMuted}
 />
 <PhoneInput
 value={newClientRefPhone}
 onChangeText={setNewClientRefPhone}
 countryCode={newClientRefPhoneCountry}
 onCountryChange={(c) => setNewClientRefPhoneCountry(c.code)}
 placeholder={t('referencePhone')}
 style={{ marginBottom: 10 }}
 />
 {/* Active custom fields — only ones user added */}
 {activeFieldIds.length > 0 && (
 <View style={s.activeFieldsContainer}>
 {activeFieldIds.map((fieldId) => {
 const def = allFieldDefs.find((f) => f.id === fieldId);
 if (!def) return null;
 const val = customFieldValues[fieldId];
 return (
 <View key={fieldId} style={s.activeFieldRow}>
 <View style={s.activeFieldHeader}>
 <Text style={s.activeFieldLabel}>{def.label}</Text>
 <TouchableOpacity
 onPress={() => {
 setActiveFieldIds((prev) => prev.filter((id) => id !== fieldId));
 setCustomFieldValues((prev) => {
 const copy = { ...prev };
 delete copy[fieldId];
 return copy;
 });
 }}
 >
 <Text style={s.activeFieldRemove}>✕</Text>
 </TouchableOpacity>
 </View>
 <DynamicFieldInput
 definition={def}
 value={val}
 onChange={(v) =>
 setCustomFieldValues((prev) => ({ ...prev, [fieldId]: v }))
 }
 />
 </View>
 );
 })}
 </View>
 )}

 {/* + Add Field button */}
 <TouchableOpacity
 style={s.addFieldBtn}
 onPress={() => setShowFieldPicker(true)}
 >
 <Text style={s.addFieldBtnText}>+ Add Field</Text>
 </TouchableOpacity>

 <TouchableOpacity style={s.inlineSaveBtn} onPress={handleCreateClient}>
 <Text style={s.inlineSaveBtnText}>{t('save')}</Text>
 </TouchableOpacity>
 </View>
 )}
 </View>

 {/* ── SERVICE ── */}
 <View style={s.section}>
 <Text style={s.sectionTitle}>{t('services').toUpperCase()}</Text>
 <FieldRow
 label={t('services')}
 value={selectedService?.name ?? ''}
 onPress={() => setModal('service')}
 />
 {selectedService && (
 <Text style={s.hint}>Est. {selectedService.estimated_duration_days} days</Text>
 )}
 {selectedService && (
   <TouchableOpacity
     style={s.docsSheetBtn}
     onPress={() => { setShowDocSheet(true); loadServiceDocsForSheet(selectedService.id); }}
     activeOpacity={0.75}
   >
     <Text style={s.docsSheetBtnText}>📋 {t('requiredDocs')}</Text>
   </TouchableOpacity>
 )}
 <TouchableOpacity
 style={s.addInlineBtn}
 onPress={() => setShowNewServiceForm((v) => !v)}
 >
 <Text style={s.addInlineBtnText}>
 {showNewServiceForm ? `− ${t('cancel')}` : `${t('add')} ${t('service')}`}
 </Text>
 </TouchableOpacity>
 {showNewServiceForm && (
 <View style={s.inlineForm}>
   <TextInput
     style={s.inlineInput}
     value={newServiceName}
     onChangeText={setNewServiceName}
     placeholder={`${t('serviceName')} *`}
     placeholderTextColor={theme.color.textMuted}
     autoFocus
   />
   {/* Stages builder */}
   {newServiceStages.length > 0 && (
     <View style={s.newSvcStageList}>
       {newServiceStages.map((draft, idx) => (
         <View key={idx}>
           <View style={s.newSvcStageRow}>
             <View style={s.stageIndex}>
               <Text style={s.stageIndexText}>{idx + 1}</Text>
             </View>
             <View style={{ flex: 1 }}>
               <Text style={s.newSvcStageName} numberOfLines={1}>{draft.name}</Text>
               <TouchableOpacity
                 onPress={() => {
                   setExpandedSvcStageIdx(expandedSvcStageIdx === idx ? null : idx);
                   setSvcStageCitySearch('');
                   setSvcStageCreateOpen(false);
                   setSvcStageNewCityName('');
                 }}
               >
                 <Text style={{ fontSize: 11, color: draft.cityName ? theme.color.primary : theme.color.textMuted, marginTop: 2, fontWeight: draft.cityName ? '600' : '400' }}>
                   {draft.cityName ? `📍 ${draft.cityName}` : '📍 Tap to set city'}
                 </Text>
               </TouchableOpacity>
             </View>
             <TouchableOpacity onPress={() => {
               setNewServiceStages((prev) => prev.filter((_, i) => i !== idx));
               if (expandedSvcStageIdx === idx) setExpandedSvcStageIdx(null);
             }}>
               <Text style={s.stageRemove}>✕</Text>
             </TouchableOpacity>
           </View>

           {/* Inline city picker for this draft stage */}
           {expandedSvcStageIdx === idx && (
             <View style={s.stageDetailPanel}>
               <TextInput
                 style={s.stageDetailSearch}
                 value={svcStageCitySearch}
                 onChangeText={setSvcStageCitySearch}
                 placeholder={t('searchCity')}
                 placeholderTextColor={theme.color.textMuted}
               />
               {draft.cityId && (
                 <TouchableOpacity onPress={() => setDraftStageCity(idx, null)}>
                   <Text style={{ color: theme.color.danger, padding: 8, fontSize: 13 }}>✕ Remove city</Text>
                 </TouchableOpacity>
               )}
               {allCities
                 .filter(c => !svcStageCitySearch.trim() || c.name.includes(svcStageCitySearch.trim()))
                 .slice(0, 10)
                 .map(c => (
                   <TouchableOpacity
                     key={c.id}
                     style={[s.stageDetailItem, draft.cityId === c.id && s.stageDetailItemActive]}
                     onPress={() => { setDraftStageCity(idx, { id: c.id, name: c.name }); setSvcStageCitySearch(''); }}
                   >
                     <Text style={s.stageDetailItemText}>{c.name}</Text>
                     {draft.cityId === c.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                   </TouchableOpacity>
                 ))}
               {/* Create new city for this draft */}
               {!svcStageCreateOpen ? (
                 <TouchableOpacity
                   style={s.inlineCreateBtn}
                   onPress={() => {
                     setSvcStageCreateOpen(true);
                     if (svcStageCitySearch.trim()) setSvcStageNewCityName(svcStageCitySearch.trim());
                   }}
                 >
                   <Text style={s.inlineCreateBtnText}>＋ Create new city</Text>
                 </TouchableOpacity>
               ) : (
                 <View style={s.inlineCreateForm}>
                   <TextInput
                     style={s.inlineCreateInput}
                     value={svcStageNewCityName}
                     onChangeText={setSvcStageNewCityName}
                     placeholder={t('city')}
                     placeholderTextColor={theme.color.textMuted}
                     autoFocus
                   />
                   <View style={s.inlineCreateActions}>
                     <TouchableOpacity
                       style={s.inlineCancelBtn}
                       onPress={() => { setSvcStageCreateOpen(false); setSvcStageNewCityName(''); }}
                     >
                       <Text style={s.inlineCancelBtnText}>{t('cancel')}</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                       style={[s.inlineSaveBtn, svcStageSavingCity && { opacity: 0.6 }]}
                       disabled={svcStageSavingCity}
                       onPress={() => createCityForDraftStage(idx)}
                     >
                       <Text style={s.inlineSaveBtnText}>{svcStageSavingCity ? t('pleaseWait') : t('save')}</Text>
                     </TouchableOpacity>
                   </View>
                 </View>
               )}

               <TouchableOpacity
                 style={s.stageDetailSaveBtn}
                 onPress={() => {
                   setExpandedSvcStageIdx(null);
                   setSvcStageCitySearch('');
                   setSvcStageCreateOpen(false);
                   setSvcStageNewCityName('');
                 }}
               >
                 <Text style={s.stageDetailSaveBtnText}>✓ Done</Text>
               </TouchableOpacity>
             </View>
           )}
         </View>
       ))}
     </View>
   )}
   <View style={s.newSvcAddRow}>
     <TextInput
       style={[s.inlineInput, { flex: 1, marginBottom: 0 }]}
       value={newServiceStageInput}
       onChangeText={setNewServiceStageInput}
       placeholder={`+ ${t('stageName')}`}
       placeholderTextColor={theme.color.textMuted}
       onSubmitEditing={() => {
         if (newServiceStageInput.trim()) {
           setNewServiceStages((prev) => [...prev, { name: newServiceStageInput.trim() }]);
           setNewServiceStageInput('');
         }
       }}
       returnKeyType="done"
     />
     <TouchableOpacity
       style={s.newSvcPlusBtn}
       onPress={() => {
         if (newServiceStageInput.trim()) {
           setNewServiceStages((prev) => [...prev, { name: newServiceStageInput.trim() }]);
           setNewServiceStageInput('');
         }
       }}
     >
       <Text style={s.newSvcPlusBtnText}>+</Text>
     </TouchableOpacity>
   </View>
   <TouchableOpacity
     style={[s.inlineSaveBtn, savingService && s.disabled]}
     onPress={handleCreateService}
     disabled={savingService}
   >
     {savingService
       ? <ActivityIndicator color={theme.color.white} size="small" />
       : <Text style={s.inlineSaveBtnText}>{t('save')}</Text>}
   </TouchableOpacity>
 </View>
 )}
 </View>

 {/* ── STAGES — appears after service is selected ── */}
 {selectedService && (
 <View style={s.section}>
 <Text style={s.sectionTitle}>{t('stagesSection').toUpperCase()}</Text>
 {routeStops.length === 0 && (
   <Text style={s.hint}>No default stages for this service. Add stages below.</Text>
 )}

 {routeStops.length > 0 && (
 <View style={s.selectedStages}>
 {routeStops.map((stage, idx) => (
 <View key={stage.id} style={s.stageRow}>
   <View style={s.stageIndex}>
     <Text style={s.stageIndexText}>{idx + 1}</Text>
   </View>
   <View style={{ flex: 1 }}>
     {/* Stage name row */}
     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
       {editingStageIdx === idx ? (
         <TextInput
           style={[s.inlineInput, { flex: 1, marginVertical: 0, paddingVertical: 6 }]}
           value={editingStageName}
           onChangeText={setEditingStageName}
           autoFocus
           onSubmitEditing={handleRenameStage}
           returnKeyType="done"
         />
       ) : (
         <TouchableOpacity
           style={{ flex: 1 }}
           onPress={() => {
             setOpenStageDetailId(v => v === stage.id ? null : stage.id);
             setStageCitySearch('');
             setStageAssigneeSearch('');
             setStageDetailTab('city');
           }}
           activeOpacity={0.7}
         >
           <Text style={s.stageName} numberOfLines={1}>{stage.name}</Text>
           {/* Show the discovery hint only when nothing is set yet — once a city or assignee
               is picked, those values appear in the picker (with ✓), so we don't duplicate
               them under the stage name. */}
           {!stageCityMap[stage.id] && !stageAssigneeMap[stage.id] && (
             <Text style={{ fontSize: 11, color: theme.color.textMuted, marginTop: 2 }}>
               📍 tap to set city & assignee
             </Text>
           )}
         </TouchableOpacity>
       )}
       <View style={s.stageActions}>
         {editingStageIdx === idx ? (
           <>
             <TouchableOpacity onPress={handleRenameStage} disabled={savingStageRename}>
               {savingStageRename
                 ? <ActivityIndicator size="small" color={theme.color.success} />
                 : <Text style={s.stageRenameConfirm}>✓</Text>}
             </TouchableOpacity>
             <TouchableOpacity onPress={() => setEditingStageIdx(null)}>
               <Text style={s.stageRemove}>✕</Text>
             </TouchableOpacity>
           </>
         ) : (
           <>
             <TouchableOpacity onPress={() => { setEditingStageIdx(idx); setEditingStageName(stage.name); }}>
               <Text style={s.stageEdit}>✎</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => moveStop(idx, -1)} disabled={idx === 0}>
               <Text style={[s.stageArrow, idx === 0 && s.disabled]}>↑</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => moveStop(idx, 1)} disabled={idx === routeStops.length - 1}>
               <Text style={[s.stageArrow, idx === routeStops.length - 1 && s.disabled]}>↓</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => removeRouteStop(stage.id)}>
               <Text style={s.stageRemove}>✕</Text>
             </TouchableOpacity>
           </>
         )}
       </View>
     </View>

     {/* Inline city + assignee picker */}
     {openStageDetailId === stage.id && (
       <View style={s.stageDetailPanel}>
         {/* Tab selector */}
         <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
           <TouchableOpacity
             style={[s.stageDetailTab, stageDetailTab === 'city' && s.stageDetailTabActive]}
             onPress={() => setStageDetailTab('city')}
           >
             <Text style={[s.stageDetailTabText, stageDetailTab === 'city' && { color: theme.color.primary }]}>
               📍 City
             </Text>
           </TouchableOpacity>
           <TouchableOpacity
             style={[s.stageDetailTab, stageDetailTab === 'assignee' && s.stageDetailTabActive]}
             onPress={() => setStageDetailTab('assignee')}
           >
             <Text style={[s.stageDetailTabText, stageDetailTab === 'assignee' && { color: theme.color.primary }]}>
               👤 Assignee
             </Text>
           </TouchableOpacity>
         </View>

         {stageDetailTab === 'city' && (
           <>
             <TextInput
               style={s.stageDetailSearch}
               value={stageCitySearch}
               onChangeText={setStageCitySearch}
               placeholder={t('searchCity')}
               placeholderTextColor={theme.color.textMuted}
             />
             <View>
               {stageCityMap[stage.id] && (
                 <TouchableOpacity onPress={() => persistStageCity(stage.id, null)}>
                   <Text style={{ color: theme.color.danger, padding: 8, fontSize: 13 }}>✕ Remove city</Text>
                 </TouchableOpacity>
               )}
               {allCities
                 .filter(c => !stageCitySearch.trim() || c.name.includes(stageCitySearch.trim()))
                 .slice(0, 10)
                 .map(c => (
                   <TouchableOpacity
                     key={c.id}
                     style={[s.stageDetailItem, stageCityMap[stage.id]?.cityId === c.id && s.stageDetailItemActive]}
                     onPress={() => { persistStageCity(stage.id, { cityId: c.id, cityName: c.name }); setStageCitySearch(''); }}
                   >
                     <Text style={s.stageDetailItemText}>{c.name}</Text>
                     {stageCityMap[stage.id]?.cityId === c.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                   </TouchableOpacity>
                 ))}
               {/* Create new city */}
               {!showCreateCityForm ? (
                 <TouchableOpacity
                   style={s.inlineCreateBtn}
                   onPress={() => {
                     setShowCreateCityForm(true);
                     // Pre-fill from search if user typed something
                     if (stageCitySearch.trim()) setNewCityName(stageCitySearch.trim());
                     // Delay focus so KeyboardAwareScrollView has time to scroll
                     // the input above the keyboard before it pops up.
                     setTimeout(() => newCityInputRef.current?.focus(), 300);
                   }}
                 >
                   <Text style={s.inlineCreateBtnText}>＋ Create new city</Text>
                 </TouchableOpacity>
               ) : (
                 <View style={s.inlineCreateForm}>
                   <TextInput
                     ref={newCityInputRef}
                     style={s.inlineCreateInput}
                     value={newCityName}
                     onChangeText={setNewCityName}
                     placeholder={t('city')}
                     placeholderTextColor={theme.color.textMuted}
                   />
                   <View style={s.inlineCreateActions}>
                     <TouchableOpacity
                       style={s.inlineCancelBtn}
                       onPress={() => { setShowCreateCityForm(false); setNewCityName(''); }}
                     >
                       <Text style={s.inlineCancelBtnText}>{t('cancel')}</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                       style={[s.inlineSaveBtn, savingNewCity && { opacity: 0.6 }]}
                       disabled={savingNewCity}
                       onPress={() => handleCreateCityForStage(stage.id)}
                     >
                       <Text style={s.inlineSaveBtnText}>{savingNewCity ? t('pleaseWait') : t('createAndAdd')}</Text>
                     </TouchableOpacity>
                   </View>
                 </View>
               )}
             </View>
           </>
         )}

         {stageDetailTab === 'assignee' && (
           <>
             <TextInput
               style={s.stageDetailSearch}
               value={stageAssigneeSearch}
               onChangeText={setStageAssigneeSearch}
               placeholder={t('searchMember')}
               placeholderTextColor={theme.color.textMuted}
             />
             <View>
               {stageAssigneeMap[stage.id] && (
                 <TouchableOpacity onPress={() => setStageAssigneeMap(m => ({ ...m, [stage.id]: null }))}>
                   <Text style={{ color: theme.color.danger, padding: 8, fontSize: 13 }}>{t('removeAssignment')}</Text>
                 </TouchableOpacity>
               )}
               <Text style={{ fontSize: 11, color: theme.color.textMuted, paddingHorizontal: 8, paddingTop: 4, fontWeight: '700' }}>{t('teamSectionLabel')}</Text>
               {teamMembers
                 .filter(tm => !stageAssigneeSearch.trim() || tm.name.toLowerCase().includes(stageAssigneeSearch.toLowerCase()))
                 .slice(0, 15)
                 .map(tm => (
                   <TouchableOpacity
                     key={tm.id}
                     style={[s.stageDetailItem, stageAssigneeMap[stage.id]?.id === tm.id && s.stageDetailItemActive]}
                     onPress={() => { setStageAssigneeMap(m => ({ ...m, [stage.id]: { id: tm.id, name: tm.name, isExt: false } })); setStageAssigneeSearch(''); }}
                   >
                     <Text style={s.stageDetailItemText}>{tm.name}</Text>
                     {stageAssigneeMap[stage.id]?.id === tm.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                   </TouchableOpacity>
                 ))}
               {allAssignees.length > 0 && (
                 <Text style={{ fontSize: 11, color: theme.color.textMuted, paddingHorizontal: 8, paddingTop: 8, fontWeight: '700' }}>{t('externalSectionLabel')}</Text>
               )}
               {allAssignees
                 .filter(a => !stageAssigneeSearch.trim() || a.name.toLowerCase().includes(stageAssigneeSearch.toLowerCase()))
                 .slice(0, 15)
                 .map(a => (
                   <TouchableOpacity
                     key={a.id}
                     style={[s.stageDetailItem, stageAssigneeMap[stage.id]?.id === a.id && s.stageDetailItemActive]}
                     onPress={() => { setStageAssigneeMap(m => ({ ...m, [stage.id]: { id: a.id, name: a.name, isExt: true } })); setStageAssigneeSearch(''); }}
                   >
                     <Text style={s.stageDetailItemText}>{a.name}</Text>
                     {stageAssigneeMap[stage.id]?.id === a.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                   </TouchableOpacity>
                 ))}
               {/* Create new external contact */}
               {!showCreateExtForm ? (
                 <TouchableOpacity
                   style={s.inlineCreateBtn}
                   onPress={() => {
                     setShowCreateExtForm(true);
                     if (stageAssigneeSearch.trim()) setNewExtName(stageAssigneeSearch.trim());
                     // Delay focus so KeyboardAwareScrollView can scroll the input above the keyboard
                     setTimeout(() => newExtNameInputRef.current?.focus(), 300);
                   }}
                 >
                   <Text style={s.inlineCreateBtnText}>＋ {t('createNewContact')}</Text>
                 </TouchableOpacity>
               ) : (
                 <View style={s.inlineCreateForm}>
                   <TextInput
                     ref={newExtNameInputRef}
                     style={s.inlineCreateInput}
                     value={newExtName}
                     onChangeText={setNewExtName}
                     placeholder={`${t('name')} *`}
                     placeholderTextColor={theme.color.textMuted}
                   />
                   <TextInput
                     style={s.inlineCreateInput}
                     value={newExtPhone}
                     onChangeText={setNewExtPhone}
                     placeholder={t('phoneNumberOpt')}
                     placeholderTextColor={theme.color.textMuted}
                     keyboardType="phone-pad"
                   />
                   <TextInput
                     style={s.inlineCreateInput}
                     value={newExtReference}
                     onChangeText={setNewExtReference}
                     placeholder={t('referenceOpt')}
                     placeholderTextColor={theme.color.textMuted}
                   />
                   <View style={s.inlineCreateActions}>
                     <TouchableOpacity
                       style={s.inlineCancelBtn}
                       onPress={() => {
                         setShowCreateExtForm(false);
                         setNewExtName(''); setNewExtPhone(''); setNewExtReference('');
                       }}
                     >
                       <Text style={s.inlineCancelBtnText}>{t('cancel')}</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                       style={[s.inlineSaveBtn, savingNewExt && { opacity: 0.6 }]}
                       disabled={savingNewExt}
                       onPress={() => handleCreateExtAssigneeForStage(stage.id)}
                     >
                       <Text style={s.inlineSaveBtnText}>{savingNewExt ? t('pleaseWait') : t('createAndAdd')}</Text>
                     </TouchableOpacity>
                   </View>
                 </View>
               )}
             </View>
           </>
         )}

         {/* Save & close — confirms current city/assignee selection and collapses the picker */}
         <TouchableOpacity
           style={s.stageDetailSaveBtn}
           onPress={() => {
             setOpenStageDetailId(null);
             setStageCitySearch('');
             setStageAssigneeSearch('');
             setShowCreateCityForm(false);
             setShowCreateExtForm(false);
           }}
         >
           <Text style={s.stageDetailSaveBtnText}>✓ {t('save')}</Text>
         </TouchableOpacity>
       </View>
     )}
   </View>
 </View>
 ))}
 </View>
 )}

 <TouchableOpacity style={s.addStopBtn} onPress={() => setModal('stage')}>
 <Text style={s.addStopBtnText}>{t('addStageBtn')}</Text>
 </TouchableOpacity>

 <TouchableOpacity
 style={s.addInlineBtn}
 onPress={() => setShowNewStageForm((v) => !v)}
 >
 <Text style={s.addInlineBtnText}>
 {showNewStageForm ? `− ${t('cancel')}` : t('createStage')}
 </Text>
 </TouchableOpacity>
 {showNewStageForm && (
 <View style={s.inlineForm}>
 <TextInput
 style={s.inlineInput}
 value={newStageName}
 onChangeText={setNewStageName}
 placeholder={`${t('stageName')} *`}
 placeholderTextColor={theme.color.textMuted}
 />
 <TouchableOpacity
 style={[s.inlineSaveBtn, savingStage && s.disabled]}
 onPress={handleCreateStage}
 disabled={savingStage}
 >
 {savingStage ? (
 <ActivityIndicator color={theme.color.white} size="small" />
 ) : (
 <Text style={s.inlineSaveBtnText}>{t('save')} & {t('addStage')}</Text>
 )}
 </TouchableOpacity>
 </View>
 )}
 </View>
 )}

 {/* ── SCHEDULE ── */}
 <View style={s.section}>
 <Text style={s.sectionTitle}>{t('scheduleLabel').toUpperCase()}</Text>

 {/* Created time — auto from device */}
 <View style={s.createdRow}>
 <Text style={s.fieldLabel}>{t('fileCreatedLabel')}</Text>
 <Text style={s.createdValue}>{createdDisplay}</Text>
 </View>

 {/* Due date — calendar or manual */}
 <Text style={s.fieldLabel}>{t('dueDate')} <Text style={s.optionalTag}>(optional)</Text></Text>
 <DatePickerField value={dueDate} onChange={setDueDate} />

 <View style={s.notesContainer}>
 <Text style={s.fieldLabel}>{t('notes')} <Text style={s.optionalTag}>(optional)</Text></Text>
 <TextInput
 style={s.notesInput}
 value={notes}
 onChangeText={setNotes}
 placeholder={t('notes')}
 placeholderTextColor={theme.color.textMuted}
 multiline
 numberOfLines={4}
 textAlignVertical="top"
 />
 </View>
 </View>

 {/* ── SUBMIT ── */}
 <TouchableOpacity
 style={[s.submitBtn, saving && s.submitBtnDisabled]}
 onPress={handleSave}
 disabled={saving}
 >
 {saving ? (
 <ActivityIndicator color={theme.color.white} />
 ) : (
 <Text style={s.submitBtnText}>{t('createFileBtn')}</Text>
 )}
 </TouchableOpacity>
 </KeyboardAwareScrollView>

 {/* ── MODALS ── */}
 <PickerModal
 visible={modal === 'client'}
 title={t('pickClient')}
 items={clients.map((c) => ({ id: c.id, label: c.name, subtitle: c.phone ?? undefined }))}
 onSelect={(item) => setSelectedClient(clients.find((c) => c.id === item.id)!)}
 onItemAction={permissions.can_edit_delete_clients ? (item) => { navigation.navigate('EditClient', { clientId: item.id }); } : undefined}
 itemActionLabel={permissions.can_edit_delete_clients ? '✎ Edit' : undefined}
 onItemDelete={permissions.can_edit_delete_clients ? handleDeleteClient : undefined}
 onClose={() => setModal(null)}
 search
 addNewLabel={t('createNewClient')}
 onAddNew={(initialName) => {
   setNewClientName(initialName ?? '');
   setNewClientPhone('');
   setNewClientPhoneCountry(DEFAULT_COUNTRY.code);
   setNewClientRefName('');
   setNewClientRefPhone('');
   setNewClientRefPhoneCountry(DEFAULT_COUNTRY.code);
   setCustomFieldValues({});
   setActiveFieldIds([]);
   setShowNewClientForm(true);
 }}
 />
 <PickerModal
 visible={modal === 'service'}
 title={t('pickService')}
 items={services.map((sv) => ({
 id: sv.id,
 label: sv.name,
 subtitle: `Est. ${sv.estimated_duration_days} days`,
 }))}
 onSelect={(item) => {
   const svc = services.find((sv) => sv.id === item.id)!;
   setSelectedService(svc);
   loadServiceDefaultStages(svc.id);
 }}
 onItemAction={permissions.can_manage_catalog ? (item) => { navigation.navigate('ServiceStages', { serviceId: item.id, serviceName: item.label }); } : undefined}
 itemActionLabel={permissions.can_manage_catalog ? '✎ Stages' : undefined}
 onItemDelete={permissions.can_manage_catalog ? handleDeleteService : undefined}
 onClose={() => setModal(null)}
 search
 />
 <PickerModal
 visible={modal === 'stage'}
 title={t('pickStage')}
 items={stages.map((m) => ({ id: m.id, label: m.name }))}
 onSelect={(item) => {
 const stage = stages.find((m) => m.id === item.id);
 if (stage) toggleStage(stage);
 }}
 onItemDelete={permissions.can_manage_catalog ? handleDeleteStage : undefined}
 onClose={() => setModal(null)}
 search
 multiSelect
 selectedIds={routeStops.map((r) => r.id)}
 />
      {/* Field picker modal */}
      {/* Field picker modal */}
      <Modal
        visible={showFieldPicker}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowFieldPicker(false); setShowCreateField(false); }}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={fp.overlay}
        >
          <View style={fp.sheet}>
            <View style={fp.header}>
              <Text style={fp.title}>{t('addField')}</Text>
              <TouchableOpacity onPress={() => { setShowFieldPicker(false); setShowCreateField(false); }}>
                <Text style={fp.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <KeyboardAwareScrollView
              keyboardShouldPersistTaps="handled"
              enableOnAndroid={true}
              enableAutomaticScroll={true}
              extraScrollHeight={60}
            >
 {/* Existing fields */}
 {allFieldDefs.filter((f) => f.is_active && !activeFieldIds.includes(f.id)).length > 0 && (
 <>
 <Text style={fp.sectionLabel}>{t('savedFieldsLabel')}</Text>
 {allFieldDefs
 .filter((f) => f.is_active && !activeFieldIds.includes(f.id))
 .map((item) => (
 <TouchableOpacity
 key={item.id}
 style={fp.option}
 onPress={() => {
 setActiveFieldIds((prev) => [...prev, item.id]);
 setShowFieldPicker(false);
 }}
 >
 <View style={fp.optionIcon}>
 <Text style={fp.optionIconText}>{FIELD_TYPE_ICONS[item.field_type] ?? '?'}</Text>
 </View>
 <View style={{ flex: 1 }}>
 <Text style={fp.optionLabel}>{item.label}</Text>
 <Text style={fp.optionType}>{item.field_type}</Text>
 </View>
 {item.is_required && <Text style={fp.required}>{t('required')}</Text>}
 <Text style={fp.optionAdd}>+</Text>
 </TouchableOpacity>
 ))}
 </>
 )}

 {/* Create new custom field */}
 <Text style={fp.sectionLabel}>{t('createField').toUpperCase()}</Text>
 <TouchableOpacity
 style={fp.createToggle}
 onPress={() => setShowCreateField((v) => !v)}
 >
 <View style={fp.optionIcon}>
 <Text style={fp.optionIconText}>✦</Text>
 </View>
 <Text style={fp.createToggleText}>
 {showCreateField ? `− ${t('cancel')}` : `+ ${t('createField')}`}
 </Text>
 </TouchableOpacity>

 {showCreateField && (
 <View style={fp.createForm}>
 {/* Label */}
 <View style={fp.createField}>
 <Text style={fp.createLabel}>{t('fieldNameLabel').toUpperCase()} *</Text>
 <TextInput
 style={fp.createInput}
 value={newFieldLabel}
 onChangeText={setNewFieldLabel}
 placeholder=""
 placeholderTextColor={theme.color.textMuted}
 />
 </View>

 {/* Type picker */}
 <View style={fp.createField}>
 <Text style={fp.createLabel}>{t('fieldTypeLabel').toUpperCase()} *</Text>
 <TouchableOpacity
 style={fp.typeSelectBtn}
 onPress={() => setShowFieldTypePicker(true)}
 >
 <Text style={fp.typeSelectIcon}>{FIELD_TYPE_ICONS[newFieldType] ?? '?'}</Text>
 <Text style={fp.typeSelectName}>
 {FIELD_TYPES_LIST.find((t) => t.key === newFieldType)?.label ?? newFieldType}
 </Text>
 <Text style={fp.typeSelectChevron}>›</Text>
 </TouchableOpacity>
 </View>

 {/* Options — only for select/multiselect */}
 {['select', 'multiselect'].includes(newFieldType) && (
 <View style={fp.createField}>
 <Text style={fp.createLabel}>{t('optionsSeparated').toUpperCase()} *</Text>
 <TextInput
 style={fp.createInput}
 value={newFieldOptions}
 onChangeText={setNewFieldOptions}
 placeholder="Option A, Option B, Option C"
 placeholderTextColor={theme.color.textMuted}
 />
 </View>
 )}

 {/* Required toggle */}
 <View style={fp.createField}>
 <View style={fp.createSwitchRow}>
 <Text style={fp.createLabel}>{t('requiredFieldLabel')}</Text>
 <Switch
 value={newFieldRequired}
 onValueChange={setNewFieldRequired}
 trackColor={{ false: theme.color.border, true: theme.color.primary }}
 thumbColor={theme.color.white}
 />
 </View>
 </View>

 <TouchableOpacity
 style={[fp.createSaveBtn, savingNewField && fp.createSaveBtnDisabled]}
 onPress={handleCreateCustomField}
 disabled={savingNewField}
 >
 {savingNewField ? (
 <ActivityIndicator color={theme.color.white} size="small" />
 ) : (
 <Text style={fp.createSaveBtnText}>{t('saveAndAddField')}</Text>
 )}
 </TouchableOpacity>
 </View>
 )}
            </KeyboardAwareScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Field type picker sub-modal */}
 <Modal
 visible={showFieldTypePicker}
 transparent
 animationType="fade"
 onRequestClose={() => setShowFieldTypePicker(false)}
 >
        <KeyboardAvoidingView
          behavior="padding"
          style={fp.overlay}
        >
          <View style={fp.sheet}>
            <View style={fp.header}>
              <Text style={fp.title}>{t('fieldTypeLabel')}</Text>
 <TouchableOpacity onPress={() => setShowFieldTypePicker(false)}>
 <Text style={fp.close}>✕</Text>
 </TouchableOpacity>
 </View>
 <ScrollView>
 {FIELD_TYPES_LIST.map((t) => (
 <TouchableOpacity
 key={t.key}
 style={[fp.option, newFieldType === t.key && fp.optionSelected]}
 onPress={() => { setNewFieldType(t.key); setShowFieldTypePicker(false); }}
 >
 <View style={fp.optionIcon}>
 <Text style={fp.optionIconText}>{t.icon}</Text>
 </View>
 <View style={{ flex: 1 }}>
 <Text style={[fp.optionLabel, newFieldType === t.key && fp.optionLabelSelected]}>
 {t.label}
 </Text>
 <Text style={fp.optionType}>{t.desc}</Text>
 </View>
 {newFieldType === t.key && <Text style={fp.optionCheck}>✓</Text>}
 </TouchableOpacity>
 ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── REQUIRED DOCS SHEET ── */}
      <Modal
        visible={showDocSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDocSheet(false)}
      >
        <View style={ds.overlay}>
          <View style={ds.sheet}>
            {/* Header */}
            <View style={ds.header}>
              <View style={{ flex: 1 }}>
                <Text style={ds.title}>📋 {t('requiredDocs')}</Text>
                {selectedService && (
                  <Text style={ds.subtitle}>{selectedService.name}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowDocSheet(false)}>
                <Text style={ds.close}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Body */}
            {loadingSheetDocs ? (
              <ActivityIndicator color={theme.color.primary} style={{ margin: 32 }} />
            ) : (
              <ScrollView
                contentContainerStyle={{ padding: theme.spacing.space3 }}
                keyboardShouldPersistTaps="handled"
              >
                {sheetDocs.length === 0 ? (
                  <Text style={ds.empty}>{t('noDocumentsForService')}</Text>
                ) : (
                  sheetDocs.map((doc: any, idx: number) => {
                    const reqs = sheetDocReqs[doc.id] ?? [];
                    const isOpen = sheetExpandedId === doc.id;
                    return (
                      <View key={doc.id} style={ds.docCard}>
                        <TouchableOpacity
                          style={ds.docRow}
                          onPress={() => setSheetExpandedId(isOpen ? null : doc.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={ds.docNum}>{idx + 1}.</Text>
                          <Text style={ds.docTitle} numberOfLines={2}>{doc.title}</Text>
                          {reqs.length > 0 && (
                            <View style={ds.badge}>
                              <Text style={ds.badgeText}>{reqs.length}</Text>
                            </View>
                          )}
                          {reqs.length > 0 && (
                            <Text style={ds.arrow}>{isOpen ? '▼' : '▶'}</Text>
                          )}
                        </TouchableOpacity>
                        {isOpen && reqs.length > 0 && (
                          <View style={ds.reqList}>
                            {reqs.map((r: any) => (
                              <View key={r.id} style={ds.reqRow}>
                                <Text style={ds.reqBullet}>•</Text>
                                <Text style={ds.reqTitle}>{r.title}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}

                {/* Add new document — inline button + form */}
                {!showAddDocForm ? (
                  <TouchableOpacity
                    style={ds.addDocBtn}
                    onPress={() => setShowAddDocForm(true)}
                  >
                    <Text style={ds.addDocBtnText}>＋ {t('addDocument')}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={ds.addDocForm}>
                    <TextInput
                      style={ds.addDocInput}
                      value={newDocTitle}
                      onChangeText={setNewDocTitle}
                      placeholder={t('documentName')}
                      placeholderTextColor={theme.color.textMuted}
                      autoFocus
                    />
                    <View style={ds.addDocActions}>
                      <TouchableOpacity
                        style={ds.addDocCancelBtn}
                        onPress={() => { setShowAddDocForm(false); setNewDocTitle(''); }}
                      >
                        <Text style={ds.addDocCancelText}>{t('cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ds.addDocSaveBtn, savingNewDoc && { opacity: 0.6 }]}
                        disabled={savingNewDoc}
                        onPress={handleAddDocFromSheet}
                      >
                        <Text style={ds.addDocSaveText}>
                          {savingNewDoc ? t('pleaseWait') : t('save')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            {/* WhatsApp share */}
            {sheetDocs.length > 0 && (
              <TouchableOpacity style={ds.waBtn} onPress={handleShareDocsWhatsApp}>
                <Text style={ds.waBtnText}>{t('whatsappShare')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
 );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  container: { padding: theme.spacing.space4, gap: theme.spacing.space2, paddingBottom: 80 },
  section: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
    marginBottom:    theme.spacing.space3,
  },
  sectionTitle: { ...theme.typography.sectionDivider, marginBottom: 4 },
  fieldRowSelected: {
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor: theme.color.bgSurface,
    borderRadius:  theme.radius.lg,
    padding:       14,
    borderWidth:   1,
    borderColor:   theme.color.primary,
    gap:           6,
  },
  fieldRowSelectedHint:  { ...theme.typography.sectionDivider, color: theme.color.primary, marginBottom: 3 },
  fieldRowSelectedValue: { color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  fieldRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.lg,
    paddingVertical:   14,
    paddingHorizontal: theme.spacing.space4,
  },
  fieldLabel:       { ...theme.typography.body, color: theme.color.white, fontWeight: '700', fontSize: 15 },
  fieldValue:       { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 2 },
  fieldValueText:   { ...theme.typography.body, color: theme.color.textPrimary, flex: 1, textAlign: 'right' },
  fieldPlaceholder: { fontSize: 17, fontWeight: '700', color: theme.color.white, flex: 1, textAlign: 'right' },
  fieldChevron:     { color: theme.color.white, fontSize: 20, fontWeight: '700' },
  hint:             { ...theme.typography.label, color: theme.color.textMuted },
  addInlineBtn:     {
    alignSelf:       'stretch',
    marginTop:       theme.spacing.space2,
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    paddingVertical: 12,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     theme.color.primary,
  },
  addInlineBtnText: { color: theme.color.primary, fontSize: 15, fontWeight: '700' },
  inlineForm: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  inlineInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    color:           theme.color.textPrimary,
    fontSize:        theme.typography.body.fontSize,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  selectedStages: { gap: 6 },
  stageRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         10,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  stageIndex: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: theme.color.primary + '33',
    justifyContent:  'center',
    alignItems:      'center',
  },
  stageIndexText:    { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  stageName:         { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  stageActions:      { flexDirection: 'row', gap: theme.spacing.space2, alignItems: 'center' },
  stageDetailPanel: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    marginTop:       theme.spacing.space2,
    borderWidth:     1,
    borderColor:     theme.color.primary + '33',
  },
  stageDetailTab: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    borderRadius: theme.radius.sm, backgroundColor: theme.color.bgSurface,
  },
  stageDetailTabActive: { backgroundColor: theme.color.primary + '22' },
  stageDetailTabText: { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '700' },
  // Save button at the bottom of the inline city/assignee picker
  stageDetailSaveBtn: {
    marginTop:       theme.spacing.space3,
    paddingVertical: 12,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.primary,
    alignItems:      'center',
  },
  stageDetailSaveBtnText: {
    color:      theme.color.white,
    fontSize:   14,
    fontWeight: '700',
  },
  stageDetailSearch: {
    backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, color: theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3, paddingVertical: theme.spacing.space2,
    fontSize: 13, marginBottom: 6,
  },
  stageDetailItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.space3, paddingVertical: theme.spacing.space2,
    borderRadius: theme.radius.sm,
  },
  stageDetailItemActive: { backgroundColor: theme.color.primary + '18' },
  stageDetailItemText: { ...theme.typography.body, color: theme.color.textPrimary },
  // Inline create-new (city / contact) inside stage city/assignee picker
  inlineCreateBtn: {
    marginTop:    theme.spacing.space2,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2 + 2,
    borderRadius:  theme.radius.md,
    borderWidth:   1,
    borderColor:   theme.color.primary,
    backgroundColor: theme.color.primary + '11',
    alignItems:    'center',
  },
  inlineCreateBtnText: {
    color:      theme.color.primary,
    fontSize:   13,
    fontWeight: '700',
  },
  inlineCreateForm: {
    marginTop:       theme.spacing.space2,
    padding:         theme.spacing.space3,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    backgroundColor: theme.color.bgSurface,
    gap:             theme.spacing.space2,
  },
  inlineCreateInput: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.sm,
    borderWidth:     1,
    borderColor:     theme.color.border,
    color:           theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    fontSize:        13,
  },
  inlineCreateActions: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    gap:            theme.spacing.space2,
    marginTop:      2,
  },
  inlineCancelBtn: {
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    borderRadius:      theme.radius.sm,
  },
  inlineCancelBtnText: {
    color:      theme.color.textSecondary,
    fontSize:   13,
    fontWeight: '600',
  },
  inlineSaveBtn: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   10,
    borderRadius:      theme.radius.md,
    backgroundColor:   theme.color.primary,
    alignItems:        'center' as const,
  },
  inlineSaveBtnText: {
    color:      theme.color.white,
    fontSize:   13,
    fontWeight: '700' as const,
  },
  stageArrow:        { color: theme.color.primary, fontSize: 18, fontWeight: '700', padding: 2 },
  stageRemove:       { color: theme.color.danger, fontSize: 16, padding: 2 },
  stageEdit:         { color: theme.color.textSecondary, fontSize: 15, padding: 2 },
  stageRenameConfirm: { color: theme.color.success, fontSize: 18, fontWeight: '700', padding: 2 },
  disabled: { opacity: 0.3 },
  addStopBtn: {
    borderWidth:     1.5,
    borderColor:     theme.color.primary + '55',
    borderStyle:     'dashed',
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
    backgroundColor: theme.color.primary + '08',
  },
  addStopBtnText: { ...theme.typography.body, color: theme.color.primary, fontWeight: '600' },
  notesContainer: { gap: theme.spacing.space2 },
  notesInput: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    color:           theme.color.textPrimary,
    fontSize:        theme.typography.body.fontSize,
    borderWidth:     1,
    borderColor:     theme.color.border,
    minHeight:       80,
  },
  submitBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       theme.spacing.space2,
  },
  submitBtnDisabled: { opacity: 0.6 },
  activeFieldsContainer: { gap: 10 },
  activeFieldRow: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         10,
    gap:             6,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  activeFieldHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   2,
  },
  activeFieldLabel:  { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '700' },
  activeFieldRemove: { color: theme.color.danger, fontSize: 16, padding: 2 },
  addFieldBtn: {
    borderWidth:     1.5,
    borderColor:     theme.color.primary + '55',
    borderStyle:     'dashed',
    borderRadius:    theme.radius.md,
    paddingVertical: 11,
    alignItems:      'center',
    backgroundColor: theme.color.primary + '08',
  },
  addFieldBtnText: { ...theme.typography.label, color: theme.color.primary, fontWeight: '700' },
  createdRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    marginBottom:      4,
  },
  createdValue:  { color: theme.color.primary, fontSize: 13, fontWeight: '700' },
  optionalTag:   { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '400' },
  submitBtnText: { color: theme.color.white, fontSize: 16, fontWeight: '700' },
  newSvcStageList: { marginBottom: theme.spacing.space2 },
  newSvcStageRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  newSvcStageName: { flex: 1, color: theme.color.textSecondary, fontSize: 13, fontWeight: '600' },
  newSvcAddRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  newSvcPlusBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    width:           40,
    height:          40,
    justifyContent:  'center',
    alignItems:      'center',
    marginStart:     theme.spacing.space2,
  },
  newSvcPlusBtnText: { color: theme.color.white, fontSize: 22, lineHeight: 26 },
  modalOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'center', padding: theme.spacing.space6 },
  editClientSheet: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    padding:         20,
    borderWidth:     1,
    borderColor:     theme.color.border,
    ...theme.shadow.modal,
  },
  editClientTitle:      { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  editClientBtns:       { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  editClientCancel:     { paddingHorizontal: theme.spacing.space4, paddingVertical: 10, marginEnd: 10 },
  editClientCancelText: { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  editClientSave: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  editClientSaveText: { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },

  // Required docs sheet button
  docsSheetBtn: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.primary + '18',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.color.primary + '44',
    marginTop: 6,
    marginBottom: 4,
  },
  docsSheetBtnText: {
    color: theme.color.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
});

// ─── Required Docs Sheet styles ───────────────────────────────
const ds = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start', paddingTop: 60 },
  sheet:     { backgroundColor: theme.color.bgSurface, borderBottomLeftRadius: theme.radius.xl, borderBottomRightRadius: theme.radius.xl, maxHeight: '75%', paddingBottom: theme.spacing.space4 },
  header:    { flexDirection: 'row', alignItems: 'flex-start', padding: theme.spacing.space4, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title:     { color: theme.color.textPrimary, fontSize: 17, fontWeight: '700' },
  subtitle:  { color: theme.color.textSecondary, fontSize: 13, marginTop: 2 },
  close:     { color: theme.color.textSecondary, fontSize: 20, padding: 4 },
  empty:     { color: theme.color.textMuted, padding: theme.spacing.space4, textAlign: 'center' },
  docCard:   { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, marginBottom: theme.spacing.space2, borderWidth: 1, borderColor: theme.color.border, overflow: 'hidden' },
  docRow:    { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.space3, gap: 8 },
  docNum:    { color: theme.color.textMuted, fontSize: 13, minWidth: 20, fontWeight: '600' },
  docTitle:  { flex: 1, color: theme.color.textPrimary, fontSize: 14, fontWeight: '600' },
  badge:     { backgroundColor: theme.color.primary + '33', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { color: theme.color.primaryText, fontSize: 10, fontWeight: '700' },
  arrow:     { color: theme.color.textMuted, fontSize: 11 },
  reqList:   { paddingHorizontal: theme.spacing.space3, paddingBottom: theme.spacing.space2, gap: 4 },
  reqRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  reqBullet: { color: theme.color.primary, fontSize: 16, lineHeight: 20 },
  reqTitle:  { flex: 1, color: theme.color.textSecondary, fontSize: 13, lineHeight: 20 },
  waBtn:     { margin: theme.spacing.space3, marginTop: theme.spacing.space2, backgroundColor: '#25D366', borderRadius: theme.radius.lg, paddingVertical: 13, alignItems: 'center' },
  waBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Inline add-document button + form (within Required Docs sheet)
  addDocBtn: {
    marginTop: theme.spacing.space2,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.primary,
    backgroundColor: theme.color.primary + '11',
    alignItems: 'center',
  },
  addDocBtnText: {
    color: theme.color.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  addDocForm: {
    marginTop: theme.spacing.space2,
    padding: theme.spacing.space3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.primary + '55',
    backgroundColor: theme.color.bgBase,
    gap: theme.spacing.space2,
  },
  addDocInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    color: theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space2 + 2,
    fontSize: 14,
  },
  addDocActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.space2,
  },
  addDocCancelBtn: {
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space2,
    borderRadius: theme.radius.sm,
  },
  addDocCancelText: {
    color: theme.color.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  addDocSaveBtn: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: theme.spacing.space2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.primary,
  },
  addDocSaveText: {
    color: theme.color.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
