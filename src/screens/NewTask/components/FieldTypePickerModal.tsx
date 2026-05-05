// src/screens/NewTask/components/FieldTypePickerModal.tsx
//
// Sub-picker shown inside the FieldPickerModal's "Create New Field" form —
// lets the user choose what kind of field to create (text / number / date /
// select / etc.). Phase 3a of the NewTaskScreen split.

import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { fp } from '../styles/fieldPickerStyles';

interface FieldTypeOption {
  key: string;
  label: string;
  icon: string;
  desc: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;
  fieldTypes: FieldTypeOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export function FieldTypePickerModal({
  visible, onClose, t, fieldTypes, selectedKey, onSelect,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={fp.overlay}>
        <View style={fp.sheet}>
          <View style={fp.header}>
            <Text style={fp.title}>{t('fieldTypeLabel')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={fp.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {fieldTypes.map((ft) => (
              <TouchableOpacity
                key={ft.key}
                style={[fp.option, selectedKey === ft.key && fp.optionSelected]}
                onPress={() => { onSelect(ft.key); onClose(); }}
              >
                <View style={fp.optionIcon}>
                  <Text style={fp.optionIconText}>{ft.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[fp.optionLabel, selectedKey === ft.key && fp.optionLabelSelected]}>
                    {ft.label}
                  </Text>
                  <Text style={fp.optionType}>{ft.desc}</Text>
                </View>
                {selectedKey === ft.key && <Text style={fp.optionCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
