// src/screens/EditClientScreen.tsx
// Edit client name, phone, and custom field values

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
  Switch,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { useFieldDefinitions, FieldDefinition, FieldValue } from '../components/ClientFieldsForm';
import { DashboardStackParamList } from '../types';
import PhoneInput, { DEFAULT_COUNTRY, parseStoredPhone } from '../components/PhoneInput';

type RouteType = RouteProp<DashboardStackParamList, 'EditClient'>;
type Nav = NativeStackNavigationProp<DashboardStackParamList>;

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: 'Aa', textarea: '¶', number: '123', currency: '$', email: '@', phone: '☏',
  url: '🔗', date: '📅', boolean: '✓', select: '▾', multiselect: '☑',
  image: '🖼', location: '📍', id_number: '#',
};

// ─── Single field input renderer ─────────────────────────────
function FieldInput({
  definition,
  value,
  onChange,
}: {
  definition: FieldDefinition;
  value?: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  const { t } = useTranslation();
  const [selectOpen, setSelectOpen] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const ft = definition.field_type;
  const base = { field_id: definition.id };
  const textVal = value?.value_text ?? '';
  const numVal = value?.value_number;
  const boolVal = value?.value_boolean ?? false;
  const jsonVal = value?.value_json;

  const inputStyle = fi.input;

  if (ft === 'text' || ft === 'id_number') {
    return (
      <TextInput style={inputStyle} value={textVal}
        onChangeText={(v) => onChange({ ...base, value_text: v })}
        placeholder={definition.label} placeholderTextColor={theme.color.textMuted} />
    );
  }
  if (ft === 'textarea') {
    return (
      <TextInput style={[inputStyle, fi.textarea]} value={textVal}
        onChangeText={(v) => onChange({ ...base, value_text: v })}
        placeholder={definition.label} placeholderTextColor={theme.color.textMuted}
        multiline numberOfLines={3} textAlignVertical="top" />
    );
  }
  if (ft === 'number' || ft === 'currency') {
    return (
      <TextInput style={inputStyle}
        value={numVal != null ? String(numVal) : ''}
        onChangeText={(v) => onChange({ ...base, value_number: parseFloat(v) || undefined })}
        placeholder={ft === 'currency' ? '0.00' : '0'}
        placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
    );
  }
  if (ft === 'email') {
    return (
      <TextInput style={inputStyle} value={textVal}
        onChangeText={(v) => onChange({ ...base, value_text: v })}
        placeholder="email@example.com" placeholderTextColor={theme.color.textMuted}
        keyboardType="email-address" autoCapitalize="none" />
    );
  }
  if (ft === 'phone') {
    return (
      <TextInput style={inputStyle} value={textVal}
        onChangeText={(v) => onChange({ ...base, value_text: v })}
        placeholderTextColor={theme.color.textMuted} keyboardType="phone-pad" />
    );
  }
  if (ft === 'url') {
    return (
      <TextInput style={inputStyle} value={textVal}
        onChangeText={(v) => onChange({ ...base, value_text: v })}
        placeholder="https://" placeholderTextColor={theme.color.textMuted}
        keyboardType="url" autoCapitalize="none" />
    );
  }
  if (ft === 'date') {
    return (
      <TextInput style={inputStyle} value={textVal}
        onChangeText={(v) => onChange({ ...base, value_text: v })}
        placeholder="DD/MM/YYYY" placeholderTextColor={theme.color.textMuted}
        keyboardType="decimal-pad" maxLength={10} />
    );
  }
  if (ft === 'boolean') {
    return (
      <View style={fi.boolRow}>
        <Text style={fi.boolLabel}>{boolVal ? 'Yes' : 'No'}</Text>
        <Switch value={boolVal}
          onValueChange={(v) => onChange({ ...base, value_boolean: v })}
          trackColor={{ false: theme.color.border, true: theme.color.primary }} thumbColor={theme.color.white} />
      </View>
    );
  }
  if (ft === 'select' || ft === 'multiselect') {
    const isMulti = ft === 'multiselect';
    const selected: string[] = isMulti
      ? ((jsonVal as any)?.selected ?? [])
      : (textVal ? [textVal] : []);
    const options = definition.options ?? [];
    return (
      <>
        <TouchableOpacity style={fi.selectBtn} onPress={() => setSelectOpen(true)}>
          <Text style={selected.length ? fi.selectValue : fi.selectPlaceholder}>
            {selected.length ? selected.join(', ') : 'Select...'}
          </Text>
          <Text style={fi.selectChevron}>›</Text>
        </TouchableOpacity>
        <Modal visible={selectOpen} transparent animationType="fade" onRequestClose={() => setSelectOpen(false)}>
          <TouchableOpacity style={fi.selectOverlay} activeOpacity={1} onPress={() => setSelectOpen(false)}>
            <View style={fi.selectSheet}>
              <Text style={fi.selectTitle}>{definition.label}</Text>
              {options.map((opt) => {
                const isChosen = selected.includes(opt);
                return (
                  <TouchableOpacity key={opt} style={fi.selectOption} onPress={() => {
                    if (isMulti) {
                      const next = isChosen ? selected.filter((s) => s !== opt) : [...selected, opt];
                      onChange({ ...base, value_json: { selected: next } as any });
                    } else {
                      onChange({ ...base, value_text: opt });
                      setSelectOpen(false);
                    }
                  }}>
                    <Text style={[fi.selectOptionText, isChosen && fi.selectOptionChosen]}>{opt}</Text>
                    {isChosen && <Text style={fi.selectCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              {isMulti && (
                <TouchableOpacity style={fi.selectDone} onPress={() => setSelectOpen(false)}>
                  <Text style={fi.selectDoneText}>{t('done')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }
  if (ft === 'location') {
    const loc = jsonVal as { lat: number; lng: number; address?: string } | null;
    return (
      <TouchableOpacity style={fi.locBtn} onPress={async () => {
        setLocLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocLoading(false); return; }
        const pos = await Location.getCurrentPositionAsync({});
        onChange({ ...base, value_json: { lat: pos.coords.latitude, lng: pos.coords.longitude } as any });
        setLocLoading(false);
      }}>
        {locLoading ? <ActivityIndicator size="small" color={theme.color.primary} /> : (
          <Text style={fi.locText}>{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : '📍 Capture Location'}</Text>
        )}
      </TouchableOpacity>
    );
  }
  if (ft === 'image') {
    return (
      <TouchableOpacity style={fi.imgBtn} onPress={async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ base64: false });
        if (!result.canceled && result.assets[0])
          onChange({ ...base, value_text: result.assets[0].uri });
      }}>
        <Text style={fi.imgText}>{textVal ? '🖼 Image selected' : '🖼 Choose image'}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TextInput style={inputStyle} value={textVal}
      onChangeText={(v) => onChange({ ...base, value_text: v })}
      placeholder={definition.label} placeholderTextColor={theme.color.textMuted} />
  );
}

// ─── Main screen ──────────────────────────────────────────────
export default function EditClientScreen() {
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { clientId } = route.params;

  const { fields: allFieldDefs, reload: reloadFieldDefs } = useFieldDefinitions();

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientPhoneCountry, setClientPhoneCountry] = useState(DEFAULT_COUNTRY.code);
  const [referenceName, setReferenceName] = useState('');
  const [referencePhone, setReferencePhone] = useState('');
  const [referencePhoneCountry, setReferencePhoneCountry] = useState(DEFAULT_COUNTRY.code);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Field values: Record<fieldId, FieldValue>
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({});
  // IDs of fields the user is editing (those with existing values + user-added)
  const [activeFieldIds, setActiveFieldIds] = useState<string[]>([]);
  // Tracks which field values came from DB (so we know to delete if removed)
  const [existingValueIds, setExistingValueIds] = useState<Record<string, string>>({}); // fieldId → row id

  const [showFieldPicker, setShowFieldPicker] = useState(false);
  // Create new field inline
  const [showCreateField, setShowCreateField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [savingNewField, setSavingNewField] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const FIELD_TYPES_LIST = [
    { key: 'text', label: t('fieldText') }, { key: 'textarea', label: t('fieldTextarea') },
    { key: 'number', label: t('fieldNumber') }, { key: 'currency', label: t('fieldCurrency') },
    { key: 'email', label: t('fieldEmail') }, { key: 'phone', label: t('fieldPhone') },
    { key: 'url', label: t('fieldUrl') }, { key: 'date', label: t('fieldDate') },
    { key: 'boolean', label: t('fieldBoolean') }, { key: 'select', label: t('fieldSelect') },
    { key: 'multiselect', label: t('fieldMultiselect') }, { key: 'image', label: t('fieldImage') },
    { key: 'location', label: t('fieldLocation') }, { key: 'id_number', label: t('fieldIdNumber') },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const [clientRes, valuesRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('client_field_values').select('*').eq('client_id', clientId),
    ]);
    if (clientRes.data) {
      setClientName(clientRes.data.name);
      const parsedPhone = parseStoredPhone(clientRes.data.phone);
      setClientPhone(parsedPhone.local);
      setClientPhoneCountry(parsedPhone.countryCode);
      setReferenceName(clientRes.data.reference_name ?? '');
      const parsedRef = parseStoredPhone(clientRes.data.reference_phone);
      setReferencePhone(parsedRef.local);
      setReferencePhoneCountry(parsedRef.countryCode);
    }
    if (valuesRes.data && valuesRes.data.length > 0) {
      const ids: string[] = [];
      const vals: Record<string, FieldValue> = {};
      const existingIds: Record<string, string> = {};
      for (const row of valuesRes.data) {
        ids.push(row.field_id);
        vals[row.field_id] = {
          field_id: row.field_id,
          value_text: row.value_text,
          value_number: row.value_number,
          value_boolean: row.value_boolean,
          value_json: row.value_json,
        };
        existingIds[row.field_id] = row.id;
      }
      setActiveFieldIds(ids);
      setFieldValues(vals);
      setExistingValueIds(existingIds);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!clientName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSaving(true);

    // Update client row
    const fullPhone    = clientPhone.trim()    ? `${clientPhoneCountry}${clientPhone.trim()}`         : null;
    const fullRefPhone = referencePhone.trim() ? `${referencePhoneCountry}${referencePhone.trim()}`   : null;
    const { error: clientErr } = await supabase
      .from('clients')
      .update({
        name: clientName.trim(),
        phone: fullPhone,
        reference_name: referenceName.trim() || null,
        reference_phone: fullRefPhone,
      })
      .eq('id', clientId);
    if (clientErr) { Alert.alert(t('error'), clientErr.message); setSaving(false); return; }

    // Upsert active field values
    for (const fieldId of activeFieldIds) {
      const val = fieldValues[fieldId];
      if (!val) continue;
      const existingId = existingValueIds[fieldId];
      if (existingId) {
        await supabase.from('client_field_values').update({
          value_text: val.value_text ?? null,
          value_number: val.value_number ?? null,
          value_boolean: val.value_boolean ?? null,
          value_json: val.value_json ?? null,
        }).eq('id', existingId);
      } else {
        const { data: newRow } = await supabase.from('client_field_values').insert({
          client_id: clientId,
          field_id: fieldId,
          value_text: val.value_text ?? null,
          value_number: val.value_number ?? null,
          value_boolean: val.value_boolean ?? null,
          value_json: val.value_json ?? null,
        }).select().single();
        if (newRow) setExistingValueIds((prev) => ({ ...prev, [fieldId]: newRow.id }));
      }
    }

    // Delete removed field values
    for (const fieldId of Object.keys(existingValueIds)) {
      if (!activeFieldIds.includes(fieldId)) {
        await supabase.from('client_field_values').delete().eq('id', existingValueIds[fieldId]);
      }
    }

    setSaving(false);
    navigation.goBack();
  };

  const handleCreateCustomField = async () => {
    if (!newFieldLabel.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingNewField(true);
    const slug = newFieldLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const key = `${slug || 'field'}_${Date.now()}`;
    const opts = ['select', 'multiselect'].includes(newFieldType)
      ? newFieldOptions.split(',').map((o) => o.trim()).filter(Boolean)
      : null;
    const maxOrder = allFieldDefs.reduce((mx, f) => Math.max(mx, f.sort_order), 0);
    const { data, error } = await supabase
      .from('client_field_definitions')
      .insert({
        label: newFieldLabel.trim(),
        field_key: key,
        field_type: newFieldType,
        options: opts,
        is_required: newFieldRequired,
        is_active: true,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();
    setSavingNewField(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    await reloadFieldDefs();
    setActiveFieldIds((prev) => [...prev, data.id]);
    setShowCreateField(false);
    setShowFieldPicker(false);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldOptions('');
    setNewFieldRequired(false);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.color.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={s.container}
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
      >
        {/* Client info */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>{t('clientInfo').toUpperCase()}</Text>
          <TextInput
            style={s.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder={t("fullNameRequired")}
            placeholderTextColor={theme.color.textMuted}
          />
          <PhoneInput
            value={clientPhone}
            onChangeText={setClientPhone}
            countryCode={clientPhoneCountry}
            onCountryChange={(c) => setClientPhoneCountry(c.code)}
            placeholder={t('phoneNumber')}
            style={{ marginBottom: 10 }}
          />
          <Text style={s.subsectionLabel}>{t('reference').toUpperCase()}</Text>
          <TextInput
            style={s.input}
            value={referenceName}
            onChangeText={setReferenceName}
            placeholder={t('referenceName')}
            placeholderTextColor={theme.color.textMuted}
          />
          <PhoneInput
            value={referencePhone}
            onChangeText={setReferencePhone}
            countryCode={referencePhoneCountry}
            onCountryChange={(c) => setReferencePhoneCountry(c.code)}
            placeholder={t('referencePhone')}
            style={{ marginBottom: 10 }}
          />
        </View>

        {/* Custom fields */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>{t('clientFields').toUpperCase()}</Text>

          {activeFieldIds.length === 0 && (
            <Text style={s.emptyText}>{t('noFieldsYet')}</Text>
          )}

          {activeFieldIds.map((fieldId) => {
            const def = allFieldDefs.find((f) => f.id === fieldId);
            if (!def) return null;
            return (
              <View key={fieldId} style={s.fieldBlock}>
                <View style={s.fieldHeader}>
                  <Text style={s.fieldLabel}>{def.label}</Text>
                  <TouchableOpacity onPress={() => {
                    setActiveFieldIds((prev) => prev.filter((id) => id !== fieldId));
                    setFieldValues((prev) => {
                      const copy = { ...prev };
                      delete copy[fieldId];
                      return copy;
                    });
                  }}>
                    <Text style={s.fieldRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
                <FieldInput
                  definition={def}
                  value={fieldValues[fieldId]}
                  onChange={(v) => setFieldValues((prev) => ({ ...prev, [fieldId]: v }))}
                />
              </View>
            );
          })}

          <TouchableOpacity style={s.addFieldBtn} onPress={() => setShowFieldPicker(true)}>
            <Text style={s.addFieldBtnText}>+ {t('addField')}</Text>
          </TouchableOpacity>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={theme.color.white} size="small" />
            : <Text style={s.saveBtnText}>{t('saveChanges')}</Text>}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Field picker modal */}
      <Modal
        visible={showFieldPicker}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowFieldPicker(false); setShowCreateField(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              enableOnAndroid
              enableAutomaticScroll
              extraScrollHeight={60}
            >
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

              <Text style={fp.sectionLabel}>{t('createField').toUpperCase()}</Text>
              <TouchableOpacity style={fp.createToggle} onPress={() => setShowCreateField((v) => !v)}>
                <View style={fp.optionIcon}>
                  <Text style={fp.optionIconText}>✦</Text>
                </View>
                <Text style={fp.createToggleText}>
                  {showCreateField ? '− ' + t('cancel') : '+ ' + t('createField')}
                </Text>
              </TouchableOpacity>

              {showCreateField && (
                <View style={fp.createForm}>
                  <Text style={fp.createLabel}>{t('name').toUpperCase()} *</Text>
                  <TextInput
                    style={fp.createInput}
                    value={newFieldLabel}
                    onChangeText={setNewFieldLabel}
                    placeholderTextColor={theme.color.textMuted}
                  />

                  <Text style={fp.createLabel}>{t('fieldTypeLabel').toUpperCase()} *</Text>
                  <TouchableOpacity style={fp.typeBtn} onPress={() => setShowTypePicker(true)}>
                    <Text style={fp.typeIcon}>{FIELD_TYPE_ICONS[newFieldType] ?? '?'}</Text>
                    <Text style={fp.typeName}>{FIELD_TYPES_LIST.find((t) => t.key === newFieldType)?.label ?? newFieldType}</Text>
                    <Text style={fp.typeChevron}>›</Text>
                  </TouchableOpacity>

                  {['select', 'multiselect'].includes(newFieldType) && (
                    <>
                      <Text style={fp.createLabel}>{t('options').toUpperCase()} *</Text>
                      <TextInput
                        style={fp.createInput}
                        value={newFieldOptions}
                        onChangeText={setNewFieldOptions}
                        placeholder="A, B"
                        placeholderTextColor={theme.color.textMuted}
                      />
                    </>
                  )}

                  <View style={fp.switchRow}>
                    <Text style={fp.createLabel}>{t('requiredFieldLabel')}</Text>
                    <Switch
                      value={newFieldRequired}
                      onValueChange={setNewFieldRequired}
                      trackColor={{ false: theme.color.border, true: theme.color.primary }}
                      thumbColor={theme.color.white}
                    />
                  </View>

                  <TouchableOpacity
                    style={[fp.saveBtn, savingNewField && fp.saveBtnDisabled]}
                    onPress={handleCreateCustomField}
                    disabled={savingNewField}
                  >
                    {savingNewField
                      ? <ActivityIndicator color={theme.color.white} size="small" />
                      : <Text style={fp.saveBtnText}>{t('saveAndAddField')}</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </KeyboardAwareScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Field type sub-picker */}
      <Modal visible={showTypePicker} transparent animationType="slide" onRequestClose={() => setShowTypePicker(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={fp.overlay}>
          <View style={[fp.sheet, { maxHeight: '60%' }]}>
            <View style={fp.header}>
              <Text style={fp.title}>{t('fieldTypeLabel')}</Text>
              <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                <Text style={fp.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={FIELD_TYPES_LIST}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity style={fp.option} onPress={() => { setNewFieldType(item.key); setShowTypePicker(false); }}>
                  <View style={fp.optionIcon}>
                    <Text style={fp.optionIconText}>{FIELD_TYPE_ICONS[item.key] ?? '?'}</Text>
                  </View>
                  <Text style={fp.optionLabel}>{item.label}</Text>
                  {newFieldType === item.key && <Text style={{ color: theme.color.primary, fontSize: theme.typography.body.fontSize + 4 }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Field input styles ───────────────────────────────────────
const fi = StyleSheet.create({
  input: {
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 11,
    color: theme.color.textPrimary,
    fontSize: theme.typography.body.fontSize,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  boolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  boolLabel: { color: theme.color.textSecondary, fontSize: theme.typography.body.fontSize },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  selectValue: { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize },
  selectPlaceholder: { flex: 1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  selectChevron: { color: theme.color.textMuted, fontSize: 18 },
  selectOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'center', padding: theme.spacing.space6 },
  selectSheet: { backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.xl, padding: theme.spacing.space4, borderWidth: 1, borderColor: theme.color.border },
  selectTitle: { color: theme.color.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: theme.spacing.space3 },
  selectOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  selectOptionText: { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize },
  selectOptionChosen: { color: theme.color.primaryText, fontWeight: '700' },
  selectCheck: { color: theme.color.primary, fontSize: 16 },
  selectDone: { marginTop: theme.spacing.space3, backgroundColor: theme.color.primary, borderRadius: theme.radius.md, paddingVertical: theme.spacing.space3, alignItems: 'center' },
  selectDoneText: { color: theme.color.white, fontSize: theme.typography.body.fontSize, fontWeight: '700' },
  locBtn: { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 11, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center' },
  locText: { color: theme.color.primaryText, fontSize: theme.typography.label.fontSize },
  imgBtn: { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 11, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center' },
  imgText: { color: theme.color.primaryText, fontSize: theme.typography.label.fontSize },
});

// ─── Screen styles ────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.color.bgBase },
  container: { padding: theme.spacing.space4, paddingBottom: 40 },
  card: {
    backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.space4,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: theme.spacing.space3,
  },
  sectionLabel: { ...theme.typography.sectionDivider, color: theme.color.textMuted, marginBottom: theme.spacing.space3 },
  subsectionLabel: { ...theme.typography.sectionDivider, color: theme.color.textMuted, marginBottom: 10, marginTop: 4 },
  input: {
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space3,
    color: theme.color.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: 10,
  },
  emptyText: { color: theme.color.textMuted, fontSize: theme.typography.label.fontSize, textAlign: 'center', paddingVertical: theme.spacing.space2 },
  fieldBlock: { marginBottom: 14 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fieldLabel: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize, fontWeight: '700' },
  fieldRemove: { color: theme.color.danger, fontSize: 16, padding: 2 },
  addFieldBtn: {
    borderWidth: 1.5,
    borderColor: theme.color.primary + '55',
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems: 'center',
    backgroundColor: theme.color.primary + '08',
    marginTop: 4,
  },
  addFieldBtnText: { color: theme.color.primary, fontSize: theme.typography.label.fontSize, fontWeight: '700' },
  saveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.space4,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: theme.color.white, fontSize: 16, fontWeight: '700' },
});

// ─── Field picker modal styles ────────────────────────────────
const fp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.color.bgSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: theme.spacing.space2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.space4, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  title: { color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  close: { color: theme.color.textSecondary, fontSize: 20, padding: 4 },
  sectionLabel: { ...theme.typography.sectionDivider, color: theme.color.textMuted, paddingHorizontal: theme.spacing.space4, paddingTop: 14, paddingBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.space4, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.color.bgBase },
  optionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.color.primary + '22', borderWidth: 1, borderColor: theme.color.primary + '55', justifyContent: 'center', alignItems: 'center', marginEnd: theme.spacing.space3 },
  optionIconText: { color: theme.color.primaryText, fontSize: theme.typography.body.fontSize, fontWeight: '700' },
  optionLabel: { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  optionType: { color: theme.color.textSecondary, fontSize: theme.typography.caption.fontSize },
  required: { color: theme.color.danger, fontSize: theme.typography.caption.fontSize, fontWeight: '700', marginEnd: theme.spacing.space2 },
  optionAdd: { color: theme.color.primary, fontSize: 22, fontWeight: '300' },
  createToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.space4, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.color.bgBase },
  createToggleText: { color: theme.color.primaryText, fontSize: theme.typography.body.fontSize, fontWeight: '600', flex: 1 },
  createForm: { padding: theme.spacing.space4 },
  createLabel: { ...theme.typography.sectionDivider, color: theme.color.textMuted, marginBottom: 6, marginTop: theme.spacing.space3 },
  createInput: { backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 11, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, borderWidth: 1, borderColor: theme.color.border },
  typeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.bgBase, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 11, borderWidth: 1, borderColor: theme.color.border },
  typeIcon: { color: theme.color.primaryText, fontSize: 16, marginEnd: theme.spacing.space2 },
  typeName: { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize },
  typeChevron: { color: theme.color.textMuted, fontSize: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.space3 },
  saveBtn: { backgroundColor: theme.color.primary, borderRadius: theme.radius.md + 2, paddingVertical: 14, alignItems: 'center', marginTop: theme.spacing.space4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },
});
