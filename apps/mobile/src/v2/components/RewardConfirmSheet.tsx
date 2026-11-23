import { Gift } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { RewardIcon } from '@/components/RewardIcon';
import { exchangePreview } from '@/domain/reward-exchange';
import { v2Colors, v2Radius, v2Spacing, v2Text, V2_TOUCH } from '../theme';
import { ConfirmSheet } from './ConfirmSheet';

export type RewardChoice = { id: string; title: string; icon: string; cost: number };

type Props = {
  reward: RewardChoice | null;
  /** solde DISPONIBLE (solde − demandes en attente, serveur) */
  available: number;
  onSend: (reward: RewardChoice) => void;
  onClose: () => void;
};

/**
 * Échange d'une récompense (enfant, V2, D-111) : icône cadeau, récompense et coût, « Hiện có X → Còn lại Y » calculé sur le solde DISPONIBLE
 * (`exchangePreview`) ; points insuffisants = « còn thiếu N điểm » et un seul bouton « Đóng ».
 */
export function RewardConfirmSheet({ reward, available, onSend, onClose }: Props) {
  const { t } = useTranslation();
  if (!reward) return null;
  const p = exchangePreview(available, reward.cost);
  const actions = p.affordable
    ? [
        { label: t('v2.rewards.exchange.send'), variant: 'primary' as const, testID: 'reward-confirm-send', onPress: () => onSend(reward) },
        { label: t('v2.rewards.exchange.later'), variant: 'secondary' as const, testID: 'reward-confirm-later', onPress: onClose },
      ]
    : [{ label: t('v2.rewards.exchange.close'), variant: 'secondary' as const, testID: 'reward-confirm-close', onPress: onClose }];
  return (
    <ConfirmSheet visible onClose={onClose} title={t('v2.rewards.exchange.title')} icon={<Gift color={v2Colors.primary} size={32} />} actions={actions} testID="reward-confirm">
      <View style={styles.reward}>
        <View style={styles.rewardIcon}>
          <RewardIcon name={reward.icon} color={v2Colors.primary} />
        </View>
        <Text style={[v2Text.bodyBold, styles.flex]}>{reward.title}</Text>
        <Text style={styles.cost}>
          {reward.cost} {t('points.unit')}
        </Text>
      </View>
      {p.affordable ? (
        <>
          <Text style={styles.balance} accessibilityLabel={t('v2.rewards.exchange.balanceA11y', { have: p.have, after: p.after })} testID="reward-confirm-balance">
            {t('v2.rewards.exchange.balance', { have: p.have, after: p.after })}
          </Text>
          <Text style={styles.note}>{t('v2.rewards.exchange.note')}</Text>
        </>
      ) : (
        <Text style={styles.missing} accessibilityRole="alert" testID="reward-confirm-missing">
          {t('v2.rewards.exchange.missing', { count: p.missing })}
        </Text>
      )}
    </ConfirmSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v2Spacing.md,
    backgroundColor: v2Colors.cardMuted,
    borderRadius: v2Radius.control,
    padding: v2Spacing.md,
  },
  rewardIcon: { width: V2_TOUCH, height: V2_TOUCH, borderRadius: V2_TOUCH / 2, backgroundColor: v2Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cost: { ...v2Text.bodyBold, color: v2Colors.energyText },
  balance: { ...v2Text.bodyBold, textAlign: 'center' },
  note: { ...v2Text.small, color: v2Colors.textSecondary, textAlign: 'center' },
  missing: { ...v2Text.bodyBold, color: v2Colors.danger, textAlign: 'center' },
});
