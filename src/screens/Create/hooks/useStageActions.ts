// src/screens/Create/hooks/useStageActions.ts
//
// Stage (Ministry) handlers extracted from CreateScreen — Phase 5c.
// Owns: create / save-edit / delete + per-stage city set + create-new-city
// inline + Excel import. State stays in the parent.

import { Alert, Platform } from 'react-native';
import supabase from '../../../lib/supabase';
import { Ministry } from '../../../types';

export interface UseStageActionsOptions {
  orgId: string;
  t: (key: any) => string;
  fetchData: () => void;

  // New stage
  newStageName: string;
  setNewStageName: (v: string) => void;
  setSavingNewStage: (v: boolean) => void;

  // Edit stage inline
  editStageId: string | null;
  setEditStageId: (v: string | null) => void;
  editStageName: string;
  setSavingEditStage: (v: boolean) => void;

  // Per-stage city + inline create-new-city
  setStageCityPickerId: (v: string | null) => void;
  setStageCitySearch: (v: string) => void;
  newStageCityName: string;
  setNewStageCityName: (v: string) => void;
  setShowCreateStageCityForm: (v: boolean) => void;
  setSavingStageCity: (v: boolean) => void;
  setAllCities: (
    updater: any[] | ((prev: any[]) => any[]),
  ) => void;

  // Excel import
  stageImportNames: string[];
  setStageImportRaw: (v: string) => void;
  setStageImportNames: (v: string[]) => void;
  setImportingStages: (v: boolean) => void;
  setShowStageImport: (v: boolean) => void;
  setMinistries: (
    updater: Ministry[] | ((prev: Ministry[]) => Ministry[]),
  ) => void;
}

export function useStageActions(opts: UseStageActionsOptions) {
  const {
    orgId, t, fetchData,
    newStageName, setNewStageName, setSavingNewStage,
    editStageId, setEditStageId, editStageName, setSavingEditStage,
    setStageCityPickerId, setStageCitySearch,
    newStageCityName, setNewStageCityName, setShowCreateStageCityForm, setSavingStageCity,
    setAllCities,
    stageImportNames, setStageImportRaw, setStageImportNames,
    setImportingStages, setShowStageImport, setMinistries,
  } = opts;

  const handleCreateStage = async () => {
    if (!newStageName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingNewStage(true);
    await supabase.from('ministries').insert({ name: newStageName.trim(), type: 'parent', org_id: orgId });
    setSavingNewStage(false);
    setNewStageName('');
    fetchData();
  };

  const handleSaveEditStage = async () => {
    if (!editStageId || !editStageName.trim()) return;
    setSavingEditStage(true);
    await supabase.from('ministries').update({ name: editStageName.trim() }).eq('id', editStageId);
    setSavingEditStage(false);
    setEditStageId(null);
    fetchData();
  };

  const handleDeleteStage = (m: Ministry) => {
    const doDelete = async () => {
      await supabase.from('ministries').delete().eq('id', m.id);
      fetchData();
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Delete "${m.name}"?`)) doDelete();
    } else {
      Alert.alert(`${t('delete')} ${t('stages')}`, `Delete "${m.name}"?`, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleSetStageCity = async (ministryId: string, cityId: string | null) => {
    await supabase.from('ministries').update({ city_id: cityId }).eq('id', ministryId);
    setStageCityPickerId(null);
    setStageCitySearch('');
    fetchData();
  };

  const handleCreateStageCity = async (ministryId: string) => {
    if (!newStageCityName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingStageCity(true);
    const { data, error } = await supabase
      .from('cities')
      .insert({ name: newStageCityName.trim(), org_id: orgId })
      .select()
      .single();
    setSavingStageCity(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setAllCities((prev: any[]) => [...prev, data].sort((a: any, b: any) => a.name.localeCompare(b.name)));
    setNewStageCityName('');
    setShowCreateStageCityForm(false);
    await handleSetStageCity(ministryId, data.id);
  };

  // ── Excel import ──────────────────────────────────────────
  const parseStageImport = (raw: string): string[] =>
    raw.split(/\r?\n/).map(l => l.split('\t')[0].trim()).filter(Boolean);

  const handleImportStages = async () => {
    if (!stageImportNames.length) return;
    setImportingStages(true);
    const inserts = stageImportNames.map(name => ({ name, type: 'parent' as const, org_id: orgId }));
    const { data, error } = await supabase.from('ministries').insert(inserts).select();
    setImportingStages(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    if (data) setMinistries((prev: Ministry[]) => [...prev, ...(data as any[])].sort((a: Ministry, b: Ministry) => a.name.localeCompare(b.name)));
    setShowStageImport(false); setStageImportRaw(''); setStageImportNames([]);
    Alert.alert(t('success'), `${inserts.length} ${t('stages')}`);
  };

  return {
    handleCreateStage,
    handleSaveEditStage,
    handleDeleteStage,
    handleSetStageCity,
    handleCreateStageCity,
    parseStageImport,
    handleImportStages,
  };
}
