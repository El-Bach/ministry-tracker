// src/screens/NewTask/components/ClientSection.tsx
//
// CLIENT section — picker row + collapsible "Create new client" inline form
// with name + phone (with country code) + reference name/phone + active
// custom-field stack (with +Add Field trigger). Phase 4b of the NewTaskScreen
// split. Folds in the original Phase 3c "NewClientFormModal" plan since the
// form is inline JSX, not a modal.

import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { theme } from '../../../theme';
import PhoneInput from '../../../components/PhoneInput';
import { FieldDefinition, FieldValue } from '../../../components/ClientFieldsForm';
import { Client } from '../../../types';
import { FieldRow } from './FieldRow';
import { DynamicFieldInput } from './DynamicFieldInput';

interface Props {
  t: (key: any) => string;

  // Picker
  selectedClient: Client | null;
  onOpenClientPicker: () => void;

  // Inline new-client form toggle
  showNewClientForm: boolean;
  setShowNewClientForm: (updater: boolean | ((prev: boolean) => boolean)) => void;

  // Form fields
  newClientName: string;
  setNewClientName: (v: string) => void;
  newClientPhone: string;
  setNewClientPhone: (v: string) => void;
  newClientPhoneCountry: string;
  setNewClientPhoneCountry: (v: string) => void;
  newClientRefName: string;
  setNewClientRefName: (v: string) => void;
  newClientRefPhone: string;
  setNewClientRefPhone: (v: string) => void;
  newClientRefPhoneCountry: string;
  setNewClientRefPhoneCountry: (v: string) => void;

  // Active custom fields stack
  activeFieldIds: string[];
  setActiveFieldIds: (updater: string[] | ((prev: string[]) => string[])) => void;
  allFieldDefs: FieldDefinition[];
  customFieldValues: Record<string, FieldValue>;
  setCustomFieldValues: (
    updater: Record<string, FieldValue>
      | ((prev: Record<string, FieldValue>) => Record<string, FieldValue>),
  ) => void;

  // + Add Field trigger
  onOpenFieldPicker: () => void;

  // Save
  handleCreateClient: () => void;

  // Shared screen styles
  s: any;
}

export function ClientSection(props: Props) {
  const {
    t,
    selectedClient, onOpenClientPicker,
    showNewClientForm, setShowNewClientForm,
    newClientName, setNewClientName,
    newClientPhone, setNewClientPhone, newClientPhoneCountry, setNewClientPhoneCountry,
    newClientRefName, setNewClientRefName,
    newClientRefPhone, setNewClientRefPhone, newClientRefPhoneCountry, setNewClientRefPhoneCountry,
    activeFieldIds, setActiveFieldIds,
    allFieldDefs, customFieldValues, setCustomFieldValues,
    onOpenFieldPicker, handleCreateClient,
    s,
  } = props;

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{t('clients').toUpperCase()}</Text>
      <FieldRow
        label={t('clients')}
        value={selectedClient ? selectedClient.name : ''}
        onPress={onOpenClientPicker}
        s={s}
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

          {/* Active custom fields — only ones the user added */}
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
          <TouchableOpacity style={s.addFieldBtn} onPress={onOpenFieldPicker}>
            <Text style={s.addFieldBtnText}>+ Add Field</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.inlineSaveBtn} onPress={handleCreateClient}>
            <Text style={s.inlineSaveBtnText}>{t('save')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
