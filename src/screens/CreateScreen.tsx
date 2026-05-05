// src/screens/CreateScreen.tsx
// Create tab: quick-action cards + full manage section (clients / services / stages)

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';

import { CameraView, useCameraPermissions } from 'expo-camera';
import supabase from '../lib/supabase';
import { useTranslation, formatNumber, t as tStatic } from '../lib/i18n';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { Client, Service, Ministry, ServiceDocument, ServiceDocumentRequirement, MainTabParamList } from '../types';
import { formatPhoneDisplay } from '../lib/phone';
import PhoneInput, { DEFAULT_COUNTRY } from '../components/PhoneInput';
import { MinistryContactsSheet } from '../components/MinistryContactsSheet';
import { NetworkModal } from './Create/components/NetworkModal';

type ManageSection = 'clients' | 'services' | 'stages' | 'network' | 'documents' | null;

function openPhone(phone: string, name?: string) {
  const clean = phone.replace(/[^0-9+]/g, '');
  Alert.alert(name ?? phone, phone, [
    { text: tStatic('callBtn'), onPress: () => Linking.openURL(`tel:${clean}`) },
    { text: tStatic('whatsappBtn'), onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
    { text: tStatic('cancel'), style: 'cancel' },
  ]);
}

export default function CreateScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MainTabParamList, 'Create'>>();
  const { teamMember, permissions } = useAuth();
  const { t, lang } = useTranslation();
  const orgId = teamMember?.org_id ?? null;

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Manage section ────────────────────────────────────────
  const [manageSection, setManageSection] = useState<ManageSection>(null);

  // Search within manage modals
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [stageSearch, setStageSearch] = useState('');

  // Manage clients
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [savingEditClient, setSavingEditClient] = useState(false);

  // Manage services
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcPriceUSD, setNewSvcPriceUSD] = useState('');
  const [newSvcPriceLBP, setNewSvcPriceLBP] = useState('');
  const [savingNewSvc, setSavingNewSvc] = useState(false);
  const [editSvcId, setEditSvcId] = useState<string | null>(null);
  const [editSvcName, setEditSvcName] = useState('');
  const [editSvcPriceUSD, setEditSvcPriceUSD] = useState('');
  const [editSvcPriceLBP, setEditSvcPriceLBP] = useState('');
  const [savingEditSvc, setSavingEditSvc] = useState(false);

  // Manage stages
  const [newStageName, setNewStageName] = useState('');
  const [savingNewStage, setSavingNewStage] = useState(false);
  const [editStageId, setEditStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState('');
  const [savingEditStage, setSavingEditStage] = useState(false);
  // Per-stage contacts sheet — null = closed, ministry id = open for that stage
  const [contactsMinistryId, setContactsMinistryId] = useState<string | null>(null);
  // Stage city picker
  const [stageCityPickerId, setStageCityPickerId] = useState<string | null>(null);
  const [stageCitySearch, setStageCitySearch] = useState('');
  const [showCreateStageCityForm, setShowCreateStageCityForm] = useState(false);
  const [newStageCityName, setNewStageCityName] = useState('');
  const [savingStageCity, setSavingStageCity] = useState(false);

  // Inline service stages
  const [expandedSvcId, setExpandedSvcId] = useState<string | null>(null);
  const [svcStages, setSvcStages] = useState<Record<string, any[]>>({});
  const [loadingSvcStages, setLoadingSvcStages] = useState<string | null>(null);
  const [svcStageNewName, setSvcStageNewName] = useState('');
  const [savingNewSvcStage, setSavingNewSvcStage] = useState(false);

  // Inline stage requirements
  const [expandedStageReqId, setExpandedStageReqId] = useState<string | null>(null);
  const [stageReqs, setStageReqs] = useState<Record<string, any[]>>({});
  const [loadingStageReqs, setLoadingStageReqs] = useState<string | null>(null);
  const [stageReqNewTitle, setStageReqNewTitle] = useState('');
  const [savingNewStageReq, setSavingNewStageReq] = useState(false);

  // New client full form
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientPhoneCountry, setNewClientPhoneCountry] = useState(DEFAULT_COUNTRY.code);
  const [newClientRefName, setNewClientRefName] = useState('');
  const [newClientRefPhone, setNewClientRefPhone] = useState('');
  const [newClientRefPhoneCountry, setNewClientRefPhoneCountry] = useState(DEFAULT_COUNTRY.code);
  const [savingClient, setSavingClient] = useState(false);
  const [clientFormFieldDefs, setClientFormFieldDefs] = useState<any[]>([]);
  const [clientFormFieldValues, setClientFormFieldValues] = useState<Record<string, string>>({});
  const [loadingClientFields, setLoadingClientFields] = useState(false);

  // Client Excel import
  const [showClientImport, setShowClientImport]   = useState(false);
  const [clientImportRaw, setClientImportRaw]     = useState('');
  const [clientImportRows, setClientImportRows]   = useState<{name:string;phone:string;refName:string;refPhone:string}[]>([]);
  const [importingClients, setImportingClients]   = useState(false);

  // Stages Excel import
  const [showStageImport, setShowStageImport]     = useState(false);
  const [stageImportRaw, setStageImportRaw]       = useState('');
  const [stageImportNames, setStageImportNames]   = useState<string[]>([]);
  const [importingStages, setImportingStages]     = useState(false);

  // ID / QR scanner for new client form
  const [showIdScanner, setShowIdScanner]   = useState(false);
  const [scannerPerm, requestScannerPerm]   = useCameraPermissions();
  const scannerCooldown                     = useRef(false);

  // Inline calendar for date fields
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState<string | null>(null);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [calCurrentDate, setCalCurrentDate] = useState<string | undefined>(undefined);

  // ── Network (people directory) ────────────────────────────
  const [network, setNetwork] = useState<any[]>([]);
  const [networkSearch, setNetworkSearch] = useState('');
  const [showNetworkForm, setShowNetworkForm] = useState(false);
  const [editNetworkId, setEditNetworkId] = useState<string | null>(null);
  const [netName, setNetName] = useState('');
  const [netPhone, setNetPhone] = useState('');
  const [netReference, setNetReference] = useState('');
  const [netRefPhone, setNetRefPhone] = useState('');
  const [netCityId, setNetCityId] = useState<string | null>(null);
  const [netCitySearch, setNetCitySearch] = useState('');
  const [showNetCityPicker, setShowNetCityPicker] = useState(false);
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [allCities, setAllCities] = useState<any[]>([]);
  // Network additional fields
  const [netFieldDefs, setNetFieldDefs] = useState<any[]>([]);
  const [netFieldValues, setNetFieldValues] = useState<Record<string, string>>({});
  const [netAddedFieldIds, setNetAddedFieldIds] = useState<string[]>([]);
  const [showNetFieldPicker, setShowNetFieldPicker] = useState(false);
  const [netFieldSearch, setNetFieldSearch] = useState('');
  const [netDatePickerFieldId, setNetDatePickerFieldId] = useState<string | null>(null);
  const [netDatePickerYear, setNetDatePickerYear] = useState(new Date().getFullYear());
  const [netDatePickerMonthYear, setNetDatePickerMonthYear] = useState(false);
  const [netDatePickerCurrent, setNetDatePickerCurrent] = useState<string | undefined>(undefined);
  // Network import
  const [showImportModal, setShowImportModal]       = useState(false);
  const [importRaw, setImportRaw]                   = useState('');
  const [importRows, setImportRows]                 = useState<{ name: string; phone: string; reference: string }[]>([]);
  const [importingContacts, setImportingContacts]   = useState(false);

  // Service import
  const [showSvcImportModal, setShowSvcImportModal]     = useState(false);
  const [svcImportRaw, setSvcImportRaw]                 = useState('');
  const [svcImportRows, setSvcImportRows]               = useState<{ name: string; priceUSD: string; priceLBP: string }[]>([]);
  const [importingServices, setImportingServices]       = useState(false);

  // ── Service documents checklist ───────────────────────────
  const [serviceDocs, setServiceDocs] = useState<Record<string, ServiceDocument[]>>({});
  const [expandedDocSvcId, setExpandedDocSvcId] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  // Documents Excel import
  const [docImportSvcId, setDocImportSvcId]   = useState<string | null>(null);
  const [docImportRaw, setDocImportRaw]         = useState('');
  const [docImportTitles, setDocImportTitles]   = useState<string[]>([]);
  const [importingDocs, setImportingDocs]       = useState(false);
  // ── Service document sub-requirements ────────────────────
  const [expandedDocReqId, setExpandedDocReqId] = useState<string | null>(null);
  const [docReqs, setDocReqs] = useState<Record<string, ServiceDocumentRequirement[]>>({});
  const [loadingDocReqs, setLoadingDocReqs] = useState<string | null>(null);
  const [docReqNewTitle, setDocReqNewTitle] = useState('');
  const [savingDocReq, setSavingDocReq] = useState(false);

  // ── Barcode parse helper ──────────────────────────────────
  const parseBarcodeData = (data: string): { name: string; phone: string } => {
    // Normalize: replace non-printable chars with space/newline
    const normalized = data.replace(/\r/g, '\n').replace(/[\x00-\x08\x0B-\x1F\x7F]/g, ' ');
    // Split by common delimiters used in ID barcodes
    const parts = normalized.split(/[\n|;,]+/).map(p => p.trim()).filter(Boolean);
    // Name candidates: 2+ words of letters (supports Arabic + Latin)
    const nameCandidates = parts.filter(p =>
      /^[\u0600-\u06FFa-zA-Z][\u0600-\u06FFa-zA-Z ]{3,}$/.test(p) && p.includes(' ')
    );
    // Phone candidates: 6–15 digits possibly starting with +
    const phoneCandidates = parts.filter(p => /^[+]?[0-9 ()-]{6,16}$/.test(p));
    return {
      name:  nameCandidates[0] ?? '',
      phone: phoneCandidates[0] ?? '',
    };
  };

  // ── Data fetching ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!orgId) return;
    const [c, s, m, net, cities, fieldDefs] = await Promise.all([
      supabase.from('clients').select('*').eq('org_id', orgId).order('name'),
      supabase.from('services').select('*').eq('org_id', orgId).order('name'),
      supabase.from('ministries').select('*, city:cities(id,name)').eq('type', 'parent').eq('org_id', orgId).order('name'),
      supabase.from('assignees').select('*, city:cities(id,name)').eq('org_id', orgId).order('name'),
      supabase.from('cities').select('*').eq('org_id', orgId).order('name'),
      supabase.from('client_field_definitions').select('*').eq('org_id', orgId).eq('is_active', true).order('sort_order'),
    ]);
    if (c.data) setClients(c.data as Client[]);
    if (s.data) setServices(s.data as Service[]);
    if (m.data) setMinistries(m.data as Ministry[]);
    if (net.data) setNetwork(net.data as any[]);
    if (cities.data) setAllCities(cities.data as any[]);
    if (fieldDefs.data) setNetFieldDefs(fieldDefs.data as any[]);
    setLoading(false);
  }, [orgId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // Open specific section when navigated here from the welcome overlay
  useFocusEffect(useCallback(() => {
    const section = (route.params as any)?.openSection as ManageSection | undefined;
    if (section) {
      setManageSection(section);
      // Clear the param so it doesn't re-trigger on next focus
      navigation.setParams({ openSection: undefined });
    }
  }, [route.params]));

  // ── Handlers ──────────────────────────────────────────────
  const openNewClientForm = async () => {
    setNewClientName('');
    setNewClientPhone('');
    setNewClientRefName('');
    setNewClientRefPhone('');
    setClientFormFieldValues({});
    setLoadingClientFields(true);
    setShowClientForm(true);
    const { data } = await supabase
      .from('client_field_definitions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setClientFormFieldDefs(data ?? []);
    setLoadingClientFields(false);
  };

  const handleCreateClientWithFields = async () => {
    if (!newClientName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingClient(true);

    // ── Duplicate check ──────────────────────────────────────────────────────
    const fullPhone = newClientPhone.trim() ? `${newClientPhoneCountry}${newClientPhone.trim()}` : '';
    const orFilters: string[] = [`name.ilike.${newClientName.trim()}`];
    if (fullPhone) orFilters.push(`phone.eq.${fullPhone}`);
    const { data: existing } = await supabase
      .from('clients')
      .select('id, name, phone, client_id')
      .eq('org_id', orgId)
      .or(orFilters.join(','))
      .limit(1)
      .maybeSingle();

    if (existing) {
      const reason = (existing as any).name?.toLowerCase() === newClientName.trim().toLowerCase()
        ? `name "${(existing as any).name}"`
        : `phone "${(existing as any).phone}"`;
      setSavingClient(false);
      Alert.alert(
        t('duplicateClient'),
        `A client already exists with this ${reason} (${(existing as any).client_id}).\n\nCreate anyway?`,
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('createAnyway'), onPress: () => doInsertClient() },
        ]
      );
      return;
    }

    doInsertClient();
  };

  const doInsertClient = async () => {
    setSavingClient(true);
    const autoId = `CLT-${Date.now()}`;
    const fullPhone    = newClientPhone.trim()    ? `${newClientPhoneCountry}${newClientPhone.trim()}`       : null;
    const fullRefPhone = newClientRefPhone.trim() ? `${newClientRefPhoneCountry}${newClientRefPhone.trim()}` : null;
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: newClientName.trim(), client_id: autoId, phone: fullPhone, reference_name: newClientRefName.trim() || null, reference_phone: fullRefPhone, org_id: orgId })
      .select()
      .single();
    if (error || !data) { setSavingClient(false); Alert.alert(t('error'), error?.message ?? t('failedToSave')); return; }
    const inserts: any[] = [];
    for (const def of clientFormFieldDefs) {
      const val = clientFormFieldValues[def.id];
      if (val !== undefined && val.trim() !== '') {
        inserts.push({ client_id: (data as any).id, field_id: def.id, value_text: val });
      }
    }
    if (inserts.length > 0) await supabase.from('client_field_values').insert(inserts);
    setSavingClient(false);
    setShowClientForm(false);
    setNewClientName(''); setNewClientPhone(''); setNewClientPhoneCountry(DEFAULT_COUNTRY.code);
    setNewClientRefName(''); setNewClientRefPhone(''); setNewClientRefPhoneCountry(DEFAULT_COUNTRY.code);
    setClientFormFieldValues({});
    fetchData();
  };

  const handleSaveEditClient = async () => {
    if (!editClientId || !editClientName.trim()) return;
    setSavingEditClient(true);
    await supabase.from('clients').update({ name: editClientName.trim(), phone: editClientPhone.trim() || null }).eq('id', editClientId);
    setSavingEditClient(false);
    setEditClientId(null);
    fetchData();
  };

  const handleDeleteClient = (c: Client) => {
    const doDelete = async () => { await supabase.from('clients').delete().eq('id', c.id); fetchData(); };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Delete "${c.name}"? This cannot be undone.`)) doDelete();
    } else {
      Alert.alert(`${t('delete')} ${t('clients')}`, `Delete "${c.name}"? This cannot be undone.`, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleCreateService = async () => {
    if (!newSvcName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingNewSvc(true);
    await supabase.from('services').insert({ name: newSvcName.trim(), estimated_duration_days: 0, base_price_usd: parseFloat(newSvcPriceUSD) || 0, base_price_lbp: parseFloat(newSvcPriceLBP.replace(/,/g, '')) || 0, org_id: orgId });
    setSavingNewSvc(false);
    setNewSvcName(''); setNewSvcPriceUSD(''); setNewSvcPriceLBP('');
    fetchData();
  };

  const handleSaveEditService = async () => {
    if (!editSvcId || !editSvcName.trim()) return;
    setSavingEditSvc(true);
    await supabase.from('services').update({ name: editSvcName.trim(), base_price_usd: parseFloat(editSvcPriceUSD) || 0, base_price_lbp: parseFloat(editSvcPriceLBP.replace(/,/g, '')) || 0 }).eq('id', editSvcId);
    setSavingEditSvc(false);
    setEditSvcId(null);
    fetchData();
  };

  const handleDeleteService = (sv: Service) => {
    const doDelete = async () => { await supabase.from('services').delete().eq('id', sv.id); fetchData(); };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Delete "${sv.name}"?`)) doDelete();
    } else {
      Alert.alert(`${t('delete')} ${t('services')}`, `Delete "${sv.name}"?`, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

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
    const doDelete = async () => { await supabase.from('ministries').delete().eq('id', m.id); fetchData(); };
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
    setAllCities(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewStageCityName('');
    setShowCreateStageCityForm(false);
    await handleSetStageCity(ministryId, data.id);
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
    // Check if ministry with this name already exists
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
    const idx = stages.findIndex((s) => s.id === stageId);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === stages.length - 1) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    await Promise.all([
      supabase.from('service_default_stages').update({ stop_order: stages[swapIdx].stop_order }).eq('id', stages[idx].id),
      supabase.from('service_default_stages').update({ stop_order: stages[idx].stop_order }).eq('id', stages[swapIdx].id),
    ]);
    await fetchSvcStages(svcId);
  };

  // ── Inline Stage Requirements ──────────────────────────────
  const fetchStageReqs = async (ministryId: string) => {
    setLoadingStageReqs(ministryId);
    const { data } = await supabase
      .from('ministry_requirements')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('sort_order');
    setStageReqs((prev) => ({ ...prev, [ministryId]: data ?? [] }));
    setLoadingStageReqs(null);
  };

  const handleToggleStageReqExpand = async (ministryId: string) => {
    if (expandedStageReqId === ministryId) { setExpandedStageReqId(null); return; }
    setExpandedStageReqId(ministryId);
    await fetchStageReqs(ministryId);
  };

  const handleAddStageReq = async (ministryId: string) => {
    const title = stageReqNewTitle.trim();
    if (!title) return;
    setSavingNewStageReq(true);
    const reqs = stageReqs[ministryId] ?? [];
    await supabase.from('ministry_requirements').insert({ ministry_id: ministryId, title, req_type: 'document', sort_order: reqs.length + 1 });
    setSavingNewStageReq(false);
    setStageReqNewTitle('');
    await fetchStageReqs(ministryId);
  };

  const handleDeleteStageReq = async (ministryId: string, reqId: string) => {
    await supabase.from('ministry_requirements').delete().eq('id', reqId);
    await fetchStageReqs(ministryId);
  };

  // ── Network helpers ───────────────────────────────────────
  const matchesNetworkSearch = (n: any, query: string) => {
    const q = query.toLowerCase();
    return (
      n.name?.toLowerCase().includes(q) ||
      n.phone?.toLowerCase().includes(q) ||
      n.reference?.toLowerCase().includes(q) ||
      n.reference_phone?.toLowerCase().includes(q) ||
      n.notes?.toLowerCase().includes(q) ||
      n.city?.name?.toLowerCase().includes(q)
    );
  };

  // ── Network handlers ─────────────────────────────────────
  const openNetworkForm = async (contact?: any) => {
    setNetFieldValues({});
    setNetAddedFieldIds([]);
    setShowNetFieldPicker(false);
    setNetFieldSearch('');
    setNetCitySearch('');
    setShowNetCityPicker(false);
    setNetDatePickerFieldId(null);
    setNetDatePickerMonthYear(false);
    setNetDatePickerCurrent(undefined);
    if (contact) {
      setEditNetworkId(contact.id);
      setNetName(contact.name ?? '');
      setNetPhone(contact.phone ?? '');
      setNetReference(contact.reference ?? '');
      setNetRefPhone(contact.reference_phone ?? '');
      setNetCityId(contact.city_id ?? null);
    } else {
      setEditNetworkId(null);
      setNetName(''); setNetPhone(''); setNetReference(''); setNetRefPhone(''); setNetCityId(null);
    }
    setShowNetworkForm(true);
  };

  const handleSaveNetworkContact = async () => {
    if (!netName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingNetwork(true);
    const payload = {
      name: netName.trim(),
      phone: netPhone.trim() || null,
      reference: netReference.trim() || null,
      reference_phone: netRefPhone.trim() || null,
      city_id: netCityId ?? null,
      org_id: orgId,
    };
    let assigneeId: string;
    if (editNetworkId) {
      await supabase.from('assignees').update(payload).eq('id', editNetworkId);
      assigneeId = editNetworkId;
    } else {
      const { data: newContact, error } = await supabase.from('assignees').insert(payload).select().single();
      if (error || !newContact) { setSavingNetwork(false); Alert.alert(t('error'), error?.message ?? t('failedToSave')); return; }
      assigneeId = (newContact as any).id;
    }
    setSavingNetwork(false);
    setShowNetworkForm(false);
    setEditNetworkId(null);
    const { data } = await supabase.from('assignees').select('*, city:cities(id,name)').order('name');
    if (data) setNetwork(data);
  };

  const handleDeleteNetworkContact = (contact: any) => {
    Alert.alert(`${t('delete')} ${t('network')}`, `Delete "${contact.name}"?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          await supabase.from('assignees').delete().eq('id', contact.id);
          setNetwork(prev => prev.filter(n => n.id !== contact.id));
        },
      },
    ]);
  };

  // ── Network import helpers ────────────────────────────────
  const parseImportText = (raw: string) => {
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    return lines.map(l => {
      const cols = l.split('\t');
      return {
        name:      (cols[0] ?? '').trim(),
        phone:     (cols[1] ?? '').trim(),
        reference: (cols[2] ?? '').trim(),
      };
    }).filter(r => r.name);
  };

  const handleImportContacts = async () => {
    if (!importRows.length) return;
    setImportingContacts(true);
    const inserts = importRows.map(r => ({
      name:      r.name,
      phone:     r.phone || null,
      reference: r.reference || null,
      org_id:    orgId,
    }));
    const { error } = await supabase.from('assignees').insert(inserts);
    setImportingContacts(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    setShowImportModal(false);
    setImportRaw('');
    setImportRows([]);
    const { data } = await supabase.from('assignees').select('*, city:cities(id,name)').order('name');
    if (data) setNetwork(data as any[]);
    Alert.alert(t('success'), `${inserts.length} ${t('contacts')}`);
  };

  // ── Service import helpers ───────────────────────────────────
  const parseSvcImportText = (raw: string) => {
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
      name:                r.name,
      base_price_usd:      parseFloat(r.priceUSD) || 0,
      base_price_lbp:      parseInt(r.priceLBP, 10) || 0,
      estimated_duration_days: 0,
      org_id:              orgId,
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

  // ── Service document handlers ─────────────────────────────
  const fetchServiceDocs = async (serviceId: string) => {
    const { data } = await supabase.from('service_documents').select('*').eq('service_id', serviceId).order('sort_order');
    setServiceDocs(prev => ({ ...prev, [serviceId]: (data ?? []) as ServiceDocument[] }));
    // Pre-fetch sub-req counts for badge display (fire-and-forget)
    for (const doc of data ?? []) {
      supabase.from('service_document_requirements').select('id').eq('doc_id', doc.id)
        .then(({ data: rd }) => {
          if (rd) setDocReqs(prev => ({ ...prev, [doc.id]: rd as ServiceDocumentRequirement[] }));
        });
    }
  };

  const handleToggleDocExpand = async (serviceId: string) => {
    if (expandedDocSvcId === serviceId) { setExpandedDocSvcId(null); return; }
    setExpandedDocSvcId(serviceId);
    await fetchServiceDocs(serviceId);
  };

  const handleAddDoc = async (serviceId: string) => {
    const title = newDocTitle.trim();
    if (!title) return;
    setSavingDoc(true);
    const docs = serviceDocs[serviceId] ?? [];
    const maxOrder = docs.length > 0 ? Math.max(...docs.map(d => d.sort_order)) : 0;
    const { data } = await supabase.from('service_documents')
      .insert({ service_id: serviceId, title, sort_order: maxOrder + 1, org_id: orgId })
      .select().single();
    setSavingDoc(false);
    if (data) {
      setServiceDocs(prev => ({ ...prev, [serviceId]: [...(prev[serviceId] ?? []), data as ServiceDocument] }));
      setNewDocTitle('');
    }
  };

  const handleToggleDocCheck = async (doc: ServiceDocument) => {
    const next = !doc.is_checked;
    await supabase.from('service_documents').update({ is_checked: next }).eq('id', doc.id);
    setServiceDocs(prev => ({
      ...prev,
      [doc.service_id]: (prev[doc.service_id] ?? []).map(d => d.id === doc.id ? { ...d, is_checked: next } : d),
    }));
  };

  const handleDeleteDoc = async (doc: ServiceDocument) => {
    await supabase.from('service_documents').delete().eq('id', doc.id);
    setServiceDocs(prev => ({ ...prev, [doc.service_id]: (prev[doc.service_id] ?? []).filter(d => d.id !== doc.id) }));
  };

  const handleResetChecks = async (serviceId: string) => {
    await supabase.from('service_documents').update({ is_checked: false }).eq('service_id', serviceId);
    setServiceDocs(prev => ({ ...prev, [serviceId]: (prev[serviceId] ?? []).map(d => ({ ...d, is_checked: false })) }));
  };

  const handleShareServiceDocsWhatsApp = (svcName: string, docs: any[]) => {
    if (docs.length === 0) return;
    const lines = [`📋 *${svcName}* — Required Documents:\n`];
    docs.forEach((doc, idx) => {
      lines.push(`${idx + 1}. *${doc.title}*`);
      (docReqs[doc.id] ?? []).forEach((r: any) => lines.push(`   • ${r.title}`));
    });
    if (teamMember?.name) lines.push(`\n_Generated by ${teamMember.name}_`);
    lines.push('_GovPilot, Powered by KTS_');
    const msg = encodeURIComponent(lines.join('\n'));
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() =>
      Alert.alert(t('error'), t('somethingWrong'))
    );
  };

  // ── Service document sub-requirement handlers ─────────────
  const fetchDocReqs = async (docId: string) => {
    setLoadingDocReqs(docId);
    const { data } = await supabase
      .from('service_document_requirements')
      .select('*')
      .eq('doc_id', docId)
      .order('sort_order');
    setDocReqs(prev => ({ ...prev, [docId]: (data ?? []) as ServiceDocumentRequirement[] }));
    setLoadingDocReqs(null);
  };

  const handleToggleDocReqExpand = async (docId: string) => {
    if (expandedDocReqId === docId) { setExpandedDocReqId(null); return; }
    setExpandedDocReqId(docId);
    if (!docReqs[docId]) await fetchDocReqs(docId);
  };

  const handleAddDocReq = async (docId: string) => {
    const trimmed = docReqNewTitle.trim();
    if (!trimmed) return;
    setSavingDocReq(true);
    const reqs = docReqs[docId] ?? [];
    const { data } = await supabase
      .from('service_document_requirements')
      .insert({ doc_id: docId, title: trimmed, sort_order: reqs.length + 1, org_id: orgId })
      .select().single();
    setSavingDocReq(false);
    if (data) {
      setDocReqs(prev => ({ ...prev, [docId]: [...(prev[docId] ?? []), data as ServiceDocumentRequirement] }));
      setDocReqNewTitle('');
    }
  };

  const handleDeleteDocReq = async (docId: string, reqId: string) => {
    await supabase.from('service_document_requirements').delete().eq('id', reqId);
    setDocReqs(prev => ({ ...prev, [docId]: (prev[docId] ?? []).filter(r => r.id !== reqId) }));
  };

  const parseDocImport = (raw: string): string[] =>
    raw.split(/\r?\n/).map(l => l.split('\t')[0].trim()).filter(Boolean);

  // ── Client import helpers ─────────────────────────────────
  const parseClientImport = (raw: string) =>
    raw.split(/\r?\n/).map(l => {
      const c = l.split('\t');
      return { name:(c[0]??'').trim(), phone:(c[1]??'').trim(), refName:(c[2]??'').trim(), refPhone:(c[3]??'').trim() };
    }).filter(r => r.name);

  const handleImportClients = async () => {
    if (!clientImportRows.length) return;
    setImportingClients(true);

    // ── Duplicate check ──────────────────────────────────────────────────────
    const { data: existingClients } = await supabase
      .from('clients').select('name, phone').eq('org_id', orgId);
    const existingNames  = new Set((existingClients ?? []).map((c: any) => c.name?.toLowerCase()));
    const existingPhones = new Set((existingClients ?? []).map((c: any) => c.phone).filter(Boolean));

    const duplicates: string[] = [];
    const uniqueRows = clientImportRows.filter(r => {
      const isDup = existingNames.has(r.name.toLowerCase()) ||
                    (r.phone && existingPhones.has(r.phone));
      if (isDup) { duplicates.push(r.name); return false; }
      return true;
    });

    if (uniqueRows.length === 0) {
      setImportingClients(false);
      Alert.alert(t('allDuplicates'), `All clients already exist:\n${duplicates.join(', ')}`);
      return;
    }

    const inserts = uniqueRows.map((r, i) => ({
      name: r.name,
      client_id: `CLT-${Date.now()}-${i}`,
      phone: r.phone || null,
      reference_name: r.refName || null,
      reference_phone: r.refPhone || null,
      org_id: orgId,
    }));
    const { error } = await supabase.from('clients').insert(inserts);
    setImportingClients(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) setClients(data as Client[]);
    setShowClientImport(false); setClientImportRaw(''); setClientImportRows([]);
    const skippedMsg = duplicates.length > 0 ? `\n${t('skippedDuplicates')}: ${duplicates.join(', ')}` : '';
    Alert.alert(t('success'), `${inserts.length} ${t('clients')}${skippedMsg}`);
  };

  // ── Stages import helpers ─────────────────────────────────
  const parseStageImport = (raw: string): string[] =>
    raw.split(/\r?\n/).map(l => l.split('\t')[0].trim()).filter(Boolean);

  const handleImportStages = async () => {
    if (!stageImportNames.length) return;
    setImportingStages(true);
    const inserts = stageImportNames.map(name => ({ name, type: 'parent' as const, org_id: orgId }));
    const { data, error } = await supabase.from('ministries').insert(inserts).select();
    setImportingStages(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    if (data) setMinistries(prev => [...prev, ...(data as any[])].sort((a,b) => a.name.localeCompare(b.name)));
    setShowStageImport(false); setStageImportRaw(''); setStageImportNames([]);
    Alert.alert(t('success'), `${inserts.length} ${t('stages')}`);
  };

  const handleImportDocs = async () => {
    if (!docImportSvcId || !docImportTitles.length) return;
    setImportingDocs(true);
    const docs = serviceDocs[docImportSvcId] ?? [];
    const maxOrder = docs.length > 0 ? Math.max(...docs.map(d => d.sort_order)) : 0;
    const inserts = docImportTitles.map((title, i) => ({
      service_id: docImportSvcId,
      title,
      sort_order: maxOrder + i + 1,
      is_checked: false,
      org_id: orgId,
    }));
    const { data, error } = await supabase.from('service_documents').insert(inserts).select();
    setImportingDocs(false);
    if (error) { Alert.alert(t('error'), error.message); return; }
    if (data) setServiceDocs(prev => ({ ...prev, [docImportSvcId]: [...(prev[docImportSvcId] ?? []), ...(data as ServiceDocument[])] }));
    setDocImportSvcId(null);
    setDocImportRaw('');
    setDocImportTitles([]);
    Alert.alert(t('success'), `${inserts.length} ${t('documents')}`);
  };

  // ── UI ────────────────────────────────────────────────────
  const quickActions = [
    ...(permissions.can_create_files ? [{
      icon: '📄',
      label: t('newFileBtn'),
      color: theme.color.primary,
      onPress: () => (navigation as any).navigate('Dashboard', { screen: 'NewTask' }),
    }] : []),
    ...(permissions.can_manage_clients ? [{
      icon: '👤',
      label: t('newClient'),
      color: '#10b981',
      onPress: () => openNewClientForm(),
    }] : []),
    ...(permissions.can_manage_catalog ? [{
      icon: '⚙',
      label: t('newService'),
      color: '#f59e0b',
      onPress: () => { setClientSearch(''); setServiceSearch(''); setStageSearch(''); setManageSection('services'); },
    }] : []),
    ...(permissions.can_manage_catalog ? [{
      icon: '◎',
      label: t('newStage'),
      color: '#8b5cf6',
      onPress: () => { setClientSearch(''); setServiceSearch(''); setStageSearch(''); setManageSection('stages'); },
    }] : []),
    ...(permissions.can_manage_catalog ? [{
      icon: '👥',
      label: t('network'),
      color: '#06b6d4',
      onPress: () => { setNetworkSearch(''); setShowNetworkForm(false); setShowImportModal(false); setManageSection('network'); },
    }] : []),
    {
      icon: '📋',
      label: t('documents'),
      color: '#a855f7',
      onPress: () => { setExpandedDocSvcId(null); setDocSearch(''); setManageSection('documents'); },
    },
  ];

  const manageRows = [
    ...(permissions.can_manage_clients  ? [{ key: 'clients'  as ManageSection, icon: '👤', label: t('clients'),  count: clients.length }] : []),
    ...(permissions.can_manage_catalog  ? [{ key: 'services' as ManageSection, icon: '⚙', label: t('services'), count: services.length }] : []),
    ...(permissions.can_manage_catalog  ? [{ key: 'stages'   as ManageSection, icon: '◎', label: t('stages'),   count: ministries.length }] : []),
    ...(permissions.can_manage_catalog  ? [{ key: 'network'  as ManageSection, icon: '👥', label: t('network'),  count: network.length }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('create')}</Text>
        </View>

        {/* QUICK ACTIONS */}
        <Text style={s.sectionLabel}>{t('quickActions').toUpperCase()}</Text>
        <View style={s.actionGrid}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[s.actionCard, { borderColor: a.color + '55', backgroundColor: a.color + '18' }]}
              onPress={a.onPress}
              activeOpacity={0.75}
            >
              <Text style={[s.actionIcon, { color: a.color }]}>{a.icon}</Text>
              <Text style={[s.actionLabel, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* MANAGE */}
        <Text style={[s.sectionLabel, { marginTop: theme.spacing.space4 }]}>{t('manage').toUpperCase()}</Text>
        <View style={s.manageList}>
          {manageRows.map((row, i) => (
            <TouchableOpacity
              key={row.key}
              style={[s.manageRow, i < manageRows.length - 1 && s.manageRowBorder]}
              onPress={() => { setClientSearch(''); setServiceSearch(''); setStageSearch(''); setNetworkSearch(''); setShowNetworkForm(false); setManageSection(row.key); }}
              activeOpacity={0.7}
            >
              <Text style={s.manageRowIcon}>{row.icon}</Text>
              <Text style={s.manageRowLabel}>{row.label}</Text>
              <View style={s.manageRowBadge}>
                <Text style={s.manageRowCount}>{formatNumber(row.count, lang)}</Text>
              </View>
              <Text style={s.manageRowArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── MANAGE CLIENTS MODAL ── */}
      <Modal
        visible={manageSection === 'clients'}
        transparent
        animationType="fade"
        onRequestClose={() => { setManageSection(null); setClientSearch(''); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }}>
            <View style={[s.modalSheet, { maxHeight: '82%' }]}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>{t('clients')}</Text>
                  <Text style={s.modalSubtitle}>
                    {clientSearch
                      ? `${clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.phone ?? '').includes(clientSearch)).length} of ${clients.length}`
                      : `${clients.length} total`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    style={s.modalAddBtn}
                    onPress={() => { setManageSection(null); setClientSearch(''); openNewClientForm(); }}
                  >
                    <Text style={s.modalAddBtnText}>+ {t('add')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setManageSection(null); setClientSearch(''); }}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={s.mgmtSearchRow}>
                <TextInput
                  style={s.mgmtSearchInput}
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  placeholder={t('searchPlaceholder')}
                  placeholderTextColor={theme.color.textMuted}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                {clients.length === 0 ? (
                  <Text style={s.mgmtEmpty}>{t('noFilesFound')}</Text>
                ) : clients.filter(c =>
                  !clientSearch.trim() ||
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  (c.phone ?? '').includes(clientSearch)
                ).length === 0 ? (
                  <Text style={s.mgmtEmpty}>No clients match "{clientSearch}"</Text>
                ) : clients.filter(c =>
                  !clientSearch.trim() ||
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  (c.phone ?? '').includes(clientSearch)
                ).map((c) => (
                  <View key={c.id} style={s.mgmtClientRow}>
                    <View style={s.mgmtClientAvatar}>
                      <Text style={s.mgmtClientAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.mgmtItemName}>{c.name}</Text>
                      {!!c.reference_name && (
                        <Text style={s.mgmtItemRef}>عبر {c.reference_name}</Text>
                      )}
                      {c.phone ? (
                        <TouchableOpacity onPress={() => openPhone(c.phone!, c.name)} activeOpacity={0.7}>
                          <Text style={[s.mgmtItemSub, { color: theme.color.primary }]}>📞 {formatPhoneDisplay(c.phone)}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {permissions.can_edit_delete_clients && (
                      <TouchableOpacity
                        style={s.mgmtEditBtn}
                        onPress={() => { setManageSection(null); (navigation as any).navigate('Dashboard', { screen: 'EditClient', params: { clientId: c.id } }); }}
                      >
                        <Text style={s.mgmtEditBtnText}>✎</Text>
                      </TouchableOpacity>
                    )}
                    {permissions.can_edit_delete_clients && (
                      <TouchableOpacity style={s.mgmtDelBtn} onPress={() => handleDeleteClient(c)}>
                        <Text style={s.mgmtDelBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── NEW CLIENT FORM ── */}
      <Modal
        visible={showClientForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClientForm(false)}
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
                      scannerCooldown.current = false;
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
                  <TouchableOpacity onPress={() => { setShowClientForm(false); setShowClientImport(false); }}>
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
                      onChangeText={(t) => { setClientImportRaw(t); setClientImportRows([]); }}
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
                    {clientFormFieldDefs.map((def) => (
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
                            {(def.options as string[]).map((opt) => (
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
                                    onDayPress={(day) => {
                                      const [y, m, d] = day.dateString.split('-');
                                      setClientFormFieldValues((p) => ({ ...p, [def.id]: `${d}/${m}/${y}` }));
                                      setShowDatePicker(false);
                                      setCurrentDateField(null);
                                      setCalCurrentDate(undefined);
                                      setShowMonthYearPicker(false);
                                    }}
                                    onMonthChange={(date) => setCalCurrentDate(date.dateString)}
                                    renderHeader={(date) => {
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

      {/* ── MANAGE SERVICES MODAL ── */}
      <Modal
        visible={manageSection === 'services'}
        transparent
        animationType="fade"
        onRequestClose={() => { setManageSection(null); setEditSvcId(null); setServiceSearch(''); setShowSvcImportModal(false); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }}>
            <View style={[s.modalSheet, showSvcImportModal ? { height: '90%' } : { maxHeight: '90%' }]}>

              {/* ── HEADER — import view or list view ── */}
              {showSvcImportModal ? (
                <View style={s.modalHeader}>
                  <TouchableOpacity onPress={() => setShowSvcImportModal(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: theme.color.primary, fontSize: 18 }}>‹</Text>
                    <Text style={{ ...theme.typography.label, color: theme.color.primary }}>Back</Text>
                  </TouchableOpacity>
                  <Text style={s.modalTitle}>📥 {t('importServicesBtn')}</Text>
                  <TouchableOpacity onPress={() => { setManageSection(null); setShowSvcImportModal(false); setServiceSearch(''); }}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.modalHeader}>
                  <View>
                    <Text style={s.modalTitle}>{t('services')}</Text>
                    <Text style={s.modalSubtitle}>
                      {serviceSearch ? `${services.filter(sv => sv.name.toLowerCase().includes(serviceSearch.toLowerCase())).length} of ${services.length}` : `${services.length} total`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={s.modalImportBtn}
                      onPress={() => { setSvcImportRaw(''); setSvcImportRows([]); setShowSvcImportModal(true); }}
                    >
                      <Text style={s.modalImportBtnText}>{t('importBtn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setManageSection(null); setEditSvcId(null); setServiceSearch(''); }}>
                      <Text style={s.modalClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {showSvcImportModal ? (
                /* ── IMPORT VIEW body ── */
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
                  <View style={s.importInstructions}>
                    <Text style={s.importInstructionsTitle}>{t('howToImportExcel')}</Text>
                    <Text style={s.importInstructionsText}>
                      {'1. Make sure columns are: A = Service Name  |  B = Price USD  |  C = Price LBP\n2. Select all data rows (not the header)\n3. Press Ctrl+C (or Cmd+C on Mac)\n4. Long-press in the box below → Paste'}
                    </Text>
                  </View>

                  <TextInput
                    style={s.importTextArea}
                    value={svcImportRaw}
                    onChangeText={setSvcImportRaw}
                    placeholder={'Paste Excel data here...\n\nExample:\nPassport Renewal\t150\t225000\nVisa Application\t200\t300000'}
                    placeholderTextColor={theme.color.textMuted}
                    multiline
                    numberOfLines={6}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={s.importPreviewBtn}
                    onPress={() => {
                      const rows = parseSvcImportText(svcImportRaw);
                      if (!rows.length) { Alert.alert(t('noResults'), t('emptyList')); return; }
                      setSvcImportRows(rows);
                    }}
                  >
                    <Text style={s.importPreviewBtnText}>Preview ({parseSvcImportText(svcImportRaw).length} rows)</Text>
                  </TouchableOpacity>

                  {svcImportRows.length > 0 && (
                    <>
                      <Text style={s.importPreviewLabel}>PREVIEW — {svcImportRows.length} SERVICE{svcImportRows.length !== 1 ? 'S' : ''}</Text>
                      {svcImportRows.map((r, i) => (
                        <View key={i} style={s.importPreviewRow}>
                          <View style={s.importRowNum}><Text style={s.importRowNumText}>{i + 1}</Text></View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={s.importRowName}>{r.name}</Text>
                            {r.priceUSD ? <Text style={s.importRowSub}>$ {parseFloat(r.priceUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text> : null}
                            {r.priceLBP ? <Text style={s.importRowSub}>LBP {parseInt(r.priceLBP, 10).toLocaleString('en-US')}</Text> : null}
                          </View>
                        </View>
                      ))}
                      <TouchableOpacity
                        style={[s.modalSaveBtn, importingServices && s.modalSaveBtnDisabled]}
                        onPress={handleImportServices}
                        disabled={importingServices}
                      >
                        {importingServices
                          ? <ActivityIndicator color={theme.color.white} size="small" />
                          : <Text style={s.modalSaveBtnText}>Import {svcImportRows.length} Service{svcImportRows.length !== 1 ? 's' : ''}</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              ) : (
                <>
              <View style={s.mgmtSearchRow}>
                <TextInput
                  style={s.mgmtSearchInput}
                  value={serviceSearch}
                  onChangeText={setServiceSearch}
                  placeholder={t('searchService')}
                  placeholderTextColor={theme.color.textMuted}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                <View style={s.mgmtAddBlock}>
                  <Text style={s.mgmtAddSectionLabel}>{t('newService').toUpperCase()}</Text>
                  <TextInput style={s.modalInput} value={newSvcName} onChangeText={setNewSvcName} placeholder={`${t('serviceName')} *`} placeholderTextColor={theme.color.textMuted} />
                  <View style={s.mgmtPriceRow}>
                    <TextInput style={[s.modalInput, { flex: 1 }]} value={newSvcPriceUSD} onChangeText={setNewSvcPriceUSD} placeholder={t('amountUSD')} placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
                    <TextInput style={[s.modalInput, { flex: 1 }]} value={newSvcPriceLBP} onChangeText={(v) => { const d = v.replace(/,/g, ''); if (d === '' || /^\d*$/.test(d)) setNewSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US')); }} placeholder={t('amountLBP')} placeholderTextColor={theme.color.textMuted} keyboardType="number-pad" />
                  </View>
                  <TouchableOpacity style={s.mgmtAddBtn} onPress={handleCreateService} disabled={savingNewSvc}>
                    {savingNewSvc ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtAddBtnText}>+ {t('addService')}</Text>}
                  </TouchableOpacity>
                </View>
                {services.filter(sv =>
                  !serviceSearch.trim() ||
                  sv.name.toLowerCase().includes(serviceSearch.toLowerCase())
                ).map((sv) => (
                  <View key={sv.id}>
                    {editSvcId === sv.id ? (
                      <View style={[s.mgmtEditRow, { flexDirection: 'column', gap: 8 }]}>
                        <TextInput style={s.modalInput} value={editSvcName} onChangeText={setEditSvcName} placeholder={t('name')} placeholderTextColor={theme.color.textMuted} autoFocus />
                        <View style={s.mgmtPriceRow}>
                          <TextInput style={[s.modalInput, { flex: 1 }]} value={editSvcPriceUSD} onChangeText={setEditSvcPriceUSD} placeholder={t('amountUSD')} placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
                          <TextInput style={[s.modalInput, { flex: 1 }]} value={editSvcPriceLBP} onChangeText={(v) => { const d = v.replace(/,/g, ''); if (d === '' || /^\d*$/.test(d)) setEditSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US')); }} placeholder={t('amountLBP')} placeholderTextColor={theme.color.textMuted} keyboardType="number-pad" />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={[s.mgmtSaveBtn, { flex: 1 }]} onPress={handleSaveEditService} disabled={savingEditSvc}>
                            {savingEditSvc ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtSaveBtnText}>{t('save')}</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity style={s.mgmtCancelBtn} onPress={() => setEditSvcId(null)}>
                            <Text style={s.mgmtCancelBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View>
                        <View style={s.mgmtItemRow}>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => handleToggleSvcExpand(sv.id)}>
                            <Text style={[s.mgmtItemName, { color: theme.color.primaryText }]}>
                              {expandedSvcId === sv.id ? '▾ ' : '›  '}{sv.name}
                            </Text>
                            {(sv.base_price_usd > 0 || sv.base_price_lbp > 0) && (
                              <Text style={s.mgmtItemPrice}>
                                {sv.base_price_usd > 0 ? `$${sv.base_price_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
                                {sv.base_price_usd > 0 && sv.base_price_lbp > 0 ? '  ·  ' : ''}
                                {sv.base_price_lbp > 0 ? `LBP ${sv.base_price_lbp.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
                              </Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity style={s.mgmtEditBtn} onPress={() => { setExpandedSvcId(null); setEditSvcId(sv.id); setEditSvcName(sv.name); setEditSvcPriceUSD(sv.base_price_usd > 0 ? String(sv.base_price_usd) : ''); setEditSvcPriceLBP(sv.base_price_lbp > 0 ? sv.base_price_lbp.toLocaleString('en-US') : ''); }}>
                            <Text style={s.mgmtEditBtnText}>✎</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.mgmtDelBtn} onPress={() => handleDeleteService(sv)}>
                            <Text style={s.mgmtDelBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                        {expandedSvcId === sv.id && (
                          <View style={s.inlinePanel}>
                            {loadingSvcStages === sv.id ? (
                              <ActivityIndicator color={theme.color.primary} style={{ margin: 12 }} />
                            ) : (
                              <>
                                <Text style={s.inlinePanelLabel}>STAGES</Text>
                                {(svcStages[sv.id] ?? []).length === 0 ? (
                                  <Text style={s.inlinePanelEmpty}>{t('noStagesYetAddBelow')}</Text>
                                ) : (
                                  (svcStages[sv.id] ?? []).map((stage, idx) => (
                                    <View key={stage.id} style={s.inlineStageRow}>
                                      <Text style={s.inlineStageOrder}>{stage.stop_order}.</Text>
                                      <Text style={s.inlineStageName}>{stage.ministry?.name ?? '—'}</Text>
                                      <TouchableOpacity onPress={() => handleMoveSvcStage(sv.id, stage.id, 'up')} style={s.inlineStageBtn} disabled={idx === 0}>
                                        <Text style={[s.inlineStageBtnText, idx === 0 && { opacity: 0.25 }]}>↑</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => handleMoveSvcStage(sv.id, stage.id, 'down')} style={s.inlineStageBtn} disabled={idx === (svcStages[sv.id] ?? []).length - 1}>
                                        <Text style={[s.inlineStageBtnText, idx === (svcStages[sv.id] ?? []).length - 1 && { opacity: 0.25 }]}>↓</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => handleRemoveSvcStage(sv.id, stage.id)} style={[s.inlineStageBtn, { backgroundColor: theme.color.dangerDim }]}>
                                        <Text style={[s.inlineStageBtnText, { color: theme.color.danger }]}>✕</Text>
                                      </TouchableOpacity>
                                    </View>
                                  ))
                                )}
                                <View style={s.inlineAddRow}>
                                  <TextInput
                                    style={[s.mgmtSearchInput, { flex: 1 }]}
                                    value={svcStageNewName}
                                    onChangeText={setSvcStageNewName}
                                    placeholder={t('stageName')}
                                    placeholderTextColor={theme.color.textMuted}
                                  />
                                  <TouchableOpacity style={s.inlineAddBtn} onPress={() => handleAddSvcStage(sv.id)} disabled={savingNewSvcStage}>
                                    {savingNewSvcStage ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.inlineAddBtnText}>＋</Text>}
                                  </TouchableOpacity>
                                </View>
                                {svcStageNewName.trim().length > 0 && ministries.filter(m => m.name.toLowerCase().includes(svcStageNewName.toLowerCase())).length > 0 && (
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                                    {ministries.filter(m => m.name.toLowerCase().includes(svcStageNewName.toLowerCase())).map(m => (
                                      <TouchableOpacity key={m.id} style={s.inlinePill} onPress={() => handleAddExistingSvcStage(sv.id, m.id)}>
                                        <Text style={s.inlinePillText}>{m.name}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                )}
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))}
                {serviceSearch.trim() && services.filter(sv => sv.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
                  <Text style={s.mgmtEmpty}>{t('noServicesMatch')}: "{serviceSearch}"</Text>
                )}
              </ScrollView>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── MANAGE STAGES MODAL ── */}
      <Modal
        visible={manageSection === 'stages'}
        transparent
        animationType="fade"
        onRequestClose={() => { setManageSection(null); setEditStageId(null); setStageSearch(''); setShowStageImport(false); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }}>
            <View style={[s.modalSheet, { maxHeight: '90%' }]}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>{t('stages')}</Text>
                  <Text style={s.modalSubtitle}>
                    {stageSearch ? `${ministries.filter(m => m.name.toLowerCase().includes(stageSearch.toLowerCase())).length} of ${ministries.length}` : `${ministries.length} total`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={s.docImportToggleBtn}
                    onPress={() => { setShowStageImport(v => !v); setStageImportRaw(''); setStageImportNames([]); }}
                  >
                    <Text style={s.docImportToggleBtnText}>📥</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setManageSection(null); setEditStageId(null); setStageSearch(''); setShowStageImport(false); }}>
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
                    onChangeText={(t) => { setStageImportRaw(t); setStageImportNames([]); }}
                    placeholder={t('paste')}
                    placeholderTextColor={theme.color.textMuted}
                    multiline
                    textAlignVertical="top"
                  />
                  {stageImportNames.length === 0 ? (
                    <TouchableOpacity style={s.docImportPreviewBtn} onPress={() => setStageImportNames(parseStageImport(stageImportRaw))} disabled={!stageImportRaw.trim()}>
                      <Text style={s.docImportPreviewBtnText}>Preview</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      {stageImportNames.map((name, i) => (
                        <View key={i} style={s.docImportPreviewRow}>
                          <Text style={s.docImportPreviewTitle} numberOfLines={1}>{name}</Text>
                        </View>
                      ))}
                      <TouchableOpacity style={s.docImportConfirmBtn} onPress={handleImportStages} disabled={importingStages}>
                        {importingStages ? <ActivityIndicator size="small" color={theme.color.white} /> : <Text style={s.docImportConfirmBtnText}>Import {stageImportNames.length} stage{stageImportNames.length !== 1 ? 's' : ''}</Text>}
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
                {ministries.filter(m =>
                  !stageSearch.trim() ||
                  m.name.toLowerCase().includes(stageSearch.toLowerCase())
                ).map((m) => (
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
                              const cityName = m.city?.name ?? allCities.find(c => c.id === m.city_id)?.name ?? null;
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
                                    : <Text style={s.mgmtSaveBtnText}>Save City</Text>}
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
                                .filter(c => !stageCitySearch.trim() || c.name.toLowerCase().includes(stageCitySearch.toLowerCase()))
                                .slice(0, 15)
                                .map(city => (
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
                              {allCities.filter(c => !stageCitySearch.trim() || c.name.toLowerCase().includes(stageCitySearch.toLowerCase())).length === 0 && (
                                <Text style={{ color: theme.color.textMuted, fontSize: 13, padding: 12 }}>No cities match "{stageCitySearch}"</Text>
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))}
                {stageSearch.trim() && ministries.filter(m => m.name.toLowerCase().includes(stageSearch.toLowerCase())).length === 0 && (
                  <Text style={s.mgmtEmpty}>No stages match "{stageSearch}"</Text>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── ID / QR SCANNER MODAL ── */}
      <Modal visible={showIdScanner} transparent={false} animationType="slide" onRequestClose={() => setShowIdScanner(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {showIdScanner && (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['pdf417', 'qr', 'code128', 'code39', 'ean13', 'datamatrix'] }}
              onBarcodeScanned={(result) => {
                if (scannerCooldown.current) return;
                scannerCooldown.current = true;
                const parsed = parseBarcodeData(result.data);
                setShowIdScanner(false);
                // Pre-fill form fields with whatever we extracted
                if (parsed.name)  setNewClientName(parsed.name);
                if (parsed.phone) setNewClientPhone(parsed.phone);
                if (!parsed.name && !parsed.phone) {
                  // Show raw data so user can inspect
                  Alert.alert(
                    t('scanDoc'),
                    result.data.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, 300),
                    [{ text: t('ok') }]
                  );
                }
              }}
            />
          )}
          {/* Overlay UI */}
          <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {/* Top bar */}
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>📷 Scan ID / QR Code</Text>
              <TouchableOpacity onPress={() => setShowIdScanner(false)}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Center frame guide */}
            <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 280, height: 160, borderRadius: 12, borderWidth: 2, borderColor: '#6366f1', backgroundColor: 'transparent' }} />
              <Text style={{ color: '#fff', marginTop: 16, fontSize: 13, opacity: 0.85, textAlign: 'center' }}>
                Point at the PDF417 barcode or QR code{'\n'}on the ID document
              </Text>
            </View>
            {/* Bottom info */}
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 20 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' }}>
                Supports: PDF417 · QR · Code128 · EAN-13 · DataMatrix
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── NETWORK MODAL ── (extracted to ./Create/components/NetworkModal.tsx) */}
      <NetworkModal
        visible={manageSection === 'network'}
        onClose={() => setManageSection(null)}
        t={t}
        network={network}
        networkSearch={networkSearch}
        setNetworkSearch={setNetworkSearch}
        matchesNetworkSearch={matchesNetworkSearch}
        showNetworkForm={showNetworkForm}
        setShowNetworkForm={setShowNetworkForm}
        editNetworkId={editNetworkId}
        setEditNetworkId={setEditNetworkId}
        netName={netName}
        setNetName={setNetName}
        netPhone={netPhone}
        setNetPhone={setNetPhone}
        netReference={netReference}
        setNetReference={setNetReference}
        netRefPhone={netRefPhone}
        setNetRefPhone={setNetRefPhone}
        netCityId={netCityId}
        setNetCityId={setNetCityId}
        netCitySearch={netCitySearch}
        setNetCitySearch={setNetCitySearch}
        showNetCityPicker={showNetCityPicker}
        setShowNetCityPicker={setShowNetCityPicker}
        savingNetwork={savingNetwork}
        allCities={allCities}
        netFieldDefs={netFieldDefs}
        netFieldValues={netFieldValues}
        setNetFieldValues={setNetFieldValues}
        netAddedFieldIds={netAddedFieldIds}
        setNetAddedFieldIds={setNetAddedFieldIds}
        showNetFieldPicker={showNetFieldPicker}
        setShowNetFieldPicker={setShowNetFieldPicker}
        netFieldSearch={netFieldSearch}
        setNetFieldSearch={setNetFieldSearch}
        netDatePickerFieldId={netDatePickerFieldId}
        setNetDatePickerFieldId={setNetDatePickerFieldId}
        netDatePickerYear={netDatePickerYear}
        setNetDatePickerYear={setNetDatePickerYear}
        netDatePickerMonthYear={netDatePickerMonthYear}
        setNetDatePickerMonthYear={setNetDatePickerMonthYear}
        netDatePickerCurrent={netDatePickerCurrent}
        setNetDatePickerCurrent={setNetDatePickerCurrent}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        importRaw={importRaw}
        setImportRaw={setImportRaw}
        importRows={importRows}
        setImportRows={setImportRows}
        importingContacts={importingContacts}
        parseImportText={parseImportText}
        openNetworkForm={openNetworkForm}
        handleSaveNetworkContact={handleSaveNetworkContact}
        handleDeleteNetworkContact={handleDeleteNetworkContact}
        handleImportContacts={handleImportContacts}
        s={s}
      />

      {/* ── DOCUMENTS REQUIRED MODAL ── */}
      <Modal visible={manageSection === 'documents'} transparent animationType="slide" onRequestClose={() => { setManageSection(null); setExpandedDocSvcId(null); setDocSearch(''); }}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { flex: 1, marginTop: 60 }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>📋 {t('requiredDocs')}</Text>
                <Text style={s.modalSubtitle}>
                  {docSearch.trim()
                    ? `${services.filter(sv => sv.name.toLowerCase().includes(docSearch.toLowerCase())).length} of ${services.length} services`
                    : `${services.length} services`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setManageSection(null); setExpandedDocSvcId(null); setDocSearch(''); }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.mgmtSearchRow}>
              <TextInput
                style={s.mgmtSearchInput}
                value={docSearch}
                onChangeText={setDocSearch}
                placeholder={t('searchService')}
                placeholderTextColor={theme.color.textMuted}
                clearButtonMode="while-editing"
                autoCorrect={false}
              />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing.space3 }} keyboardShouldPersistTaps="handled">
              {services.length === 0 && <Text style={s.mgmtEmpty}>{t('noServices')}</Text>}
              {docSearch.trim() && services.filter(sv => sv.name.toLowerCase().includes(docSearch.toLowerCase())).length === 0 && (
                <Text style={s.mgmtEmpty}>{t('noServicesMatch')}: "{docSearch}"</Text>
              )}
              {services.filter(sv => !docSearch.trim() || sv.name.toLowerCase().includes(docSearch.toLowerCase())).map((svc) => {
                const docs = serviceDocs[svc.id] ?? [];
                const checkedCount = docs.filter(d => d.is_checked).length;
                const isExpanded = expandedDocSvcId === svc.id;
                return (
                  <View key={svc.id} style={s.docSvcCard}>
                    {/* Service header row */}
                    <TouchableOpacity style={s.docSvcRow} onPress={() => handleToggleDocExpand(svc.id)} activeOpacity={0.7}>
                      <Text style={s.docSvcName}>{svc.name}</Text>
                      {docs.length > 0 && (
                        <Text style={s.docSvcBadge}>{checkedCount}/{docs.length} ✓</Text>
                      )}
                      <Text style={s.docSvcArrow}>{isExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {/* Expanded document list */}
                    {isExpanded && (
                      <View style={s.docListPanel}>
                        {docs.length === 0 && <Text style={s.docEmpty}>No documents added yet</Text>}
                        {docs.map((doc, idx) => {
                          const subreqs = docReqs[doc.id] ?? [];
                          const isReqOpen = expandedDocReqId === doc.id;
                          return (
                            <View key={doc.id}>
                              {/* ── Main document row ── */}
                              <View style={s.docRow}>
                                <Text style={s.docNumber}>{idx + 1}.</Text>
                                <TouchableOpacity onPress={() => handleToggleDocCheck(doc)} activeOpacity={0.7}>
                                  <Text style={[s.docCheck, doc.is_checked && s.docCheckDone]}>
                                    {doc.is_checked ? '☑' : '☐'}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flex: 1 }} onPress={() => handleToggleDocCheck(doc)} activeOpacity={0.7}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={[s.docTitle, doc.is_checked && s.docTitleDone]} numberOfLines={2}>
                                      {doc.title}
                                    </Text>
                                    {subreqs.length > 0 && (
                                      <View style={s.docReqBadge}>
                                        <Text style={s.docReqBadgeText}>{subreqs.length}</Text>
                                      </View>
                                    )}
                                  </View>
                                </TouchableOpacity>
                                {/* Expand toggle for sub-requirements */}
                                <TouchableOpacity
                                  onPress={() => handleToggleDocReqExpand(doc.id)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={{ paddingHorizontal: 4 }}
                                >
                                  <Text style={{ color: theme.color.textMuted, fontSize: 11 }}>
                                    {isReqOpen ? '▼' : '▶'}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteDoc(doc)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <Text style={s.docDelete}>✕</Text>
                                </TouchableOpacity>
                              </View>
                              {/* ── Sub-requirements panel ── */}
                              {isReqOpen && (
                                <View style={s.docReqPanel}>
                                  {loadingDocReqs === doc.id ? (
                                    <ActivityIndicator color={theme.color.primary} style={{ margin: 8 }} />
                                  ) : (
                                    <>
                                      {subreqs.length === 0 && (
                                        <Text style={s.docReqEmpty}>No sub-requirements yet. Add below.</Text>
                                      )}
                                      {subreqs.map(req => (
                                        <View key={req.id} style={s.docSubReqRow}>
                                          <Text style={s.docSubReqBullet}>•</Text>
                                          <Text style={s.docSubReqTitle}>{req.title}</Text>
                                          <TouchableOpacity
                                            onPress={() => handleDeleteDocReq(doc.id, req.id)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                          >
                                            <Text style={s.docDelete}>✕</Text>
                                          </TouchableOpacity>
                                        </View>
                                      ))}
                                      {/* Add sub-req input */}
                                      <View style={s.docAddRow}>
                                        <TextInput
                                          style={s.docAddInput}
                                          value={isReqOpen ? docReqNewTitle : ''}
                                          onChangeText={setDocReqNewTitle}
                                          placeholder={t('addRequirement')}
                                          placeholderTextColor={theme.color.textMuted}
                                          returnKeyType="done"
                                          onSubmitEditing={() => handleAddDocReq(doc.id)}
                                        />
                                        <TouchableOpacity
                                          style={[s.docAddBtn, (!docReqNewTitle.trim() || savingDocReq) && { opacity: 0.5 }]}
                                          onPress={() => handleAddDocReq(doc.id)}
                                          disabled={savingDocReq || !docReqNewTitle.trim()}
                                        >
                                          {savingDocReq
                                            ? <ActivityIndicator size="small" color={theme.color.white} />
                                            : <Text style={s.docAddBtnText}>＋</Text>}
                                        </TouchableOpacity>
                                      </View>
                                    </>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                        {/* Add document inline */}
                        <View style={s.docAddRow}>
                          <TextInput
                            style={s.docAddInput}
                            value={expandedDocSvcId === svc.id ? newDocTitle : ''}
                            onChangeText={setNewDocTitle}
                            placeholder={t('addDocument')}
                            placeholderTextColor={theme.color.textMuted}
                          />
                          <TouchableOpacity style={s.docAddBtn} onPress={() => handleAddDoc(svc.id)} disabled={savingDoc || !newDocTitle.trim()}>
                            {savingDoc ? <ActivityIndicator size="small" color={theme.color.white} /> : <Text style={s.docAddBtnText}>＋</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.docImportToggleBtn}
                            onPress={() => {
                              if (docImportSvcId === svc.id) {
                                setDocImportSvcId(null); setDocImportRaw(''); setDocImportTitles([]);
                              } else {
                                setDocImportSvcId(svc.id); setDocImportRaw(''); setDocImportTitles([]);
                              }
                            }}
                          >
                            <Text style={s.docImportToggleBtnText}>📥</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.docImportToggleBtn, { backgroundColor: '#25D366' }]}
                            onPress={() => handleShareServiceDocsWhatsApp(svc.name, docs)}
                            disabled={docs.length === 0}
                          >
                            <Text style={s.docImportToggleBtnText}>💬</Text>
                          </TouchableOpacity>
                        </View>
                        {/* Excel import panel */}
                        {docImportSvcId === svc.id && (
                          <View style={s.docImportPanel}>
                            <Text style={s.docImportLabel}>{t('importBtn')} ({t('documentName')})</Text>
                            <TextInput
                              style={s.docImportTextArea}
                              value={docImportRaw}
                              onChangeText={(t) => { setDocImportRaw(t); setDocImportTitles([]); }}
                              placeholder={t('paste')}
                              placeholderTextColor={theme.color.textMuted}
                              multiline
                              textAlignVertical="top"
                            />
                            {docImportTitles.length === 0 ? (
                              <TouchableOpacity
                                style={s.docImportPreviewBtn}
                                onPress={() => setDocImportTitles(parseDocImport(docImportRaw))}
                                disabled={!docImportRaw.trim()}
                              >
                                <Text style={s.docImportPreviewBtnText}>{t('preview')}</Text>
                              </TouchableOpacity>
                            ) : (
                              <>
                                {docImportTitles.map((t, i) => (
                                  <View key={i} style={s.docImportPreviewRow}>
                                    <Text style={s.docCheck}>☐</Text>
                                    <Text style={s.docImportPreviewTitle} numberOfLines={1}>{t}</Text>
                                  </View>
                                ))}
                                <TouchableOpacity
                                  style={s.docImportConfirmBtn}
                                  onPress={handleImportDocs}
                                  disabled={importingDocs}
                                >
                                  {importingDocs
                                    ? <ActivityIndicator size="small" color={theme.color.white} />
                                    : <Text style={s.docImportConfirmBtnText}>Import {docImportTitles.length} document{docImportTitles.length !== 1 ? 's' : ''}</Text>}
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        )}
                        {/* Reset checks */}
                        {checkedCount > 0 && (
                          <TouchableOpacity style={s.docResetBtn} onPress={() => handleResetChecks(svc.id)}>
                            <Text style={s.docResetBtnText}>↺ Reset all checks</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Per-stage ministry contacts sheet (👥 button on each stage row) */}
      <MinistryContactsSheet
        visible={!!contactsMinistryId}
        ministryId={contactsMinistryId}
        ministryName={ministries.find(m => m.id === contactsMinistryId)?.name ?? ''}
        onClose={() => setContactsMinistryId(null)}
      />

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: theme.color.bgBase },
  scroll: { paddingBottom: theme.spacing.space10 },

  header: {
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space5,
    paddingBottom:     theme.spacing.space3,
  },
  headerTitle: {
    ...theme.typography.heading,
    fontSize: 22,
  },

  sectionLabel: {
    ...theme.typography.sectionDivider,
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space3,
    paddingBottom:     theme.spacing.space2,
  },

  // Quick action grid
  actionGrid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    paddingHorizontal: theme.spacing.space3,
    gap:               theme.spacing.space3,
  },
  actionCard: {
    width:             '47%',
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.lg,
    borderWidth:       1,
    borderColor:       theme.color.border,
    paddingVertical:   theme.spacing.space5,
    paddingHorizontal: theme.spacing.space3,
    alignItems:        'center',
    gap:               theme.spacing.space2,
  },
  actionCardAccent: {
    borderColor:     theme.color.primary + '66',
    backgroundColor: theme.color.primaryDim,
  },
  actionIcon:       { fontSize: 28 },
  actionLabel:      { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '700', textAlign: 'center' },
  actionLabelAccent:{ color: theme.color.primaryText },

  // Manage rows
  manageList: {
    marginHorizontal: theme.spacing.space4,
    backgroundColor:  theme.color.bgSurface,
    borderRadius:     theme.radius.lg,
    borderWidth:      1,
    borderColor:      theme.color.border,
    overflow:         'hidden',
  },
  manageRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3 + 2,
    minHeight:         theme.touchTarget.min,
    gap:               theme.spacing.space3,
  },
  manageRowBorder:  { borderBottomWidth: 1, borderBottomColor: theme.color.border },
  manageRowIcon:    { fontSize: theme.icon.md },
  manageRowLabel:   { flex: 1, ...theme.typography.body, fontWeight: '600' },
  manageRowBadge: {
    backgroundColor:   theme.color.primaryDim,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical:   theme.spacing.space1 - 1,
  },
  manageRowCount:   { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  manageRowArrow:   { ...theme.typography.heading, color: theme.color.textMuted },

  // Modals (shared with DashboardScreen pattern)
  modalOverlay: {
    flex:            1,
    backgroundColor: theme.color.overlayDark,
  },
  modalSheet: {
    backgroundColor:      theme.color.bgSurface,
    borderTopLeftRadius:  theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth:          1,
    borderColor:          theme.color.border,
  },
  modalHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space5,
    paddingBottom:     theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  modalTitle:    { ...theme.typography.heading },
  modalSubtitle: { ...theme.typography.caption, marginTop: theme.spacing.space1 - 2 },
  modalClose: {
    ...theme.typography.heading,
    color:             theme.color.textMuted,
    paddingHorizontal: theme.spacing.space1,
    minWidth:          theme.touchTarget.min,
    minHeight:         theme.touchTarget.min,
    textAlign:         'center',
    textAlignVertical: 'center',
  },
  modalAddBtn: {
    backgroundColor:   theme.color.primaryDim,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2 - 1,
    borderWidth:       1,
    borderColor:       theme.color.primary + '44',
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  modalAddBtnText: { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  modalImportBtn: {
    backgroundColor:   theme.color.infoDim,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space1 + 2,
    borderWidth:       1,
    borderColor:       theme.color.info + '55',
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  modalImportBtnText: { ...theme.typography.label, color: theme.color.info, fontWeight: '700' },
  // Import view
  importInstructions: {
    backgroundColor: theme.color.infoDim,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space4,
    borderWidth:     1,
    borderColor:     theme.color.info + '44',
    gap:             theme.spacing.space2,
  },
  importInstructionsTitle: { fontSize: 16, color: theme.color.info, fontWeight: '700' },
  importInstructionsText:  { fontSize: 14, color: theme.color.textSecondary, lineHeight: 22 },
  importTextArea: {
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    padding:           theme.spacing.space4,
    minHeight:         160,
    color:             theme.color.textPrimary,
    fontSize:          15,
    lineHeight:        22,
    borderWidth:       1,
    borderColor:       theme.color.border,
    textAlignVertical: 'top',
  },
  importPreviewBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space4,
    alignItems:      'center',
  },
  importPreviewBtnText: { fontSize: 16, color: theme.color.white, fontWeight: '700' },
  importPreviewLabel:   { fontSize: 13, color: theme.color.textMuted, fontWeight: '700', letterSpacing: 0.8, marginTop: theme.spacing.space3 },
  importPreviewRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               theme.spacing.space3,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  importRowNum: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: theme.color.bgSubtle,
    alignItems:      'center',
    justifyContent:  'center',
  },
  importRowNumText: { fontSize: 13, color: theme.color.textMuted, fontWeight: '700' },
  importRowName:    { fontSize: 16, color: theme.color.textPrimary, fontWeight: '700' },
  importRowSub:     { fontSize: 14, color: theme.color.textMuted, marginTop: 2 },
  modalBody: {
    padding: theme.spacing.space4,
    gap:     theme.spacing.space3,
  },
  modalInput: {
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    color:             theme.color.textPrimary,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  modalSaveBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3 + 1,
    alignItems:      'center',
    marginTop:       theme.spacing.space1,
  },
  modalSaveBtnDisabled: { opacity: 0.5 },
  modalSaveBtnText: {
    ...theme.typography.body,
    color:      theme.color.white,
    fontWeight: '700',
  },

  // Client form fields
  fieldsSectionLabel: {
    ...theme.typography.sectionDivider,
    marginTop:    theme.spacing.space2,
    marginBottom: theme.spacing.space3,
  },
  fieldDefLabel:  { ...theme.typography.label, color: theme.color.textSecondary, marginBottom: theme.spacing.space1 + 2 },
  fieldBoolRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  fieldBoolText: { ...theme.typography.body, fontWeight: '600' },
  selectOption: {
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2,
    marginEnd:         theme.spacing.space2,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  selectOptionActive:     { borderColor: theme.color.primary, backgroundColor: theme.color.primaryDim },
  selectOptionText:       { ...theme.typography.label, color: theme.color.textMuted },
  selectOptionTextActive: { color: theme.color.primaryText },
  dateBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    borderWidth:       1,
    borderColor:       theme.color.border,
    minHeight:         theme.touchTarget.min,
  },
  dateBtnText:        { ...theme.typography.body, flex: 1 },
  dateBtnPlaceholder: { ...theme.typography.body, color: theme.color.textMuted, flex: 1 },
  dateBtnIcon:        { fontSize: theme.icon.md },
  inlineCalendarContainer: {
    marginTop:       theme.spacing.space1 + 2,
    borderRadius:    theme.radius.lg,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     theme.color.border,
    backgroundColor: theme.color.bgBase,
  },
  clearDateBtn: {
    margin:          theme.spacing.space3,
    backgroundColor: theme.color.border,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
  },
  clearDateBtnText: { ...theme.typography.body, fontWeight: '600' },

  // Month/year picker
  monthYearPicker: {
    padding:          theme.spacing.space3,
    backgroundColor:  theme.color.bgBase,
  },
  monthYearPickerHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   theme.spacing.space3,
  },
  monthYearPickerYearInput: {
    ...theme.typography.heading,
    color:             theme.color.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: theme.color.primary,
    minWidth:          64,
    textAlign:         'center',
    paddingVertical:   theme.spacing.space1,
  },
  monthYearArrow:     { padding: theme.spacing.space2 },
  monthYearArrowText: { fontSize: 24, color: theme.color.primary, fontWeight: '700', lineHeight: 28 },
  monthGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.space2 },
  monthGridItem: {
    width:           '22%',
    paddingVertical: theme.spacing.space2,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.bgSurface,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  monthGridItemText: { ...theme.typography.label, color: theme.color.textPrimary },
  calHeaderBtn: {
    paddingVertical:   theme.spacing.space2,
    paddingHorizontal: theme.spacing.space3,
    alignSelf:         'center',
  },
  calHeaderText: { ...theme.typography.body, fontWeight: '700', color: theme.color.textPrimary },

  // Manage shared
  mgmtAddSectionLabel: { ...theme.typography.sectionDivider, marginBottom: theme.spacing.space2 + 2 },
  mgmtAddBlock: {
    padding:       theme.spacing.space3 + 2,
    paddingBottom: theme.spacing.space2,
    gap:           theme.spacing.space2,
  },
  mgmtPriceRow:   { flexDirection: 'row', gap: theme.spacing.space2 },
  mgmtAddBtn: {
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 3,
    justifyContent:    'center',
    alignItems:        'center',
    minHeight:         theme.touchTarget.min,
  },
  mgmtAddBtnText:  { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  mgmtSearchRow: {
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        theme.spacing.space2 + 2,
    paddingBottom:     theme.spacing.space1 + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  mgmtSearchInput: {
    backgroundColor:   theme.color.bgBase,
    color:             theme.color.textPrimary,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space2 + 1,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  mgmtClientRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3 + 1,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
    gap:               theme.spacing.space3,
    minHeight:         theme.touchTarget.min,
  },
  mgmtClientAvatar: {
    width:           38,
    height:          38,
    borderRadius:    theme.radius.full,
    backgroundColor: theme.color.primaryDim,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    justifyContent:  'center',
    alignItems:      'center',
  },
  mgmtClientAvatarText: { ...theme.typography.body, color: theme.color.primaryText, fontWeight: '800' },
  mgmtEmpty: { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', padding: theme.spacing.space8 },
  mgmtItemRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
    gap:               theme.spacing.space2,
    minHeight:         theme.touchTarget.min,
  },
  mgmtItemName:  { ...theme.typography.body, fontWeight: '600' },
  mgmtItemRef:   { ...theme.typography.caption, fontStyle: 'italic', marginTop: theme.spacing.space1 - 3 },
  stageCityChip: {
    marginTop:       4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius:    theme.radius.sm,
    backgroundColor: theme.color.bgBase,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  stageCityChipText: { ...theme.typography.caption, color: theme.color.textMuted, fontSize: 12 },
  stageCityPanel: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    marginTop:       4,
    marginBottom:    4,
  },
  stageCityItem: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  stageCityItemActive: { backgroundColor: theme.color.primary + '14' },
  stageCityItemText:   { ...theme.typography.body, color: theme.color.textPrimary, flex: 1, flexWrap: 'wrap' },
  mgmtItemSub:   { ...theme.typography.caption, marginTop: theme.spacing.space1 - 2 },
  mgmtItemPrice: { ...theme.typography.caption, color: theme.color.primary, fontWeight: '600', marginTop: theme.spacing.space1 - 2 },
  mgmtEditBtn: {
    backgroundColor:   theme.color.border,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    minWidth:          theme.touchTarget.min,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
    alignItems:        'center',
  },
  mgmtEditBtnText: { ...theme.typography.body, color: theme.color.textSecondary },
  mgmtDelBtn: {
    backgroundColor:   theme.color.dangerDim,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    minWidth:          theme.touchTarget.min,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
    alignItems:        'center',
  },
  mgmtDelBtnText: { ...theme.typography.caption, color: theme.color.danger + 'a5' },
  mgmtEditRow: {
    flexDirection:   'row',
    gap:             theme.spacing.space2,
    padding:         theme.spacing.space3 + 2,
    paddingVertical: theme.spacing.space2 + 2,
    backgroundColor: theme.color.bgBase,
    alignItems:      'center',
  },
  mgmtSaveBtn: {
    backgroundColor:   theme.color.success,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    alignItems:        'center',
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  mgmtSaveBtnText:   { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  mgmtCancelBtn: {
    backgroundColor:   theme.color.border,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space2,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  mgmtCancelBtnText: { ...theme.typography.label, color: theme.color.textSecondary },
  mgmtReqBtn: {
    backgroundColor:   theme.color.successDim,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    borderWidth:       1,
    borderColor:       theme.color.success + '44',
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
  },
  mgmtReqBtnText: { ...theme.typography.caption, color: theme.color.success, fontWeight: '700' },

  // Inline panels (service stages + stage requirements)
  inlinePanel: {
    backgroundColor:   theme.color.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingBottom:     theme.spacing.space2,
  },
  inlinePanelLabel: {
    ...theme.typography.sectionDivider,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingTop:        theme.spacing.space2 + 2,
    paddingBottom:     theme.spacing.space1 + 2,
  },
  inlinePanelEmpty: { ...theme.typography.caption, color: theme.color.textMuted, paddingHorizontal: theme.spacing.space3 + 2, paddingVertical: theme.spacing.space2 },
  inlineStageRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    gap:               theme.spacing.space2,
  },
  inlineStageOrder: { ...theme.typography.caption, color: theme.color.textMuted, minWidth: 18 },
  inlineStageName:  { ...theme.typography.body, fontSize: 13, flex: 1 },
  inlineStageBtn: {
    backgroundColor:   theme.color.border,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical:   theme.spacing.space1,
    minWidth:          28,
    minHeight:         28,
    justifyContent:    'center',
    alignItems:        'center',
  },
  inlineStageBtnText: { ...theme.typography.label, color: theme.color.textSecondary },
  inlineAddRow: {
    flexDirection:     'row',
    gap:               theme.spacing.space2,
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingTop:        theme.spacing.space2,
    paddingBottom:     theme.spacing.space1,
  },
  inlineAddBtn: {
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.space3,
    minWidth:          40,
    minHeight:         theme.touchTarget.min,
    justifyContent:    'center',
    alignItems:        'center',
  },
  inlineAddBtnText: { ...theme.typography.heading, color: theme.color.white, fontSize: 18 },
  inlinePill: {
    backgroundColor:   theme.color.primaryDim,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space1 + 2,
    marginEnd:         theme.spacing.space2,
    borderWidth:       1,
    borderColor:       theme.color.primary + '44',
  },
  inlinePillText: { ...theme.typography.label, color: theme.color.primaryText },
  inlineReqRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space3 + 2,
    paddingVertical:   theme.spacing.space1 + 2,
    gap:               theme.spacing.space2,
  },
  inlineReqTitle: { ...theme.typography.body, fontSize: 13, flex: 1 },

  // ── Network styles ────────────────────────────────────────
  netContactCard: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    gap:             theme.spacing.space3,
  },
  netContactName:    { ...theme.typography.body, fontWeight: '700', marginBottom: 2 },
  netContactPhone:   { ...theme.typography.caption, color: theme.color.primary, marginBottom: 1 },
  netContactRef:     { ...theme.typography.caption, color: theme.color.textMuted, fontStyle: 'italic', marginBottom: 1 },
  netContactCity:     { ...theme.typography.caption, color: theme.color.textSecondary },
  netContactFieldVal: { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 1 },
  netContactActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  netActionBtn:      { padding: 6 },
  netActionEdit:     { color: theme.color.primary, fontSize: 16 },
  netActionDelete:   { color: theme.color.textMuted, fontSize: 15 },
  netAddBtn: {
    margin:          theme.spacing.space4,
    paddingVertical: theme.spacing.space3,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.primary + '18',
    borderWidth:     1,
    borderColor:     theme.color.primary + '44',
    alignItems:      'center',
  },
  netAddBtnText: { ...theme.typography.body, color: theme.color.primary, fontWeight: '700' },
  netAddFieldBtn: {
    borderWidth:     1,
    borderColor:     theme.color.border,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
    backgroundColor: theme.color.bgBase,
  },
  netAddFieldBtnText: { ...theme.typography.label, color: theme.color.primary, fontWeight: '700' },
  netFieldPickerItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  netFieldPickerType: { ...theme.typography.caption, color: theme.color.textMuted, fontStyle: 'italic' },
  netForm: {
    borderTopWidth:  1,
    borderTopColor:  theme.color.border,
    padding:         theme.spacing.space4,
    gap:             10,
    backgroundColor: theme.color.bgBase,
  },
  netFormTitle:  { ...theme.typography.label, fontWeight: '700', color: theme.color.textSecondary },
  netInput: {
    backgroundColor:  theme.color.bgSurface,
    borderRadius:     theme.radius.md,
    borderWidth:      1,
    borderColor:      theme.color.border,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:  10,
    ...theme.typography.body,
    color:            theme.color.textPrimary,
  },
  netCityTrigger: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
  },
  netCityTriggerText: { ...theme.typography.body, color: theme.color.textMuted, flex: 1 },
  netCityDropdown: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    overflow:        'hidden',
  },
  netCitySearch: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   8,
    ...theme.typography.body,
    color:             theme.color.textPrimary,
  },
  netCityItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  netCityItemActive: { backgroundColor: theme.color.primary + '11' },
  netCityItemText:   { ...theme.typography.body, color: theme.color.textPrimary, flex: 1 },
  netFormActions:  { flexDirection: 'row', gap: 10 },
  netCancelBtn: {
    flex:            0,
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.bgSurface,
    borderWidth:     1,
    borderColor:     theme.color.border,
    alignItems:      'center',
  },
  netCancelBtnText: { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  netSaveBtn: {
    flex:            1,
    paddingVertical: theme.spacing.space3,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.primary,
    alignItems:      'center',
  },
  netSaveBtnText: { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },

  // ── Service Documents styles ──────────────────────────────
  docSvcCard: {
    marginHorizontal: theme.spacing.space3,
    marginBottom:     theme.spacing.space3,
    backgroundColor:  theme.color.bgSurface,
    borderRadius:     theme.radius.lg,
    borderWidth:      1,
    borderColor:      theme.color.border,
    overflow:         'hidden',
  },
  docSvcRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3 + 2,
    gap:             theme.spacing.space2,
  },
  docSvcName:  { flex: 1, ...theme.typography.body, fontWeight: '700' },
  docSvcBadge: { ...theme.typography.caption, color: theme.color.success, fontWeight: '700' },
  docSvcArrow: { ...theme.typography.caption, color: theme.color.textMuted },
  docListPanel: {
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingBottom:  theme.spacing.space2,
  },
  docEmpty: { ...theme.typography.caption, color: theme.color.textMuted, padding: theme.spacing.space3, paddingBottom: theme.spacing.space1 },
  docRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    gap:             theme.spacing.space2,
  },
  docNumber:      { ...theme.typography.caption, color: theme.color.textMuted, minWidth: 20 },
  docCheck:       { fontSize: 18, color: theme.color.textMuted },
  docCheckDone:   { color: theme.color.success },
  docTitle:       { flex: 1, ...theme.typography.body },
  docTitleDone:   { textDecorationLine: 'line-through', color: theme.color.textMuted },
  docDelete:      { color: theme.color.textMuted, fontSize: 14, padding: 4 },
  docAddRow: {
    flexDirection:   'row',
    alignItems:      'center',
    marginHorizontal: theme.spacing.space3,
    marginTop:       theme.spacing.space2,
    gap:             8,
  },
  docAddInput: {
    flex:            1,
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   8,
    ...theme.typography.body,
    color:           theme.color.textPrimary,
  },
  docAddBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   8,
    alignItems:      'center',
  },
  docAddBtnText:  { color: theme.color.white, fontWeight: '700', fontSize: 16 },

  // Sub-requirement styles
  docReqBadge: {
    backgroundColor: theme.color.primary + '33',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  docReqBadgeText: {
    color: theme.color.primaryText,
    fontSize: 10,
    fontWeight: '700',
  },
  docReqPanel: {
    backgroundColor: theme.color.bgBase,
    marginHorizontal: theme.spacing.space2,
    marginBottom: theme.spacing.space2,
    borderRadius: theme.radius.md,
    padding: theme.spacing.space2,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  docSubReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  docSubReqBullet: {
    color: theme.color.primary,
    fontSize: 16,
    lineHeight: 20,
  },
  docSubReqTitle: {
    flex: 1,
    color: theme.color.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  docReqEmpty: {
    color: theme.color.textMuted,
    fontSize: 12,
    padding: theme.spacing.space2,
    textAlign: 'center',
  },

  docResetBtn: {
    marginHorizontal: theme.spacing.space3,
    marginTop:        theme.spacing.space2,
    paddingVertical:  8,
    alignItems:       'center',
    borderRadius:     theme.radius.md,
    borderWidth:      1,
    borderColor:      theme.color.border,
  },
  docResetBtnText: { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '600' },

  // Document Excel import
  docImportToggleBtn: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.border,
    paddingHorizontal: 10,
    paddingVertical:   8,
    alignItems:      'center',
    justifyContent:  'center',
  },
  docImportToggleBtnText: { fontSize: 16 },
  docImportPanel: {
    marginHorizontal: theme.spacing.space3,
    marginTop:        theme.spacing.space2,
    backgroundColor:  theme.color.bgBase,
    borderRadius:     theme.radius.md,
    borderWidth:      1,
    borderColor:      theme.color.border,
    padding:          theme.spacing.space3,
    gap:              8,
  },
  docImportLabel: { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '700', marginBottom: 4 },
  docImportTextArea: {
    backgroundColor:  theme.color.bgSurface,
    borderRadius:     theme.radius.sm,
    borderWidth:      1,
    borderColor:      theme.color.border,
    padding:          10,
    minHeight:        80,
    color:            theme.color.textPrimary,
    ...theme.typography.body,
    textAlignVertical: 'top',
  },
  docImportPreviewBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: 8,
    alignItems:      'center',
  },
  docImportPreviewBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },
  docImportPreviewRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgSurface,
  },
  docImportPreviewTitle: { ...theme.typography.body, color: theme.color.textPrimary, flex: 1 },
  docImportConfirmBtn: {
    backgroundColor: theme.color.success,
    borderRadius:    theme.radius.md,
    paddingVertical: 8,
    alignItems:      'center',
    marginTop:       4,
  },
  docImportConfirmBtnText: { color: theme.color.white, fontWeight: '700', fontSize: 13 },

  // ID / QR scanner button (in New Client modal header)
  scanIdBtn: {
    backgroundColor: theme.color.primary + '22',
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.primary + '66',
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  scanIdBtnText: { color: theme.color.primary, fontWeight: '700', fontSize: 12 },
});
