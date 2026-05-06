// src/screens/Create/components/ManageStagesModal.tsx
//
// Manage > Stages modal: list with inline new/edit/delete + per-stage city
// chip with inline picker (search + create new) + 👥 contacts shortcut +
// Excel import panel. Phase 3b extraction.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { theme } from '../../../theme';
import { s } from '../styles/createStyles';
import { Ministry } from '../../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;

  // Data
  ministries: Ministry[];
  allCities: any[];

  // Search
  stageSearch: string;
  setStageSearch: (v: string) => void;

  // New stage
  newStageName: string;
  setNewStageName: (v: string) => void;
  savingNewStage: boolean;
  handleCreateStage: () => void;

  // Edit stage inline
  editStageId: string | null;
  setEditStageId: (v: string | null) => void;
  editStageName: string;
  setEditStageName: (v: string) => void;
  savingEditStage: boolean;
  handleSaveEditStage: () => void;
  handleDeleteStage: (m: Ministry) => void;

  // Per-stage city picker
  stageCityPickerId: string | null;
  setStageCityPickerId: (v: string | null | ((prev: string | null) => string | null)) => void;
  stageCitySearch: string;
  setStageCitySearch: (v: string) => void;
  showCreateStageCityForm: boolean;
  setShowCreateStageCityForm: (v: boolean | ((prev: boolean) => boolean)) => void;
  newStageCityName: string;
  setNewStageCityName: (v: string) => void;
  savingStageCity: boolean;
  handleSetStageCity: (ministryId: string, cityId: string | null) => void;
  handleCreateStageCity: (ministryId: string) => void;

  // Ministry contacts (👥) shortcut — opens MinistryContactsSheet
  setContactsMinistryId: (id: string | null) => void;

  // Excel import
  showStageImport: boolean;
  setShowStageImport: (v: boolean | ((prev: boolean) => boolean)) => void;
  stageImportRaw: string;
  setStageImportRaw: (v: string) => void;
  stageImportNames: string[];
  setStageImportNames: (v: string[]) => void;
  importingStages: boolean;
  parseStageImport: (raw: string) => string[];
  handleImportStages: () => void;

}

export function ManageStagesModal(props: Props) {
  const {
    visible, onClose, t,
    ministries, allCities,
    stageSearch, setStageSearch,
    newStageName, setNewStageName, savingNewStage, handleCreateStage,
    editStageId, setEditStageId, editStageName, setEditStageName,
    savingEditStage, handleSaveEditStage, handleDeleteStage,
    stageCityPickerId, setStageCityPickerId,
    stageCitySearch, setStageCitySearch,
    showCreateStageCityForm, setShowCreateStageCityForm,
    newStageCityName, setNewStageCityName, savingStageCity,
    handleSetStageCity, handleCreateStageCity,
    setContactsMinistryId,
    showStageImport, setShowStageImport,
    stageImportRaw, setStageImportRaw,
    stageImportNames, setStageImportNames,
    importingStages, parseStageImport, handleImportStages,
  } = props;

  const filtered = ministries.filter((m) =>
    !stageSearch.trim() || m.name.toLowerCase().includes(stageSearch.toLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { onClose(); setEditStageId(null); setStageSearch(''); setShowStageImport(false); }}
    >
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }}>
          <View style={[s.modalSheet, { maxHeight: '90%' }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{t('stages')}</Text>
                <Text style={s.modalSubtitle}>
                  {stageSearch ? `${filtered.length} of ${ministries.length}` : `${ministries.length} total`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={s.docImportToggleBtn}
                  onPress={() => { setShowStageImport(v => !v); setStageImportRaw(''); setStageImportNames([]); }}
                >
                  <Text style={s.docImportToggleBtnText}>📥</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onClose(); setEditStageId(null); setStageSearch(''); setShowStageImport(false); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Stage import panel */}
            {showStageImport && (
              <View style={[s.docImportPanel, { marginHorizontal: theme.spacing.space3, marginBottom: theme.spacing.space2 }]}>
                <Text style={s.docImportLabel}>{t('importBtn')} ({t('stageName')})</Text>
                <TextInput
                  style={s.docImportTextArea}
                  value={stageImportRaw}
                  onChangeText={(txt) => { setStageImportRaw(txt); setStageImportNames([]); }}
                  placeholder={t('paste')}
                  placeholderTextColor={theme.color.textMuted}
                  multiline
                  textAlignVertical="top"
                />
                {stageImportNames.length === 0 ? (
                  <TouchableOpacity style={s.docImportPreviewBtn} onPress={() => setStageImportNames(parseStageImport(stageImportRaw))} disabled={!stageImportRaw.trim()}>
                    <Text style={s.docImportPreviewBtnText}>{t('preview')}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {stageImportNames.map((name, i) => (
                      <View key={i} style={s.docImportPreviewRow}>
                        <Text style={s.docImportPreviewTitle} numberOfLines={1}>{name}</Text>
                      </View>
                    ))}
                    <TouchableOpacity style={s.docImportConfirmBtn} onPress={handleImportStages} disabled={importingStages}>
                      {importingStages ? <ActivityIndicator size="small" color={theme.color.white} /> : <Text style={s.docImportConfirmBtnText}>{t('importBtn')} {stageImportNames.length} {t('stage')}{stageImportNames.length !== 1 ? 's' : ''}</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <View style={s.mgmtSearchRow}>
              <TextInput
                style={s.mgmtSearchInput}
                value={stageSearch}
                onChangeText={setStageSearch}
                placeholder={t('searchStage')}
                placeholderTextColor={theme.color.textMuted}
                clearButtonMode="while-editing"
                autoCorrect={false}
              />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              <View style={[s.mgmtAddBlock, { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }]}>
                <Text style={[s.mgmtAddSectionLabel, { position: 'absolute', top: 14, left: 14 }]}>{t('newStage').toUpperCase()}</Text>
                <TextInput style={[s.modalInput, { flex: 1, marginTop: 20 }]} value={newStageName} onChangeText={setNewStageName} placeholder={`${t('stageName')} *`} placeholderTextColor={theme.color.textMuted} />
                <TouchableOpacity style={s.mgmtAddBtn} onPress={handleCreateStage} disabled={savingNewStage}>
                  {savingNewStage ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtAddBtnText}>+ {t('add')}</Text>}
                </TouchableOpacity>
              </View>

              {filtered.map((m) => (
                <View key={m.id}>
                  {editStageId === m.id ? (
                    <View style={s.mgmtEditRow}>
                      <TextInput style={[s.modalInput, { flex: 1 }]} value={editStageName} onChangeText={setEditStageName} placeholder={t('stageName')} placeholderTextColor={theme.color.textMuted} autoFocus />
                      <TouchableOpacity style={s.mgmtSaveBtn} onPress={handleSaveEditStage} disabled={savingEditStage}>
                        {savingEditStage ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtSaveBtnText}>{t('save')}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={s.mgmtCancelBtn} onPress={() => setEditStageId(null)}>
                        <Text style={s.mgmtCancelBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <View style={s.mgmtItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.mgmtItemName}>{m.name}</Text>
                          {/* City chip */}
                          {(() => {
                            const cityName = m.city?.name ?? allCities.find((c: any) => c.id === m.city_id)?.name ?? null;
                            return (
                              <TouchableOpacity
                                style={s.stageCityChip}
                                onPress={() => {
                                  setStageCityPickerId(v => v === m.id ? null : m.id);
                                  setStageCitySearch('');
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={[s.stageCityChipText, cityName ? { color: theme.color.primary } : {}]}>
                                  📍 {cityName ?? t('setCityOptional')}
                                </Text>
                              </TouchableOpacity>
                            );
                          })()}
                        </View>
                        <TouchableOpacity style={s.mgmtEditBtn} onPress={() => { setStageCityPickerId(null); setEditStageId(m.id); setEditStageName(m.name); }}>
                          <Text style={s.mgmtEditBtnText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.mgmtEditBtn} onPress={() => { setStageCityPickerId(null); setContactsMinistryId(m.id); }}>
                          <Text style={s.mgmtEditBtnText}>👥</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.mgmtDelBtn} onPress={() => handleDeleteStage(m)}>
                          <Text style={s.mgmtDelBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>

                      {/* City picker dropdown */}
                      {stageCityPickerId === m.id && (
                        <View style={s.stageCityPanel}>
                          <TextInput
                            style={s.mgmtSearchInput}
                            value={stageCitySearch}
                            onChangeText={text => { setStageCitySearch(text); setShowCreateStageCityForm(false); setNewStageCityName(text); }}
                            placeholder={t('searchCity')}
                            placeholderTextColor={theme.color.textMuted}
                            autoCorrect={false}
                          />
                          {/* Create new city — always visible above list */}
                          <TouchableOpacity
                            style={[s.stageCityItem, { borderBottomWidth: 1, borderBottomColor: theme.color.border }]}
                            onPress={() => { setShowCreateStageCityForm(v => !v); if (!newStageCityName) setNewStageCityName(stageCitySearch); }}
                          >
                            <Text style={{ color: theme.color.primary, fontSize: 13, fontWeight: '600' }}>
                              {showCreateStageCityForm ? '− Cancel' : '+ Create New City'}
                            </Text>
                          </TouchableOpacity>
                          {showCreateStageCityForm && (
                            <View style={{ padding: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
                              <TextInput
                                style={s.mgmtSearchInput}
                                value={newStageCityName}
                                onChangeText={setNewStageCityName}
                                placeholder={`${t('city')} *`}
                                placeholderTextColor={theme.color.textMuted}
                                autoFocus
                              />
                              <TouchableOpacity
                                style={[s.mgmtSaveBtn, savingStageCity && { opacity: 0.6 }]}
                                onPress={() => handleCreateStageCity(m.id)}
                                disabled={savingStageCity}
                              >
                                {savingStageCity
                                  ? <ActivityIndicator size="small" color={theme.color.white} />
                                  : <Text style={s.mgmtSaveBtnText}>{t('saveCityBtn')}</Text>}
                              </TouchableOpacity>
                            </View>
                          )}
                          <View>
                            {m.city_id && (
                              <TouchableOpacity
                                style={s.stageCityItem}
                                onPress={() => handleSetStageCity(m.id, null)}
                              >
                                <Text style={{ color: theme.color.danger, fontSize: 13 }}>✕ Remove city</Text>
                              </TouchableOpacity>
                            )}
                            {allCities
                              .filter((c: any) => !stageCitySearch.trim() || c.name.toLowerCase().includes(stageCitySearch.toLowerCase()))
                              .slice(0, 15)
                              .map((city: any) => (
                                <TouchableOpacity
                                  key={city.id}
                                  style={[s.stageCityItem, m.city_id === city.id && s.stageCityItemActive]}
                                  onPress={() => handleSetStageCity(m.id, city.id)}
                                >
                                  <Text style={[s.stageCityItemText, m.city_id === city.id && { color: theme.color.primary, fontWeight: '600' }]}>
                                    {city.name}
                                  </Text>
                                  {m.city_id === city.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                                </TouchableOpacity>
                              ))}
                            {allCities.filter((c: any) => !stageCitySearch.trim() || c.name.toLowerCase().includes(stageCitySearch.toLowerCase())).length === 0 && (
                              <Text style={{ color: theme.color.textMuted, fontSize: 13, padding: 12 }}>{t('noCitiesMatch')} "{stageCitySearch}"</Text>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}
              {stageSearch.trim() && filtered.length === 0 && (
                <Text style={s.mgmtEmpty}>{t('noStagesMatch')} "{stageSearch}"</Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
