// src/screens/Create/hooks/useNetworkActions.ts
//
// Network (people directory) handlers extracted from CreateScreen — Phase 5a.
//
// State stays in CreateScreen (parent owns it) so this hook reads + writes
// it through an Options bag of refs and setters. Returns the 6 handlers
// the NetworkModal component already expects via its Props interface, so
// CreateScreen just spreads them into the modal.

import { Alert } from 'react-native';
import supabase from '../../../lib/supabase';

interface ImportRow { name: string; phone: string; reference: string }

export interface UseNetworkActionsOptions {
  // Identity / translation
  orgId: string;
  t: (key: any) => string;

  // Network list state
  setNetwork: (
    updater: any[] | ((prev: any[]) => any[]),
  ) => void;

  // Form state — read for save, written for open/close
  netName: string;
  netPhone: string;
  netReference: string;
  netRefPhone: string;
  netCityId: string | null;
  setNetName: (v: string) => void;
  setNetPhone: (v: string) => void;
  setNetReference: (v: string) => void;
  setNetRefPhone: (v: string) => void;
  setNetCityId: (v: string | null) => void;
  editNetworkId: string | null;
  setEditNetworkId: (v: string | null) => void;
  setShowNetworkForm: (v: boolean) => void;
  setSavingNetwork: (v: boolean) => void;

  // Side-state cleared on form open
  setNetFieldValues: (v: Record<string, string>) => void;
  setNetAddedFieldIds: (v: string[]) => void;
  setShowNetFieldPicker: (v: boolean) => void;
  setNetFieldSearch: (v: string) => void;
  setNetCitySearch: (v: string) => void;
  setShowNetCityPicker: (v: boolean) => void;
  setNetDatePickerFieldId: (v: string | null) => void;
  setNetDatePickerMonthYear: (v: boolean) => void;
  setNetDatePickerCurrent: (v: string | undefined) => void;

  // Excel import
  importRows: ImportRow[];
  setImportRaw: (v: string) => void;
  setImportRows: (v: ImportRow[]) => void;
  setShowImportModal: (v: boolean) => void;
  setImportingContacts: (v: boolean) => void;
}

export function useNetworkActions(opts: UseNetworkActionsOptions) {
  const {
    orgId, t,
    setNetwork,
    netName, netPhone, netReference, netRefPhone, netCityId,
    setNetName, setNetPhone, setNetReference, setNetRefPhone, setNetCityId,
    editNetworkId, setEditNetworkId, setShowNetworkForm, setSavingNetwork,
    setNetFieldValues, setNetAddedFieldIds, setShowNetFieldPicker, setNetFieldSearch,
    setNetCitySearch, setShowNetCityPicker,
    setNetDatePickerFieldId, setNetDatePickerMonthYear, setNetDatePickerCurrent,
    importRows, setImportRaw, setImportRows, setShowImportModal, setImportingContacts,
  } = opts;

  // Loose substring match across all of a contact's text fields.
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

  const openNetworkForm = async (contact?: any) => {
    // Reset side-state every time the form opens — keeps add/edit cleanly separated
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
    if (editNetworkId) {
      await supabase.from('assignees').update(payload).eq('id', editNetworkId);
    } else {
      const { data: newContact, error } = await supabase.from('assignees').insert(payload).select().single();
      if (error || !newContact) { setSavingNetwork(false); Alert.alert(t('error'), error?.message ?? t('failedToSave')); return; }
    }
    setSavingNetwork(false);
    setShowNetworkForm(false);
    setEditNetworkId(null);
    const { data } = await supabase.from('assignees').select('*, city:cities(id,name)').order('name');
    if (data) setNetwork(data as any[]);
  };

  const handleDeleteNetworkContact = (contact: any) => {
    Alert.alert(`${t('delete')} ${t('network')}`, `Delete "${contact.name}"?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          await supabase.from('assignees').delete().eq('id', contact.id);
          setNetwork((prev: any[]) => prev.filter((n: any) => n.id !== contact.id));
        },
      },
    ]);
  };

  // Excel-paste parser: tab-separated (name, phone, reference) per line.
  const parseImportText = (raw: string): ImportRow[] => {
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

  return {
    matchesNetworkSearch,
    openNetworkForm,
    handleSaveNetworkContact,
    handleDeleteNetworkContact,
    parseImportText,
    handleImportContacts,
  };
}
