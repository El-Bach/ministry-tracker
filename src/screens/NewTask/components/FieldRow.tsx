// src/screens/NewTask/components/FieldRow.tsx
//
// Tappable label/value row used by the CLIENT and SERVICE sections to open
// their respective pickers. Renders two visual states: selected (label as
// small hint, value prominently) and empty (label on left, placeholder on
// right). Phase 4 extraction. Styles still come from the parent's shared
// `s` until Phase 6 dedup.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../../lib/i18n';
import { s } from '../styles/newTaskStyles';

interface Props {
  label: string;
  value: string;
  onPress: () => void;
  placeholder?: string;
}

export function FieldRow({ label, value, onPress, placeholder }: Props) {
  const { t } = useTranslation();
  if (value) {
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
        <Text style={s.fieldPlaceholder}>{placeholder || t('select')}</Text>
        <Text style={s.fieldChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}
