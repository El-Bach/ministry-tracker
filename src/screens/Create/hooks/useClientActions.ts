// src/screens/Create/hooks/useClientActions.ts
//
// Client handlers extracted from CreateScreen — Phase 5d.
// Owns: open new-client form, insert (with duplicate check), delete, plus
// the Excel-paste import flow with skip-duplicates handling. State stays
// in the parent.

import { Alert, Platform } from 'react-native';
import supabase from '../../../lib/supabase';
import { Client } from '../../../types';
import { DEFAULT_COUNTRY } from '../../../components/PhoneInput';

interface ClientImportRow { name: string; phone: string; refName: string; refPhone: string }

export interface UseClientActionsOptions {
  orgId: string;
  t: (key: any) => string;
  fetchData: () => void;

  // New-client form fields
  newClientName: string;
  newClientPhone: string;
  newClientPhoneCountry: string;
  newClientRefName: string;
  newClientRefPhone: string;
  newClientRefPhoneCountry: string;
  setNewClientName: (v: string) => void;
  setNewClientPhone: (v: string) => void;
  setNewClientPhoneCountry: (v: string) => void;
  setNewClientRefName: (v: string) => void;
  setNewClientRefPhone: (v: string) => void;
  setNewClientRefPhoneCountry: (v: string) => void;

  // Custom client field defs/values
  clientFormFieldDefs: any[];
  clientFormFieldValues: Record<string, string>;
  setClientFormFieldDefs: (v: any[]) => void;
  setClientFormFieldValues: (v: Record<string, string>) => void;
  setLoadingClientFields: (v: boolean) => void;

  // Form open + save
  setShowClientForm: (v: boolean) => void;
  setSavingClient: (v: boolean) => void;

  // Excel import
  clientImportRows: ClientImportRow[];
  setClientImportRaw: (v: string) => void;
  setClientImportRows: (v: ClientImportRow[]) => void;
  setShowClientImport: (v: boolean) => void;
  setImportingClients: (v: boolean) => void;
  setClients: (
    updater: Client[] | ((prev: Client[]) => Client[]),
  ) => void;
}

export function useClientActions(opts: UseClientActionsOptions) {
  const {
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
  } = opts;

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

  // Insert path — pulled out because the duplicate-check Alert needs to be
  // able to confirm and re-run insertion with the original payload.
  const doInsertClient = async () => {
    setSavingClient(true);
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
        org_id:          orgId,
      })
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

  const handleCreateClientWithFields = async () => {
    if (!newClientName.trim()) { Alert.alert(t('required'), t('fieldRequired')); return; }
    setSavingClient(true);

    // Duplicate check — same name OR same phone
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
        ],
      );
      return;
    }

    doInsertClient();
  };

  const handleDeleteClient = (c: Client) => {
    const doDelete = async () => {
      await supabase.from('clients').delete().eq('id', c.id);
      fetchData();
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Delete "${c.name}"? This cannot be undone.`)) doDelete();
    } else {
      Alert.alert(`${t('delete')} ${t('clients')}`, `Delete "${c.name}"? This cannot be undone.`, [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Excel import — skip-duplicates flow ──────────────────────────────────
  const parseClientImport = (raw: string): ClientImportRow[] =>
    raw.split(/\r?\n/).map(l => {
      const c = l.split('\t');
      return {
        name:     (c[0] ?? '').trim(),
        phone:    (c[1] ?? '').trim(),
        refName:  (c[2] ?? '').trim(),
        refPhone: (c[3] ?? '').trim(),
      };
    }).filter(r => r.name);

  const handleImportClients = async () => {
    if (!clientImportRows.length) return;
    setImportingClients(true);

    // Pull existing clients once and dedupe in-memory
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
      name:            r.name,
      client_id:       `CLT-${Date.now()}-${i}`,
      phone:           r.phone || null,
      reference_name:  r.refName || null,
      reference_phone: r.refPhone || null,
      org_id:          orgId,
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

  return {
    openNewClientForm,
    handleCreateClientWithFields,
    handleDeleteClient,
    parseClientImport,
    handleImportClients,
  };
}
