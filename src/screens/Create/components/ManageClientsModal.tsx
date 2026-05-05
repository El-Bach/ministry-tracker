// src/screens/Create/components/ManageClientsModal.tsx
//
// List view for managing clients — search, +Add, ✎Edit (navigates to
// EditClient), ✕Delete. Phase 2b extraction from CreateScreen.

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView,
  Alert, Linking,
} from 'react-native';
import { theme } from '../../../theme';
import { s } from '../styles/createStyles';
import { formatPhoneDisplay } from '../../../lib/phone';
import { Client } from '../../../types';

function openPhone(phone: string, name?: string) {
  if (!phone) return;
  const clean = phone.replace(/[^0-9+]/g, '');
  Alert.alert(name ?? phone, phone, [
    { text: '📞 Phone Call', onPress: () => Linking.openURL(`tel:${clean}`) },
    { text: '💬 WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${clean.replace(/^\+/, '')}`) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

interface Props {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;

  clients: Client[];
  clientSearch: string;
  setClientSearch: (v: string) => void;

  /** Permissions object — only `can_edit_delete_clients` is read here. */
  permissions: { can_edit_delete_clients?: boolean };

  openNewClientForm: () => void;
  handleDeleteClient: (client: Client) => void;
  /** Tap ✎ on a row → navigate to EditClient with the client id. */
  onEditClient: (clientId: string) => void;

}

export function ManageClientsModal(props: Props) {
  const {
    visible, onClose, t,
    clients, clientSearch, setClientSearch,
    permissions, openNewClientForm, handleDeleteClient, onEditClient,
  } = props;

  const filterFn = (c: Client) =>
    !clientSearch.trim() ||
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.phone ?? '').includes(clientSearch);

  const filtered = clients.filter(filterFn);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { onClose(); setClientSearch(''); }}
    >
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-start', paddingTop: 60 }}>
          <View style={[s.modalSheet, { maxHeight: '82%' }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{t('clients')}</Text>
                <Text style={s.modalSubtitle}>
                  {clientSearch
                    ? `${filtered.length} of ${clients.length}`
                    : `${clients.length} total`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  style={s.modalAddBtn}
                  onPress={() => { onClose(); setClientSearch(''); openNewClientForm(); }}
                >
                  <Text style={s.modalAddBtnText}>+ {t('add')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onClose(); setClientSearch(''); }}>
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
              ) : filtered.length === 0 ? (
                <Text style={s.mgmtEmpty}>No clients match "{clientSearch}"</Text>
              ) : filtered.map((c) => (
                <View key={c.id} style={s.mgmtClientRow}>
                  <View style={s.mgmtClientAvatar}>
                    <Text style={s.mgmtClientAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.mgmtItemName}>{c.name}</Text>
                    {!!(c as any).reference_name && (
                      <Text style={s.mgmtItemRef}>عبر {(c as any).reference_name}</Text>
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
                      onPress={() => { onClose(); onEditClient(c.id); }}
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
  );
}
