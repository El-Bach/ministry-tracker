// src/components/PlanWarningModal.tsx
// Dismissible bottom-sheet warning shown on every app launch during the
// 3-day grace period (limit exceeded but not yet locked).

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { theme } from '../theme';
import { SUPPORT_EMAIL } from '../lib/config';
import { useTranslation } from '../lib/i18n';

interface Props {
  visible: boolean;
  daysRemaining: number;
  planName: string;
  limitType: 'files' | 'members' | 'both';
  limitValue: number;
  currentCount: number;
  isOwner: boolean;
  orgName: string;
  ownerEmail: string;
  ownerPhone?: string;
  onDismiss: () => void;
}

export function PlanWarningModal({
  visible,
  daysRemaining,
  planName,
  limitType,
  limitValue,
  currentCount,
  isOwner,
  orgName,
  ownerEmail,
  ownerPhone,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const resourceLabel = limitType === 'members' ? t('teamMember') : t('files');

  const handleUpgrade = () => {
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to upgrade my GovPilot account.\n\nOrganization: ${orgName}\nEmail: ${ownerEmail}\nMobile: ${ownerPhone ?? '—'}`,
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Upgrade GovPilot Plan&body=${body}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={s.sheet}>

          {/* Dismiss X */}
          <TouchableOpacity style={s.closeBtn} onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {/* Icon + title */}
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.title}>{t('planLimitReached')}</Text>

          {/* Body */}
          <Text style={s.body}>
            {t('planLimitBody').replace('{count}', `${limitValue}`)}{' '}({resourceLabel})
            {'\n\n'}
            {daysRemaining > 0
              ? t('planGraceBody').replace('{days}', `${daysRemaining}`)
              : t('planGraceBody').replace('{days}', '0')}
          </Text>

          {/* Countdown pill */}
          <View style={s.pill}>
            <Text style={s.pillText}>
              🕐 {daysRemaining > 0 ? `${daysRemaining} ${t('planLimitChip')}` : t('planLimitChip')}
            </Text>
          </View>

          {/* CTA */}
          {isOwner ? (
            <TouchableOpacity style={s.upgradeBtn} onPress={handleUpgrade} activeOpacity={0.85}>
              <Text style={s.upgradeBtnText}>{t('planUpgradeNow')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.nonOwnerBox}>
              <Text style={s.nonOwnerText}>
                {t('contactSupport')}
              </Text>
            </View>
          )}

          {/* Dismiss link */}
          <TouchableOpacity style={s.remindBtn} onPress={onDismiss}>
            <Text style={s.remindBtnText}>{t('planRemindLater')}</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.color.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.space6,
    paddingBottom: 40,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: theme.spacing.space4,
    right: theme.spacing.space4,
  },
  closeBtnText: {
    color: theme.color.textMuted,
    fontSize: 18,
  },
  icon: {
    fontSize: 48,
    marginBottom: theme.spacing.space3,
    marginTop: theme.spacing.space2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.color.textPrimary,
    marginBottom: theme.spacing.space3,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: theme.color.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: theme.spacing.space4,
  },
  bold: {
    fontWeight: '700',
    color: theme.color.textPrimary,
  },
  pill: {
    backgroundColor: '#78350f22',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: theme.spacing.space5,
    borderWidth: 1,
    borderColor: '#92400e44',
  },
  pillText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 14,
  },
  upgradeBtn: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: theme.spacing.space3,
  },
  upgradeBtnText: {
    color: theme.color.white,
    fontSize: 16,
    fontWeight: '800',
  },
  nonOwnerBox: {
    backgroundColor: theme.color.bgBase,
    borderRadius: theme.radius.md,
    padding: theme.spacing.space4,
    alignSelf: 'stretch',
    marginBottom: theme.spacing.space3,
  },
  nonOwnerText: {
    color: theme.color.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  remindBtn: {
    paddingVertical: 10,
  },
  remindBtnText: {
    color: theme.color.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
