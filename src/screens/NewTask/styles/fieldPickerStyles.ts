// src/screens/NewTask/styles/fieldPickerStyles.ts
//
// Shared StyleSheet used by FieldPickerModal + FieldTypePickerModal.
// Lifted from NewTaskScreen as part of Phase 3 — both modals consume it
// directly so the parent doesn't need to drill it through props.

import { StyleSheet } from 'react-native';
import { theme } from '../../../theme';

export const fp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.color.overlayDark, justifyContent: 'flex-start', paddingTop: 60 },
  sheet: {
    backgroundColor: theme.color.bgSurface, borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20, maxHeight: '75%', paddingBottom: 32,
    ...theme.shadow.modal, zIndex: theme.zIndex.modal,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.space4, borderBottomWidth: 1, borderBottomColor: theme.color.border,
  },
  title:  { ...theme.typography.body, color: theme.color.textPrimary, fontSize: 16, fontWeight: '700' },
  close:  { color: theme.color.textSecondary, fontSize: 20 },
  hint: {
    ...theme.typography.label, color: theme.color.textMuted,
    paddingHorizontal: theme.spacing.space4, paddingTop: 10, paddingBottom: 4,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space3,
    paddingHorizontal: theme.spacing.space4, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.color.bgBase,
  },
  optionIcon: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary + '22',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: theme.color.primary + '33',
  },
  optionIconText:      { fontSize: 15 },
  optionLabel:         { ...theme.typography.body, color: theme.color.textPrimary, fontWeight: '600' },
  optionType:          { ...theme.typography.caption, color: theme.color.textMuted, marginTop: 1 },
  required: {
    color: theme.color.danger, fontSize: theme.typography.sectionDivider.fontSize, fontWeight: '700',
    backgroundColor: theme.color.danger + '22', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: theme.radius.sm - 2,
  },
  optionAdd:    { color: theme.color.primary, fontSize: 22, fontWeight: '700' },
  empty:        { ...theme.typography.body, color: theme.color.textMuted, textAlign: 'center', padding: 24 },
  sectionLabel: {
    ...theme.typography.sectionDivider, color: theme.color.border,
    paddingHorizontal: theme.spacing.space4, paddingTop: 14, paddingBottom: 4,
  },
  createToggle: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.space3,
    paddingHorizontal: theme.spacing.space4, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.color.bgBase,
  },
  createToggleText: { ...theme.typography.body, color: theme.color.primary, fontWeight: '700', flex: 1 },
  createForm: {
    margin: theme.spacing.space3, backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.lg, padding: 14, gap: theme.spacing.space3,
    borderWidth: 1, borderColor: theme.color.border,
  },
  createField: { gap: 6 },
  createLabel: { ...theme.typography.sectionDivider, color: theme.color.textSecondary, letterSpacing: 1 },
  createInput: {
    backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3, paddingVertical: 11,
    color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize,
    borderWidth: 1, borderColor: theme.color.border,
  },
  typeSelectBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.bgSurface,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.space3, paddingVertical: 11,
    borderWidth: 1, borderColor: theme.color.border, gap: 10,
  },
  typeSelectIcon:    { fontSize: 16, width: 22, textAlign: 'center' },
  typeSelectName:    { flex: 1, color: theme.color.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  typeSelectChevron: { color: theme.color.textMuted, fontSize: 20 },
  createSwitchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.color.bgSurface, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.space3, paddingVertical: 11,
    borderWidth: 1, borderColor: theme.color.border,
  },
  createSaveBtn: {
    backgroundColor: theme.color.primary, borderRadius: theme.radius.md,
    paddingVertical: 13, alignItems: 'center',
  },
  createSaveBtnDisabled:  { opacity: 0.6 },
  createSaveBtnText:      { ...theme.typography.body, color: theme.color.white, fontWeight: '700' },
  optionSelected:         { backgroundColor: theme.color.primary + '11' },
  optionLabelSelected:    { color: theme.color.primaryText },
  optionCheck:            { color: theme.color.success, fontSize: 18 },
});
