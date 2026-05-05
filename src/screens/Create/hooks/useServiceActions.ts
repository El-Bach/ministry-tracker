// src/screens/Create/hooks/useServiceActions.ts
//
// Service handlers extracted from CreateScreen — Phase 5d.
// Owns: create / save-edit / delete + per-service stages panel
// (toggle expand, fetch, add-new-or-existing, remove, ↑↓ reorder) +
// Excel import. State stays in the parent.

import { Alert, Platform } from 'react-native';
import supabase from '../../../lib/supabase';
import { Service, Ministry } from '../../../types';

interface SvcImportRow { name: string; priceUSD: string; priceLBP: string }

export interface UseServiceActionsOptions {
  orgId: string;
  t: (key: any) => string;
  fetchData: () => void;

  // Data
  ministries: Ministry[];
  setServices: (
    updater: Service[] | ((prev: Service[]) => Service[]),
  ) => void;

  // New service
  newSvcName: string;
  newSvcPriceUSD: string;
  newSvcPriceLBP: string;
  setNewSvcName: (v: string) => void;
  setNewSvcPriceUSD: (v: string) => void;
  setNewSvcPriceLBP: (v: string) => void;
  setSavingNewSvc: (v: boolean) => void;

  // Edit service inline
  editSvcId: string | null;
  editSvcName: string;
  editSvcPriceUSD: string;
  editSvcPriceLBP: string;
  setEditSvcId: (v: string | null) => void;
  setSavingEditSvc: (v: boolean) => void;

  // Inline service-stages panel
  expandedSvcId: string | null;
  setExpandedSvcId: (v: string | null) => void;
  svcStages: Record<string, any[]>;
  setSvcStages: (
    updater: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>),
  ) => void;
  setLoadingSvcStages: (v: string | null) => void;
  svcStageNewName: string;
  setSvcStageNewName: (v: string) => void;
  setSavingNewSvcStage: (v: boolean) => void;

  // Excel import
  svcImportRows: SvcImportRow[];
  setSvcImportRaw: (v: string) => void;
  setSvcImportRows: (v: SvcImportRow[]) => void;
  setShowSvcImportModal: (v: boolean) => void;
  setImportingServices: (v: boolean) => void;
}

export function useServiceActions(opts: UseServiceActionsOptions) {
  const {
    orgId, t, fetchData,
    ministries, setServices,
    newSvcName, newSvcPriceUSD, newSvcPriceLBP,
    setNewSvcName, setNewSvcPriceUSD, setNewSvcPriceLBP, setSavingNewSvc,
    editSvcId, editSvcName, editSvcPriceUSD, editSvcPriceLBP,
    setEditSvcId, setSavingEditSvc,
    expandedSvcId, setExpandedSvcId,
    svcStages, setSvcStages, setLoadingSvcStages,
    svcStageNewName, setSvcStageNewName, setSavingNewSvcStage,
    svcImportRows, setSvcImportRaw, setSvcImportRows,
    setShowSvcImportModal, setImportingServices,
  } = opts;

  const handleCreateService = async () => {
    if (!newSvcName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingNewSvc(true);
    await supabase.from('services').insert({
      name:                    newSvcName.trim(),
      estimated_duration_days: 0,
      base_price_usd:          parseFloat(newSvcPriceUSD) || 0,
      base_price_lbp:          parseFloat(newSvcPriceLBP.replace(/,/g, '')) || 0,
      org_id:                  orgId,
    });
    setSavingNewSvc(false);
    setNewSvcName(''); setNewSvcPriceUSD(''); setNewSvcPriceLBP('');
    fetchData();
  };

  const handleSaveEditService = async () => {
    if (!editSvcId || !editSvcName.trim()) return;
    setSavingEditSvc(true);
    await supabase.from('services').update({
      name:           editSvcName.trim(),
      base_price_usd: parseFloat(editSvcPriceUSD) || 0,
      base_price_lbp: parseFloat(editSvcPriceLBP.replace(/,/g, '')) || 0,
    }).eq('id', editSvcId);
    setSavingEditSvc(false);
    setEditSvcId(null);
    fetchData();
  };

  const handleDeleteService = (sv: Service) => {
    const doDelete = async () => {
      await supabase.from('services').delete().eq('id', sv.id);
      fetchData();
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Delete "${sv.name}"?`)) doDelete();
    } else {
      Alert.alert(`${t('delete')} ${t('services')}`, `Delete "${sv.name}"?`, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Inline Service Stages ─────────────────────────────────
  const fetchSvcStages = async (svcId: string) => {
    setLoadingSvcStages(svcId);
    const { data } = await supabase
      .from('service_default_stages')
      .select('id, stop_order, ministry:ministries(id, name)')
      .eq('service_id', svcId)
      .order('stop_order');
    setSvcStages((prev) => ({ ...prev, [svcId]: data ?? [] }));
    setLoadingSvcStages(null);
  };

  const handleToggleSvcExpand = async (svcId: string) => {
    if (expandedSvcId === svcId) { setExpandedSvcId(null); return; }
    setExpandedSvcId(svcId);
    await fetchSvcStages(svcId);
  };

  const handleAddSvcStage = async (svcId: string) => {
    const name = svcStageNewName.trim();
    if (!name) return;
    setSavingNewSvcStage(true);
    const existing = ministries.find((m) => m.name.toLowerCase() === name.toLowerCase());
    let ministryId: string;
    if (existing) {
      ministryId = existing.id;
    } else {
      const { data: mData } = await supabase.from('ministries').insert({ name, type: 'parent', org_id: orgId }).select().single();
      if (!mData) { setSavingNewSvcStage(false); return; }
      ministryId = (mData as any).id;
    }
    const stages = svcStages[svcId] ?? [];
    await supabase.from('service_default_stages').insert({ service_id: svcId, ministry_id: ministryId, stop_order: stages.length + 1 });
    setSavingNewSvcStage(false);
    setSvcStageNewName('');
    await fetchSvcStages(svcId);
    fetchData();
  };

  const handleAddExistingSvcStage = async (svcId: string, ministryId: string) => {
    const stages = svcStages[svcId] ?? [];
    await supabase.from('service_default_stages').insert({ service_id: svcId, ministry_id: ministryId, stop_order: stages.length + 1 });
    setSvcStageNewName('');
    await fetchSvcStages(svcId);
  };

  const handleRemoveSvcStage = async (svcId: string, stageId: string) => {
    await supabase.from('service_default_stages').delete().eq('id', stageId);
    await fetchSvcStages(svcId);
  };

  const handleMoveSvcStage = async (svcId: string, stageId: string, dir: 'up' | 'down') => {
    const stages = [...(svcStages[svcId] ?? [])];
    const idx    = stages.findIndex((s) => s.id === stageId);
    if (dir === 'up'   && idx === 0)                    return;
    if (dir === 'down' && idx === stages.length - 1)    return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    await Promise.all([
      supabase.from('service_default_stages').update({ stop_order: stages[swapIdx].stop_order }).eq('id', stages[idx].id),
      supabase.from('service_default_stages').update({ stop_order: stages[idx].stop_order }).eq('id', stages[swapIdx].id),
    ]);
    await fetchSvcStages(svcId);
  };

  // ── Excel import ──────────────────────────────────────────
  const parseSvcImportText = (raw: string): SvcImportRow[] => {
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    return lines.map(l => {
      const cols = l.split('\t');
      return {
        name:     (cols[0] ?? '').trim(),
        priceUSD: (cols[1] ?? '').replace(/[^\d.]/g, '').trim(),
        priceLBP: (cols[2] ?? '').replace(/[^\d]/g, '').trim(),
      };
    }).filter(r => r.name);
  };

  const handleImportServices = async () => {
    if (!svcImportRows.length) return;
    setImportingServices(true);
    const inserts = svcImportRows.map(r => ({
      name:                    r.name,
      base_price_usd:          parseFloat(r.priceUSD) || 0,
      base_price_lbp:          parseInt(r.priceLBP, 10) || 0,
      estimated_duration_days: 0,
      org_id:                  orgId,
    }));
    const { error } = await supabase.from('services').insert(inserts);
    setImportingServices(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setShowSvcImportModal(false);
    setSvcImportRaw('');
    setSvcImportRows([]);
    const { data } = await supabase.from('services').select('*').order('name');
    if (data) setServices(data as Service[]);
    Alert.alert(t('success'), `${inserts.length} ${t('services')}`);
  };

  return {
    handleCreateService,
    handleSaveEditService,
    handleDeleteService,
    handleToggleSvcExpand,
    handleAddSvcStage,
    handleAddExistingSvcStage,
    handleRemoveSvcStage,
    handleMoveSvcStage,
    parseSvcImportText,
    handleImportServices,
  };
}
