// src/screens/Create/components/NewClientForm.tsx
//
// New-client modal: name + phone + reference fields + custom client fields
// (with all 14 field types) + Excel import panel + ID/QR scan trigger.
// Phase 2c extraction from CreateScreen — biggest of Phase 2.
//
// Date-picker sub-state (showDatePicker / currentDateField / showMonthYearPicker
// / pickerYear / calCurrentDate) only ever appeared in this section, so it's
// hoisted INTO this component (private state). All other state stays in the
// parent and flows in via Props.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Switch,
  Modal, ScrollView, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { PermissionResponse } from 'expo-camera';
import { theme } from '../../../theme';
import { s } from '../styles/createStyles';
import PhoneInput from '../../../components/PhoneInput';

interface ImportRow { name: string; phone: string; refName: string; refPhone: string }

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;

  // Basic fields
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

  // Custom field defs + values
  loadingClientFields: boolean;
  clientFormFieldDefs: any[];
  clientFormFieldValues: Record<string, string>;
  setClientFormFieldValues: (
    updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;

  // Save
  savingClient: boolean;
  handleCreateClientWithFields: () => void;

  // Excel import
  showClientImport: boolean;
  setShowClientImport: (v: boolean | ((prev: boolean) => boolean)) => void;
  clientImportRaw: string;
  setClientImportRaw: (v: string) => void;
  clientImportRows: ImportRow[];
  setClientImportRows: (v: ImportRow[]) => void;
  importingClients: boolean;
  parseClientImport: (raw: string) => ImportRow[];
  handleImportClients: () => void;

  // ID/QR scanner trigger
  scannerPerm: PermissionResponse | null;
  requestScannerPerm: () => Promise<PermissionResponse>;
  setShowIdScanner: (v: boolean) => void;

}

export function NewClientForm(props: Props) {
  const {
    visible, onClose, t,
    newClientName, setNewClientName, newClientPhone, setNewClientPhone,
    newClientPhoneCountry, setNewClientPhoneCountry,
    newClientRefName, setNewClientRefName, newClientRefPhone, setNewClientRefPhone,
    newClientRefPhoneCountry, setNewClientRefPhoneCountry,
    loadingClientFields, clientFormFieldDefs, clientFormFieldValues, setClientFormFieldValues,
    savingClient, handleCreateClientWithFields,
    showClientImport, setShowClientImport,
    clientImportRaw, setClientImportRaw,
    clientImportRows, setClientImportRows,
    importingClients, parseClientImport, handleImportClients,
    scannerPerm, requestScannerPerm, setShowIdScanner,
  } = props;

  // Date-picker sub-state — only used inside this form, kept private here.
  const [showDatePicker, setShowDatePicker]           = useState(false);
  const [currentDateField, setCurrentDateField]       = useState<string | null>(null);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [pickerYear, setPickerYear]                   = useState(new Date().getFullYear());
  const [calCurrentDate, setCalCurrentDate]           = useState<string | undefined>(undefined);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }}>
          <View style={[s.modalSheet, { maxHeight: '92%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('addNewClient')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={s.scanIdBtn}
                  onPress={async () => {
                    if (!scannerPerm?.granted) {
                      const { granted } = await requestScannerPerm();
                      if (!granted) { Alert.alert(t('warning'), t('fieldRequired')); return; }
                    }
                    setShowIdScanner(true);
                  }}
                >
                  <Text style={s.scanIdBtnText}>📷 Scan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.docImportToggleBtn}
                  onPress={() => { setShowClientImport(v => !v); setClientImportRaw(''); setClientImportRows([]); }}
                >
                  <Text style={s.docImportToggleBtnText}>📥</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onClose(); setShowClientImport(false); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              {/* ── Excel Import Panel ── */}
              {showClientImport && (
                <View style={s.docImportPanel}>
                  <Text style={s.docImportLabel}>{t('pasteExcelClients')}</Text>
                  <TextInput
                    style={s.docImportTextArea}
                    value={clientImportRaw}
                    onChangeText={(txt) => { setClientImportRaw(txt); setClientImportRows([]); }}
                    placeholder={'Paste Excel rows here...\n\nExample:\nAhmad Khalil\t+961 70 111\tSara\t+961 71 222'}
                    placeholderTextColor={theme.color.textMuted}
                    multiline
                    textAlignVertical="top"
                  />
                  {clientImportRows.length === 0 ? (
                    <TouchableOpacity style={s.docImportPreviewBtn} onPress={() => setClientImportRows(parseClientImport(clientImportRaw))} disabled={!clientImportRaw.trim()}>
                      <Text style={s.docImportPreviewBtnText}>{t('preview')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      {clientImportRows.map((r, i) => (
                        <View key={i} style={s.docImportPreviewRow}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[s.docImportPreviewTitle, { fontWeight: '700' }]}>{r.name}</Text>
                            {r.phone ? <Text style={s.docImportLabel}>📞 {r.phone}</Text> : null}
                            {r.refName ? <Text style={s.docImportLabel}>{t('refPrefix')}: {r.refName}{r.refPhone ? ` · ${r.refPhone}` : ''}</Text> : null}
                          </View>
                        </View>
                      ))}
                      <TouchableOpacity style={s.docImportConfirmBtn} onPress={handleImportClients} disabled={importingClients}>
                        {importingClients ? <ActivityIndicator size="small" color={theme.color.white} /> : <Text style={s.docImportConfirmBtnText}>{t('importClientsBtn')} ({clientImportRows.length})</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
              <TextInput
                style={s.modalInput}
                value={newClientName}
                onChangeText={setNewClientName}
                placeholder={t('fullNameRequired')}
                placeholderTextColor={theme.color.textMuted}
                autoFocus
              />
              <PhoneInput
                value={newClientPhone}
                onChangeText={setNewClientPhone}
                countryCode={newClientPhoneCountry}
                onCountryChange={(c) => setNewClientPhoneCountry(c.code)}
                placeholder={t('phoneNumber')}
                style={{ marginBottom: 10 }}
              />
              <Text style={s.fieldsSectionLabel}>{t('referenceOpt').toUpperCase()}</Text>
              <TextInput
                style={s.modalInput}
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
              {loadingClientFields ? (
                <ActivityIndicator color={theme.color.primary} style={{ marginVertical: 20 }} />
              ) : clientFormFieldDefs.length > 0 ? (
                <>
                  <Text style={s.fieldsSectionLabel}>{t('preferences').toUpperCase()}</Text>
                  {clientFormFieldDefs.map((def: any) => (
                    <View key={def.id} style={{ marginBottom: 12 }}>
                      <Text style={s.fieldDefLabel}>{def.label}{def.is_required ? ' *' : ''}</Text>
                      {def.field_type === 'boolean' ? (
                        <View style={s.fieldBoolRow}>
                          <Text style={s.fieldBoolText}>{clientFormFieldValues[def.id] === 'true' ? t('yes') : t('no')}</Text>
                          <Switch
                            value={clientFormFieldValues[def.id] === 'true'}
                            onValueChange={(v) => setClientFormFieldValues((p) => ({ ...p, [def.id]: v ? 'true' : 'false' }))}
                            trackColor={{ false: theme.color.border, true: theme.color.primary }}
                            thumbColor={theme.color.white}
                          />
                        </View>
                      ) : def.field_type === 'select' && def.options?.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {(def.options as string[]).map((opt: string) => (
                            <TouchableOpacity
                              key={opt}
                              style={[s.selectOption, clientFormFieldValues[def.id] === opt && s.selectOptionActive]}
                              onPress={() => setClientFormFieldValues((p) => ({ ...p, [def.id]: opt }))}
                            >
                              <Text style={[s.selectOptionText, clientFormFieldValues[def.id] === opt && s.selectOptionTextActive]}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : def.field_type === 'date' ? (
                        <View>
                          <TouchableOpacity
                            style={s.dateBtn}
                            onPress={() => {
                              if (currentDateField === def.id && showDatePicker) {
                                setShowDatePicker(false);
                                setCurrentDateField(null);
                                setShowMonthYearPicker(false);
                                setCalCurrentDate(undefined);
                              } else {
                                setCurrentDateField(def.id);
                                setShowMonthYearPicker(false);
                                setCalCurrentDate(undefined);
                                setShowDatePicker(true);
                              }
                            }}
                          >
                            <Text style={clientFormFieldValues[def.id] ? s.dateBtnText : s.dateBtnPlaceholder}>
                              {clientFormFieldValues[def.id] || `Select ${def.label}`}
                            </Text>
                            <Text style={s.dateBtnIcon}>{currentDateField === def.id && showDatePicker ? '▲' : '📅'}</Text>
                          </TouchableOpacity>
                          {currentDateField === def.id && showDatePicker && (
                            <View style={s.inlineCalendarContainer}>
                              {showMonthYearPicker ? (
                                <View style={s.monthYearPicker}>
                                  <View style={s.monthYearPickerHeader}>
                                    <TouchableOpacity onPress={() => setPickerYear((y) => y - 1)} style={s.monthYearArrow}>
                                      <Text style={s.monthYearArrowText}>‹</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                      style={s.monthYearPickerYearInput}
                                      value={String(pickerYear)}
                                      onChangeText={(v) => {
                                        const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                                        if (!isNaN(n)) setPickerYear(n);
                                        else if (v === '') setPickerYear(0);
                                      }}
                                      keyboardType="number-pad"
                                      maxLength={4}
                                      selectTextOnFocus
                                      placeholderTextColor={theme.color.textMuted}
                                    />
                                    <TouchableOpacity onPress={() => setPickerYear((y) => y + 1)} style={s.monthYearArrow}>
                                      <Text style={s.monthYearArrowText}>›</Text>
                                    </TouchableOpacity>
                                  </View>
                                  <View style={s.monthGrid}>
                                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mon, idx) => (
                                      <TouchableOpacity
                                        key={mon}
                                        style={s.monthGridItem}
                                        onPress={() => {
                                          const isoDate = `${pickerYear}-${String(idx + 1).padStart(2, '0')}-01`;
                                          setCalCurrentDate(isoDate);
                                          setShowMonthYearPicker(false);
                                        }}
                                      >
                                        <Text style={s.monthGridItemText}>{mon}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>
                              ) : (
                                <Calendar
                                  current={calCurrentDate ?? (
                                    clientFormFieldValues[def.id]
                                      ? (() => {
                                          const val = clientFormFieldValues[def.id];
                                          if (val?.includes('/')) {
                                            const [d, m, y] = val.split('/');
                                            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                                          }
                                          return val || undefined;
                                        })()
                                      : undefined
                                  )}
                                  onDayPress={(day: any) => {
                                    const [y, m, d] = day.dateString.split('-');
                                    setClientFormFieldValues((p) => ({ ...p, [def.id]: `${d}/${m}/${y}` }));
                                    setShowDatePicker(false);
                                    setCurrentDateField(null);
                                    setCalCurrentDate(undefined);
                                    setShowMonthYearPicker(false);
                                  }}
                                  onMonthChange={(date: any) => setCalCurrentDate(date.dateString)}
                                  renderHeader={(date: any) => {
                                    const d = typeof date === 'string' ? new Date(date) : date as any;
                                    const label = d?.toString ? d.toString('MMMM yyyy') : '';
                                    return (
                                      <TouchableOpacity
                                        onPress={() => {
                                          const year = typeof d?.getFullYear === 'function' ? d.getFullYear() : new Date().getFullYear();
                                          setPickerYear(year);
                                          setShowMonthYearPicker(true);
                                        }}
                                        style={s.calHeaderBtn}
                                      >
                                        <Text style={s.calHeaderText}>{label} ▾</Text>
                                      </TouchableOpacity>
                                    );
                                  }}
                                  markedDates={clientFormFieldValues[def.id] ? {
                                    [(() => {
                                      const val = clientFormFieldValues[def.id];
                                      if (val?.includes('/')) {
                                        const [d, m, y] = val.split('/');
                                        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                                      }
                                      return val || '';
                                    })()]: { selected: true, selectedColor: theme.color.primary },
                                  } : {}}
                                  theme={{
                                    backgroundColor: theme.color.bgBase,
                                    calendarBackground: theme.color.bgBase,
                                    textSectionTitleColor: theme.color.textMuted,
                                    selectedDayBackgroundColor: theme.color.primary,
                                    selectedDayTextColor: theme.color.white,
                                    todayTextColor: theme.color.primary,
                                    dayTextColor: theme.color.textPrimary,
                                    textDisabledColor: theme.color.textMuted,
                                    arrowColor: theme.color.primary,
                                    monthTextColor: theme.color.textPrimary,
                                    textDayFontWeight: '500',
                                    textMonthFontWeight: '700',
                                    textDayHeaderFontWeight: '600',
                                    textDayFontSize: 14,
                                    textMonthFontSize: 15,
                                    textDayHeaderFontSize: 12,
                                  }}
                                />
                              )}
                              {clientFormFieldValues[def.id] ? (
                                <TouchableOpacity
                                  style={s.clearDateBtn}
                                  onPress={() => {
                                    setClientFormFieldValues((p) => ({ ...p, [def.id]: '' }));
                                    setShowDatePicker(false);
                                    setCurrentDateField(null);
                                  }}
                                >
                                  <Text style={s.clearDateBtnText}>{t('clearDateBtn')}</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          )}
                        </View>
                      ) : (
                        <TextInput
                          style={[s.modalInput, def.field_type === 'textarea' && { height: 80, textAlignVertical: 'top' }]}
                          value={clientFormFieldValues[def.id] ?? ''}
                          onChangeText={(v) => setClientFormFieldValues((p) => ({ ...p, [def.id]: v }))}
                          placeholder={def.label}
                          placeholderTextColor={theme.color.textMuted}
                          multiline={def.field_type === 'textarea'}
                          keyboardType={
                            def.field_type === 'number' || def.field_type === 'currency' ? 'decimal-pad' :
                            def.field_type === 'phone' ? 'phone-pad' :
                            def.field_type === 'email' ? 'email-address' : 'default'
                          }
                        />
                      )}
                    </View>
                  ))}
                </>
              ) : null}
              <TouchableOpacity
                style={[s.modalSaveBtn, savingClient && s.modalSaveBtnDisabled]}
                onPress={handleCreateClientWithFields}
                disabled={savingClient}
              >
                {savingClient
                  ? <ActivityIndicator color={theme.color.white} size="small" />
                  : <Text style={s.modalSaveBtnText}>{t('createClientBtn')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
