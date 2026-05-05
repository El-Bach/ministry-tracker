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
        s={s}
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
        s={s}
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
        s={s}
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
        s={s}
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
        s={s}
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
        s={s}
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
