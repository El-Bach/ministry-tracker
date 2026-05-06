// src/screens/NewTask/components/StagesSection.tsx
//
// STAGES section — the biggest visual block in NewTaskScreen. Renders the
// route_stops list with rename/move/remove + per-stage inline city +
// assignee picker (with create-new-city and create-new-external-contact
// inline forms) + Add Stage trigger + collapsible Create Stage form.
// Phase 4d of the NewTaskScreen split.

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { theme } from '../../../theme';
import { Service, City, TeamMember } from '../../../types';

interface RouteStopLite { id: string; name: string }

interface StageCityValue { cityId: string; cityName: string }
interface StageAssigneeValue { id: string; name: string; isExt: boolean }

interface Props {
  t: (key: any) => string;

  // Show/hide gate
  selectedService: Service | null;

  // Stage list + manipulation
  routeStops: RouteStopLite[];
  editingStageIdx: number | null;
  setEditingStageIdx: (v: number | null) => void;
  editingStageName: string;
  setEditingStageName: (v: string) => void;
  savingStageRename: boolean;
  handleRenameStage: () => void;
  moveStop: (idx: number, dir: -1 | 1) => void;
  removeRouteStop: (id: string) => void;

  // Per-stage inline detail picker
  openStageDetailId: string | null;
  setOpenStageDetailId: (v: string | null | ((prev: string | null) => string | null)) => void;
  stageDetailTab: 'city' | 'assignee';
  setStageDetailTab: (v: 'city' | 'assignee') => void;

  // City picker
  stageCityMap: Record<string, StageCityValue | null>;
  stageCitySearch: string;
  setStageCitySearch: (v: string) => void;
  allCities: City[];
  persistStageCity: (stageId: string, city: StageCityValue | null) => void;

  // Create new city inline
  showCreateCityForm: boolean;
  setShowCreateCityForm: (v: boolean) => void;
  newCityName: string;
  setNewCityName: (v: string) => void;
  newCityInputRef: React.RefObject<TextInput | null>;
  savingNewCity: boolean;
  handleCreateCityForStage: (stageId: string) => void;

  // Assignee picker
  stageAssigneeMap: Record<string, StageAssigneeValue | null>;
  setStageAssigneeMap: (
    updater: Record<string, StageAssigneeValue | null>
      | ((prev: Record<string, StageAssigneeValue | null>) => Record<string, StageAssigneeValue | null>),
  ) => void;
  stageAssigneeSearch: string;
  setStageAssigneeSearch: (v: string) => void;
  teamMembers: TeamMember[];
  allAssignees: { id: string; name: string }[];

  // Create new external assignee inline
  showCreateExtForm: boolean;
  setShowCreateExtForm: (v: boolean) => void;
  newExtName: string;
  setNewExtName: (v: string) => void;
  newExtPhone: string;
  setNewExtPhone: (v: string) => void;
  newExtReference: string;
  setNewExtReference: (v: string) => void;
  newExtNameInputRef: React.RefObject<TextInput | null>;
  savingNewExt: boolean;
  handleCreateExtAssigneeForStage: (stageId: string) => void;

  // Add stage trigger + create-new-stage form
  onOpenStagePicker: () => void;
  showNewStageForm: boolean;
  setShowNewStageForm: (updater: boolean | ((prev: boolean) => boolean)) => void;
  newStageName: string;
  setNewStageName: (v: string) => void;
  savingStage: boolean;
  handleCreateStage: () => void;

  s: any;
}

export function StagesSection(props: Props) {
  const {
    t, selectedService,
    routeStops, editingStageIdx, setEditingStageIdx, editingStageName, setEditingStageName,
    savingStageRename, handleRenameStage, moveStop, removeRouteStop,
    openStageDetailId, setOpenStageDetailId, stageDetailTab, setStageDetailTab,
    stageCityMap, stageCitySearch, setStageCitySearch, allCities, persistStageCity,
    showCreateCityForm, setShowCreateCityForm,
    newCityName, setNewCityName, newCityInputRef, savingNewCity, handleCreateCityForStage,
    stageAssigneeMap, setStageAssigneeMap, stageAssigneeSearch, setStageAssigneeSearch,
    teamMembers, allAssignees,
    showCreateExtForm, setShowCreateExtForm,
    newExtName, setNewExtName, newExtPhone, setNewExtPhone, newExtReference, setNewExtReference,
    newExtNameInputRef, savingNewExt, handleCreateExtAssigneeForStage,
    onOpenStagePicker,
    showNewStageForm, setShowNewStageForm, newStageName, setNewStageName,
    savingStage, handleCreateStage,
    s,
  } = props;

  if (!selectedService) return null;

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{t('stagesSection').toUpperCase()}</Text>
      {routeStops.length === 0 && (
        <Text style={s.hint}>No default stages for this service. Add stages below.</Text>
      )}

      {routeStops.length > 0 && (
        <View style={s.selectedStages}>
          {routeStops.map((stage, idx) => (
            <View key={stage.id} style={s.stageRow}>
              <View style={s.stageIndex}>
                <Text style={s.stageIndexText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                {/* Stage name row */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {editingStageIdx === idx ? (
                    <TextInput
                      style={[s.inlineInput, { flex: 1, marginVertical: 0, paddingVertical: 6 }]}
                      value={editingStageName}
                      onChangeText={setEditingStageName}
                      autoFocus
                      onSubmitEditing={handleRenameStage}
                      returnKeyType="done"
                    />
                  ) : (
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        setOpenStageDetailId(v => v === stage.id ? null : stage.id);
                        setStageCitySearch('');
                        setStageAssigneeSearch('');
                        setStageDetailTab('city');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={s.stageName} numberOfLines={1}>{stage.name}</Text>
                      {/* Discovery hint only when nothing's set yet */}
                      {!stageCityMap[stage.id] && !stageAssigneeMap[stage.id] && (
                        <Text style={{ fontSize: 11, color: theme.color.textMuted, marginTop: 2 }}>
                          📍 tap to set city & assignee
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={s.stageActions}>
                    {editingStageIdx === idx ? (
                      <>
                        <TouchableOpacity onPress={handleRenameStage} disabled={savingStageRename}>
                          {savingStageRename
                            ? <ActivityIndicator size="small" color={theme.color.success} />
                            : <Text style={s.stageRenameConfirm}>✓</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingStageIdx(null)}>
                          <Text style={s.stageRemove}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity onPress={() => { setEditingStageIdx(idx); setEditingStageName(stage.name); }}>
                          <Text style={s.stageEdit}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => moveStop(idx, -1)} disabled={idx === 0}>
                          <Text style={[s.stageArrow, idx === 0 && s.disabled]}>↑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => moveStop(idx, 1)} disabled={idx === routeStops.length - 1}>
                          <Text style={[s.stageArrow, idx === routeStops.length - 1 && s.disabled]}>↓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeRouteStop(stage.id)}>
                          <Text style={s.stageRemove}>✕</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>

                {/* Inline city + assignee picker */}
                {openStageDetailId === stage.id && (
                  <View style={s.stageDetailPanel}>
                    {/* Tab selector */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <TouchableOpacity
                        style={[s.stageDetailTab, stageDetailTab === 'city' && s.stageDetailTabActive]}
                        onPress={() => setStageDetailTab('city')}
                      >
                        <Text style={[s.stageDetailTabText, stageDetailTab === 'city' && { color: theme.color.primary }]}>
                          📍 City
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.stageDetailTab, stageDetailTab === 'assignee' && s.stageDetailTabActive]}
                        onPress={() => setStageDetailTab('assignee')}
                      >
                        <Text style={[s.stageDetailTabText, stageDetailTab === 'assignee' && { color: theme.color.primary }]}>
                          👤 Assignee
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {stageDetailTab === 'city' && (
                      <>
                        <TextInput
                          style={s.stageDetailSearch}
                          value={stageCitySearch}
                          onChangeText={setStageCitySearch}
                          placeholder={t('searchCity')}
                          placeholderTextColor={theme.color.textMuted}
                        />
                        <View>
                          {stageCityMap[stage.id] && (
                            <TouchableOpacity onPress={() => persistStageCity(stage.id, null)}>
                              <Text style={{ color: theme.color.danger, padding: 8, fontSize: 13 }}>✕ Remove city</Text>
                            </TouchableOpacity>
                          )}
                          {allCities
                            .filter(c => !stageCitySearch.trim() || c.name.includes(stageCitySearch.trim()))
                            .slice(0, 10)
                            .map(c => (
                              <TouchableOpacity
                                key={c.id}
                                style={[s.stageDetailItem, stageCityMap[stage.id]?.cityId === c.id && s.stageDetailItemActive]}
                                onPress={() => { persistStageCity(stage.id, { cityId: c.id, cityName: c.name }); setStageCitySearch(''); }}
                              >
                                <Text style={s.stageDetailItemText}>{c.name}</Text>
                                {stageCityMap[stage.id]?.cityId === c.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                              </TouchableOpacity>
                            ))}
                          {/* Create new city */}
                          {!showCreateCityForm ? (
                            <TouchableOpacity
                              style={s.inlineCreateBtn}
                              onPress={() => {
                                setShowCreateCityForm(true);
                                if (stageCitySearch.trim()) setNewCityName(stageCitySearch.trim());
                                setTimeout(() => newCityInputRef.current?.focus(), 300);
                              }}
                            >
                              <Text style={s.inlineCreateBtnText}>＋ Create new city</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={s.inlineCreateForm}>
                              <TextInput
                                ref={newCityInputRef}
                                style={s.inlineCreateInput}
                                value={newCityName}
                                onChangeText={setNewCityName}
                                placeholder={t('city')}
                                placeholderTextColor={theme.color.textMuted}
                              />
                              <View style={s.inlineCreateActions}>
                                <TouchableOpacity
                                  style={s.inlineCancelBtn}
                                  onPress={() => { setShowCreateCityForm(false); setNewCityName(''); }}
                                >
                                  <Text style={s.inlineCancelBtnText}>{t('cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[s.inlineSaveBtn, savingNewCity && { opacity: 0.6 }]}
                                  disabled={savingNewCity}
                                  onPress={() => handleCreateCityForStage(stage.id)}
                                >
                                  <Text style={s.inlineSaveBtnText}>
                                    {savingNewCity ? t('pleaseWait') : t('createAndAdd')}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      </>
                    )}

                    {stageDetailTab === 'assignee' && (
                      <>
                        <TextInput
                          style={s.stageDetailSearch}
                          value={stageAssigneeSearch}
                          onChangeText={setStageAssigneeSearch}
                          placeholder={t('searchMember')}
                          placeholderTextColor={theme.color.textMuted}
                        />
                        <View>
                          {stageAssigneeMap[stage.id] && (
                            <TouchableOpacity onPress={() => setStageAssigneeMap(m => ({ ...m, [stage.id]: null }))}>
                              <Text style={{ color: theme.color.danger, padding: 8, fontSize: 13 }}>{t('removeAssignment')}</Text>
                            </TouchableOpacity>
                          )}
                          <Text style={{ fontSize: 11, color: theme.color.textMuted, paddingHorizontal: 8, paddingTop: 4, fontWeight: '700' }}>{t('teamSectionLabel')}</Text>
                          {teamMembers
                            .filter(tm => !stageAssigneeSearch.trim() || tm.name.toLowerCase().includes(stageAssigneeSearch.toLowerCase()))
                            .slice(0, 15)
                            .map(tm => (
                              <TouchableOpacity
                                key={tm.id}
                                style={[s.stageDetailItem, stageAssigneeMap[stage.id]?.id === tm.id && s.stageDetailItemActive]}
                                onPress={() => { setStageAssigneeMap(m => ({ ...m, [stage.id]: { id: tm.id, name: tm.name, isExt: false } })); setStageAssigneeSearch(''); }}
                              >
                                <Text style={s.stageDetailItemText}>{tm.name}</Text>
                                {stageAssigneeMap[stage.id]?.id === tm.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                              </TouchableOpacity>
                            ))}
                          {allAssignees.length > 0 && (
                            <Text style={{ fontSize: 11, color: theme.color.textMuted, paddingHorizontal: 8, paddingTop: 8, fontWeight: '700' }}>{t('externalSectionLabel')}</Text>
                          )}
                          {allAssignees
                            .filter(a => !stageAssigneeSearch.trim() || a.name.toLowerCase().includes(stageAssigneeSearch.toLowerCase()))
                            .slice(0, 15)
                            .map(a => (
                              <TouchableOpacity
                                key={a.id}
                                style={[s.stageDetailItem, stageAssigneeMap[stage.id]?.id === a.id && s.stageDetailItemActive]}
                                onPress={() => { setStageAssigneeMap(m => ({ ...m, [stage.id]: { id: a.id, name: a.name, isExt: true } })); setStageAssigneeSearch(''); }}
                              >
                                <Text style={s.stageDetailItemText}>{a.name}</Text>
                                {stageAssigneeMap[stage.id]?.id === a.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                              </TouchableOpacity>
                            ))}
                          {/* Create new external contact */}
                          {!showCreateExtForm ? (
                            <TouchableOpacity
                              style={s.inlineCreateBtn}
                              onPress={() => {
                                setShowCreateExtForm(true);
                                if (stageAssigneeSearch.trim()) setNewExtName(stageAssigneeSearch.trim());
                                setTimeout(() => newExtNameInputRef.current?.focus(), 300);
                              }}
                            >
                              <Text style={s.inlineCreateBtnText}>＋ {t('createNewContact')}</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={s.inlineCreateForm}>
                              <TextInput
                                ref={newExtNameInputRef}
                                style={s.inlineCreateInput}
                                value={newExtName}
                                onChangeText={setNewExtName}
                                placeholder={`${t('name')} *`}
                                placeholderTextColor={theme.color.textMuted}
                              />
                              <TextInput
                                style={s.inlineCreateInput}
                                value={newExtPhone}
                                onChangeText={setNewExtPhone}
                                placeholder={t('phoneNumberOpt')}
                                placeholderTextColor={theme.color.textMuted}
                                keyboardType="phone-pad"
                              />
                              <TextInput
                                style={s.inlineCreateInput}
                                value={newExtReference}
                                onChangeText={setNewExtReference}
                                placeholder={t('referenceOpt')}
                                placeholderTextColor={theme.color.textMuted}
                              />
                              <View style={s.inlineCreateActions}>
                                <TouchableOpacity
                                  style={s.inlineCancelBtn}
                                  onPress={() => {
                                    setShowCreateExtForm(false);
                                    setNewExtName(''); setNewExtPhone(''); setNewExtReference('');
                                  }}
                                >
                                  <Text style={s.inlineCancelBtnText}>{t('cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[s.inlineSaveBtn, savingNewExt && { opacity: 0.6 }]}
                                  disabled={savingNewExt}
                                  onPress={() => handleCreateExtAssigneeForStage(stage.id)}
                                >
                                  <Text style={s.inlineSaveBtnText}>
                                    {savingNewExt ? t('pleaseWait') : t('createAndAdd')}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      </>
                    )}

                    {/* Save & close — confirms current city/assignee selection and collapses the picker */}
                    <TouchableOpacity
                      style={s.stageDetailSaveBtn}
                      onPress={() => {
                        setOpenStageDetailId(null);
                        setStageCitySearch('');
                        setStageAssigneeSearch('');
                        setShowCreateCityForm(false);
                        setShowCreateExtForm(false);
                      }}
                    >
                      <Text style={s.stageDetailSaveBtnText}>✓ {t('save')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.addStopBtn} onPress={onOpenStagePicker}>
        <Text style={s.addStopBtnText}>{t('addStageBtn')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.addInlineBtn}
        onPress={() => setShowNewStageForm((v) => !v)}
      >
        <Text style={s.addInlineBtnText}>
          {showNewStageForm ? `− ${t('cancel')}` : t('createStage')}
        </Text>
      </TouchableOpacity>
      {showNewStageForm && (
        <View style={s.inlineForm}>
          <TextInput
            style={s.inlineInput}
            value={newStageName}
            onChangeText={setNewStageName}
            placeholder={`${t('stageName')} *`}
            placeholderTextColor={theme.color.textMuted}
          />
          <TouchableOpacity
            style={[s.inlineSaveBtn, savingStage && s.disabled]}
            onPress={handleCreateStage}
            disabled={savingStage}
          >
            {savingStage
              ? <ActivityIndicator color={theme.color.white} size="small" />
              : <Text style={s.inlineSaveBtnText}>{t('save')} & {t('addStage')}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
