// src/screens/NewTaskScreen.tsx
// Create new task: client → service → stages route → assignee → due date

import React, { useState, useEffect, useRef } from 'react';
import {
 View,
 Text,
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
import { s } from './NewTask/styles/newTaskStyles';

// (FINAL_STAGE_NAME moved into ./NewTask/hooks/useNewTaskActions.ts —
// the only remaining caller of it after the Phase 5 handler lift)



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
      />

      {/* ── SCHEDULE ── (extracted to ./NewTask/components/ScheduleSection.tsx) */}
      <ScheduleSection
        t={t}
        createdDisplay={createdDisplay}
        dueDate={dueDate}
        setDueDate={setDueDate}
        notes={notes}
        setNotes={setNotes}
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


