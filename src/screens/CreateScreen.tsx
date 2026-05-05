// src/screens/CreateScreen.tsx
// Create tab: quick-action cards + full manage section (clients / services / stages)

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
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

import { useCameraPermissions } from 'expo-camera';
import supabase from '../lib/supabase';
import { useTranslation, formatNumber, t as tStatic } from '../lib/i18n';
import { theme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { Client, Service, Ministry, ServiceDocument, ServiceDocumentRequirement, MainTabParamList } from '../types';
import { formatPhoneDisplay } from '../lib/phone';
import PhoneInput, { DEFAULT_COUNTRY } from '../components/PhoneInput';
import { MinistryContactsSheet } from '../components/MinistryContactsSheet';
import { NetworkModal } from './Create/components/NetworkModal';
import { IdScannerModal } from './Create/components/IdScannerModal';
import { ManageClientsModal } from './Create/components/ManageClientsModal';
import { NewClientForm } from './Create/components/NewClientForm';
import { ManageServicesModal } from './Create/components/ManageServicesModal';
import { ManageStagesModal } from './Create/components/ManageStagesModal';
import { DocumentsRequiredModal } from './Create/components/DocumentsRequiredModal';
import { useNetworkActions } from './Create/hooks/useNetworkActions';
import { useDocsActions } from './Create/hooks/useDocsActions';
import { useStageActions } from './Create/hooks/useStageActions';
import { useClientActions } from './Create/hooks/useClientActions';
import { useServiceActions } from './Create/hooks/useServiceActions';
import { s } from './Create/styles/createStyles';

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

  // (Inline stage-requirements state removed in Phase 5c — dead since the
  // ManageStages modal dropped that inline panel)

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

  // (date-picker state moved to NewClientForm — only used inside that form)

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

  // ── Network actions hook (Phase 5a) ──────────────────────────────────────
  const networkActions = useNetworkActions({
    orgId, t,
    setNetwork,
    netName, netPhone, netReference, netRefPhone, netCityId,
    setNetName, setNetPhone, setNetReference, setNetRefPhone, setNetCityId,
    editNetworkId, setEditNetworkId, setShowNetworkForm, setSavingNetwork,
    setNetFieldValues, setNetAddedFieldIds, setShowNetFieldPicker, setNetFieldSearch,
    setNetCitySearch, setShowNetCityPicker,
    setNetDatePickerFieldId, setNetDatePickerMonthYear, setNetDatePickerCurrent,
    importRows, setImportRaw, setImportRows, setShowImportModal, setImportingContacts,
  });
  const {
    matchesNetworkSearch, openNetworkForm, handleSaveNetworkContact,
    handleDeleteNetworkContact, parseImportText, handleImportContacts,
  } = networkActions;

  // ── Documents-required actions hook (Phase 5b) ──────────────────────────
  const docsActions = useDocsActions({
    orgId, t, teamMember,
    expandedDocSvcId, setExpandedDocSvcId,
    serviceDocs, setServiceDocs,
    newDocTitle, setNewDocTitle, setSavingDoc,
    expandedDocReqId, setExpandedDocReqId,
    docReqs, setDocReqs, setLoadingDocReqs,
    docReqNewTitle, setDocReqNewTitle, setSavingDocReq,
    docImportSvcId, docImportTitles,
    setDocImportSvcId, setDocImportRaw, setDocImportTitles, setImportingDocs,
  });
  const {
    handleToggleDocExpand, handleAddDoc, handleToggleDocCheck, handleDeleteDoc,
    handleResetChecks, handleShareServiceDocsWhatsApp,
    handleToggleDocReqExpand, handleAddDocReq, handleDeleteDocReq,
    parseDocImport, handleImportDocs,
  } = docsActions;

  // ── Stage (Ministry) actions hook (Phase 5c) ─────────────────────────────
  const stageActions = useStageActions({
    orgId, t, fetchData,
    newStageName, setNewStageName, setSavingNewStage,
    editStageId, setEditStageId, editStageName, setSavingEditStage,
    setStageCityPickerId, setStageCitySearch,
    newStageCityName, setNewStageCityName, setShowCreateStageCityForm, setSavingStageCity,
    setAllCities,
    stageImportNames, setStageImportRaw, setStageImportNames,
    setImportingStages, setShowStageImport, setMinistries,
  });
  const {
    handleCreateStage, handleSaveEditStage, handleDeleteStage,
    handleSetStageCity, handleCreateStageCity,
    parseStageImport, handleImportStages,
  } = stageActions;

  // ── Client actions hook (Phase 5d) ───────────────────────────────────────
  const clientActions = useClientActions({
    orgId, t, fetchData,
    newClientName, newClientPhone, newClientPhoneCountry,
    newClientRefName, newClientRefPhone, newClientRefPhoneCountry,
    setNewClientName, setNewClientPhone, setNewClientPhoneCountry,
    setNewClientRefName, setNewClientRefPhone, setNewClientRefPhoneCountry,
    clientFormFieldDefs, clientFormFieldValues,
    setClientFormFieldDefs, setClientFormFieldValues, setLoadingClientFields,
    setShowClientForm, setSavingClient,
    clientImportRows, setClientImportRaw, setClientImportRows,
    setShowClientImport, setImportingClients, setClients,
  });
  const {
    openNewClientForm, handleCreateClientWithFields, handleDeleteClient,
    parseClientImport, handleImportClients,
  } = clientActions;

  // ── Service actions hook (Phase 5d) ──────────────────────────────────────
  const serviceActions = useServiceActions({
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
  });
  const {
    handleCreateService, handleSaveEditService, handleDeleteService,
    handleToggleSvcExpand, handleAddSvcStage, handleAddExistingSvcStage,
    handleRemoveSvcStage, handleMoveSvcStage,
    parseSvcImportText, handleImportServices,
  } = serviceActions;

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

      {/* ── MANAGE CLIENTS MODAL ── (extracted to ./Create/components/ManageClientsModal.tsx) */}
      <ManageClientsModal
        visible={manageSection === 'clients'}
        onClose={() => setManageSection(null)}
        t={t}
        clients={clients}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        permissions={permissions}
        openNewClientForm={openNewClientForm}
        handleDeleteClient={handleDeleteClient}
        onEditClient={(clientId) => (navigation as any).navigate('Dashboard', { screen: 'EditClient', params: { clientId } })}
      />

      {/* ── NEW CLIENT FORM ── (extracted to ./Create/components/NewClientForm.tsx) */}
      <NewClientForm
        visible={showClientForm}
        onClose={() => setShowClientForm(false)}
        t={t}
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
        loadingClientFields={loadingClientFields}
        clientFormFieldDefs={clientFormFieldDefs}
        clientFormFieldValues={clientFormFieldValues}
        setClientFormFieldValues={setClientFormFieldValues}
        savingClient={savingClient}
        handleCreateClientWithFields={handleCreateClientWithFields}
        showClientImport={showClientImport}
        setShowClientImport={setShowClientImport}
        clientImportRaw={clientImportRaw}
        setClientImportRaw={setClientImportRaw}
        clientImportRows={clientImportRows}
        setClientImportRows={setClientImportRows}
        importingClients={importingClients}
        parseClientImport={parseClientImport}
        handleImportClients={handleImportClients}
        scannerPerm={scannerPerm}
        requestScannerPerm={requestScannerPerm}
        setShowIdScanner={setShowIdScanner}
      />

      {/* ── MANAGE SERVICES MODAL ── (extracted to ./Create/components/ManageServicesModal.tsx) */}
      <ManageServicesModal
        visible={manageSection === 'services'}
        onClose={() => setManageSection(null)}
        t={t}
        services={services}
        ministries={ministries}
        serviceSearch={serviceSearch}
        setServiceSearch={setServiceSearch}
        newSvcName={newSvcName}
        setNewSvcName={setNewSvcName}
        newSvcPriceUSD={newSvcPriceUSD}
        setNewSvcPriceUSD={setNewSvcPriceUSD}
        newSvcPriceLBP={newSvcPriceLBP}
        setNewSvcPriceLBP={setNewSvcPriceLBP}
        savingNewSvc={savingNewSvc}
        handleCreateService={handleCreateService}
        editSvcId={editSvcId}
        setEditSvcId={setEditSvcId}
        editSvcName={editSvcName}
        setEditSvcName={setEditSvcName}
        editSvcPriceUSD={editSvcPriceUSD}
        setEditSvcPriceUSD={setEditSvcPriceUSD}
        editSvcPriceLBP={editSvcPriceLBP}
        setEditSvcPriceLBP={setEditSvcPriceLBP}
        savingEditSvc={savingEditSvc}
        handleSaveEditService={handleSaveEditService}
        handleDeleteService={handleDeleteService}
        expandedSvcId={expandedSvcId}
        setExpandedSvcId={setExpandedSvcId}
        svcStages={svcStages}
        loadingSvcStages={loadingSvcStages}
        svcStageNewName={svcStageNewName}
        setSvcStageNewName={setSvcStageNewName}
        savingNewSvcStage={savingNewSvcStage}
        handleToggleSvcExpand={handleToggleSvcExpand}
        handleAddSvcStage={handleAddSvcStage}
        handleAddExistingSvcStage={handleAddExistingSvcStage}
        handleMoveSvcStage={handleMoveSvcStage}
        handleRemoveSvcStage={handleRemoveSvcStage}
        showSvcImportModal={showSvcImportModal}
        setShowSvcImportModal={setShowSvcImportModal}
        svcImportRaw={svcImportRaw}
        setSvcImportRaw={setSvcImportRaw}
        svcImportRows={svcImportRows}
        setSvcImportRows={setSvcImportRows}
        importingServices={importingServices}
        parseSvcImportText={parseSvcImportText}
        handleImportServices={handleImportServices}
      />

      {/* ── MANAGE STAGES MODAL ── (extracted to ./Create/components/ManageStagesModal.tsx) */}
      <ManageStagesModal
        visible={manageSection === 'stages'}
        onClose={() => setManageSection(null)}
        t={t}
        ministries={ministries}
        allCities={allCities}
        stageSearch={stageSearch}
        setStageSearch={setStageSearch}
        newStageName={newStageName}
        setNewStageName={setNewStageName}
        savingNewStage={savingNewStage}
        handleCreateStage={handleCreateStage}
        editStageId={editStageId}
        setEditStageId={setEditStageId}
        editStageName={editStageName}
        setEditStageName={setEditStageName}
        savingEditStage={savingEditStage}
        handleSaveEditStage={handleSaveEditStage}
        handleDeleteStage={handleDeleteStage}
        stageCityPickerId={stageCityPickerId}
        setStageCityPickerId={setStageCityPickerId}
        stageCitySearch={stageCitySearch}
        setStageCitySearch={setStageCitySearch}
        showCreateStageCityForm={showCreateStageCityForm}
        setShowCreateStageCityForm={setShowCreateStageCityForm}
        newStageCityName={newStageCityName}
        setNewStageCityName={setNewStageCityName}
        savingStageCity={savingStageCity}
        handleSetStageCity={handleSetStageCity}
        handleCreateStageCity={handleCreateStageCity}
        setContactsMinistryId={setContactsMinistryId}
        showStageImport={showStageImport}
        setShowStageImport={setShowStageImport}
        stageImportRaw={stageImportRaw}
        setStageImportRaw={setStageImportRaw}
        stageImportNames={stageImportNames}
        setStageImportNames={setStageImportNames}
        importingStages={importingStages}
        parseStageImport={parseStageImport}
        handleImportStages={handleImportStages}
      />

      {/* ── ID / QR SCANNER MODAL ── (extracted to ./Create/components/IdScannerModal.tsx) */}
      <IdScannerModal
        visible={showIdScanner}
        onClose={() => setShowIdScanner(false)}
        t={t}
        onScan={(parsed) => {
          if (parsed.name)  setNewClientName(parsed.name);
          if (parsed.phone) setNewClientPhone(parsed.phone);
        }}
      />

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
      />

      {/* ── DOCUMENTS REQUIRED MODAL ── (extracted to ./Create/components/DocumentsRequiredModal.tsx) */}
      <DocumentsRequiredModal
        visible={manageSection === 'documents'}
        onClose={() => setManageSection(null)}
        t={t}
        services={services}
        serviceDocs={serviceDocs}
        docReqs={docReqs}
        docSearch={docSearch}
        setDocSearch={setDocSearch}
        expandedDocSvcId={expandedDocSvcId}
        setExpandedDocSvcId={setExpandedDocSvcId}
        handleToggleDocExpand={handleToggleDocExpand}
        newDocTitle={newDocTitle}
        setNewDocTitle={setNewDocTitle}
        savingDoc={savingDoc}
        handleAddDoc={handleAddDoc}
        handleToggleDocCheck={handleToggleDocCheck}
        handleDeleteDoc={handleDeleteDoc}
        handleResetChecks={handleResetChecks}
        handleShareServiceDocsWhatsApp={handleShareServiceDocsWhatsApp}
        expandedDocReqId={expandedDocReqId}
        loadingDocReqs={loadingDocReqs}
        docReqNewTitle={docReqNewTitle}
        setDocReqNewTitle={setDocReqNewTitle}
        savingDocReq={savingDocReq}
        handleToggleDocReqExpand={handleToggleDocReqExpand}
        handleAddDocReq={handleAddDocReq}
        handleDeleteDocReq={handleDeleteDocReq}
        docImportSvcId={docImportSvcId}
        setDocImportSvcId={setDocImportSvcId}
        docImportRaw={docImportRaw}
        setDocImportRaw={setDocImportRaw}
        docImportTitles={docImportTitles}
        setDocImportTitles={setDocImportTitles}
        importingDocs={importingDocs}
        parseDocImport={parseDocImport}
        handleImportDocs={handleImportDocs}
      />

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

