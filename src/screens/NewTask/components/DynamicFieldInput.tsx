// src/screens/NewTask/components/DynamicFieldInput.tsx
//
// Renders one of 14 client-field types (text / textarea / number / currency
// / email / phone / url / date / boolean / select / multiselect / image /
// location / id_number) with type-specific input UX. Self-contained.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Switch,
  Modal, ScrollView, Alert, StyleSheet,
} from 'react-native';
import * as Location from 'expo-location';
import { theme } from '../../../theme';
import { useTranslation } from '../../../lib/i18n';
import { FieldDefinition, FieldValue } from '../../../components/ClientFieldsForm';

interface Props {
  definition: FieldDefinition;
  value?: FieldValue;
  onChange: (v: FieldValue) => void;
}

export function DynamicFieldInput({ definition, value, onChange }: Props) {
  const { t } = useTranslation();
  const [locLoading, setLocLoading] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const ft   = definition.field_type;
  const base = { field_id: definition.id };

  const textVal = value?.value_text ?? '';
  const numVal  = value?.value_number;
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
