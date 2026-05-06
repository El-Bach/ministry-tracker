// src/screens/NewTask/components/ServiceSection.tsx
//
// SERVICE section — picker row + Required Docs trigger + collapsible
// "Add Service" inline form with draft stages list (each with its own
// inline city picker + create-new-city form). Phase 4c of the
// NewTaskScreen split.

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { theme } from '../../../theme';
import { s } from '../styles/newTaskStyles';
import { Service, City } from '../../../types';
import { FieldRow } from './FieldRow';

interface DraftStage { name: string; cityId?: string | null; cityName?: string | null }

interface Props {
  t: (key: any) => string;

  // Picker
  selectedService: Service | null;
  onOpenServicePicker: () => void;

  // Required Docs trigger
  onOpenDocSheet: (serviceId: string) => void;

  // Inline new-service form toggle
  showNewServiceForm: boolean;
  setShowNewServiceForm: (updater: boolean | ((prev: boolean) => boolean)) => void;
  newServiceName: string;
  setNewServiceName: (v: string) => void;

  // Draft stages
  newServiceStages: DraftStage[];
  setNewServiceStages: (
    updater: DraftStage[] | ((prev: DraftStage[]) => DraftStage[]),
  ) => void;
  newServiceStageInput: string;
  setNewServiceStageInput: (v: string) => void;

  // Per-draft-stage city picker state
  expandedSvcStageIdx: number | null;
  setExpandedSvcStageIdx: (v: number | null) => void;
  svcStageCitySearch: string;
  setSvcStageCitySearch: (v: string) => void;
  svcStageCreateOpen: boolean;
  setSvcStageCreateOpen: (v: boolean) => void;
  svcStageNewCityName: string;
  setSvcStageNewCityName: (v: string) => void;
  svcStageSavingCity: boolean;
  setDraftStageCity: (idx: number, city: { id: string; name: string } | null) => void;
  createCityForDraftStage: (idx: number) => void;

  // Cities pool
  allCities: City[];

  // Save
  savingService: boolean;
  handleCreateService: () => void;

}

export function ServiceSection(props: Props) {
  const {
    t,
    selectedService, onOpenServicePicker, onOpenDocSheet,
    showNewServiceForm, setShowNewServiceForm,
    newServiceName, setNewServiceName,
    newServiceStages, setNewServiceStages,
    newServiceStageInput, setNewServiceStageInput,
    expandedSvcStageIdx, setExpandedSvcStageIdx,
    svcStageCitySearch, setSvcStageCitySearch,
    svcStageCreateOpen, setSvcStageCreateOpen,
    svcStageNewCityName, setSvcStageNewCityName,
    svcStageSavingCity, setDraftStageCity, createCityForDraftStage,
    allCities,
    savingService, handleCreateService,
  } = props;

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{t('services').toUpperCase()}</Text>
      <FieldRow
        label={t('services')}
        value={selectedService?.name ?? ''}
        onPress={onOpenServicePicker}
      />
      {selectedService && (
        <Text style={s.hint}>Est. {selectedService.estimated_duration_days} days</Text>
      )}
      {selectedService && (
        <TouchableOpacity
          style={s.docsSheetBtn}
          onPress={() => onOpenDocSheet(selectedService.id)}
          activeOpacity={0.75}
        >
          <Text style={s.docsSheetBtnText}>📋 {t('requiredDocs')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={s.addInlineBtn}
        onPress={() => setShowNewServiceForm((v) => !v)}
      >
        <Text style={s.addInlineBtnText}>
          {showNewServiceForm ? `− ${t('cancel')}` : `${t('add')} ${t('service')}`}
        </Text>
      </TouchableOpacity>

      {showNewServiceForm && (
        <View style={s.inlineForm}>
          <TextInput
            style={s.inlineInput}
            value={newServiceName}
            onChangeText={setNewServiceName}
            placeholder={`${t('serviceName')} *`}
            placeholderTextColor={theme.color.textMuted}
            autoFocus
          />

          {/* Draft stages list */}
          {newServiceStages.length > 0 && (
            <View style={s.newSvcStageList}>
              {newServiceStages.map((draft, idx) => (
                <View key={idx}>
                  <View style={s.newSvcStageRow}>
                    <View style={s.stageIndex}>
                      <Text style={s.stageIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.newSvcStageName} numberOfLines={1}>{draft.name}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setExpandedSvcStageIdx(expandedSvcStageIdx === idx ? null : idx);
                          setSvcStageCitySearch('');
                          setSvcStageCreateOpen(false);
                          setSvcStageNewCityName('');
                        }}
                      >
                        <Text style={{ fontSize: 11, color: draft.cityName ? theme.color.primary : theme.color.textMuted, marginTop: 2, fontWeight: draft.cityName ? '600' : '400' }}>
                          {draft.cityName ? `📍 ${draft.cityName}` : '📍 Tap to set city'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => {
                      setNewServiceStages((prev) => prev.filter((_, i) => i !== idx));
                      if (expandedSvcStageIdx === idx) setExpandedSvcStageIdx(null);
                    }}>
                      <Text style={s.stageRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Inline city picker for this draft stage */}
                  {expandedSvcStageIdx === idx && (
                    <View style={s.stageDetailPanel}>
                      <TextInput
                        style={s.stageDetailSearch}
                        value={svcStageCitySearch}
                        onChangeText={setSvcStageCitySearch}
                        placeholder={t('searchCity')}
                        placeholderTextColor={theme.color.textMuted}
                      />
                      {draft.cityId && (
                        <TouchableOpacity onPress={() => setDraftStageCity(idx, null)}>
                          <Text style={{ color: theme.color.danger, padding: 8, fontSize: 13 }}>✕ Remove city</Text>
                        </TouchableOpacity>
                      )}
                      {allCities
                        .filter(c => !svcStageCitySearch.trim() || c.name.includes(svcStageCitySearch.trim()))
                        .slice(0, 10)
                        .map(c => (
                          <TouchableOpacity
                            key={c.id}
                            style={[s.stageDetailItem, draft.cityId === c.id && s.stageDetailItemActive]}
                            onPress={() => { setDraftStageCity(idx, { id: c.id, name: c.name }); setSvcStageCitySearch(''); }}
                          >
                            <Text style={s.stageDetailItemText}>{c.name}</Text>
                            {draft.cityId === c.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                          </TouchableOpacity>
                        ))}

                      {/* Create new city for this draft */}
                      {!svcStageCreateOpen ? (
                        <TouchableOpacity
                          style={s.inlineCreateBtn}
                          onPress={() => {
                            setSvcStageCreateOpen(true);
                            if (svcStageCitySearch.trim()) setSvcStageNewCityName(svcStageCitySearch.trim());
                          }}
                        >
                          <Text style={s.inlineCreateBtnText}>＋ Create new city</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={s.inlineCreateForm}>
                          <TextInput
                            style={s.inlineCreateInput}
                            value={svcStageNewCityName}
                            onChangeText={setSvcStageNewCityName}
                            placeholder={t('city')}
                            placeholderTextColor={theme.color.textMuted}
                            autoFocus
                          />
                          <View style={s.inlineCreateActions}>
                            <TouchableOpacity
                              style={s.inlineCancelBtn}
                              onPress={() => { setSvcStageCreateOpen(false); setSvcStageNewCityName(''); }}
                            >
                              <Text style={s.inlineCancelBtnText}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.inlineSaveBtn, svcStageSavingCity && { opacity: 0.6 }]}
                              disabled={svcStageSavingCity}
                              onPress={() => createCityForDraftStage(idx)}
                            >
                              <Text style={s.inlineSaveBtnText}>
                                {svcStageSavingCity ? t('pleaseWait') : t('save')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={s.stageDetailSaveBtn}
                        onPress={() => {
                          setExpandedSvcStageIdx(null);
                          setSvcStageCitySearch('');
                          setSvcStageCreateOpen(false);
                          setSvcStageNewCityName('');
                        }}
                      >
                        <Text style={s.stageDetailSaveBtnText}>✓ Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Add-stage row */}
          <View style={s.newSvcAddRow}>
            <TextInput
              style={[s.inlineInput, { flex: 1, marginBottom: 0 }]}
              value={newServiceStageInput}
              onChangeText={setNewServiceStageInput}
              placeholder={`+ ${t('stageName')}`}
              placeholderTextColor={theme.color.textMuted}
              onSubmitEditing={() => {
                if (newServiceStageInput.trim()) {
                  setNewServiceStages((prev) => [...prev, { name: newServiceStageInput.trim() }]);
                  setNewServiceStageInput('');
                }
              }}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={s.newSvcPlusBtn}
              onPress={() => {
                if (newServiceStageInput.trim()) {
                  setNewServiceStages((prev) => [...prev, { name: newServiceStageInput.trim() }]);
                  setNewServiceStageInput('');
                }
              }}
            >
              <Text style={s.newSvcPlusBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.inlineSaveBtn, savingService && s.disabled]}
            onPress={handleCreateService}
            disabled={savingService}
          >
            {savingService
              ? <ActivityIndicator color={theme.color.white} size="small" />
              : <Text style={s.inlineSaveBtnText}>{t('save')}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
