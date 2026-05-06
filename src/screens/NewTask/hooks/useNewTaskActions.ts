// src/screens/NewTask/hooks/useNewTaskActions.ts
//
// All NewTaskScreen mutation handlers extracted from the parent.
// Phase 5 of the NewTaskScreen split — single hook owning every handler
// (24 total) plus 2 internal helpers (doCreateClient, doCreateService,
// doCreateStage, validate). State stays in the parent and is passed in
// via the Options bag.

import { Alert, Linking } from 'react-native';
import supabase from '../../../lib/supabase';
import { Client, Service, Ministry, TeamMember, City } from '../../../types';
import { DEFAULT_COUNTRY } from '../../../components/PhoneInput';
import { FieldValue } from '../../../components/ClientFieldsForm';
import { toISO } from '../utils/dateHelpers';
import { PickerItem } from '../components/PickerModal';

// The single closure stage that's always last on every file. Duplicated
// here so the hook is self-contained (also defined in NewTaskScreen,
// TaskDetailScreen, useTaskActions).
const FINAL_STAGE_NAME = 'تسليم المعاملة النهائية و اغلاق الحسابات';

interface StageCityValue { cityId: string; cityName: string }
interface StageAssigneeValue { id: string; name: string; isExt: boolean }
interface DraftStage { name: string; cityId?: string; cityName?: string }

export interface UseNewTaskActionsOptions {
  // Identity / nav / translation
  t: (key: any) => string;
  teamMember: { id?: string; org_id?: string; name?: string } | null;
  navigation: { goBack: () => void };
  routeParams: { preselectedClientId?: string } | undefined;

  // Data sets
  clients: Client[];                          setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  services: Service[];                        setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  stages: Ministry[];                         setStages: React.Dispatch<React.SetStateAction<Ministry[]>>;
                                              setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  allCities: City[];                          setAllCities: React.Dispatch<React.SetStateAction<City[]>>;
  allAssignees: any[];                        setAllAssignees: React.Dispatch<React.SetStateAction<any[]>>;

  // Selections
  selectedClient: Client | null;              setSelectedClient: React.Dispatch<React.SetStateAction<Client | null>>;
  selectedService: Service | null;            setSelectedService: React.Dispatch<React.SetStateAction<Service | null>>;
  routeStops: Ministry[];                     setRouteStops: React.Dispatch<React.SetStateAction<Ministry[]>>;
  dueDate: string;
  notes: string;
  createdAt: Date;

  // New-client form
  newClientName: string;                      setNewClientName: React.Dispatch<React.SetStateAction<string>>;
  newClientPhone: string;                     setNewClientPhone: React.Dispatch<React.SetStateAction<string>>;
  newClientPhoneCountry: string;              setNewClientPhoneCountry: React.Dispatch<React.SetStateAction<string>>;
  newClientRefName: string;                   setNewClientRefName: React.Dispatch<React.SetStateAction<string>>;
  newClientRefPhone: string;                  setNewClientRefPhone: React.Dispatch<React.SetStateAction<string>>;
  newClientRefPhoneCountry: string;           setNewClientRefPhoneCountry: React.Dispatch<React.SetStateAction<string>>;
  setShowNewClientForm: React.Dispatch<React.SetStateAction<boolean>>;

  // Custom field values + active selection
  customFieldValues: Record<string, FieldValue>;
  setCustomFieldValues: React.Dispatch<React.SetStateAction<Record<string, FieldValue>>>;
  setActiveFieldIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Custom field create form
  newFieldLabel: string;                      setNewFieldLabel: React.Dispatch<React.SetStateAction<string>>;
  newFieldType: string;                       setNewFieldType: React.Dispatch<React.SetStateAction<string>>;
  newFieldOptions: string;                    setNewFieldOptions: React.Dispatch<React.SetStateAction<string>>;
  newFieldRequired: boolean;                  setNewFieldRequired: React.Dispatch<React.SetStateAction<boolean>>;
  setSavingNewField: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCreateField: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFieldPicker: React.Dispatch<React.SetStateAction<boolean>>;
  reloadFieldDefs: () => Promise<void>;

  // New-service form (with draft stages)
  newServiceName: string;                     setNewServiceName: React.Dispatch<React.SetStateAction<string>>;
  newServiceStages: DraftStage[];             setNewServiceStages: React.Dispatch<React.SetStateAction<DraftStage[]>>;
  newServiceStageInput: string;               setNewServiceStageInput: React.Dispatch<React.SetStateAction<string>>;
  setSavingService: React.Dispatch<React.SetStateAction<boolean>>;
  setShowNewServiceForm: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedSvcStageIdx: React.Dispatch<React.SetStateAction<number | null>>;
  svcStageNewCityName: string;                setSvcStageNewCityName: React.Dispatch<React.SetStateAction<string>>;
  setSvcStageCreateOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSvcStageCitySearch: React.Dispatch<React.SetStateAction<string>>;
  setSvcStageSavingCity: React.Dispatch<React.SetStateAction<boolean>>;

  // New-stage form
  newStageName: string;                       setNewStageName: React.Dispatch<React.SetStateAction<string>>;
  setSavingStage: React.Dispatch<React.SetStateAction<boolean>>;
  setShowNewStageForm: React.Dispatch<React.SetStateAction<boolean>>;

  // Per-stage city + assignee maps
  stageCityMap: Record<string, StageCityValue | null>;
  setStageCityMap: React.Dispatch<React.SetStateAction<Record<string, StageCityValue | null>>>;
  stageAssigneeMap: Record<string, StageAssigneeValue | null>;
  setStageAssigneeMap: React.Dispatch<React.SetStateAction<Record<string, StageAssigneeValue | null>>>;

  // Inline create-city
  newCityName: string;                        setNewCityName: React.Dispatch<React.SetStateAction<string>>;
  setSavingNewCity: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCreateCityForm: React.Dispatch<React.SetStateAction<boolean>>;
  setStageCitySearch: React.Dispatch<React.SetStateAction<string>>;

  // Inline create-external-assignee
  newExtName: string;                         setNewExtName: React.Dispatch<React.SetStateAction<string>>;
  newExtPhone: string;                        setNewExtPhone: React.Dispatch<React.SetStateAction<string>>;
  newExtReference: string;                    setNewExtReference: React.Dispatch<React.SetStateAction<string>>;
  setSavingNewExt: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCreateExtForm: React.Dispatch<React.SetStateAction<boolean>>;
  setStageAssigneeSearch: React.Dispatch<React.SetStateAction<string>>;

  // Inline rename
  editingStageIdx: number | null;             setEditingStageIdx: React.Dispatch<React.SetStateAction<number | null>>;
  editingStageName: string;                   setEditingStageName: React.Dispatch<React.SetStateAction<string>>;
  setSavingStageRename: React.Dispatch<React.SetStateAction<boolean>>;

  // Required Docs sheet
  newDocTitle: string;                        setNewDocTitle: React.Dispatch<React.SetStateAction<string>>;
  setSavingNewDoc: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAddDocForm: React.Dispatch<React.SetStateAction<boolean>>;
  sheetDocs: any[];                           setSheetDocs: React.Dispatch<React.SetStateAction<any[]>>;
  sheetDocReqs: Record<string, any[]>;        setSheetDocReqs: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  setLoadingSheetDocs: React.Dispatch<React.SetStateAction<boolean>>;
  setSheetExpandedId: React.Dispatch<React.SetStateAction<string | null>>;

  // Submit
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useNewTaskActions(opts: UseNewTaskActionsOptions) {
  const {
    t, teamMember, navigation, routeParams,
    clients, setClients, services, setServices, stages, setStages, setTeamMembers,
    allCities, setAllCities, allAssignees, setAllAssignees,
    selectedClient, setSelectedClient, selectedService, setSelectedService,
    routeStops, setRouteStops, dueDate, notes, createdAt,
    newClientName, setNewClientName, newClientPhone, setNewClientPhone,
    newClientPhoneCountry, setNewClientPhoneCountry,
    newClientRefName, setNewClientRefName, newClientRefPhone, setNewClientRefPhone,
    newClientRefPhoneCountry, setNewClientRefPhoneCountry,
    setShowNewClientForm,
    customFieldValues, setCustomFieldValues, setActiveFieldIds,
    newFieldLabel, setNewFieldLabel, newFieldType, setNewFieldType,
    newFieldOptions, setNewFieldOptions, newFieldRequired, setNewFieldRequired,
    setSavingNewField, setShowCreateField, setShowFieldPicker, reloadFieldDefs,
    newServiceName, setNewServiceName, newServiceStages, setNewServiceStages,
    newServiceStageInput, setNewServiceStageInput, setSavingService,
    setShowNewServiceForm, setExpandedSvcStageIdx,
    svcStageNewCityName, setSvcStageNewCityName, setSvcStageCreateOpen,
    setSvcStageCitySearch, setSvcStageSavingCity,
    newStageName, setNewStageName, setSavingStage, setShowNewStageForm,
    stageCityMap, setStageCityMap, stageAssigneeMap, setStageAssigneeMap,
    newCityName, setNewCityName, setSavingNewCity, setShowCreateCityForm, setStageCitySearch,
    newExtName, setNewExtName, newExtPhone, setNewExtPhone, newExtReference, setNewExtReference,
    setSavingNewExt, setShowCreateExtForm, setStageAssigneeSearch,
    editingStageIdx, setEditingStageIdx, editingStageName, setEditingStageName, setSavingStageRename,
    newDocTitle, setNewDocTitle, setSavingNewDoc, setShowAddDocForm,
    sheetDocs, setSheetDocs, sheetDocReqs, setSheetDocReqs,
    setLoadingSheetDocs, setSheetExpandedId,
    setSaving,
  } = opts;

  // ── Stage city: update local map AND persist as the stage's default city
  const persistStageCity = async (stageId: string, city: StageCityValue | null) => {
    setStageCityMap(m => ({ ...m, [stageId]: city }));
    await supabase.from('ministries').update({ city_id: city?.cityId ?? null }).eq('id', stageId);
    setStages(prev => prev.map(st =>
      st.id === stageId
        ? { ...st, city_id: city?.cityId ?? null, city: city ? { id: city.cityId, name: city.cityName } as any : undefined }
        : st,
    ));
  };

  // ── Service-form draft-stage city helpers
  const setDraftStageCity = (idx: number, city: { id: string; name: string } | null) => {
    setNewServiceStages(prev => prev.map((s, i) =>
      i === idx ? { ...s, cityId: city?.id, cityName: city?.name } : s,
    ));
  };

  const createCityForDraftStage = async (idx: number) => {
    const name = svcStageNewCityName.trim();
    if (!name) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSvcStageSavingCity(true);
    const { data, error } = await supabase
      .from('cities').insert({ name, org_id: teamMember?.org_id ?? null }).select().single();
    setSvcStageSavingCity(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const created = data as City;
    setAllCities(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setDraftStageCity(idx, { id: created.id, name: created.name });
    setSvcStageNewCityName('');
    setSvcStageCreateOpen(false);
    setSvcStageCitySearch('');
  };

  // ── Inline create handlers (city + external assignee)
  const handleCreateCityForStage = async (stageId: string) => {
    const name = newCityName.trim();
    if (!name) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingNewCity(true);
    const { data, error } = await supabase
      .from('cities').insert({ name, org_id: teamMember?.org_id ?? null }).select().single();
    setSavingNewCity(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const created = data as City;
    setAllCities(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    await persistStageCity(stageId, { cityId: created.id, cityName: created.name });
    setNewCityName('');
    setShowCreateCityForm(false);
    setStageCitySearch('');
  };

  const handleCreateExtAssigneeForStage = async (stageId: string) => {
    const name = newExtName.trim();
    if (!name) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingNewExt(true);
    const { data, error } = await supabase
      .from('assignees')
      .insert({
        name,
        phone:     newExtPhone.trim()     || null,
        reference: newExtReference.trim() || null,
        created_by: teamMember?.id,
        org_id:     teamMember?.org_id ?? null,
      })
      .select('*, creator:team_members!created_by(name)')
      .single();
    setSavingNewExt(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const created = data as any;
    setAllAssignees(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setStageAssigneeMap(m => ({ ...m, [stageId]: { id: created.id, name: created.name, isExt: true } }));
    setNewExtName(''); setNewExtPhone(''); setNewExtReference('');
    setShowCreateExtForm(false);
    setStageAssigneeSearch('');
  };

  // ── Service-stage list loader (called when picker selects a service)
  const loadServiceDefaultStages = async (serviceId: string) => {
    const { data } = await supabase
      .from('service_default_stages')
      .select('*, ministry:ministries(*, city:cities(id,name))')
      .eq('service_id', serviceId)
      .order('stop_order');
    if (data && data.length > 0) {
      const ministries = data.map((d: any) => d.ministry as Ministry);
      setRouteStops(ministries);
      const cityMap: Record<string, StageCityValue | null> = {};
      for (const m of ministries) {
        if (m.city_id && (m as any).city?.name) {
          cityMap[m.id] = { cityId: m.city_id, cityName: (m as any).city.name };
        }
      }
      setStageCityMap(cityMap);
    } else {
      setRouteStops([]);
      setStageCityMap({});
    }
  };

  // ── Required-docs sheet
  const loadServiceDocsForSheet = async (serviceId: string) => {
    setLoadingSheetDocs(true);
    setSheetDocs([]);
    setSheetDocReqs({});
    setSheetExpandedId(null);
    const { data: docs } = await supabase
      .from('service_documents').select('*').eq('service_id', serviceId).order('sort_order');
    const docList = docs ?? [];
    setSheetDocs(docList);
    if (docList.length > 0) {
      const results = await Promise.all(
        docList.map((d: any) =>
          supabase.from('service_document_requirements')
            .select('*').eq('doc_id', d.id).order('sort_order'),
        ),
      );
      const reqs: Record<string, any[]> = {};
      docList.forEach((d: any, i: number) => { reqs[d.id] = results[i].data ?? []; });
      setSheetDocReqs(reqs);
    }
    setLoadingSheetDocs(false);
  };

  const handleAddDocFromSheet = async () => {
    const title = newDocTitle.trim();
    if (!title) { Alert.alert(t('required'), t('fieldRequired')); return; }
    if (!selectedService) return;
    setSavingNewDoc(true);
    const maxOrder = sheetDocs.length > 0
      ? Math.max(...sheetDocs.map((d: any) => d.sort_order ?? 0))
      : 0;
    const { data, error } = await supabase
      .from('service_documents')
      .insert({
        service_id: selectedService.id,
        title,
        sort_order: maxOrder + 1,
        org_id:     teamMember?.org_id ?? null,
      })
      .select()
      .single();
    setSavingNewDoc(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    if (data) {
      setSheetDocs(prev => [...prev, data]);
      setSheetDocReqs(prev => ({ ...prev, [(data as any).id]: [] }));
    }
    setNewDocTitle('');
    setShowAddDocForm(false);
  };

  const handleShareDocsWhatsApp = () => {
    if (!selectedService || sheetDocs.length === 0) return;
    const lines: string[] = [`📋 *${selectedService.name}* — Required Documents:\n`];
    sheetDocs.forEach((doc: any, idx: number) => {
      lines.push(`${idx + 1}. *${doc.title}*`);
      (sheetDocReqs[doc.id] ?? []).forEach((r: any) => lines.push(`   • ${r.title}`));
    });
    if (teamMember?.name) lines.push(`\n_Generated by ${teamMember.name}_`);
    lines.push('_GovPilot, Powered by KTS_');
    const msg = encodeURIComponent(lines.join('\n'));
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() =>
      Alert.alert(t('error'), t('somethingWrong')),
    );
  };

  // ── Picker delete handlers
  const handleDeleteService = (item: PickerItem) => {
    Alert.alert(t('deleteService'), `${t('confirmDelete')} — "${item.label}"`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await supabase.from('services').delete().eq('id', item.id);
          setServices((prev) => prev.filter((sv) => sv.id !== item.id));
          if (selectedService?.id === item.id) {
            setSelectedService(null);
            setRouteStops([]);
          }
        },
      },
    ]);
  };

  const handleDeleteStage = (item: PickerItem) => {
    Alert.alert(t('deleteStage'), `${t('confirmDelete')} — "${item.label}"`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await supabase.from('ministries').delete().eq('id', item.id);
          setStages((prev) => prev.filter((m) => m.id !== item.id));
          setRouteStops((prev) => prev.filter((m) => m.id !== item.id));
        },
      },
    ]);
  };

  const handleDeleteClient = (item: PickerItem) => {
    Alert.alert(
      t('delete') + ' ' + t('clients'),
      `${t('confirmDelete')} — "${item.label}"? ${t('cannotUndo')}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            await supabase.from('clients').delete().eq('id', item.id);
            setClients((prev) => prev.filter((c) => c.id !== item.id));
            if (selectedClient?.id === item.id) setSelectedClient(null);
          },
        },
      ],
    );
  };

  // ── Initial data load + preselected client from nav params
  const loadData = async () => {
    const orgId = teamMember?.org_id ?? '';
    if (!orgId) return;
    const [c, sv, m, tm, ci, asgn] = await Promise.all([
      supabase.from('clients').select('*').eq('org_id', orgId).order('name'),
      supabase.from('services').select('*').eq('org_id', orgId).order('name'),
      supabase.from('ministries').select('*, city:cities(id,name)').eq('org_id', orgId).eq('type', 'parent').order('name'),
      supabase.from('team_members').select('*').eq('org_id', orgId).is('deleted_at', null).order('name'),
      supabase.from('cities').select('*').eq('org_id', orgId).order('name'),
      supabase.from('assignees').select('*').eq('org_id', orgId).order('name'),
    ]);
    if (c.data) {
      setClients(c.data as Client[]);
      const preId = routeParams?.preselectedClientId;
      if (preId) {
        const match = (c.data as Client[]).find((cl) => cl.id === preId);
        if (match) setSelectedClient(match);
      }
    }
    if (sv.data) setServices(sv.data as Service[]);
    if (m.data) setStages(m.data as Ministry[]);
    if (tm.data) setTeamMembers(tm.data as TeamMember[]);
    if (ci.data) setAllCities(ci.data as City[]);
    if (asgn.data) setAllAssignees(asgn.data);
  };

  // ── Route stops manipulation
  const toggleStage = (stage: Ministry) => {
    if (routeStops.find((r) => r.id === stage.id)) {
      setRouteStops((prev) => prev.filter((r) => r.id !== stage.id));
    } else {
      setRouteStops((prev) => [...prev, stage]);
      if (stage.city_id && (stage as any).city?.name) {
        setStageCityMap(prev => ({
          ...prev,
          [stage.id]: prev[stage.id] ?? { cityId: stage.city_id!, cityName: (stage as any).city!.name },
        }));
      }
    }
  };

  const removeRouteStop = (stageId: string) => {
    setRouteStops((prev) => prev.filter((r) => r.id !== stageId));
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    const newRoute = [...routeStops];
    const target = index + dir;
    if (target < 0 || target >= newRoute.length) return;
    [newRoute[index], newRoute[target]] = [newRoute[target], newRoute[index]];
    setRouteStops(newRoute);
  };

  // ── Custom field create
  const handleCreateCustomField = async () => {
    if (!newFieldLabel.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    const needsOptions = ['select', 'multiselect'].includes(newFieldType);
    if (needsOptions && !newFieldOptions.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingNewField(true);
    const options = needsOptions
      ? newFieldOptions.split(',').map((o) => o.trim()).filter(Boolean)
      : null;
    const fieldKey = newFieldLabel.toLowerCase().trim()
      .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
    const { data, error } = await supabase
      .from('client_field_definitions')
      .insert({
        label:       newFieldLabel.trim(),
        field_key:   fieldKey,
        field_type:  newFieldType,
        is_required: newFieldRequired,
        is_active:   true,
        options:     options ? JSON.stringify(options) : null,
        sort_order:  999,
        org_id:      teamMember?.org_id ?? null,
      })
      .select()
      .single();
    setSavingNewField(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    await reloadFieldDefs();
    setActiveFieldIds((prev) => [...prev, (data as any).id]);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldOptions('');
    setNewFieldRequired(false);
    setShowCreateField(false);
    setShowFieldPicker(false);
  };

  // ── Client create (with duplicate-check Alert path)
  const doCreateClient = async () => {
    const autoId       = `CLT-${Date.now()}`;
    const fullPhone    = newClientPhone.trim()    ? `${newClientPhoneCountry}${newClientPhone.trim()}`       : null;
    const fullRefPhone = newClientRefPhone.trim() ? `${newClientRefPhoneCountry}${newClientRefPhone.trim()}` : null;
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name:            newClientName.trim(),
        client_id:       autoId,
        phone:           fullPhone,
        reference_name:  newClientRefName.trim() || null,
        reference_phone: fullRefPhone,
        org_id:          teamMember?.org_id ?? null,
      })
      .select()
      .single();
    if (error) { Alert.alert(t('error'), error.message); return; }
    const c = data as Client;

    // Save custom field values
    const fieldEntries = Object.values(customFieldValues).filter((v) =>
      v.value_text != null || v.value_number != null ||
      v.value_boolean != null || v.value_json != null,
    );
    if (fieldEntries.length > 0) {
      await supabase.from('client_field_values').insert(
        fieldEntries.map((v) => ({ client_id: c.id, ...v })),
      );
    }

    setClients((prev) => [...prev, c]);
    setSelectedClient(c);
    setShowNewClientForm(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientPhoneCountry(DEFAULT_COUNTRY.code);
    setNewClientRefName('');
    setNewClientRefPhone('');
    setNewClientRefPhoneCountry(DEFAULT_COUNTRY.code);
    setCustomFieldValues({});
    setActiveFieldIds([]);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    const fullPhone = newClientPhone.trim() ? `${newClientPhoneCountry}${newClientPhone.trim()}` : '';
    const orFilters: string[] = [`name.ilike.${newClientName.trim()}`];
    if (fullPhone) orFilters.push(`phone.eq.${fullPhone}`);
    const { data: existing } = await supabase
      .from('clients')
      .select('id, name, phone, client_id')
      .eq('org_id', teamMember?.org_id ?? '')
      .or(orFilters.join(','))
      .limit(1)
      .maybeSingle();

    if (existing) {
      const reason = (existing as any).name?.toLowerCase() === newClientName.trim().toLowerCase()
        ? `name "${(existing as any).name}"`
        : `phone "${(existing as any).phone}"`;
      Alert.alert(
        t('duplicateClient'),
        `A client already exists with this ${reason} (${(existing as any).client_id}).\n\nCreate anyway?`,
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('createAnyway'), onPress: () => doCreateClient() },
        ],
      );
      return;
    }
    doCreateClient();
  };

  // ── Service create (with duplicate-check + draft stages flow)
  const doCreateService = async () => {
    setSavingService(true);
    const { data, error } = await supabase
      .from('services')
      .insert({ name: newServiceName.trim(), estimated_duration_days: 0, org_id: teamMember?.org_id ?? null })
      .select()
      .single();
    if (error) { Alert.alert(t('error'), error.message); setSavingService(false); return; }
    const sv = data as Service;
    const stageMinistries: Ministry[] = [];
    const cityMapForRouteStops: Record<string, StageCityValue | null> = {};
    const pendingInput = newServiceStageInput.trim();
    const drafts: DraftStage[] = [
      ...newServiceStages.filter((d) => d.name.trim()),
      ...(pendingInput ? [{ name: pendingInput }] : []),
    ];
    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      const { data: existing } = await supabase
        .from('ministries')
        .select('*, city:cities(id,name)')
        .eq('org_id', teamMember?.org_id ?? '')
        .eq('type', 'parent')
        .ilike('name', draft.name)
        .limit(1)
        .maybeSingle();
      let ministry: Ministry | null = (existing as Ministry) ?? null;
      if (!ministry) {
        const { data: mData } = await supabase
          .from('ministries')
          .insert({
            name:    draft.name,
            type:    'parent',
            org_id:  teamMember?.org_id ?? null,
            city_id: draft.cityId ?? null,
          })
          .select('*, city:cities(id,name)')
          .single();
        ministry = (mData as Ministry) ?? null;
      }
      if (ministry) {
        await supabase.from('service_default_stages').insert({
          service_id: sv.id, ministry_id: ministry.id, stop_order: i + 1,
        });
        stageMinistries.push(ministry);
        const cityId   = draft.cityId   ?? ministry.city_id;
        const cityName = draft.cityName ?? (ministry as any).city?.name;
        if (cityId && cityName) {
          cityMapForRouteStops[ministry.id] = { cityId, cityName };
        }
      }
    }
    setSavingService(false);
    setServices((prev) => [...prev, sv]);
    setSelectedService(sv);
    setRouteStops(stageMinistries);
    setStageCityMap((prev) => ({ ...prev, ...cityMapForRouteStops }));
    setStages((prev) => {
      const seen = new Set(prev.map(s => s.id));
      return [...prev, ...stageMinistries.filter(s => !seen.has(s.id))];
    });
    setShowNewServiceForm(false);
    setNewServiceName('');
    setNewServiceStages([]);
    setNewServiceStageInput('');
    setExpandedSvcStageIdx(null);
    setSvcStageCitySearch('');
    setSvcStageCreateOpen(false);
    setSvcStageNewCityName('');
  };

  const handleCreateService = async () => {
    if (!newServiceName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    const { data: dupSvc } = await supabase
      .from('services')
      .select('id, name')
      .eq('org_id', teamMember?.org_id ?? '')
      .ilike('name', newServiceName.trim())
      .limit(1)
      .maybeSingle();
    if (dupSvc) {
      Alert.alert(
        `${t('duplicate')} ${t('service')}`,
        `A service named "${(dupSvc as any).name}" already exists.\n\nCreate anyway?`,
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('createAnyway'), onPress: () => doCreateService() },
        ],
      );
      return;
    }
    doCreateService();
  };

  // ── Stage create (with duplicate check + auto-link to current service)
  const doCreateStage = async () => {
    setSavingStage(true);
    const { data, error } = await supabase
      .from('ministries')
      .insert({ name: newStageName.trim(), type: 'parent', org_id: teamMember?.org_id ?? null })
      .select()
      .single();
    setSavingStage(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const stage = data as Ministry;
    setStages((prev) => [...prev, stage]);
    setRouteStops((prev) => {
      const next = [...prev, stage];
      if (selectedService) {
        supabase.from('service_default_stages').insert({
          service_id:  selectedService.id,
          ministry_id: stage.id,
          stop_order:  next.length,
        }).then(() => {});
      }
      return next;
    });
    setShowNewStageForm(false);
    setNewStageName('');
  };

  const handleCreateStage = async () => {
    if (!newStageName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    const { data: dupStage } = await supabase
      .from('ministries')
      .select('id, name')
      .eq('org_id', teamMember?.org_id ?? '')
      .eq('type', 'parent')
      .ilike('name', newStageName.trim())
      .limit(1)
      .maybeSingle();
    if (dupStage) {
      Alert.alert(
        `${t('duplicate')} ${t('stage')}`,
        `A stage named "${(dupStage as any).name}" already exists.\n\nCreate anyway?`,
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('createAnyway'), onPress: () => doCreateStage() },
        ],
      );
      return;
    }
    doCreateStage();
  };

  // ── Inline stage rename
  const handleRenameStage = async () => {
    if (!editingStageName.trim() || editingStageIdx === null) return;
    const stage = routeStops[editingStageIdx];
    setSavingStageRename(true);
    const { error } = await supabase
      .from('ministries')
      .update({ name: editingStageName.trim() })
      .eq('id', stage.id);
    setSavingStageRename(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const newName = editingStageName.trim();
    setRouteStops((prev) => prev.map((s, i) => i === editingStageIdx ? { ...s, name: newName } : s));
    setStages((prev) => prev.map((s) => s.id === stage.id ? { ...s, name: newName } : s));
    setEditingStageIdx(null);
    setEditingStageName('');
  };

  // ── Submit (validate + insert task + stops + final closure stage + audit)
  const validate = (): string | null => {
    if (!selectedClient) return t('pickClient');
    if (!selectedService) return t('pickService');
    if (routeStops.length === 0) return t('noStagesAddFirst');
    if (dueDate.trim()) {
      const iso = toISO(dueDate);
      if (!iso) return t('invalidPhone');
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert(t('warning'), err); return; }

    const dueDateISO = dueDate.trim() ? toISO(dueDate) : null;

    setSaving(true);
    try {
      const { data: taskData, error: taskErr } = await supabase
        .from('tasks')
        .insert({
          client_id:      selectedClient!.id,
          service_id:     selectedService!.id,
          current_status: 'Submitted',
          due_date:       dueDateISO,
          notes:          notes.trim() || null,
          price_usd:      (selectedService as any).base_price_usd ?? 0,
          price_lbp:      (selectedService as any).base_price_lbp ?? 0,
          created_at:     createdAt.toISOString(),
          updated_at:     createdAt.toISOString(),
          org_id:         teamMember?.org_id ?? null,
          assigned_to:    teamMember?.id ?? null,
        })
        .select()
        .single();

      if (taskErr) throw taskErr;

      const stops = routeStops.map((m, idx) => ({
        task_id:         taskData.id,
        ministry_id:     m.id,
        stop_order:      idx + 1,
        status:          'Pending',
        city_id:         stageCityMap[m.id]?.cityId ?? null,
        assigned_to:     stageAssigneeMap[m.id]?.isExt === false ? (stageAssigneeMap[m.id]?.id ?? null) : null,
        ext_assignee_id: stageAssigneeMap[m.id]?.isExt === true  ? (stageAssigneeMap[m.id]?.id ?? null) : null,
      }));

      const { error: stopsErr } = await supabase.from('task_route_stops').insert(stops);
      if (stopsErr) throw stopsErr;

      // Auto-append the final closure stage (always last)
      const { data: existingFinalMin } = await supabase
        .from('ministries')
        .select('id')
        .eq('name', FINAL_STAGE_NAME)
        .maybeSingle();
      let finalMinistryId = existingFinalMin?.id ?? null;
      if (!finalMinistryId) {
        const { data: newMin, error: minErr } = await supabase
          .from('ministries')
          .insert({ name: FINAL_STAGE_NAME, type: 'parent', org_id: teamMember?.org_id ?? null })
          .select()
          .single();
        if (minErr) throw minErr;
        finalMinistryId = newMin.id;
      }
      await supabase.from('task_route_stops').insert({
        task_id:     taskData.id,
        ministry_id: finalMinistryId,
        stop_order:  stops.length + 1,
        status:      'Pending',
      });

      await supabase.from('status_updates').insert({
        task_id:    taskData.id,
        updated_by: teamMember?.id,
        new_status: 'Submitted',
      });

      Alert.alert(t('success'), t('savedSuccess'), [
        { text: t('ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      Alert.alert(t('error'), (e as Error).message ?? t('failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  return {
    persistStageCity, setDraftStageCity, createCityForDraftStage,
    handleCreateCityForStage, handleCreateExtAssigneeForStage,
    loadServiceDefaultStages, loadServiceDocsForSheet,
    handleAddDocFromSheet, handleShareDocsWhatsApp,
    handleDeleteService, handleDeleteStage, handleDeleteClient,
    loadData, toggleStage, removeRouteStop, moveStop,
    handleCreateCustomField,
    handleCreateClient,
    handleCreateService,
    handleCreateStage,
    handleRenameStage,
    handleSave,
  };
}
