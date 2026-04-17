// src/screens/CreateScreen.tsx
// Create tab: quick-action cards + full manage section (clients / services / stages)

import React, { useState, useCallback } from 'react';
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

import supabase from '../lib/supabase';
import { theme } from '../theme';
import { Client, Service, Ministry } from '../types';

type ManageSection = 'clients' | 'services' | 'stages' | null;

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

  // Inline calendar for date fields
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState<string | null>(null);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [calCurrentDate, setCalCurrentDate] = useState<string | undefined>(undefined);

  // ── Data fetching ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const [c, s, m] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('ministries').select('*').eq('type', 'parent').order('name'),
    ]);
    if (c.data) setClients(c.data as Client[]);
    if (s.data) setServices(s.data as Service[]);
    if (m.data) setMinistries(m.data as Ministry[]);
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
              onPress={() => { setClientSearch(''); setServiceSearch(''); setStageSearch(''); setManageSection(row.key); }}
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
                <TouchableOpacity onPress={() => setShowClientForm(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
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
});
