// src/screens/Create/components/NetworkModal.tsx
//
// Network (people directory) modal — list / form / Excel import views all
// in one component. Phase 1 extraction from CreateScreen (see ../README.md).
//
// State stays in CreateScreen for now; this component just owns the JSX.
// All values, setters, and callbacks come in via Props. The shared `styles`
// object is passed in too — it'll be deduplicated in Phase 6.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Switch,
  Modal, ScrollView, KeyboardAvoidingView, Alert, Linking,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { theme } from '../../../theme';
import { s } from '../styles/createStyles';
import { formatPhoneDisplay } from '../../../lib/phone';

// Local copy of the call/WhatsApp Alert helper. Duplicated rather than
// imported so the component is self-contained — same trivial helper sits in
// CreateScreen + several other screens.
function openPhone(phone: string, name?: string) {
  if (!phone) return;
  const clean = phone.replace(/[^0-9+]/g, '');
  Alert.alert(name ?? phone, phone, [
    { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
    { text: '💬 WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

interface ImportRow { name: string; phone: string; reference: string }

interface Props {
  // Visibility + close
  visible: boolean;
  onClose: () => void;

  // Translation
  t: (key: any) => string;

  // List view
  network: any[];
  networkSearch: string;
  setNetworkSearch: (v: string) => void;
  matchesNetworkSearch: (n: any, query: string) => boolean;

  // Form view
  showNetworkForm: boolean;
  setShowNetworkForm: (v: boolean) => void;
  editNetworkId: string | null;
  setEditNetworkId: (v: string | null) => void;
  netName: string;
  setNetName: (v: string) => void;
  netPhone: string;
  setNetPhone: (v: string) => void;
  netReference: string;
  setNetReference: (v: string) => void;
  netRefPhone: string;
  setNetRefPhone: (v: string) => void;
  netCityId: string | null;
  setNetCityId: (v: string | null) => void;
  netCitySearch: string;
  setNetCitySearch: (v: string) => void;
  showNetCityPicker: boolean;
  setShowNetCityPicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  savingNetwork: boolean;
  allCities: any[];

  // Additional fields
  netFieldDefs: any[];
  netFieldValues: Record<string, string>;
  setNetFieldValues: (
    updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  netAddedFieldIds: string[];
  setNetAddedFieldIds: (
    updater: string[] | ((prev: string[]) => string[]),
  ) => void;
  showNetFieldPicker: boolean;
  setShowNetFieldPicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  netFieldSearch: string;
  setNetFieldSearch: (v: string) => void;
  netDatePickerFieldId: string | null;
  setNetDatePickerFieldId: (v: string | null) => void;
  netDatePickerYear: number;
  setNetDatePickerYear: (v: number | ((prev: number) => number)) => void;
  netDatePickerMonthYear: boolean;
  setNetDatePickerMonthYear: (v: boolean) => void;
  netDatePickerCurrent: string | undefined;
  setNetDatePickerCurrent: (v: string | undefined) => void;

  // Import view
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  importRaw: string;
  setImportRaw: (v: string) => void;
  importRows: ImportRow[];
  setImportRows: (v: ImportRow[]) => void;
  importingContacts: boolean;
  parseImportText: (raw: string) => ImportRow[];

  // Action callbacks
  openNetworkForm: (contact?: any) => void;
  handleSaveNetworkContact: () => void;
  handleDeleteNetworkContact: (contact: any) => void;
  handleImportContacts: () => void;

}

export function NetworkModal(props: Props) {
  const {
    visible, onClose, t,
    network, networkSearch, setNetworkSearch, matchesNetworkSearch,
    showNetworkForm, setShowNetworkForm, editNetworkId, setEditNetworkId,
    netName, setNetName, netPhone, setNetPhone, netReference, setNetReference, netRefPhone, setNetRefPhone,
    netCityId, setNetCityId, netCitySearch, setNetCitySearch, showNetCityPicker, setShowNetCityPicker,
    savingNetwork, allCities,
    netFieldDefs, netFieldValues, setNetFieldValues, netAddedFieldIds, setNetAddedFieldIds,
    showNetFieldPicker, setShowNetFieldPicker, netFieldSearch, setNetFieldSearch,
    netDatePickerFieldId, setNetDatePickerFieldId,
    netDatePickerYear, setNetDatePickerYear,
    netDatePickerMonthYear, setNetDatePickerMonthYear,
    netDatePickerCurrent, setNetDatePickerCurrent,
    showImportModal, setShowImportModal, importRaw, setImportRaw,
    importRows, setImportRows, importingContacts, parseImportText,
    openNetworkForm, handleSaveNetworkContact, handleDeleteNetworkContact, handleImportContacts,
  } = props;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { onClose(); setShowNetworkForm(false); setShowImportModal(false); }}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }} behavior="padding">
          <View style={[s.modalSheet, showImportModal ? { height: '92%' } : { maxHeight: '92%' }]}>

            {/* ── HEADER — import / list / form ── */}
            {showImportModal ? (
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setShowImportModal(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: theme.color.primary, fontSize: 18 }}>‹</Text>
                  <Text style={{ ...theme.typography.label, color: theme.color.primary }}>Back</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>📥 {t('importBtn')}</Text>
                <TouchableOpacity onPress={() => { onClose(); setShowNetworkForm(false); setShowImportModal(false); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : !showNetworkForm ? (
              /* ── LIST VIEW header ── */
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>👥 {t('network')}</Text>
                  <Text style={s.modalSubtitle}>
                    {networkSearch.trim()
                      ? `${network.filter(n => matchesNetworkSearch(n, networkSearch)).length} of ${network.length} contacts`
                      : `${network.length} contacts`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={s.modalImportBtn}
                    onPress={() => { setImportRaw(''); setImportRows([]); setShowImportModal(true); }}
                  >
                    <Text style={s.modalImportBtnText}>{t('importBtn')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modalAddBtn} onPress={() => openNetworkForm()}>
                    <Text style={s.modalAddBtnText}>+ {t('add')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { onClose(); setShowNetworkForm(false); }}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ── FORM VIEW header ── */
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => { setShowNetworkForm(false); setEditNetworkId(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: theme.color.primary, fontSize: 18 }}>‹</Text>
                  <Text style={{ ...theme.typography.label, color: theme.color.primary }}>{t('back')}</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>{editNetworkId ? t('editContact') : t('addContact')}</Text>
                <TouchableOpacity onPress={() => { onClose(); setShowNetworkForm(false); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {showImportModal ? (
              /* ── IMPORT VIEW body ── */
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
                <View style={s.importInstructions}>
                  <Text style={s.importInstructionsTitle}>{t('howToImportExcel')}</Text>
                  <Text style={s.importInstructionsText}>
                    {'1. Make sure columns are: A = Name  |  B = Phone  |  C = Reference\n2. Select all data rows (not the header)\n3. Press Ctrl+C (or Cmd+C on Mac)\n4. Long-press in the box below → Paste'}
                  </Text>
                </View>

                <TextInput
                  style={s.importTextArea}
                  value={importRaw}
                  onChangeText={setImportRaw}
                  placeholder={'Paste Excel data here...\n\nExample:\nAhmad Khalil\t+961 70 111 111\tLawyer\nSara Khoury\t+961 71 222 222\tAgent'}
                  placeholderTextColor={theme.color.textMuted}
                  multiline
                  numberOfLines={6}
                  autoCorrect={false}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={s.importPreviewBtn}
                  onPress={() => {
                    const rows = parseImportText(importRaw);
                    if (!rows.length) { Alert.alert(t('noResults'), t('emptyList')); return; }
                    setImportRows(rows);
                  }}
                >
                  <Text style={s.importPreviewBtnText}>Preview ({parseImportText(importRaw).length} rows)</Text>
                </TouchableOpacity>

                {importRows.length > 0 && (
                  <>
                    <Text style={s.importPreviewLabel}>PREVIEW — {importRows.length} CONTACT{importRows.length !== 1 ? 'S' : ''}</Text>
                    {importRows.map((r, i) => (
                      <View key={i} style={s.importPreviewRow}>
                        <View style={s.importRowNum}><Text style={s.importRowNumText}>{i + 1}</Text></View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.importRowName}>{r.name}</Text>
                          {r.phone ? <Text style={s.importRowSub}>📞 {formatPhoneDisplay(r.phone)}</Text> : null}
                          {r.reference ? <Text style={s.importRowSub}>{t('refPrefix')}: {r.reference}</Text> : null}
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[s.modalSaveBtn, importingContacts && s.modalSaveBtnDisabled]}
                      onPress={handleImportContacts}
                      disabled={importingContacts}
                    >
                      {importingContacts
                        ? <ActivityIndicator color={theme.color.white} size="small" />
                        : <Text style={s.modalSaveBtnText}>Import {importRows.length} Contact{importRows.length !== 1 ? 's' : ''}</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            ) : !showNetworkForm ? (
              /* ── LIST VIEW body ── */
              <>
                <View style={s.mgmtSearchRow}>
                  <TextInput style={s.mgmtSearchInput} value={networkSearch} onChangeText={setNetworkSearch}
                    placeholder={t('searchContact')} placeholderTextColor={theme.color.textMuted}
                    clearButtonMode="while-editing" autoCorrect={false} />
                </View>
                <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                  {network.length === 0 && <Text style={s.mgmtEmpty}>No contacts yet. Tap + New to add one.</Text>}
                  {network
                    .filter(n => !networkSearch.trim() || matchesNetworkSearch(n, networkSearch))
                    .map((contact) => (
                      <View key={contact.id} style={s.netContactCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.netContactName}>{contact.name}</Text>
                          {contact.phone ? (
                            <TouchableOpacity onPress={() => openPhone(contact.phone, contact.name)}>
                              <Text style={s.netContactPhone}>📞 {formatPhoneDisplay(contact.phone)}</Text>
                            </TouchableOpacity>
                          ) : null}
                          {contact.reference ? <Text style={s.netContactRef}>عبر {contact.reference}</Text> : null}
                          {contact.reference_phone ? (
                            <TouchableOpacity onPress={() => openPhone(contact.reference_phone, contact.reference || contact.name)}>
                              <Text style={s.netContactPhone}>📞 {formatPhoneDisplay(contact.reference_phone)}</Text>
                            </TouchableOpacity>
                          ) : null}
                          {contact.city?.name ? <Text style={s.netContactCity}>📍 {contact.city.name}</Text> : null}
                          {/* Additional field values */}
                          {(contact.field_values ?? []).map((fv: any) => (
                            fv.value_text ? (
                              <Text key={fv.field_id} style={s.netContactFieldVal}>
                                {fv.field?.label}: {fv.value_text}
                              </Text>
                            ) : null
                          ))}
                        </View>
                        <View style={s.netContactActions}>
                          <TouchableOpacity onPress={() => openNetworkForm(contact)} style={s.netActionBtn}>
                            <Text style={s.netActionEdit}>✎</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteNetworkContact(contact)} style={s.netActionBtn}>
                            <Text style={s.netActionDelete}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  {networkSearch.trim() && network.filter(n => matchesNetworkSearch(n, networkSearch)).length === 0 && (
                    <Text style={s.mgmtEmpty}>No contacts match "{networkSearch}"</Text>
                  )}
                </ScrollView>
              </>
            ) : (
              /* ── FORM VIEW body ── */
              <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
                {/* Basic fields */}
                <TextInput style={s.modalInput} value={netName} onChangeText={setNetName}
                  placeholder={t('fullNameRequired')} placeholderTextColor={theme.color.textMuted} autoFocus={!editNetworkId} />
                <TextInput style={s.modalInput} value={netPhone} onChangeText={setNetPhone}
                  placeholder={t('phoneNumber')} placeholderTextColor={theme.color.textMuted} keyboardType="phone-pad" />
                <Text style={s.fieldsSectionLabel}>{t('referenceOpt').toUpperCase()}</Text>
                <TextInput style={s.modalInput} value={netReference} onChangeText={setNetReference}
                  placeholder={t('referenceName')} placeholderTextColor={theme.color.textMuted} />
                <TextInput style={s.modalInput} value={netRefPhone} onChangeText={setNetRefPhone}
                  placeholder={t('referencePhone')} placeholderTextColor={theme.color.textMuted} keyboardType="phone-pad" />

                {/* City picker */}
                <TouchableOpacity style={s.netCityTrigger} onPress={() => { setShowNetCityPicker(v => !v); setShowNetFieldPicker(false); }}>
                  <Text style={[s.netCityTriggerText, netCityId && { color: theme.color.textPrimary }]}>
                    📍 {netCityId ? (allCities.find((c: any) => c.id === netCityId)?.name ?? t('city')) : t('setCityOptional')}
                  </Text>
                  {netCityId && (
                    <TouchableOpacity onPress={() => { setNetCityId(null); setShowNetCityPicker(false); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Text style={{ color: theme.color.danger, fontSize: 13, paddingStart: 8 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {showNetCityPicker && (
                  <View style={s.netCityDropdown}>
                    <TextInput style={s.netCitySearch} value={netCitySearch} onChangeText={setNetCitySearch}
                      placeholder={t('searchCity')} placeholderTextColor={theme.color.textMuted} />
                    <View>
                      {allCities
                        .filter((c: any) => !netCitySearch.trim() || c.name.toLowerCase().includes(netCitySearch.toLowerCase()))
                        .slice(0, 15)
                        .map((city: any) => (
                          <TouchableOpacity key={city.id}
                            style={[s.netCityItem, netCityId === city.id && s.netCityItemActive]}
                            onPress={() => { setNetCityId(city.id); setShowNetCityPicker(false); setNetCitySearch(''); }}>
                            <Text style={[s.netCityItemText, netCityId === city.id && { color: theme.color.primary, fontWeight: '700' }]}>{city.name}</Text>
                            {netCityId === city.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>
                )}

                {/* Additional fields */}
                {netAddedFieldIds.length > 0 && (
                  <Text style={[s.fieldsSectionLabel, { marginTop: theme.spacing.space2 }]}>{t('preferences').toUpperCase()}</Text>
                )}
                {netAddedFieldIds.map((fieldId: string) => {
                  const def = netFieldDefs.find((d: any) => d.id === fieldId);
                  if (!def) return null;
                  return (
                    <View key={fieldId} style={{ marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={s.fieldDefLabel}>{def.label}</Text>
                        <TouchableOpacity
                          onPress={() => setNetAddedFieldIds(ids => ids.filter((id: string) => id !== fieldId))}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={{ color: theme.color.danger, fontSize: 13 }}>✕ Remove</Text>
                        </TouchableOpacity>
                      </View>
                      {def.field_type === 'boolean' ? (
                        <View style={s.fieldBoolRow}>
                          <Text style={s.fieldBoolText}>{netFieldValues[fieldId] === 'true' ? t('yes') : t('no')}</Text>
                          <Switch
                            value={netFieldValues[fieldId] === 'true'}
                            onValueChange={v => setNetFieldValues(p => ({ ...p, [fieldId]: v ? 'true' : 'false' }))}
                            trackColor={{ false: theme.color.border, true: theme.color.primary }}
                            thumbColor={theme.color.white}
                          />
                        </View>
                      ) : def.field_type === 'select' && def.options?.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {(def.options as string[]).map((opt: string) => (
                            <TouchableOpacity
                              key={opt}
                              style={[s.selectOption, netFieldValues[fieldId] === opt && s.selectOptionActive]}
                              onPress={() => setNetFieldValues(p => ({ ...p, [fieldId]: opt }))}
                            >
                              <Text style={[s.selectOptionText, netFieldValues[fieldId] === opt && s.selectOptionTextActive]}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : def.field_type === 'date' ? (
                        <View>
                          <TouchableOpacity
                            style={s.dateBtn}
                            onPress={() => {
                              if (netDatePickerFieldId === fieldId) {
                                setNetDatePickerFieldId(null);
                              } else {
                                setNetDatePickerFieldId(fieldId);
                                setNetDatePickerMonthYear(false);
                                setNetDatePickerCurrent(undefined);
                              }
                              setShowNetCityPicker(false);
                              setShowNetFieldPicker(false);
                            }}
                          >
                            <Text style={netFieldValues[fieldId] ? s.dateBtnText : s.dateBtnPlaceholder}>
                              {netFieldValues[fieldId] || `Select ${def.label}`}
                            </Text>
                            <Text style={s.dateBtnIcon}>{netDatePickerFieldId === fieldId ? '▲' : '📅'}</Text>
                          </TouchableOpacity>
                          {netDatePickerFieldId === fieldId && (
                            <View style={s.inlineCalendarContainer}>
                              {netDatePickerMonthYear ? (
                                <View style={s.monthYearPicker}>
                                  <View style={s.monthYearPickerHeader}>
                                    <TouchableOpacity onPress={() => setNetDatePickerYear(y => y - 1)} style={s.monthYearArrow}>
                                      <Text style={s.monthYearArrowText}>‹</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                      style={s.monthYearPickerYearInput}
                                      value={String(netDatePickerYear)}
                                      onChangeText={v => { const n = parseInt(v.replace(/[^0-9]/g, ''), 10); if (!isNaN(n)) setNetDatePickerYear(n); }}
                                      keyboardType="number-pad" maxLength={4} selectTextOnFocus
                                      placeholderTextColor={theme.color.textMuted}
                                    />
                                    <TouchableOpacity onPress={() => setNetDatePickerYear(y => y + 1)} style={s.monthYearArrow}>
                                      <Text style={s.monthYearArrowText}>›</Text>
                                    </TouchableOpacity>
                                  </View>
                                  <View style={s.monthGrid}>
                                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mon, idx) => (
                                      <TouchableOpacity key={mon} style={s.monthGridItem}
                                        onPress={() => { setNetDatePickerCurrent(`${netDatePickerYear}-${String(idx+1).padStart(2,'0')}-01`); setNetDatePickerMonthYear(false); }}>
                                        <Text style={s.monthGridItemText}>{mon}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>
                              ) : (
                                <Calendar
                                  current={netDatePickerCurrent}
                                  onDayPress={(day: any) => {
                                    const [y, m, d] = day.dateString.split('-');
                                    setNetFieldValues(p => ({ ...p, [fieldId]: `${d}/${m}/${y}` }));
                                    setNetDatePickerFieldId(null);
                                    setNetDatePickerCurrent(undefined);
                                  }}
                                  onMonthChange={(date: any) => setNetDatePickerCurrent(date.dateString)}
                                  renderHeader={(date: any) => {
                                    const d = typeof date === 'string' ? new Date(date) : date;
                                    const label = d?.toString ? d.toString('MMMM yyyy') : '';
                                    return (
                                      <TouchableOpacity onPress={() => { setNetDatePickerYear(typeof d?.getFullYear === 'function' ? d.getFullYear() : new Date().getFullYear()); setNetDatePickerMonthYear(true); }} style={s.calHeaderBtn}>
                                        <Text style={s.calHeaderText}>{label} ▾</Text>
                                      </TouchableOpacity>
                                    );
                                  }}
                                  theme={{ backgroundColor: theme.color.bgBase, calendarBackground: theme.color.bgBase, selectedDayBackgroundColor: theme.color.primary, selectedDayTextColor: theme.color.white, todayTextColor: theme.color.primary, dayTextColor: theme.color.textPrimary, textDisabledColor: theme.color.textMuted, arrowColor: theme.color.primary, monthTextColor: theme.color.textPrimary }}
                                />
                              )}
                            </View>
                          )}
                        </View>
                      ) : (
                        <TextInput
                          style={[s.modalInput, def.field_type === 'textarea' && { height: 80, textAlignVertical: 'top' }]}
                          value={netFieldValues[fieldId] ?? ''}
                          onChangeText={v => setNetFieldValues(p => ({ ...p, [fieldId]: v }))}
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
                  );
                })}

                {/* Add Field button + dropdown */}
                <TouchableOpacity
                  style={s.netAddFieldBtn}
                  onPress={() => { setShowNetFieldPicker(v => !v); setShowNetCityPicker(false); setNetDatePickerFieldId(null); }}
                >
                  <Text style={s.netAddFieldBtnText}>{showNetFieldPicker ? '▲ Close' : '＋ Add Field'}</Text>
                </TouchableOpacity>
                {showNetFieldPicker && (
                  <View style={s.netCityDropdown}>
                    <TextInput style={s.netCitySearch} value={netFieldSearch} onChangeText={setNetFieldSearch}
                      placeholder={t('searchInput')} placeholderTextColor={theme.color.textMuted} autoFocus />
                    <View>
                      {netFieldDefs
                        .filter((d: any) => !netAddedFieldIds.includes(d.id) && (!netFieldSearch.trim() || d.label.toLowerCase().includes(netFieldSearch.toLowerCase())))
                        .map((def: any) => (
                          <TouchableOpacity key={def.id} style={s.netFieldPickerItem}
                            onPress={() => { setNetAddedFieldIds(ids => [...ids, def.id]); setShowNetFieldPicker(false); setNetFieldSearch(''); }}>
                            <Text style={s.netCityItemText}>{def.label}</Text>
                            <Text style={s.netFieldPickerType}>{def.field_type}</Text>
                          </TouchableOpacity>
                        ))}
                      {netFieldDefs.filter((d: any) => !netAddedFieldIds.includes(d.id)).length === 0 && (
                        <Text style={{ padding: 12, color: theme.color.textMuted, ...theme.typography.caption }}>All fields already added</Text>
                      )}
                      {netFieldDefs.filter((d: any) => !netAddedFieldIds.includes(d.id) && (!netFieldSearch.trim() || d.label.toLowerCase().includes(netFieldSearch.toLowerCase()))).length === 0
                        && netFieldDefs.filter((d: any) => !netAddedFieldIds.includes(d.id)).length > 0 && (
                        <Text style={{ padding: 12, color: theme.color.textMuted, ...theme.typography.caption }}>No fields match "{netFieldSearch}"</Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Save button */}
                <TouchableOpacity
                  style={[s.modalSaveBtn, { marginTop: theme.spacing.space3 }, savingNetwork && s.modalSaveBtnDisabled]}
                  onPress={handleSaveNetworkContact}
                  disabled={savingNetwork}
                >
                  {savingNetwork
                    ? <ActivityIndicator color={theme.color.white} size="small" />
                    : <Text style={s.modalSaveBtnText}>Save Contact</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
