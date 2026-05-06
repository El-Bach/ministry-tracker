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
import { StagesSection } from './NewTask/components/StagesSection';
import { useNewTaskActions } from './NewTask/hooks/useNewTaskActions';
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

  // ── Actions hook (Phase 5) — owns all 24 mutation handlers + helpers
  const actions = useNewTaskActions({
    t, teamMember, navigation, routeParams: route.params,
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
  });
  const {
    persistStageCity, setDraftStageCity, createCityForDraftStage,
    handleCreateCityForStage, handleCreateExtAssigneeForStage,
    loadServiceDefaultStages, loadServiceDocsForSheet,
    handleAddDocFromSheet, handleShareDocsWhatsApp,
    handleDeleteService, handleDeleteStage, handleDeleteClient,
    loadData, toggleStage, removeRouteStop, moveStop,
    handleCreateCustomField, handleCreateClient, handleCreateService,
    handleCreateStage, handleRenameStage, handleSave,
  } = actions;

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

      {/* ── STAGES ── (extracted to ./NewTask/components/StagesSection.tsx) */}
      <StagesSection
        t={t}
        selectedService={selectedService}
        routeStops={routeStops}
        editingStageIdx={editingStageIdx}
        setEditingStageIdx={setEditingStageIdx}
        editingStageName={editingStageName}
        setEditingStageName={setEditingStageName}
        savingStageRename={savingStageRename}
        handleRenameStage={handleRenameStage}
        moveStop={moveStop}
        removeRouteStop={removeRouteStop}
        openStageDetailId={openStageDetailId}
        setOpenStageDetailId={setOpenStageDetailId}
        stageDetailTab={stageDetailTab}
        setStageDetailTab={setStageDetailTab}
        stageCityMap={stageCityMap}
        stageCitySearch={stageCitySearch}
        setStageCitySearch={setStageCitySearch}
        allCities={allCities}
        persistStageCity={persistStageCity}
        showCreateCityForm={showCreateCityForm}
        setShowCreateCityForm={setShowCreateCityForm}
        newCityName={newCityName}
        setNewCityName={setNewCityName}
        newCityInputRef={newCityInputRef}
        savingNewCity={savingNewCity}
        handleCreateCityForStage={handleCreateCityForStage}
        stageAssigneeMap={stageAssigneeMap}
        setStageAssigneeMap={setStageAssigneeMap}
        stageAssigneeSearch={stageAssigneeSearch}
        setStageAssigneeSearch={setStageAssigneeSearch}
        teamMembers={teamMembers}
        allAssignees={allAssignees}
        showCreateExtForm={showCreateExtForm}
        setShowCreateExtForm={setShowCreateExtForm}
        newExtName={newExtName}
        setNewExtName={setNewExtName}
        newExtPhone={newExtPhone}
        setNewExtPhone={setNewExtPhone}
        newExtReference={newExtReference}
        setNewExtReference={setNewExtReference}
        newExtNameInputRef={newExtNameInputRef}
        savingNewExt={savingNewExt}
        handleCreateExtAssigneeForStage={handleCreateExtAssigneeForStage}
        onOpenStagePicker={() => setModal('stage')}
        showNewStageForm={showNewStageForm}
        setShowNewStageForm={setShowNewStageForm}
        newStageName={newStageName}
        setNewStageName={setNewStageName}
        savingStage={savingStage}
        handleCreateStage={handleCreateStage}
        s={s}
      />

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

