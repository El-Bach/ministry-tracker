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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';

import { CameraView, useCameraPermissions } from 'expo-camera';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { Client, Service, Ministry, ServiceDocument } from '../types';

type ManageSection = 'clients' | 'services' | 'stages' | 'network' | 'documents' | null;

function openPhone(phone: string, name?: string) {
  const clean = phone.replace(/[^0-9+]/g, '');
  Alert.alert(name ?? phone, phone, [
    { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
    { text: '💬 WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function CreateScreen() {
  const navigation = useNavigation<any>();

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
  const [newClientRefName, setNewClientRefName] = useState('');
  const [newClientRefPhone, setNewClientRefPhone] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [clientFormFieldDefs, setClientFormFieldDefs] = useState<any[]>([]);
  const [clientFormFieldValues, setClientFormFieldValues] = useState<Record<string, string>>({});
  const [loadingClientFields, setLoadingClientFields] = useState(false);

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
    const [c, s, m, net, cities, fieldDefs] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('ministries').select('*').eq('type', 'parent').order('name'),
      supabase.from('assignees').select('*, city:cities(id,name)').order('name'),
      supabase.from('cities').select('*').order('name'),
      supabase.from('client_field_definitions').select('*').eq('is_active', true).order('sort_order'),
    ]);
    if (c.data) setClients(c.data as Client[]);
    if (s.data) setServices(s.data as Service[]);
    if (m.data) setMinistries(m.data as Ministry[]);
    if (net.data) setNetwork(net.data as any[]);
    if (cities.data) setAllCities(cities.data as any[]);
    if (fieldDefs.data) setNetFieldDefs(fieldDefs.data as any[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

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
    if (!newClientName.trim()) { Alert.alert('Required', 'Client name is required.'); return; }
    setSavingClient(true);
    const autoId = `CLT-${Date.now()}`;
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: newClientName.trim(), client_id: autoId, phone: newClientPhone.trim() || null, reference_name: newClientRefName.trim() || null, reference_phone: newClientRefPhone.trim() || null })
      .select()
      .single();
    if (error || !data) { setSavingClient(false); Alert.alert('Error', error?.message ?? 'Failed'); return; }
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
    setNewClientName(''); setNewClientPhone('');
    setNewClientRefName(''); setNewClientRefPhone('');
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
      Alert.alert('Delete Client', `Delete "${c.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleCreateService = async () => {
    if (!newSvcName.trim()) { Alert.alert('Required', 'Service name is required.'); return; }
    setSavingNewSvc(true);
    await supabase.from('services').insert({ name: newSvcName.trim(), estimated_duration_days: 0, base_price_usd: parseFloat(newSvcPriceUSD) || 0, base_price_lbp: parseFloat(newSvcPriceLBP.replace(/,/g, '')) || 0 });
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
      Alert.alert('Delete Service', `Delete "${sv.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleCreateStage = async () => {
    if (!newStageName.trim()) { Alert.alert('Required', 'Stage name is required.'); return; }
    setSavingNewStage(true);
    await supabase.from('ministries').insert({ name: newStageName.trim(), type: 'parent' });
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
      Alert.alert('Delete Stage', `Delete "${m.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
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
    // Check if ministry with this name already exists
    const existing = ministries.find((m) => m.name.toLowerCase() === name.toLowerCase());
    let ministryId: string;
    if (existing) {
      ministryId = existing.id;
    } else {
      const { data: mData } = await supabase.from('ministries').insert({ name, type: 'parent' }).select().single();
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
    if (!netName.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    setSavingNetwork(true);
    const payload = {
      name: netName.trim(),
      phone: netPhone.trim() || null,
      reference: netReference.trim() || null,
      reference_phone: netRefPhone.trim() || null,
      city_id: netCityId ?? null,
    };
    let assigneeId: string;
    if (editNetworkId) {
      await supabase.from('assignees').update(payload).eq('id', editNetworkId);
      assigneeId = editNetworkId;
    } else {
      const { data: newContact, error } = await supabase.from('assignees').insert(payload).select().single();
      if (error || !newContact) { setSavingNetwork(false); Alert.alert('Error', error?.message ?? 'Failed to save'); return; }
      assigneeId = (newContact as any).id;
    }
    setSavingNetwork(false);
    setShowNetworkForm(false);
    setEditNetworkId(null);
    const { data } = await supabase.from('assignees').select('*, city:cities(id,name)').order('name');
    if (data) setNetwork(data);
  };

  const handleDeleteNetworkContact = (contact: any) => {
    Alert.alert('Delete Contact', `Delete "${contact.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
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
    }));
    const { error } = await supabase.from('assignees').insert(inserts);
    setImportingContacts(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowImportModal(false);
    setImportRaw('');
    setImportRows([]);
    const { data } = await supabase.from('assignees').select('*, city:cities(id,name)').order('name');
    if (data) setNetwork(data as any[]);
    Alert.alert('Imported ✓', `${inserts.length} contact${inserts.length !== 1 ? 's' : ''} added to Network.`);
  };

  // ── Service document handlers ─────────────────────────────
  const fetchServiceDocs = async (serviceId: string) => {
    const { data } = await supabase.from('service_documents').select('*').eq('service_id', serviceId).order('sort_order');
    setServiceDocs(prev => ({ ...prev, [serviceId]: (data ?? []) as ServiceDocument[] }));
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
      .insert({ service_id: serviceId, title, sort_order: maxOrder + 1 })
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

  const parseDocImport = (raw: string): string[] =>
    raw.split(/\r?\n/).map(l => l.split('\t')[0].trim()).filter(Boolean);

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
    }));
    const { data, error } = await supabase.from('service_documents').insert(inserts).select();
    setImportingDocs(false);
    if (error) { Alert.alert('Error', error.message); return; }
    if (data) setServiceDocs(prev => ({ ...prev, [docImportSvcId]: [...(prev[docImportSvcId] ?? []), ...(data as ServiceDocument[])] }));
    setDocImportSvcId(null);
    setDocImportRaw('');
    setDocImportTitles([]);
    Alert.alert('Imported', `${inserts.length} documents added.`);
  };

  // ── UI ────────────────────────────────────────────────────
  const quickActions = [
    {
      icon: '📄',
      label: '+ New File',
      color: theme.color.primary,
      onPress: () => (navigation as any).navigate('Dashboard', { screen: 'NewTask' }),
    },
    {
      icon: '👤',
      label: '+ New Client',
      color: '#10b981',
      onPress: () => openNewClientForm(),
    },
    {
      icon: '⚙',
      label: '+ New Service',
      color: '#f59e0b',
      onPress: () => { setClientSearch(''); setServiceSearch(''); setStageSearch(''); setManageSection('services'); },
    },
    {
      icon: '◎',
      label: '+ New Stage',
      color: '#8b5cf6',
      onPress: () => { setClientSearch(''); setServiceSearch(''); setStageSearch(''); setManageSection('stages'); },
    },
    {
      icon: '👥',
      label: 'Network',
      color: '#06b6d4',
      onPress: () => { setNetworkSearch(''); setShowNetworkForm(false); setShowImportModal(false); setManageSection('network'); },
    },
    {
      icon: '📋',
      label: 'Documents',
      color: '#a855f7',
      onPress: () => { setExpandedDocSvcId(null); setDocSearch(''); setManageSection('documents'); },
    },
  ];

  const manageRows = [
    { key: 'clients' as ManageSection, icon: '👤', label: 'Clients', count: clients.length },
    { key: 'services' as ManageSection, icon: '⚙', label: 'Services', count: services.length },
    { key: 'stages' as ManageSection, icon: '◎', label: 'Stages', count: ministries.length },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Create</Text>
        </View>

        {/* QUICK ACTIONS */}
        <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
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
        <Text style={[s.sectionLabel, { marginTop: theme.spacing.space4 }]}>MANAGE</Text>
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
                <Text style={s.manageRowCount}>{row.count}</Text>
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
        animationType="slide"
        onRequestClose={() => { setManageSection(null); setClientSearch(''); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.modalSheet, { maxHeight: '82%' }]}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>Clients</Text>
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
                    <Text style={s.modalAddBtnText}>+ New</Text>
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
                  placeholder="Search clients..."
                  placeholderTextColor={theme.color.textMuted}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                {clients.length === 0 ? (
                  <Text style={s.mgmtEmpty}>No clients yet.</Text>
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
                          <Text style={[s.mgmtItemSub, { color: theme.color.primary }]}>📞 {c.phone}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={s.mgmtEditBtn}
                      onPress={() => { setManageSection(null); (navigation as any).navigate('Dashboard', { screen: 'EditClient', params: { clientId: c.id } }); }}
                    >
                      <Text style={s.mgmtEditBtnText}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.mgmtDelBtn} onPress={() => handleDeleteClient(c)}>
                      <Text style={s.mgmtDelBtnText}>✕</Text>
                    </TouchableOpacity>
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
        animationType="slide"
        onRequestClose={() => setShowClientForm(false)}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.modalSheet, { maxHeight: '92%' }]}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>New Client</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    style={s.scanIdBtn}
                    onPress={async () => {
                      if (!scannerPerm?.granted) {
                        const { granted } = await requestScannerPerm();
                        if (!granted) { Alert.alert('Permission required', 'Camera access is needed to scan ID / QR codes.'); return; }
                      }
                      scannerCooldown.current = false;
                      setShowIdScanner(true);
                    }}
                  >
                    <Text style={s.scanIdBtnText}>📷 Scan ID / QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowClientForm(false)}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
                <TextInput
                  style={s.modalInput}
                  value={newClientName}
                  onChangeText={setNewClientName}
                  placeholder="Full name *"
                  placeholderTextColor={theme.color.textMuted}
                  autoFocus
                />
                <TextInput
                  style={s.modalInput}
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                  placeholder="Phone number"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="phone-pad"
                />
                <Text style={s.fieldsSectionLabel}>REFERENCE (OPTIONAL)</Text>
                <TextInput
                  style={s.modalInput}
                  value={newClientRefName}
                  onChangeText={setNewClientRefName}
                  placeholder="Reference name"
                  placeholderTextColor={theme.color.textMuted}
                />
                <TextInput
                  style={s.modalInput}
                  value={newClientRefPhone}
                  onChangeText={setNewClientRefPhone}
                  placeholder="Reference phone"
                  placeholderTextColor={theme.color.textMuted}
                  keyboardType="phone-pad"
                />
                {loadingClientFields ? (
                  <ActivityIndicator color={theme.color.primary} style={{ marginVertical: 20 }} />
                ) : clientFormFieldDefs.length > 0 ? (
                  <>
                    <Text style={s.fieldsSectionLabel}>ADDITIONAL FIELDS</Text>
                    {clientFormFieldDefs.map((def) => (
                      <View key={def.id} style={{ marginBottom: 12 }}>
                        <Text style={s.fieldDefLabel}>{def.label}{def.is_required ? ' *' : ''}</Text>
                        {def.field_type === 'boolean' ? (
                          <View style={s.fieldBoolRow}>
                            <Text style={s.fieldBoolText}>{clientFormFieldValues[def.id] === 'true' ? 'Yes' : 'No'}</Text>
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
                                    <Text style={s.clearDateBtnText}>Clear Date</Text>
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
                    : <Text style={s.modalSaveBtnText}>Create Client</Text>}
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
        animationType="slide"
        onRequestClose={() => { setManageSection(null); setEditSvcId(null); setServiceSearch(''); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.modalSheet, { maxHeight: '90%' }]}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>Services</Text>
                  <Text style={s.modalSubtitle}>
                    {serviceSearch ? `${services.filter(sv => sv.name.toLowerCase().includes(serviceSearch.toLowerCase())).length} of ${services.length}` : `${services.length} total`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { setManageSection(null); setEditSvcId(null); setServiceSearch(''); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={s.mgmtSearchRow}>
                <TextInput
                  style={s.mgmtSearchInput}
                  value={serviceSearch}
                  onChangeText={setServiceSearch}
                  placeholder="Search services..."
                  placeholderTextColor={theme.color.textMuted}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                <View style={s.mgmtAddBlock}>
                  <Text style={s.mgmtAddSectionLabel}>NEW SERVICE</Text>
                  <TextInput style={s.modalInput} value={newSvcName} onChangeText={setNewSvcName} placeholder="Service name *" placeholderTextColor={theme.color.textMuted} />
                  <View style={s.mgmtPriceRow}>
                    <TextInput style={[s.modalInput, { flex: 1 }]} value={newSvcPriceUSD} onChangeText={setNewSvcPriceUSD} placeholder="Base price USD" placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
                    <TextInput style={[s.modalInput, { flex: 1 }]} value={newSvcPriceLBP} onChangeText={(v) => { const d = v.replace(/,/g, ''); if (d === '' || /^\d*$/.test(d)) setNewSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US')); }} placeholder="Base price LBP" placeholderTextColor={theme.color.textMuted} keyboardType="number-pad" />
                  </View>
                  <TouchableOpacity style={s.mgmtAddBtn} onPress={handleCreateService} disabled={savingNewSvc}>
                    {savingNewSvc ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtAddBtnText}>+ Add Service</Text>}
                  </TouchableOpacity>
                </View>
                {services.filter(sv =>
                  !serviceSearch.trim() ||
                  sv.name.toLowerCase().includes(serviceSearch.toLowerCase())
                ).map((sv) => (
                  <View key={sv.id}>
                    {editSvcId === sv.id ? (
                      <View style={[s.mgmtEditRow, { flexDirection: 'column', gap: 8 }]}>
                        <TextInput style={s.modalInput} value={editSvcName} onChangeText={setEditSvcName} placeholder="Name" placeholderTextColor={theme.color.textMuted} autoFocus />
                        <View style={s.mgmtPriceRow}>
                          <TextInput style={[s.modalInput, { flex: 1 }]} value={editSvcPriceUSD} onChangeText={setEditSvcPriceUSD} placeholder="Price USD" placeholderTextColor={theme.color.textMuted} keyboardType="decimal-pad" />
                          <TextInput style={[s.modalInput, { flex: 1 }]} value={editSvcPriceLBP} onChangeText={(v) => { const d = v.replace(/,/g, ''); if (d === '' || /^\d*$/.test(d)) setEditSvcPriceLBP(d === '' ? '' : parseInt(d, 10).toLocaleString('en-US')); }} placeholder="Price LBP" placeholderTextColor={theme.color.textMuted} keyboardType="number-pad" />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={[s.mgmtSaveBtn, { flex: 1 }]} onPress={handleSaveEditService} disabled={savingEditSvc}>
                            {savingEditSvc ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtSaveBtnText}>Save</Text>}
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
                                  <Text style={s.inlinePanelEmpty}>No stages yet. Add one below.</Text>
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
                                    placeholder="Stage name..."
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
                  <Text style={s.mgmtEmpty}>No services match "{serviceSearch}"</Text>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── MANAGE STAGES MODAL ── */}
      <Modal
        visible={manageSection === 'stages'}
        transparent
        animationType="slide"
        onRequestClose={() => { setManageSection(null); setEditStageId(null); setStageSearch(''); }}
      >
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.modalSheet, { maxHeight: '90%' }]}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>Stages</Text>
                  <Text style={s.modalSubtitle}>
                    {stageSearch ? `${ministries.filter(m => m.name.toLowerCase().includes(stageSearch.toLowerCase())).length} of ${ministries.length}` : `${ministries.length} total`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { setManageSection(null); setEditStageId(null); setStageSearch(''); }}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={s.mgmtSearchRow}>
                <TextInput
                  style={s.mgmtSearchInput}
                  value={stageSearch}
                  onChangeText={setStageSearch}
                  placeholder="Search stages..."
                  placeholderTextColor={theme.color.textMuted}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                <View style={[s.mgmtAddBlock, { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }]}>
                  <Text style={[s.mgmtAddSectionLabel, { position: 'absolute', top: 14, left: 14 }]}>NEW STAGE</Text>
                  <TextInput style={[s.modalInput, { flex: 1, marginTop: 20 }]} value={newStageName} onChangeText={setNewStageName} placeholder="Stage name *" placeholderTextColor={theme.color.textMuted} />
                  <TouchableOpacity style={s.mgmtAddBtn} onPress={handleCreateStage} disabled={savingNewStage}>
                    {savingNewStage ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtAddBtnText}>+ Add</Text>}
                  </TouchableOpacity>
                </View>
                {ministries.filter(m =>
                  !stageSearch.trim() ||
                  m.name.toLowerCase().includes(stageSearch.toLowerCase())
                ).map((m) => (
                  <View key={m.id}>
                    {editStageId === m.id ? (
                      <View style={s.mgmtEditRow}>
                        <TextInput style={[s.modalInput, { flex: 1 }]} value={editStageName} onChangeText={setEditStageName} placeholder="Stage name" placeholderTextColor={theme.color.textMuted} autoFocus />
                        <TouchableOpacity style={s.mgmtSaveBtn} onPress={handleSaveEditStage} disabled={savingEditStage}>
                          {savingEditStage ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.mgmtSaveBtnText}>Save</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={s.mgmtCancelBtn} onPress={() => setEditStageId(null)}>
                          <Text style={s.mgmtCancelBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View>
                        <View style={s.mgmtItemRow}>
                          <Text style={[s.mgmtItemName, { flex: 1 }]}>{m.name}</Text>
                          <TouchableOpacity
                            style={[s.mgmtReqBtn, expandedStageReqId === m.id && { backgroundColor: theme.color.successDim }]}
                            onPress={() => handleToggleStageReqExpand(m.id)}
                          >
                            <Text style={s.mgmtReqBtnText}>{expandedStageReqId === m.id ? '▲ Req' : '📋 Req'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.mgmtEditBtn} onPress={() => { setExpandedStageReqId(null); setEditStageId(m.id); setEditStageName(m.name); }}>
                            <Text style={s.mgmtEditBtnText}>✎</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.mgmtDelBtn} onPress={() => handleDeleteStage(m)}>
                            <Text style={s.mgmtDelBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                        {expandedStageReqId === m.id && (
                          <View style={s.inlinePanel}>
                            {loadingStageReqs === m.id ? (
                              <ActivityIndicator color={theme.color.primary} style={{ margin: 12 }} />
                            ) : (
                              <>
                                <Text style={s.inlinePanelLabel}>REQUIREMENTS</Text>
                                {(stageReqs[m.id] ?? []).length === 0 ? (
                                  <Text style={s.inlinePanelEmpty}>No requirements yet. Add one below.</Text>
                                ) : (
                                  (stageReqs[m.id] ?? []).map((req) => (
                                    <View key={req.id} style={s.inlineReqRow}>
                                      <Text style={s.inlineReqTitle}>{req.title}</Text>
                                      <TouchableOpacity onPress={() => handleDeleteStageReq(m.id, req.id)} style={[s.inlineStageBtn, { backgroundColor: theme.color.dangerDim }]}>
                                        <Text style={[s.inlineStageBtnText, { color: theme.color.danger }]}>✕</Text>
                                      </TouchableOpacity>
                                    </View>
                                  ))
                                )}
                                <View style={s.inlineAddRow}>
                                  <TextInput
                                    style={[s.mgmtSearchInput, { flex: 1 }]}
                                    value={stageReqNewTitle}
                                    onChangeText={setStageReqNewTitle}
                                    placeholder="Requirement title..."
                                    placeholderTextColor={theme.color.textMuted}
                                  />
                                  <TouchableOpacity style={s.inlineAddBtn} onPress={() => handleAddStageReq(m.id)} disabled={savingNewStageReq}>
                                    {savingNewStageReq ? <ActivityIndicator color={theme.color.white} size="small" /> : <Text style={s.inlineAddBtnText}>＋</Text>}
                                  </TouchableOpacity>
                                </View>
                              </>
                            )}
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
                    'Scanned Data',
                    result.data.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, 300),
                    [{ text: 'OK' }]
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

      {/* ── NETWORK MODAL ── */}
      <Modal visible={manageSection === 'network'} transparent animationType="slide" onRequestClose={() => { setManageSection(null); setShowNetworkForm(false); setShowImportModal(false); }}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior="padding">
            <View style={[s.modalSheet, { maxHeight: '92%' }]}>

              {/* ── HEADER — import / list / form ── */}
              {showImportModal ? (
                <View style={s.modalHeader}>
                  <TouchableOpacity onPress={() => setShowImportModal(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: theme.color.primary, fontSize: 18 }}>‹</Text>
                    <Text style={{ ...theme.typography.label, color: theme.color.primary }}>Back</Text>
                  </TouchableOpacity>
                  <Text style={s.modalTitle}>📥 Import</Text>
                  <TouchableOpacity onPress={() => { setManageSection(null); setShowNetworkForm(false); setShowImportModal(false); }}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : !showNetworkForm ? (
                /* ── LIST VIEW header ── */
                <View style={s.modalHeader}>
                  <View>
                    <Text style={s.modalTitle}>👥 Network</Text>
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
                      <Text style={s.modalImportBtnText}>📥 Import</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.modalAddBtn} onPress={() => openNetworkForm()}>
                      <Text style={s.modalAddBtnText}>+ New</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setManageSection(null); setShowNetworkForm(false); }}>
                      <Text style={s.modalClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* ── FORM VIEW header ── */
                <View style={s.modalHeader}>
                  <TouchableOpacity onPress={() => { setShowNetworkForm(false); setEditNetworkId(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: theme.color.primary, fontSize: 18 }}>‹</Text>
                    <Text style={{ ...theme.typography.label, color: theme.color.primary }}>Back</Text>
                  </TouchableOpacity>
                  <Text style={s.modalTitle}>{editNetworkId ? 'Edit Contact' : 'New Contact'}</Text>
                  <TouchableOpacity onPress={() => { setManageSection(null); setShowNetworkForm(false); }}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showImportModal ? (
                /* ── IMPORT VIEW body ── */
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
                  <View style={s.importInstructions}>
                    <Text style={s.importInstructionsTitle}>How to import from Excel:</Text>
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
                      if (!rows.length) { Alert.alert('Nothing found', 'No valid rows detected. Make sure Name is in the first column.'); return; }
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
                            {r.phone ? <Text style={s.importRowSub}>📞 {r.phone}</Text> : null}
                            {r.reference ? <Text style={s.importRowSub}>Ref: {r.reference}</Text> : null}
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
                      placeholder="Search contacts..." placeholderTextColor={theme.color.textMuted}
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
                                <Text style={s.netContactPhone}>📞 {contact.phone}</Text>
                              </TouchableOpacity>
                            ) : null}
                            {contact.reference ? <Text style={s.netContactRef}>عبر {contact.reference}</Text> : null}
                            {contact.reference_phone ? (
                              <TouchableOpacity onPress={() => openPhone(contact.reference_phone, contact.reference || contact.name)}>
                                <Text style={s.netContactPhone}>📞 {contact.reference_phone}</Text>
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
                    placeholder="Full name *" placeholderTextColor={theme.color.textMuted} autoFocus={!editNetworkId} />
                  <TextInput style={s.modalInput} value={netPhone} onChangeText={setNetPhone}
                    placeholder="Phone number" placeholderTextColor={theme.color.textMuted} keyboardType="phone-pad" />
                  <Text style={s.fieldsSectionLabel}>REFERENCE (OPTIONAL)</Text>
                  <TextInput style={s.modalInput} value={netReference} onChangeText={setNetReference}
                    placeholder="Reference name" placeholderTextColor={theme.color.textMuted} />
                  <TextInput style={s.modalInput} value={netRefPhone} onChangeText={setNetRefPhone}
                    placeholder="Reference phone" placeholderTextColor={theme.color.textMuted} keyboardType="phone-pad" />

                  {/* City picker */}
                  <TouchableOpacity style={s.netCityTrigger} onPress={() => { setShowNetCityPicker(v => !v); setShowNetFieldPicker(false); }}>
                    <Text style={[s.netCityTriggerText, netCityId && { color: theme.color.textPrimary }]}>
                      📍 {netCityId ? (allCities.find(c => c.id === netCityId)?.name ?? 'City') : 'Set city (optional)'}
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
                        placeholder="Search cities..." placeholderTextColor={theme.color.textMuted} />
                      <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
                        {allCities
                          .filter(c => !netCitySearch.trim() || c.name.toLowerCase().includes(netCitySearch.toLowerCase()))
                          .map(city => (
                            <TouchableOpacity key={city.id}
                              style={[s.netCityItem, netCityId === city.id && s.netCityItemActive]}
                              onPress={() => { setNetCityId(city.id); setShowNetCityPicker(false); setNetCitySearch(''); }}>
                              <Text style={[s.netCityItemText, netCityId === city.id && { color: theme.color.primary, fontWeight: '700' }]}>{city.name}</Text>
                              {netCityId === city.id && <Text style={{ color: theme.color.primary }}>✓</Text>}
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Additional fields */}
                  {netAddedFieldIds.length > 0 && (
                    <Text style={[s.fieldsSectionLabel, { marginTop: theme.spacing.space2 }]}>ADDITIONAL INFO</Text>
                  )}
                  {netAddedFieldIds.map((fieldId) => {
                    const def = netFieldDefs.find(d => d.id === fieldId);
                    if (!def) return null;
                    return (
                      <View key={fieldId} style={{ marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={s.fieldDefLabel}>{def.label}</Text>
                          <TouchableOpacity
                            onPress={() => setNetAddedFieldIds(ids => ids.filter(id => id !== fieldId))}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={{ color: theme.color.danger, fontSize: 13 }}>✕ Remove</Text>
                          </TouchableOpacity>
                        </View>
                        {def.field_type === 'boolean' ? (
                          <View style={s.fieldBoolRow}>
                            <Text style={s.fieldBoolText}>{netFieldValues[fieldId] === 'true' ? 'Yes' : 'No'}</Text>
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
                        placeholder="Search fields..." placeholderTextColor={theme.color.textMuted} autoFocus />
                      <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                        {netFieldDefs
                          .filter(d => !netAddedFieldIds.includes(d.id) && (!netFieldSearch.trim() || d.label.toLowerCase().includes(netFieldSearch.toLowerCase())))
                          .map(def => (
                            <TouchableOpacity key={def.id} style={s.netFieldPickerItem}
                              onPress={() => { setNetAddedFieldIds(ids => [...ids, def.id]); setShowNetFieldPicker(false); setNetFieldSearch(''); }}>
                              <Text style={s.netCityItemText}>{def.label}</Text>
                              <Text style={s.netFieldPickerType}>{def.field_type}</Text>
                            </TouchableOpacity>
                          ))}
                        {netFieldDefs.filter(d => !netAddedFieldIds.includes(d.id)).length === 0 && (
                          <Text style={{ padding: 12, color: theme.color.textMuted, ...theme.typography.caption }}>All fields already added</Text>
                        )}
                        {netFieldDefs.filter(d => !netAddedFieldIds.includes(d.id) && (!netFieldSearch.trim() || d.label.toLowerCase().includes(netFieldSearch.toLowerCase()))).length === 0
                          && netFieldDefs.filter(d => !netAddedFieldIds.includes(d.id)).length > 0 && (
                          <Text style={{ padding: 12, color: theme.color.textMuted, ...theme.typography.caption }}>No fields match "{netFieldSearch}"</Text>
                        )}
                      </ScrollView>
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

      {/* ── DOCUMENTS REQUIRED MODAL ── */}
      <Modal visible={manageSection === 'documents'} transparent animationType="slide" onRequestClose={() => { setManageSection(null); setExpandedDocSvcId(null); setDocSearch(''); }}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { flex: 1, marginTop: 60 }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>📋 Documents Required</Text>
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
                placeholder="Search services..."
                placeholderTextColor={theme.color.textMuted}
                clearButtonMode="while-editing"
                autoCorrect={false}
              />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing.space3 }} keyboardShouldPersistTaps="handled">
              {services.length === 0 && <Text style={s.mgmtEmpty}>No services yet</Text>}
              {docSearch.trim() && services.filter(sv => sv.name.toLowerCase().includes(docSearch.toLowerCase())).length === 0 && (
                <Text style={s.mgmtEmpty}>No services match "{docSearch}"</Text>
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
                      {isExpanded && docs.length > 0 && (
                        <Text style={s.docSvcBadge}>{checkedCount}/{docs.length} ✓</Text>
                      )}
                      <Text style={s.docSvcArrow}>{isExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {/* Expanded document list */}
                    {isExpanded && (
                      <View style={s.docListPanel}>
                        {docs.length === 0 && <Text style={s.docEmpty}>No documents added yet</Text>}
                        {docs.map((doc, idx) => (
                          <TouchableOpacity key={doc.id} style={s.docRow} onPress={() => handleToggleDocCheck(doc)} activeOpacity={0.7}>
                            <Text style={s.docNumber}>{idx + 1}.</Text>
                            <Text style={[s.docCheck, doc.is_checked && s.docCheckDone]}>{doc.is_checked ? '☑' : '☐'}</Text>
                            <Text style={[s.docTitle, doc.is_checked && s.docTitleDone]} numberOfLines={2}>{doc.title}</Text>
                            <TouchableOpacity onPress={() => handleDeleteDoc(doc)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={s.docDelete}>✕</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        ))}
                        {/* Add document inline */}
                        <View style={s.docAddRow}>
                          <TextInput
                            style={s.docAddInput}
                            value={expandedDocSvcId === svc.id ? newDocTitle : ''}
                            onChangeText={setNewDocTitle}
                            placeholder="Add document..."
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
                        </View>
                        {/* Excel import panel */}
                        {docImportSvcId === svc.id && (
                          <View style={s.docImportPanel}>
                            <Text style={s.docImportLabel}>Paste from Excel (one title per row):</Text>
                            <TextInput
                              style={s.docImportTextArea}
                              value={docImportRaw}
                              onChangeText={(t) => { setDocImportRaw(t); setDocImportTitles([]); }}
                              placeholder="Paste Excel column here..."
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
                                <Text style={s.docImportPreviewBtnText}>Preview</Text>
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
    padding:         theme.spacing.space3,
    borderWidth:     1,
    borderColor:     theme.color.info + '44',
    gap:             theme.spacing.space1,
  },
  importInstructionsTitle: { ...theme.typography.label, color: theme.color.info, fontWeight: '700' },
  importInstructionsText:  { ...theme.typography.caption, color: theme.color.textSecondary, lineHeight: 18 },
  importTextArea: {
    backgroundColor:   theme.color.bgSurface,
    borderRadius:      theme.radius.md,
    padding:           theme.spacing.space3,
    minHeight:         140,
    color:             theme.color.textPrimary,
    ...theme.typography.body,
    borderWidth:       1,
    borderColor:       theme.color.border,
    textAlignVertical: 'top',
  },
  importPreviewBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
  },
  importPreviewBtnText: { ...theme.typography.label, color: theme.color.white, fontWeight: '700' },
  importPreviewLabel:   { ...theme.typography.sectionDivider, marginTop: theme.spacing.space2 },
  importPreviewRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  importRowNum: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: theme.color.bgSubtle,
    alignItems:      'center',
    justifyContent:  'center',
  },
  importRowNumText: { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '700' },
  importRowName:    { ...theme.typography.body, fontWeight: '700' },
  importRowSub:     { ...theme.typography.caption, color: theme.color.textMuted },
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
