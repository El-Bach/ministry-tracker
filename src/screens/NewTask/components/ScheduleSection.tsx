// src/screens/NewTask/components/ScheduleSection.tsx
//
// SCHEDULE section — file-created timestamp (read-only) + due-date picker
// + notes textarea. Phase 4a of the NewTaskScreen split. Smallest section.

import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { theme } from '../../../theme';
import { s } from '../styles/newTaskStyles';
import { DatePickerField } from './DatePickerField';

interface Props {
  t: (key: any) => string;

  // Created timestamp — display string only, read-only field
  createdDisplay: string;

  // Due date (DD/MM/YYYY display format)
  dueDate: string;
  setDueDate: (v: string) => void;

  // Notes
  notes: string;
  setNotes: (v: string) => void;

}

export function ScheduleSection({
  t, createdDisplay, dueDate, setDueDate, notes, setNotes,
}: Props) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{t('scheduleLabel').toUpperCase()}</Text>

      {/* Created time — auto from device */}
      <View style={s.createdRow}>
        <Text style={s.fieldLabel}>{t('fileCreatedLabel')}</Text>
        <Text style={s.createdValue}>{createdDisplay}</Text>
      </View>

      {/* Due date — calendar or manual */}
      <Text style={s.fieldLabel}>
        {t('dueDate')} <Text style={s.optionalTag}>(optional)</Text>
      </Text>
      <DatePickerField value={dueDate} onChange={setDueDate} />

      <View style={s.notesContainer}>
        <Text style={s.fieldLabel}>
          {t('notes')} <Text style={s.optionalTag}>(optional)</Text>
        </Text>
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
  );
}
