// src/screens/NewTaskScreen.tsx
// Create new task: client → service → stages route → assignee → due date

import React, { useState, useEffect, useRef } from 'react';
import {
 View,
 Text,
 StyleSheet,
 ScrollView,
 TouchableOpacity,
 TextInput,
 Alert,
 ActivityIndicator,
 Modal,
 Switch,
 KeyboardAvoidingView,
 Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import supabase from '../lib/supabase';
import { theme } from '../theme';
import { useTranslation } from '../lib/i18n';
import { FieldDefinition, FieldValue, useFieldDefinitions } from '../components/ClientFieldsForm';
import PhoneInput, { DEFAULT_COUNTRY } from '../components/PhoneInput';
import { useAuth } from '../hooks/useAuth';
import { Client, Service, Ministry, TeamMember, City, DashboardStackParamList } from '../types';
import { PickerModal, PickerItem } from './NewTask/components/PickerModal';
import { DynamicFieldInput } from './NewTask/components/DynamicFieldInput';
import { DatePickerField } from './NewTask/components/DatePickerField';
import { RequiredDocsSheet } from './NewTask/components/RequiredDocsSheet';
import { FieldTypePickerModal } from './NewTask/components/FieldTypePickerModal';
import { FieldPickerModal } from './NewTask/components/FieldPickerModal';
import { ScheduleSection } from './NewTask/components/ScheduleSection';
import { ClientSection } from './NewTask/components/ClientSection';
import { ServiceSection } from './NewTask/components/ServiceSection';
import { FieldRow } from './NewTask/components/FieldRow';
import { toISO } from './NewTask/utils/dateHelpers';

// ─── Final closure stage — always last, auto-created ────────────────
const FINAL_STAGE_NAME = 'تسليم المعاملة النهائية و اغلاق الحسابات';



type NewTaskRoute = RouteProp<DashboardStackParamList, 'NewTask'>;
type Nav = NativeStackNavigationProp<DashboardStackParamList>;

// ─── Main Screen ──────────────────────────────────────────────
export default function NewTaskScreen() {
 const navigation = useNavigation<Nav>();
 const route = useRoute<NewTaskRoute>();
 const { teamMember, permissions } = useAuth();
 const { t } = useTranslation();

 const FIELD_TYPES_LIST = [
   { key: 'text',        label: t('fieldText'),        icon: 'Aa',  desc: 'Free text' },
   { key: 'textarea',    label: t('fieldTextarea'),    icon: '¶',   desc: 'Multi-line text' },
   { key: 'number',      label: t('fieldNumber'),      icon: '123', desc: 'Numeric value' },
   { key: 'currency',    label: t('fieldCurrency'),    icon: '$',   desc: 'Money amount' },
   { key: 'email',       label: t('fieldEmail'),       icon: '@',   desc: 'Email address' },
   { key: 'phone',       label: t('fieldPhone'),       icon: '☏',  desc: 'Phone number' },
   { key: 'url',         label: t('fieldUrl'),         icon: '🔗',  desc: 'Web address' },
   { key: 'date',        label: t('fieldDate'),        icon: '📅',  desc: 'DD/MM/YYYY' },
   { key: 'boolean',     label: t('fieldBoolean'),     icon: '✓',   desc: 'Toggle switch' },
   { key: 'select',      label: t('fieldSelect'),      icon: '▾',   desc: 'Single choice' },
   { key: 'multiselect', label: t('fieldMultiselect'), icon: '☑',  desc: 'Multiple choices' },
   { key: 'image',       label: t('fieldImage'),       icon: '🖼',  desc: 'Camera or library' },
   { key: 'location',    label: t('fieldLocation'),    icon: '📍',  desc: 'GPS coordinates' },
   { key: 'id_number',   label: t('fieldIdNumber'),    icon: '#',   desc: 'National ID, etc.' },
 ];

 const [clients, setClients] = useState<Client[]>([]);
 const [services, setServices] = useState<Service[]>([]);
 const [stages, setStages] = useState<Ministry[]>([]);
 const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

 const [selectedClient, setSelectedClient] = useState<Client | null>(null);
 const [selectedService, setSelectedService] = useState<Service | null>(null);
 const [routeStops, setRouteStops] = useState<Ministry[]>([]);
 const [dueDate, setDueDate] = useState(''); // stored as DD/MM/YYYY display format
 const [notes, setNotes] = useState('');

 const [modal, setModal] = useState<'client' | 'service' | 'stage' | null>(null);

 // New client form
 const [showNewClientForm, setShowNewClientForm] = useState(false);
 const [newClientName, setNewClientName] = useState('');
 const [newClientPhone, setNewClientPhone] = useState('');
 const [newClientPhoneCountry, setNewClientPhoneCountry] = useState(DEFAULT_COUNTRY.code);
 const [newClientRefName, setNewClientRefName] = useState('');
 const [newClientRefPhone, setNewClientRefPhone] = useState('');
 const [newClientRefPhoneCountry, setNewClientRefPhoneCountry] = useState(DEFAULT_COUNTRY.code);
 const [customFieldValues, setCustomFieldValues] = useState<Record<string, FieldValue>>({});
 const [activeFieldIds, setActiveFieldIds] = useState<string[]>([]); // fields user chose to add
 const [showFieldPicker, setShowFieldPicker] = useState(false);
 const { fields: allFieldDefs, reload: reloadFieldDefs } = useFieldDefinitions();

 // Inline custom field creation inside the picker
 const [showCreateField, setShowCreateField] = useState(false);
 const [newFieldLabel, setNewFieldLabel] = useState('');
 const [newFieldType, setNewFieldType] = useState('text');
 const [newFieldOptions, setNewFieldOptions] = useState('');
 const [newFieldRequired, setNewFieldRequired] = useState(false);
 const [savingNewField, setSavingNewField] = useState(false);
 const [showFieldTypePicker, setShowFieldTypePicker] = useState(false);


 // New service form
 const [showNewServiceForm, setShowNewServiceForm] = useState(false);
 const [newServiceName, setNewServiceName] = useState('');
 // Each draft stage carries an optional default city — persisted to ministries.city_id on save
 const [newServiceStages, setNewServiceStages] = useState<Array<{ name: string; cityId?: string; cityName?: string }>>([]);
 const [newServiceStageInput, setNewServiceStageInput] = useState('');
 const [savingService, setSavingService] = useState(false);
 // Per-draft-stage city picker state
 const [expandedSvcStageIdx, setExpandedSvcStageIdx] = useState<number | null>(null);
 const [svcStageCitySearch, setSvcStageCitySearch] = useState('');
 const [svcStageCreateOpen, setSvcStageCreateOpen] = useState(false);
 const [svcStageNewCityName, setSvcStageNewCityName] = useState('');
 const [svcStageSavingCity, setSvcStageSavingCity] = useState(false);

 // New stage form
 const [showNewStageForm, setShowNewStageForm] = useState(false);
 const [newStageName, setNewStageName] = useState('');
 const [savingStage, setSavingStage] = useState(false);

 // Per-stage city + assignee (set before creating the task)
 const [allCities, setAllCities] = useState<City[]>([]);
 const [allAssignees, setAllAssignees] = useState<any[]>([]);
 const [openStageDetailId, setOpenStageDetailId] = useState<string | null>(null);
 const [stageCityMap, setStageCityMap] = useState<Record<string, { cityId: string; cityName: string } | null>>({});
 const [stageAssigneeMap, setStageAssigneeMap] = useState<Record<string, { id: string; name: string; isExt: boolean } | null>>({});
 const [stageCitySearch, setStageCitySearch] = useState('');
 const [stageAssigneeSearch, setStageAssigneeSearch] = useState('');
 const [stageDetailTab, setStageDetailTab] = useState<'city' | 'assignee'>('city');

 // Inline create-city form state
 const [showCreateCityForm, setShowCreateCityForm] = useState(false);
 const [newCityName, setNewCityName] = useState('');
 const [savingNewCity, setSavingNewCity] = useState(false);
 const newCityInputRef = useRef<TextInput>(null);

 // Inline create-assignee (external) form state
 const [showCreateExtForm, setShowCreateExtForm] = useState(false);
 const [newExtName, setNewExtName] = useState('');
 const [newExtPhone, setNewExtPhone] = useState('');
 const [newExtReference, setNewExtReference] = useState('');
 const [savingNewExt, setSavingNewExt] = useState(false);
 const newExtNameInputRef = useRef<TextInput>(null);

 const [saving, setSaving] = useState(false);

 // ── Stage city: update local map AND persist as the stage's default city ─
 // (so the city travels with the stage everywhere — Manage Stages, future
 //  files using this stage, etc.)
 const persistStageCity = async (
   stageId: string,
   city: { cityId: string; cityName: string } | null,
 ) => {
   setStageCityMap(m => ({ ...m, [stageId]: city }));
   // Update the ministry's default city. Best-effort — UI already moved on.
   await supabase
     .from('ministries')
     .update({ city_id: city?.cityId ?? null })
     .eq('id', stageId);
   // Keep the local stages cache in sync so it shows immediately if the user
   // re-opens the stage picker for another file in the same session.
   setStages(prev => prev.map(st =>
     st.id === stageId
       ? { ...st, city_id: city?.cityId ?? null, city: city ? { id: city.cityId, name: city.cityName } as any : undefined }
       : st
   ));
 };

 // ── Service-form draft-stage city helpers ───────────────────
 const setDraftStageCity = (idx: number, city: { id: string; name: string } | null) => {
   setNewServiceStages(prev => prev.map((s, i) =>
     i === idx
       ? { ...s, cityId: city?.id, cityName: city?.name }
       : s
   ));
 };

 const createCityForDraftStage = async (idx: number) => {
   const name = svcStageNewCityName.trim();
   if (!name) { Alert.alert(t('required'), t('fieldRequired')); return; }
   setSvcStageSavingCity(true);
   const { data, error } = await supabase
     .from('cities')
     .insert({ name, org_id: teamMember?.org_id ?? null })
     .select()
     .single();
   setSvcStageSavingCity(false);
   if (error) { Alert.alert(t('error'), error.message); return; }
   const created = data as City;
   setAllCities(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
   setDraftStageCity(idx, { id: created.id, name: created.name });
   setSvcStageNewCityName('');
   setSvcStageCreateOpen(false);
   setSvcStageCitySearch('');
 };

 // ── Inline create handlers (city + external assignee) ────────
 const handleCreateCityForStage = async (stageId: string) => {
   const name = newCityName.trim();
   if (!name) { Alert.alert(t('required'), t('fieldRequired')); return; }
   setSavingNewCity(true);
   const { data, error } = await supabase
     .from('cities')
     .insert({ name, org_id: teamMember?.org_id ?? null })
     .select()
     .single();
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

 // ── Required docs bottom-sheet ────────────────────────────
 const [showDocSheet, setShowDocSheet]           = useState(false);
 const [sheetDocs, setSheetDocs]                 = useState<any[]>([]);
 const [sheetDocReqs, setSheetDocReqs]           = useState<Record<string, any[]>>({});
 const [sheetExpandedId, setSheetExpandedId]     = useState<string | null>(null);
 const [loadingSheetDocs, setLoadingSheetDocs]   = useState(false);

 // Inline add-document state (within the Required Docs sheet)
 const [showAddDocForm, setShowAddDocForm] = useState(false);
 const [newDocTitle, setNewDocTitle]       = useState('');
 const [savingNewDoc, setSavingNewDoc]     = useState(false);

 // Stage inline rename
 const [editingStageIdx, setEditingStageIdx] = useState<number | null>(null);
 const [editingStageName, setEditingStageName] = useState('');
 const [savingStageRename, setSavingStageRename] = useState(false);

 // Auto-capture created time from device
 const [createdAt] = useState<Date>(() => new Date());
 const createdDisplay = createdAt.toLocaleDateString('en-GB', {
 day: '2-digit',
 month: '2-digit',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 });

 useEffect(() => {
 loadData();
 // Re-run if org changes (auth resolves later, org switch, etc.)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [teamMember?.org_id]);

 // Refresh clients list after returning from EditClient screen
 useFocusEffect(
   React.useCallback(() => {
     supabase.from('clients').select('*').eq('org_id', teamMember?.org_id ?? '').order('name').then(({ data }) => {
       if (data) setClients(data as Client[]);
     });
     // Refresh stages for selected service
     if (selectedService) {
       loadServiceDefaultStages(selectedService.id);
     }
   }, [selectedService])
 );

 const loadServiceDefaultStages = async (serviceId: string) => {
   const { data } = await supabase
     .from('service_default_stages')
     .select('*, ministry:ministries(*, city:cities(id,name))')
     .eq('service_id', serviceId)
     .order('stop_order');
   if (data && data.length > 0) {
     const ministries = data.map((d: any) => d.ministry as Ministry);
     setRouteStops(ministries);
     // Pre-populate stageCityMap from each ministry's default city
     const cityMap: Record<string, { cityId: string; cityName: string } | null> = {};
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

 // ── Required docs sheet handlers ──────────────────────────
 const loadServiceDocsForSheet = async (serviceId: string) => {
   setLoadingSheetDocs(true);
   setSheetDocs([]);
   setSheetDocReqs({});
   setSheetExpandedId(null);
   const { data: docs } = await supabase
     .from('service_documents')
     .select('*')
     .eq('service_id', serviceId)
     .order('sort_order');
   const docList = docs ?? [];
   setSheetDocs(docList);
   if (docList.length > 0) {
     const results = await Promise.all(
       docList.map((d: any) =>
         supabase.from('service_document_requirements')
           .select('*').eq('doc_id', d.id).order('sort_order')
       )
     );
     const reqs: Record<string, any[]> = {};
     docList.forEach((d: any, i: number) => { reqs[d.id] = results[i].data ?? []; });
     setSheetDocReqs(reqs);
   }
   setLoadingSheetDocs(false);
 };

 // Add a new required document for the currently selected service
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
     Alert.alert(t('error'), t('somethingWrong'))
   );
 };

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
     ]
   );
 };

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
   // Pre-select client if navigated from ClientProfile
   const preId = route.params?.preselectedClientId;
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

 const toggleStage = (stage: Ministry) => {
   if (routeStops.find((r) => r.id === stage.id)) {
     setRouteStops((prev) => prev.filter((r) => r.id !== stage.id));
   } else {
     setRouteStops((prev) => [...prev, stage]);
     // Auto-populate city from ministry's default if it has one and isn't already set
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

 // ─── Create custom field definition on the fly ───────────────
 const handleCreateCustomField = async () => {
 if (!newFieldLabel.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }
 const needsOptions = ['select', 'multiselect'].includes(newFieldType);
 if (needsOptions && !newFieldOptions.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }
 setSavingNewField(true);
 const options = needsOptions
 ? newFieldOptions.split(',').map((o) => o.trim()).filter(Boolean)
 : null;
 const fieldKey = newFieldLabel.toLowerCase().trim()
 .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
 const { data, error } = await supabase
 .from('client_field_definitions')
 .insert({
 label: newFieldLabel.trim(),
 field_key: fieldKey,
 field_type: newFieldType,
 is_required: newFieldRequired,
 is_active: true,
 options: options ? JSON.stringify(options) : null,
 sort_order: 999,
 org_id: teamMember?.org_id ?? null,
 })
 .select()
 .single();
 setSavingNewField(false);
 if (error) { Alert.alert(t('error'), error.message); return; }
 await reloadFieldDefs();
 setActiveFieldIds((prev) => [...prev, data.id]);
 setNewFieldLabel('');
 setNewFieldType('text');
 setNewFieldOptions('');
 setNewFieldRequired(false);
 setShowCreateField(false);
 setShowFieldPicker(false);
 };

 const handleCreateClient = async () => {
 if (!newClientName.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }

 // Duplicate check
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
     ]
   );
   return;
 }
 doCreateClient();
 };

 const doCreateClient = async () => {
 const autoId = `CLT-${Date.now()}`;
 const fullPhone    = newClientPhone.trim()    ? `${newClientPhoneCountry}${newClientPhone.trim()}`       : null;
 const fullRefPhone = newClientRefPhone.trim() ? `${newClientRefPhoneCountry}${newClientRefPhone.trim()}` : null;
 const { data, error } = await supabase
 .from('clients')
 .insert({
 name: newClientName.trim(),
 client_id: autoId,
 phone: fullPhone,
 reference_name: newClientRefName.trim() || null,
 reference_phone: fullRefPhone,
 org_id: teamMember?.org_id ?? null,
 })
 .select()
 .single();
 if (error) { Alert.alert(t('error'), error.message); return; }
 const c = data as Client;

 // Save custom field values
 const fieldEntries = Object.values(customFieldValues).filter((v) =>
 v.value_text != null || v.value_number != null ||
 v.value_boolean != null || v.value_json != null
 );
 if (fieldEntries.length > 0) {
 await supabase.from('client_field_values').insert(
 fieldEntries.map((v) => ({ client_id: c.id, ...v }))
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

 const handleCreateService = async () => {
   if (!newServiceName.trim()) {
     Alert.alert(t('required'), t('fieldRequired'));
     return;
   }
   // Duplicate check (case-insensitive, scoped to current org)
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

 const doCreateService = async () => {
   setSavingService(true);
   const { data, error } = await supabase
     .from('services')
     .insert({ name: newServiceName.trim(), estimated_duration_days: 0, org_id: teamMember?.org_id ?? null })
     .select()
     .single();
   if (error) { Alert.alert(t('error'), error.message); setSavingService(false); return; }
   const sv = data as Service;
   // Create ministries + link as default stages — silently reuse existing
   // ministries (same name in this org) instead of creating duplicates.
   const stageMinistries: Ministry[] = [];
   const cityMapForRouteStops: Record<string, { cityId: string; cityName: string } | null> = {};
   const pendingInput = newServiceStageInput.trim();
   const drafts: Array<{ name: string; cityId?: string; cityName?: string }> = [
     ...newServiceStages.filter((d) => d.name.trim()),
     ...(pendingInput ? [{ name: pendingInput }] : []),
   ];
   for (let i = 0; i < drafts.length; i++) {
     const draft = drafts[i];
     // Look up existing parent ministry with same name in this org
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
       // New ministry — include the chosen city as the default
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
       // Pre-populate the per-stage city map for this file from either the
       // draft's chosen city OR the existing ministry's default city
       const cityId = draft.cityId ?? ministry.city_id;
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
   // Merge into stages cache without creating UI duplicates
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

 const handleCreateStage = async () => {
 if (!newStageName.trim()) {
 Alert.alert(t('required'), t('fieldRequired'));
 return;
 }
 // Duplicate check
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
   // Save as default stage for current service
   if (selectedService) {
     supabase.from('service_default_stages').insert({
       service_id: selectedService.id,
       ministry_id: stage.id,
       stop_order: next.length,
     }).then(() => {});
   }
   return next;
 });
 setShowNewStageForm(false);
 setNewStageName('');
 };

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

 const validate = (): string | null => {
 if (!selectedClient) return t('pickClient');
 if (!selectedService) return t('pickService');
 if (routeStops.length === 0) return t('noStagesAddFirst');
 if (dueDate.trim()) {
 const iso = toISO(dueDate);
 if (!iso) return t('invalidPhone'); // reuse generic invalid msg
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
 client_id: selectedClient!.id,
 service_id: selectedService!.id,
 current_status: 'Submitted',
 due_date: dueDateISO,
 notes: notes.trim() || null,
 price_usd: (selectedService as any).base_price_usd ?? 0,
 price_lbp: (selectedService as any).base_price_lbp ?? 0,
 created_at: createdAt.toISOString(),
 updated_at: createdAt.toISOString(),
 org_id: teamMember?.org_id ?? null,
 assigned_to: teamMember?.id ?? null,
 })
 .select()
 .single();

 if (taskErr) throw taskErr;

 const stops = routeStops.map((m, idx) => ({
 task_id: taskData.id,
 ministry_id: m.id,
 stop_order: idx + 1,
 status: 'Pending',
 city_id: stageCityMap[m.id]?.cityId ?? null,
 assigned_to: stageAssigneeMap[m.id]?.isExt === false ? (stageAssigneeMap[m.id]?.id ?? null) : null,
 ext_assignee_id: stageAssigneeMap[m.id]?.isExt === true ? (stageAssigneeMap[m.id]?.id ?? null) : null,
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
   task_id: taskData.id,
   ministry_id: finalMinistryId,
   stop_order: stops.length + 1,
   status: 'Pending',
 });

 await supabase.from('status_updates').insert({
 task_id: taskData.id,
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

 return (
 <SafeAreaView style={s.safe} edges={['bottom']}>
 <KeyboardAwareScrollView
   contentContainerStyle={s.container}
   keyboardShouldPersistTaps="handled"
   enableOnAndroid={true}
   enableAutomaticScroll={true}
   enableResetScrollToCoords={false}
   extraScrollHeight={120}
   extraHeight={120}
 >

      {/* ── CLIENT ── (extracted to ./NewTask/components/ClientSection.tsx) */}
      <ClientSection
        t={t}
        selectedClient={selectedClient}
        onOpenClientPicker={() => setModal('client')}
        showNewClientForm={showNewClientForm}
        setShowNewClientForm={setShowNewClientForm}
        newClientName={newClientName}
        setNewClientName={setNewClientName}
        newClientPhone={newClientPhone}
        setNewClientPhone={setNewClientPhone}
        newClientPhoneCountry={newClientPhoneCountry}
        setNewClientPhoneCountry={setNewClientPhoneCountry}
        newClientRefName={newClientRefName}
        setNewClientRefName={setNewClientRefName}
        newClientRefPhone={newClientRefPhone}
        setNewClientRefPhone={setNewClientRefPhone}
        newClientRefPhoneCountry={newClientRefPhoneCountry}
        setNewClientRefPhoneCountry={setNewClientRefPhoneCountry}
        activeFieldIds={activeFieldIds}
        setActiveFieldIds={setActiveFieldIds}
        allFieldDefs={allFieldDefs}
        customFieldValues={customFieldValues}
        setCustomFieldValues={setCustomFieldValues}
        onOpenFieldPicker={() => setShowFieldPicker(true)}
        handleCreateClient={handleCreateClient}
        s={s}
      />

      {/* ── SERVICE ── (extracted to ./NewTask/components/ServiceSection.tsx) */}
      <ServiceSection
        t={t}
        selectedService={selectedService}
        onOpenServicePicker={() => setModal('service')}
        onOpenDocSheet={(serviceId) => { setShowDocSheet(true); loadServiceDocsForSheet(serviceId); }}
        showNewServiceForm={showNewServiceForm}
        setShowNewServiceForm={setShowNewServiceForm}
        newServiceName={newServiceName}
        setNewServiceName={setNewServiceName}
        newServiceStages={newServiceStages}
        setNewServiceStages={setNewServiceStages}
        newServiceStageInput={newServiceStageInput}
        setNewServiceStageInput={setNewServiceStageInput}
        expandedSvcStageIdx={expandedSvcStageIdx}
        setExpandedSvcStageIdx={setExpandedSvcStageIdx}
        svcStageCitySearch={svcStageCitySearch}
        setSvcStageCitySearch={setSvcStageCitySearch}
        svcStageCreateOpen={svcStageCreateOpen}
        setSvcStageCreateOpen={setSvcStageCreateOpen}
        svcStageNewCityName={svcStageNewCityName}
        setSvcStageNewCityName={setSvcStageNewCityName}
        svcStageSavingCity={svcStageSavingCity}
        setDraftStageCity={setDraftStageCity}
        createCityForDraftStage={createCityForDraftStage}
        allCities={allCities}
        savingService={savingService}
        handleCreateService={handleCreateService}
        s={s}
      />

 {/* ── STAGES — appears after service is selected ── */}
 {selectedService && (
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
           {/* Show the discovery hint only when nothing is set yet — once a city or assignee
               is picked, those values appear in the picker (with ✓), so we don't duplicate
               them under the stage name. */}
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
                     // Pre-fill from search if user typed something
                     if (stageCitySearch.trim()) setNewCityName(stageCitySearch.trim());
                     // Delay focus so KeyboardAwareScrollView has time to scroll
                     // the input above the keyboard before it pops up.
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
                       <Text style={s.inlineSaveBtnText}>{savingNewCity ? t('pleaseWait') : t('createAndAdd')}</Text>
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
                     // Delay focus so KeyboardAwareScrollView can scroll the input above the keyboard
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
                       <Text style={s.inlineSaveBtnText}>{savingNewExt ? t('pleaseWait') : t('createAndAdd')}</Text>
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

 <TouchableOpacity style={s.addStopBtn} onPress={() => setModal('stage')}>
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
 {savingStage ? (
 <ActivityIndicator color={theme.color.white} size="small" />
 ) : (
 <Text style={s.inlineSaveBtnText}>{t('save')} & {t('addStage')}</Text>
 )}
 </TouchableOpacity>
 </View>
 )}
 </View>
 )}

      {/* ── SCHEDULE ── (extracted to ./NewTask/components/ScheduleSection.tsx) */}
      <ScheduleSection
        t={t}
        createdDisplay={createdDisplay}
        dueDate={dueDate}
        setDueDate={setDueDate}
        notes={notes}
        setNotes={setNotes}
        s={s}
      />

 {/* ── SUBMIT ── */}
 <TouchableOpacity
 style={[s.submitBtn, saving && s.submitBtnDisabled]}
 onPress={handleSave}
 disabled={saving}
 >
 {saving ? (
 <ActivityIndicator color={theme.color.white} />
 ) : (
 <Text style={s.submitBtnText}>{t('createFileBtn')}</Text>
 )}
 </TouchableOpacity>
 </KeyboardAwareScrollView>

 {/* ── MODALS ── */}
 <PickerModal
 visible={modal === 'client'}
 title={t('pickClient')}
 items={clients.map((c) => ({ id: c.id, label: c.name, subtitle: c.phone ?? undefined }))}
 onSelect={(item) => setSelectedClient(clients.find((c) => c.id === item.id)!)}
 onItemAction={permissions.can_edit_delete_clients ? (item) => { navigation.navigate('EditClient', { clientId: item.id }); } : undefined}
 itemActionLabel={permissions.can_edit_delete_clients ? '✎ Edit' : undefined}
 onItemDelete={permissions.can_edit_delete_clients ? handleDeleteClient : undefined}
 onClose={() => setModal(null)}
 search
 addNewLabel={t('createNewClient')}
 onAddNew={(initialName) => {
   setNewClientName(initialName ?? '');
   setNewClientPhone('');
   setNewClientPhoneCountry(DEFAULT_COUNTRY.code);
   setNewClientRefName('');
   setNewClientRefPhone('');
   setNewClientRefPhoneCountry(DEFAULT_COUNTRY.code);
   setCustomFieldValues({});
   setActiveFieldIds([]);
   setShowNewClientForm(true);
 }}
 />
 <PickerModal
 visible={modal === 'service'}
 title={t('pickService')}
 items={services.map((sv) => ({
 id: sv.id,
 label: sv.name,
 subtitle: `Est. ${sv.estimated_duration_days} days`,
 }))}
 onSelect={(item) => {
   const svc = services.find((sv) => sv.id === item.id)!;
   setSelectedService(svc);
   loadServiceDefaultStages(svc.id);
 }}
 onItemAction={permissions.can_manage_catalog ? (item) => { navigation.navigate('ServiceStages', { serviceId: item.id, serviceName: item.label }); } : undefined}
 itemActionLabel={permissions.can_manage_catalog ? '✎ Stages' : undefined}
 onItemDelete={permissions.can_manage_catalog ? handleDeleteService : undefined}
 onClose={() => setModal(null)}
 search
 />
 <PickerModal
 visible={modal === 'stage'}
 title={t('pickStage')}
 items={stages.map((m) => ({ id: m.id, label: m.name }))}
 onSelect={(item) => {
 const stage = stages.find((m) => m.id === item.id);
 if (stage) toggleStage(stage);
 }}
 onItemDelete={permissions.can_manage_catalog ? handleDeleteStage : undefined}
 onClose={() => setModal(null)}
 search
 multiSelect
 selectedIds={routeStops.map((r) => r.id)}
 />

      {/* Field picker modal — extracted to ./NewTask/components/FieldPickerModal.tsx */}
      <FieldPickerModal
        visible={showFieldPicker}
        onClose={() => setShowFieldPicker(false)}
        t={t}
        allFieldDefs={allFieldDefs}
        activeFieldIds={activeFieldIds}
        setActiveFieldIds={setActiveFieldIds}
        showCreateField={showCreateField}
        setShowCreateField={setShowCreateField}
        newFieldLabel={newFieldLabel}
        setNewFieldLabel={setNewFieldLabel}
        newFieldType={newFieldType}
        newFieldOptions={newFieldOptions}
        setNewFieldOptions={setNewFieldOptions}
        newFieldRequired={newFieldRequired}
        setNewFieldRequired={setNewFieldRequired}
        savingNewField={savingNewField}
        handleCreateCustomField={handleCreateCustomField}
        fieldTypes={FIELD_TYPES_LIST}
        onOpenTypePicker={() => setShowFieldTypePicker(true)}
      />

      {/* Field type picker sub-modal — extracted to ./NewTask/components/FieldTypePickerModal.tsx */}
      <FieldTypePickerModal
        visible={showFieldTypePicker}
        onClose={() => setShowFieldTypePicker(false)}
        t={t}
        fieldTypes={FIELD_TYPES_LIST}
        selectedKey={newFieldType}
        onSelect={setNewFieldType}
      />

      {/* ── REQUIRED DOCS SHEET ── (extracted to ./NewTask/components/RequiredDocsSheet.tsx) */}
      <RequiredDocsSheet
        visible={showDocSheet}
        onClose={() => setShowDocSheet(false)}
        t={t}
        selectedService={selectedService}
        loadingSheetDocs={loadingSheetDocs}
        sheetDocs={sheetDocs}
        sheetDocReqs={sheetDocReqs}
        sheetExpandedId={sheetExpandedId}
        setSheetExpandedId={setSheetExpandedId}
        showAddDocForm={showAddDocForm}
        setShowAddDocForm={setShowAddDocForm}
        newDocTitle={newDocTitle}
        setNewDocTitle={setNewDocTitle}
        savingNewDoc={savingNewDoc}
        handleAddDocFromSheet={handleAddDocFromSheet}
        handleShareDocsWhatsApp={handleShareDocsWhatsApp}
      />
    </SafeAreaView>
 );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: theme.color.bgBase },
  container: { padding: theme.spacing.space4, gap: theme.spacing.space2, paddingBottom: 80 },
  section: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.space4,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
    marginBottom:    theme.spacing.space3,
  },
  sectionTitle: { ...theme.typography.sectionDivider, marginBottom: 4 },
  fieldRowSelected: {
    flexDirection: 'row',
    alignItems:    'center',
    backgroundColor: theme.color.bgSurface,
    borderRadius:  theme.radius.lg,
    padding:       14,
    borderWidth:   1,
    borderColor:   theme.color.primary,
    gap:           6,
  },
  fieldRowSelectedHint:  { ...theme.typography.sectionDivider, color: theme.color.primary, marginBottom: 3 },
  fieldRowSelectedValue: { color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  fieldRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.lg,
    paddingVertical:   14,
    paddingHorizontal: theme.spacing.space4,
  },
  fieldLabel:       { ...theme.typography.body, color: theme.color.white, fontWeight: '700', fontSize: 15 },
  fieldValue:       { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 2 },
  fieldValueText:   { ...theme.typography.body, color: theme.color.textPrimary, flex: 1, textAlign: 'right' },
  fieldPlaceholder: { fontSize: 17, fontWeight: '700', color: theme.color.white, flex: 1, textAlign: 'right' },
  fieldChevron:     { color: theme.color.white, fontSize: 20, fontWeight: '700' },
  hint:             { ...theme.typography.label, color: theme.color.textMuted },
  addInlineBtn:     {
    alignSelf:       'stretch',
    marginTop:       theme.spacing.space2,
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.lg,
    paddingVertical: 12,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     theme.color.primary,
  },
  addInlineBtnText: { color: theme.color.primary, fontSize: 15, fontWeight: '700' },
  inlineForm: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  inlineInput: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    color:           theme.color.textPrimary,
    fontSize:        theme.typography.body.fontSize,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  selectedStages: { gap: 6 },
  stageRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         10,
    gap:             10,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  stageIndex: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: theme.color.primary + '33',
    justifyContent:  'center',
    alignItems:      'center',
  },
  stageIndexText:    { ...theme.typography.label, color: theme.color.primaryText, fontWeight: '700' },
  stageName:         { color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  stageActions:      { flexDirection: 'row', gap: theme.spacing.space2, alignItems: 'center' },
  stageDetailPanel: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.space3,
    marginTop:       theme.spacing.space2,
    borderWidth:     1,
    borderColor:     theme.color.primary + '33',
  },
  stageDetailTab: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    borderRadius: theme.radius.sm, backgroundColor: theme.color.bgSurface,
  },
  stageDetailTabActive: { backgroundColor: theme.color.primary + '22' },
  stageDetailTabText: { ...theme.typography.label, color: theme.color.textMuted, fontWeight: '700' },
  // Save button at the bottom of the inline city/assignee picker
  stageDetailSaveBtn: {
    marginTop:       theme.spacing.space3,
    paddingVertical: 12,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.color.primary,
    alignItems:      'center',
  },
  stageDetailSaveBtnText: {
    color:      theme.color.white,
    fontSize:   14,
    fontWeight: '700',
  },
  stageDetailSearch: {
    backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.color.border, color: theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3, paddingVertical: theme.spacing.space2,
    fontSize: 13, marginBottom: 6,
  },
  stageDetailItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.space3, paddingVertical: theme.spacing.space2,
    borderRadius: theme.radius.sm,
  },
  stageDetailItemActive: { backgroundColor: theme.color.primary + '18' },
  stageDetailItemText: { ...theme.typography.body, color: theme.color.textPrimary },
  // Inline create-new (city / contact) inside stage city/assignee picker
  inlineCreateBtn: {
    marginTop:    theme.spacing.space2,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2 + 2,
    borderRadius:  theme.radius.md,
    borderWidth:   1,
    borderColor:   theme.color.primary,
    backgroundColor: theme.color.primary + '11',
    alignItems:    'center',
  },
  inlineCreateBtnText: {
    color:      theme.color.primary,
    fontSize:   13,
    fontWeight: '700',
  },
  inlineCreateForm: {
    marginTop:       theme.spacing.space2,
    padding:         theme.spacing.space3,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    backgroundColor: theme.color.bgSurface,
    gap:             theme.spacing.space2,
  },
  inlineCreateInput: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.sm,
    borderWidth:     1,
    borderColor:     theme.color.border,
    color:           theme.color.textPrimary,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    fontSize:        13,
  },
  inlineCreateActions: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    gap:            theme.spacing.space2,
    marginTop:      2,
  },
  inlineCancelBtn: {
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   theme.spacing.space2,
    borderRadius:      theme.radius.sm,
  },
  inlineCancelBtnText: {
    color:      theme.color.textSecondary,
    fontSize:   13,
    fontWeight: '600',
  },
  inlineSaveBtn: {
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   10,
    borderRadius:      theme.radius.md,
    backgroundColor:   theme.color.primary,
    alignItems:        'center' as const,
  },
  inlineSaveBtnText: {
    color:      theme.color.white,
    fontSize:   13,
    fontWeight: '700' as const,
  },
  stageArrow:        { color: theme.color.primary, fontSize: 18, fontWeight: '700', padding: 2 },
  stageRemove:       { color: theme.color.danger, fontSize: 16, padding: 2 },
  stageEdit:         { color: theme.color.textSecondary, fontSize: 15, padding: 2 },
  stageRenameConfirm: { color: theme.color.success, fontSize: 18, fontWeight: '700', padding: 2 },
  disabled: { opacity: 0.3 },
  addStopBtn: {
    borderWidth:     1.5,
    borderColor:     theme.color.primary + '55',
    borderStyle:     'dashed',
    borderRadius:    theme.radius.md,
    paddingVertical: theme.spacing.space3,
    alignItems:      'center',
    backgroundColor: theme.color.primary + '08',
  },
  addStopBtnText: { ...theme.typography.body, color: theme.color.primary, fontWeight: '600' },
  notesContainer: { gap: theme.spacing.space2 },
  notesInput: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 10,
    color:           theme.color.textPrimary,
    fontSize:        theme.typography.body.fontSize,
    borderWidth:     1,
    borderColor:     theme.color.border,
    minHeight:       80,
  },
  submitBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       theme.spacing.space2,
  },
  submitBtnDisabled: { opacity: 0.6 },
  activeFieldsContainer: { gap: 10 },
  activeFieldRow: {
    backgroundColor: theme.color.bgBase,
    borderRadius:    theme.radius.md,
    padding:         10,
    gap:             6,
    borderWidth:     1,
    borderColor:     theme.color.border,
  },
  activeFieldHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   2,
  },
  activeFieldLabel:  { ...theme.typography.label, color: theme.color.textSecondary, fontWeight: '700' },
  activeFieldRemove: { color: theme.color.danger, fontSize: 16, padding: 2 },
  addFieldBtn: {
    borderWidth:     1.5,
    borderColor:     theme.color.primary + '55',
    borderStyle:     'dashed',
    borderRadius:    theme.radius.md,
    paddingVertical: 11,
    alignItems:      'center',
    backgroundColor: theme.color.primary + '08',
  },
  addFieldBtnText: { ...theme.typography.label, color: theme.color.primary, fontWeight: '700' },
  createdRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   6,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    marginBottom:      4,
  },
  createdValue:  { color: theme.color.primary, fontSize: 13, fontWeight: '700' },
  optionalTag:   { ...theme.typography.caption, color: theme.color.textMuted, fontWeight: '400' },
  submitBtnText: { color: theme.color.white, fontSize: 16, fontWeight: '700' },
  newSvcStageList: { marginBottom: theme.spacing.space2 },
  newSvcStageRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  newSvcStageName: { flex: 1, color: theme.color.textSecondary, fontSize: 13, fontWeight: '600' },
  newSvcAddRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  newSvcPlusBtn: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    width:           40,
    height:          40,
    justifyContent:  'center',
    alignItems:      'center',
    marginStart:     theme.spacing.space2,
  },
  newSvcPlusBtnText: { color: theme.color.white, fontSize: 22, lineHeight: 26 },
  modalOverlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'center', padding: theme.spacing.space6 },
  editClientSheet: {
    backgroundColor: theme.color.bgSurface,
    borderRadius:    theme.radius.xl,
    padding:         20,
    borderWidth:     1,
    borderColor:     theme.color.border,
    ...theme.shadow.modal,
  },
  editClientTitle:      { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  editClientBtns:       { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  editClientCancel:     { paddingHorizontal: theme.spacing.space4, paddingVertical: 10, marginEnd: 10 },
  editClientCancelText: { ...theme.typography.body, color: theme.color.textSecondary, fontWeight: '600' },
  editClientSave: {
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  editClientSaveText: { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },

  // Required docs sheet button
  docsSheetBtn: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.primary + '18',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.color.primary + '44',
    marginTop: 6,
    marginBottom: 4,
  },
  docsSheetBtnText: {
    color: theme.color.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
});

