// src/screens/NewTask/components/FieldPickerModal.tsx
//
// Bottom-sheet that lets the user (a) add an existing client-field
// definition to the new-client form OR (b) create a brand-new custom
// field on the fly. Owns the inline "create field" form. Phase 3b.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Switch,
  Modal, KeyboardAvoidingView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { theme } from '../../../theme';
import { fp } from '../styles/fieldPickerStyles';
import { FieldDefinition } from '../../../components/ClientFieldsForm';

// Icon glyph per field type — only used in this modal (and the inline
// preview chip), so kept local rather than re-exported.
const FIELD_TYPE_ICONS: Record<string, string> = {
  text: 'Aa',  textarea: '¶',  number: '123', currency: '$',  email: '@',
  phone: '☏',  url: '🔗',     date: '📅',    boolean: '✓',  select: '▾',
  multiselect: '☑', image: '🖼', location: '📍', id_number: '#',
};

interface FieldTypeOption { key: string; label: string }

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;

  // Existing-field section
  allFieldDefs: FieldDefinition[];
  activeFieldIds: string[];
  setActiveFieldIds: (updater: string[] | ((prev: string[]) => string[])) => void;

  // Create-new-field form
  showCreateField: boolean;
  setShowCreateField: (v: boolean | ((prev: boolean) => boolean)) => void;
  newFieldLabel: string;
  setNewFieldLabel: (v: string) => void;
  newFieldType: string;
  newFieldOptions: string;
  setNewFieldOptions: (v: string) => void;
  newFieldRequired: boolean;
  setNewFieldRequired: (v: boolean) => void;
  savingNewField: boolean;
  handleCreateCustomField: () => void;

  // Type-picker trigger
  fieldTypes: FieldTypeOption[];
  onOpenTypePicker: () => void;
}

export function FieldPickerModal(props: Props) {
  const {
    visible, onClose, t,
    allFieldDefs, activeFieldIds, setActiveFieldIds,
    showCreateField, setShowCreateField,
    newFieldLabel, setNewFieldLabel,
    newFieldType, newFieldOptions, setNewFieldOptions,
    newFieldRequired, setNewFieldRequired,
    savingNewField, handleCreateCustomField,
    fieldTypes, onOpenTypePicker,
  } = props;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { onClose(); setShowCreateField(false); }}
    >
      <KeyboardAvoidingView behavior="padding" style={fp.overlay}>
        <View style={fp.sheet}>
          <View style={fp.header}>
            <Text style={fp.title}>{t('addField')}</Text>
            <TouchableOpacity onPress={() => { onClose(); setShowCreateField(false); }}>
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
                        onClose();
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
                    onPress={onOpenTypePicker}
                  >
                    <Text style={fp.typeSelectIcon}>{FIELD_TYPE_ICONS[newFieldType] ?? '?'}</Text>
                    <Text style={fp.typeSelectName}>
                      {fieldTypes.find((ft) => ft.key === newFieldType)?.label ?? newFieldType}
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
  );
}
