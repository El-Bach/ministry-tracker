// src/components/ClientFieldsForm.tsx
// Renders dynamic custom fields for client creation/editing
// Supports: text, number, email, phone, date, textarea, url, image,
//           location, boolean, select, multiselect, currency, id_number

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import SignedImage from './SignedImage';

export interface FieldDefinition {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  options?: string[];
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface FieldValue {
  field_id: string;
  value_text?: string;
  value_number?: number;
  value_boolean?: boolean;
  value_json?: Record<string, unknown>;
}

interface Props {
  values: Record<string, FieldValue>;
  onChange: (fieldId: string, value: FieldValue) => void;
}

export function useFieldDefinitions() {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const { teamMember } = useAuth();
  const orgId = teamMember?.org_id ?? '';

  const load = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('client_field_definitions')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('sort_order');
    if (data) setFields(data as FieldDefinition[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);
  return { fields, loading, reload: load };
}

// ─── Individual field renderers ───────────────────────────────

function TextField({
  field, value, onChange, keyboardType = 'default',
}: {
  field: FieldDefinition;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'url' | 'decimal-pad';
}) {
  return (
    <TextInput
      style={s.input}
      value={value}
      onChangeText={onChange}
      placeholder={field.label}
      placeholderTextColor={theme.color.textMuted}
      keyboardType={keyboardType}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
    />
  );
}

function TextAreaField({ field, value, onChange }: { field: FieldDefinition; value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={[s.input, s.textarea]}
      value={value}
      onChangeText={onChange}
      placeholder={field.label}
      placeholderTextColor={theme.color.textMuted}
      multiline
      numberOfLines={3}
      textAlignVertical="top"
    />
  );
}

function BooleanField({ field, value, onChange }: { field: FieldDefinition; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.booleanRow}>
      <Text style={s.booleanLabel}>{value ? 'Yes' : 'No'}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.color.border, true: theme.color.primary }}
        thumbColor={theme.color.white}
      />
    </View>
  );
}

function SelectField({
  field, value, onChange, multi,
}: {
  field: FieldDefinition;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = field.options ?? [];
  const selected = multi ? (value as string[]) : [value as string];

  const toggle = (opt: string) => {
    if (multi) {
      const arr = value as string[];
      if (arr.includes(opt)) {
        onChange(arr.filter((x) => x !== opt));
      } else {
        onChange([...arr, opt]);
      }
    } else {
      onChange(opt);
      setOpen(false);
    }
  };

  const displayValue = multi
    ? (value as string[]).join(', ') || 'Select...'
    : (value as string) || 'Select...';

  return (
    <>
      <TouchableOpacity style={s.selectBtn} onPress={() => setOpen(true)}>
        <Text style={displayValue === 'Select...' ? s.selectPlaceholder : s.selectValue}>
          {displayValue}
        </Text>
        <Text style={s.selectChevron}>›</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{field.label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[s.optionRow, isSelected && s.optionRowSelected]}
                    onPress={() => toggle(opt)}
                  >
                    <Text style={[s.optionText, isSelected && s.optionTextSelected]}>{opt}</Text>
                    {isSelected && <Text style={s.optionCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {multi && (
              <TouchableOpacity style={s.doneBtn} onPress={() => setOpen(false)}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function LocationField({
  value,
  onChange,
}: {
  value: { lat: number; lng: number; address?: string } | null;
  onChange: (v: { lat: number; lng: number; address?: string }) => void;
}) {
  const [loading, setLoading] = useState(false);

  const capture = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };

      // Reverse geocode
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
        const address = [place.street, place.city, place.country].filter(Boolean).join(', ');
        onChange({ ...coords, address });
      } catch {
        onChange(coords);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not get location.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.locationContainer}>
      <TouchableOpacity style={s.locationBtn} onPress={capture} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={theme.color.primary} size="small" />
        ) : (
          <Text style={s.locationBtnText}>📍 {value ? 'Update Location' : 'Capture Location'}</Text>
        )}
      </TouchableOpacity>
      {value && (
        <View style={s.locationResult}>
          {value.address && <Text style={s.locationAddress}>{value.address}</Text>}
          <Text style={s.locationCoords}>
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </Text>
        </View>
      )}
    </View>
  );
}

function ImageField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `client-${Date.now()}.${ext}`;
      const base64 = asset.base64!;
      const arrayBuffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const { data, error } = await supabase.storage
        .from('client-images')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}` });

      if (error) throw error;

      // Store the storage path; SignedImage will sign it on display.
      onChange(data.path);
    } catch (e: unknown) {
      Alert.alert('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = 'jpg';
      const fileName = `client-${Date.now()}.${ext}`;
      const base64 = asset.base64!;
      const arrayBuffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const { data, error } = await supabase.storage
        .from('client-images')
        .upload(fileName, arrayBuffer, { contentType: `image/jpeg` });

      if (error) throw error;

      // Store the storage path; SignedImage will sign it on display.
      onChange(data.path);
    } catch (e: unknown) {
      Alert.alert('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={s.imageContainer}>
      {value && (
        <SignedImage source={value} bucket="client-images" style={s.imagePreview} resizeMode="cover" />
      )}
      <View style={s.imageButtons}>
        <TouchableOpacity style={s.imageBtn} onPress={pick} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={theme.color.primary} size="small" />
          ) : (
            <Text style={s.imageBtnText}>🖼 Library</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.imageBtn} onPress={takePhoto} disabled={uploading}>
          <Text style={s.imageBtnText}>📷 Camera</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DatePickerField({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Parse existing date value (expected format: DD/MM/YYYY or YYYY-MM-DD)
  const parseDate = (val: string): string | undefined => {
    if (!val) return undefined;
    // Try DD/MM/YYYY format first
    if (val.includes('/')) {
      const [d, m, y] = val.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Already YYYY-MM-DD
    return val;
  };

  const formatDate = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const selectedDate = parseDate(value);

  const onDayPress = (day: { dateString: string }) => {
    onChange(formatDate(day.dateString));
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity style={s.dateBtn} onPress={() => setOpen(true)}>
        <Text style={value ? s.dateValue : s.datePlaceholder}>
          {value || `Select ${field.label}`}
        </Text>
        <Text style={s.dateCalendar}>📅</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{field.label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Calendar
              current={selectedDate}
              onDayPress={onDayPress}
              markedDates={{
                [selectedDate || '']: { selected: true, selectedColor: theme.color.primary },
              }}
              theme={{
                backgroundColor: theme.color.bgSurface,
                calendarBackground: theme.color.bgSurface,
                textSectionTitleColor: theme.color.textSecondary,
                selectedDayBackgroundColor: theme.color.primary,
                selectedDayTextColor: theme.color.white,
                todayTextColor: theme.color.primary,
                dayTextColor: theme.color.textPrimary,
                textDisabledColor: theme.color.textMuted,
                dotColor: theme.color.primary,
                selectedDotColor: theme.color.white,
                arrowColor: theme.color.primary,
                monthTextColor: theme.color.textPrimary,
                indicatorColor: theme.color.primary,
                textDayFontWeight: '500',
                textMonthFontWeight: '700',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 15,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 13,
              }}
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            />
            <TouchableOpacity style={s.clearDateBtn} onPress={() => { onChange(''); setOpen(false); }}>
              <Text style={s.clearDateBtnText}>Clear Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Main form renderer ───────────────────────────────────────
export default function ClientFieldsForm({ values, onChange }: Props) {
  const { fields, loading } = useFieldDefinitions();

  if (loading) return <ActivityIndicator color={theme.color.primary} style={{ marginVertical: 12 }} />;
  if (fields.length === 0) return null;

  const get = (fieldId: string): FieldValue =>
    values[fieldId] ?? { field_id: fieldId };

  const set = (fieldId: string, partial: Partial<FieldValue>) => {
    onChange(fieldId, { field_id: fieldId, ...get(fieldId), ...partial });
  };

  return (
    <View style={s.container}>
      {fields.map((field) => {
        const val = get(field.id);
        return (
          <View key={field.id} style={s.fieldBlock}>
            <View style={s.labelRow}>
              <Text style={s.fieldLabel}>{field.label}</Text>
              {field.is_required && <Text style={s.required}>*</Text>}
              <Text style={s.fieldType}>{field.field_type}</Text>
            </View>

            {field.field_type === 'text' && (
              <TextField
                field={field}
                value={val.value_text ?? ''}
                onChange={(v) => set(field.id, { value_text: v })}
              />
            )}
            {field.field_type === 'id_number' && (
              <TextField
                field={field}
                value={val.value_text ?? ''}
                onChange={(v) => set(field.id, { value_text: v })}
                keyboardType="decimal-pad"
              />
            )}
            {field.field_type === 'number' && (
              <TextField
                field={field}
                value={val.value_number != null ? String(val.value_number) : ''}
                onChange={(v) => set(field.id, { value_number: parseFloat(v) || undefined })}
                keyboardType="decimal-pad"
              />
            )}
            {field.field_type === 'currency' && (
              <TextField
                field={field}
                value={val.value_number != null ? String(val.value_number) : ''}
                onChange={(v) => set(field.id, { value_number: parseFloat(v) || undefined })}
                keyboardType="decimal-pad"
              />
            )}
            {field.field_type === 'email' && (
              <TextField
                field={field}
                value={val.value_text ?? ''}
                onChange={(v) => set(field.id, { value_text: v })}
                keyboardType="email-address"
              />
            )}
            {field.field_type === 'phone' && (
              <TextField
                field={field}
                value={val.value_text ?? ''}
                onChange={(v) => set(field.id, { value_text: v })}
                keyboardType="phone-pad"
              />
            )}
            {field.field_type === 'url' && (
              <TextField
                field={field}
                value={val.value_text ?? ''}
                onChange={(v) => set(field.id, { value_text: v })}
                keyboardType="url"
              />
            )}
            {field.field_type === 'date' && (
              <DatePickerField
                field={field}
                value={val.value_text ?? ''}
                onChange={(v) => set(field.id, { value_text: v })}
              />
            )}
            {field.field_type === 'textarea' && (
              <TextAreaField
                field={field}
                value={val.value_text ?? ''}
                onChange={(v) => set(field.id, { value_text: v })}
              />
            )}
            {field.field_type === 'boolean' && (
              <BooleanField
                field={field}
                value={val.value_boolean ?? false}
                onChange={(v) => set(field.id, { value_boolean: v })}
              />
            )}
            {field.field_type === 'select' && (
              <SelectField
                field={field}
                value={val.value_text ?? ''}
                onChange={(v) => set(field.id, { value_text: v as string })}
              />
            )}
            {field.field_type === 'multiselect' && (
              <SelectField
                field={field}
                value={val.value_json?.selected as string[] ?? []}
                onChange={(v) => set(field.id, { value_json: { selected: v } })}
                multi
              />
            )}
            {field.field_type === 'location' && (
              <LocationField
                value={val.value_json as { lat: number; lng: number; address?: string } | null}
                onChange={(v) => set(field.id, { value_json: v as Record<string, unknown> })}
              />
            )}
            {field.field_type === 'image' && (
              <ImageField
                value={val.value_text ?? null}
                onChange={(v) => set(field.id, { value_text: v })}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { gap: theme.spacing.space3 },
  fieldBlock: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize, fontWeight: '600', flex: 1 },
  required: { color: theme.color.danger, fontSize: theme.typography.body.fontSize, fontWeight: '700' },
  fieldType: {
    ...theme.typography.sectionDivider,
    color: theme.color.border,
    backgroundColor: theme.color.bgSurface,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
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
  booleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  booleanLabel: { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space3,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  selectValue: { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize },
  selectPlaceholder: { flex: 1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  selectChevron: { color: theme.color.textMuted, fontSize: 18 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: theme.spacing.space3,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dateValue: { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize },
  datePlaceholder: { flex: 1, color: theme.color.textMuted, fontSize: theme.typography.body.fontSize },
  dateCalendar: { fontSize: 18 },
  clearDateBtn: {
    margin: theme.spacing.space3,
    backgroundColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems: 'center',
  },
  clearDateBtnText: { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  locationContainer: { gap: theme.spacing.space2 },
  locationBtn: {
    backgroundColor: theme.color.primary + '11',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.primary + '55',
  },
  locationBtnText: { color: theme.color.primaryText, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  locationResult: {
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: 3,
  },
  locationAddress: { color: theme.color.textPrimary, fontSize: theme.typography.label.fontSize, fontWeight: '500' },
  locationCoords: { color: theme.color.textMuted, fontSize: theme.typography.caption.fontSize },
  imageContainer: { gap: theme.spacing.space2 },
  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  imageButtons: { flexDirection: 'row', gap: theme.spacing.space2 },
  imageBtn: {
    flex: 1,
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  imageBtnText: { color: theme.color.textSecondary, fontSize: theme.typography.label.fontSize, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.color.bgSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  modalTitle: { color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  modalClose: { color: theme.color.textSecondary, fontSize: 20 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  optionRowSelected: { backgroundColor: theme.color.primary + '11' },
  optionText: { flex: 1, color: theme.color.textPrimary, fontSize: 15, fontWeight: '500' },
  optionTextSelected: { color: theme.color.primaryText, fontWeight: '700' },
  optionCheck: { color: theme.color.success, fontSize: 18 },
  doneBtn: {
    margin: theme.spacing.space3,
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md + 2,
    paddingVertical: 13,
    alignItems: 'center',
  },
  doneBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },
});
