// src/screens/NewTask/components/PickerModal.tsx
//
// Generic searchable picker bottom-sheet. Used throughout NewTaskScreen for
// client / service / stage selection. Pre-existing component lifted as-is —
// styles travel with it.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  KeyboardAvoidingView, StyleSheet,
} from 'react-native';
import { theme } from '../../../theme';
import { useTranslation } from '../../../lib/i18n';

export interface PickerItem { id: string; label: string; subtitle?: string }

interface Props {
  visible: boolean;
  title: string;
  items: PickerItem[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
  search?: boolean;
  multiSelect?: boolean;
  selectedIds?: string[];
  onItemAction?: (item: PickerItem) => void;
  itemActionLabel?: string;
  onItemDelete?: (item: PickerItem) => void;
  onAddNew?: (initialName?: string) => void;
  addNewLabel?: string;
}

export function PickerModal({
  visible, title, items, onSelect, onClose, search, multiSelect, selectedIds,
  onItemAction, itemActionLabel, onItemDelete, onAddNew, addNewLabel,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const filtered = query
    ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={ms.sheetHeader}>
            <Text style={ms.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={() => { setQuery(''); onClose(); }}>
              <Text style={ms.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          {multiSelect && (
            <Text style={ms.multiHint}>{t('tapToAddStagesToRoute')}</Text>
          )}
          {search && (
            <TextInput
              style={ms.sheetSearch}
              value={query}
              onChangeText={setQuery}
              placeholder={t('searchInput')}
              placeholderTextColor={theme.color.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              onAddNew && query.trim() ? (
                <TouchableOpacity
                  style={ms.addNewBtn}
                  onPress={() => { setQuery(''); onClose(); onAddNew(query.trim()); }}
                >
                  <Text style={ms.addNewBtnText}>＋ Create "{query.trim()}" as new client</Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = selectedIds?.includes(item.id);
              return (
                <View style={[ms.sheetItem, isSelected && ms.sheetItemSelected]}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      onSelect(item);
                      if (!multiSelect) { setQuery(''); onClose(); }
                    }}
                  >
                    <View style={ms.sheetItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[ms.sheetItemLabel, isSelected && ms.sheetItemLabelSelected]}>
                          {item.label}
                        </Text>
                        {item.subtitle && (
                          <Text style={ms.sheetItemSub}>{item.subtitle}</Text>
                        )}
                      </View>
                      {isSelected && !onItemAction && <Text style={ms.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  {(onItemAction || onItemDelete) && (
                    <View style={ms.itemActions}>
                      {onItemAction && (
                        <TouchableOpacity
                          style={ms.itemActionBtn}
                          onPress={() => { onItemAction(item); setQuery(''); onClose(); }}
                        >
                          <Text style={ms.itemActionBtnText}>{itemActionLabel ?? '✎'}</Text>
                        </TouchableOpacity>
                      )}
                      {onItemDelete && (
                        <TouchableOpacity
                          style={ms.itemDeleteBtn}
                          onPress={() => onItemDelete(item)}
                        >
                          <Text style={ms.itemDeleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />
          {onAddNew && (
            <TouchableOpacity
              style={ms.addNewFooterBtn}
              onPress={() => { setQuery(''); onClose(); onAddNew(undefined); }}
            >
              <Text style={ms.addNewFooterBtnText}>＋ {addNewLabel ?? t('createBtn')}</Text>
            </TouchableOpacity>
          )}
          {multiSelect && (
            <TouchableOpacity style={ms.doneBtn} onPress={() => { setQuery(''); onClose(); }}>
              <Text style={ms.doneBtnText}>{t('done')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-start', paddingTop: 60 },
  sheet: {
    backgroundColor:         theme.color.bgSurface,
    borderBottomLeftRadius:  20,
    borderBottomRightRadius: 20,
    maxHeight:               '80%',
    paddingBottom:           theme.spacing.space2,
    ...theme.shadow.modal,
    zIndex:                  theme.zIndex.modal,
  },
  sheetHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    padding:           theme.spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  sheetTitle:  { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  closeBtn:    { color: theme.color.textSecondary, fontSize: 20, padding: 4 },
  multiHint: {
    ...theme.typography.label,
    color:             theme.color.textMuted,
    paddingHorizontal: theme.spacing.space4,
    paddingTop:        10,
    paddingBottom:     2,
  },
  sheetSearch: {
    margin:            theme.spacing.space3,
    backgroundColor:   theme.color.bgBase,
    borderRadius:      theme.radius.md,
    paddingHorizontal: theme.spacing.space3,
    paddingVertical:   10,
    color:             theme.color.textPrimary,
    fontSize:          theme.typography.body.fontSize,
    borderWidth:       1,
    borderColor:       theme.color.border,
  },
  sheetItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: theme.spacing.space4,
    paddingVertical:   theme.spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.bgBase,
  },
  sheetItemSelected:      { backgroundColor: theme.color.primary + '11' },
  sheetItemRow:           { flexDirection: 'row', alignItems: 'center' },
  sheetItemLabel:         { color: theme.color.textPrimary, fontSize: 15, fontWeight: '600' },
  sheetItemLabelSelected: { color: theme.color.primaryText },
  sheetItemSub:           { ...theme.typography.label, color: theme.color.textSecondary, marginTop: 2 },
  checkmark:              { color: theme.color.primary, fontSize: 18, fontWeight: '700', marginStart: theme.spacing.space2 },
  itemActions:            { flexDirection: 'row', alignItems: 'center', marginStart: theme.spacing.space2 },
  itemActionBtn: {
    backgroundColor: theme.color.primary + '22',
    borderRadius:    theme.radius.sm,
    paddingHorizontal: theme.spacing.space2,
    paddingVertical: 4,
    borderWidth:     1,
    borderColor:     theme.color.primary + '55',
    marginEnd:       theme.spacing.space1 + 2,
  },
  itemActionBtnText: { ...theme.typography.caption, color: theme.color.primaryText, fontWeight: '700' },
  itemDeleteBtn:     { padding: 4 },
  itemDeleteBtnText: { color: theme.color.danger, fontSize: 16 },
  doneBtn: {
    margin:          theme.spacing.space3,
    backgroundColor: theme.color.primary,
    borderRadius:    theme.radius.lg,
    paddingVertical: 14,
    alignItems:      'center',
  },
  doneBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },
  addNewBtn: {
    margin:            theme.spacing.space4,
    backgroundColor:   theme.color.primary + '14',
    borderRadius:      theme.radius.lg,
    paddingVertical:   14,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       theme.color.primary + '55',
    borderStyle:       'dashed',
  },
  addNewBtnText: { color: theme.color.primaryText, fontSize: 15, fontWeight: '700' },
  addNewFooterBtn: {
    marginHorizontal:  theme.spacing.space4,
    marginTop:         theme.spacing.space2,
    marginBottom:      theme.spacing.space3,
    backgroundColor:   theme.color.primary,
    borderRadius:      theme.radius.lg,
    paddingVertical:   14,
    alignItems:        'center',
  },
  addNewFooterBtnText: { color: theme.color.white, fontSize: 15, fontWeight: '700' },
});
