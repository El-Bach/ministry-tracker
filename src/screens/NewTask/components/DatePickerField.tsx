// src/screens/NewTask/components/DatePickerField.tsx
//
// Inline date picker — manual TextInput with auto-formatting (DD/MM/YYYY)
// + calendar dropdown. Self-contained.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { theme } from '../../../theme';
import { displayToCalendar, toDisplay } from '../utils/dateHelpers';

interface Props {
  /** DD/MM/YYYY display format */
  value: string;
  onChange: (display: string) => void;
}

export function DatePickerField({ value, onChange }: Props) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [manualInput, setManualInput]   = useState(value);

  // Sync manual input when value changes externally
  useEffect(() => { setManualInput(value); }, [value]);

  const calendarSelected = displayToCalendar(value);
  const markedDates      = calendarSelected
    ? { [calendarSelected]: { selected: true, selectedColor: theme.color.primary } }
    : {};

  const handleManualChange = (text: string) => {
    setManualInput(text);
    // Auto-format: insert slashes after 2 and 4 digits
    const digits = text.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + digits.slice(4, 8);
    setManualInput(formatted);
    onChange(formatted);
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
              backgroundColor:            theme.color.bgBase,
              calendarBackground:         theme.color.bgBase,
              textSectionTitleColor:      theme.color.textMuted,
              selectedDayBackgroundColor: theme.color.primary,
              selectedDayTextColor:       theme.color.white,
              todayTextColor:             theme.color.primaryText,
              dayTextColor:               theme.color.textSecondary,
              textDisabledColor:          theme.color.border,
              arrowColor:                 theme.color.primary,
              monthTextColor:             theme.color.textPrimary,
              textDayFontWeight:          '600',
              textMonthFontWeight:        '700',
              textDayHeaderFontWeight:    '600',
              textDayFontSize:            14,
              textMonthFontSize:          15,
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
    flex:              1,
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space3,
    color:             theme.color.textPrimary,
    fontSize:          15,
    fontWeight:        '600',
    borderWidth:       1,
    borderColor:       theme.color.border,
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
