import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { confirmDialog } from '@/components/confirm';
import { RewardIcon } from '@/components/RewardIcon';
import { canAfford, recentRequests } from '@/domain/rewards';
import { useChildVoice } from '@/hooks/useChildVoice';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useCancelRequest, useProjectedBalance, useRequestReward, useRequests, useRewards } from '@/hooks/usePoints';
import { useOnline } from '@/hooks/useSyncStatus';
import { V2Button } from '@/v2/components/V2Button';
import { RewardConfirmSheet, type RewardChoice } from '@/v2/components/RewardConfirmSheet';
import { V2Screen } from '@/v2/components/V2Screen';
import { v2Card, v2Colors, v2Spacing, v2Text, V2_TOUCH } from '@/v2/theme';

/** Phần thưởng (enfant, V2) : mes points et les récompenses à demander. Logique de la V1 (`more/points`), nouvel habillage. */
export default function V2ChildRewards() {
  const { t } = useTranslation();
  const d = useDisplayedChild();
  const online = useOnline();
  const childId = d?.child?.id ?? null;
  const balance = useProjectedBalance(childId, 'child');
  const rewards = useRewards();
  const requests = useRequests(childId);
  const request = useRequestReward();
  const cancel = useCancelRequest();
  const voice = useChildVoice();
  const [choice, setChoice] = useState<RewardChoice | null>(null);
  if (!d || !d.child) return null;
  const child = d.child;
  const now = new Date();
  const mine = recentRequests((requests.data ?? []).filter((r) => r.child_id === childId), now);
  const visible = (rewards.data ?? []).filter((r) => r.child_id === null || r.child_id === childId);
  const send = (r: RewardChoice) => {
    setChoice(null);
    request.mutate({ rewardId: r.id, childId: child.id, title: r.title, cost: r.cost, requestId: newId() });
  };
  const askCancel = (id: string, title: string, cost: number) =>
    confirmDialog({
      title: t('v2.rewards.cancel.title'),
      message: t('v2.rewards.cancel.body', { title, cost, context: voice }),
      confirmLabel: t('v2.rewards.cancel.ok'),
      cancelLabel: t('v2.rewards.cancel.keep'),
      destructive: true,
      onConfirm: () => cancel.mutate(id),
    });

  return (
    <V2Screen title={t('v2.tabs.rewards')} testID="v2-rewards">
      <View style={[v2Card, styles.balance]}>
        <View style={styles.medal}>
          <Star color={v2Colors.onPrimary} fill={v2Colors.onPrimary} size={28} />
        </View>
        <View style={styles.flex}>
          {/* solde DISPONIBLE (D-112) : une demande en attente réserve ses points tout de suite (débités à la validation du parent) */}
          <Text style={styles.big} accessibilityLabel={`${balance?.available ?? 0} ${t('points.unit')}`} testID="v2-rewards-available">
            {balance?.available ?? 0} <Text style={v2Text.bodyBold}>{t('points.unit')}</Text>
          </Text>
          <Text style={v2Text.caption}>{t('v2.rewards.availableLabel')}</Text>
          {(balance?.reserved ?? 0) > 0 ? <Text style={styles.pending}>{t('v2.rewards.reservedLine', { points: balance?.reserved })}</Text> : null}
          {(balance?.pendingTaskPoints ?? 0) > 0 ? <Text style={styles.pending}>{t('points.pendingTasks', { points: balance?.pendingTaskPoints })}</Text> : null}
        </View>
      </View>

      <Text accessibilityRole="header" style={v2Text.heading}>
        {t('points.rewardsTitle')}
      </Text>
      {!online ? <Text style={styles.offline}>{t('points.needsNetwork')}</Text> : null}
      <View style={[v2Card, styles.list]}>
        {visible.length === 0 ? <Text style={v2Text.body}>{t('v2.rewards.empty')}</Text> : null}
        {visible.map((r) => {
          const affordable = balance ? canAfford(balance.available, r.cost) : false;
          // ouverte même sans assez de points : la feuille dit combien il en manque (réseau exigé pour demander)
          const can = online && balance !== null;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}, ${r.cost} ${t('points.unit')}${!affordable ? `, ${t('points.notEnough')}` : ''}`}
              accessibilityState={{ disabled: !can }}
              disabled={!can}
              onPress={() => setChoice({ id: r.id, title: r.title, icon: r.icon, cost: r.cost })}
              testID={`v2-reward-${r.id}`}
              style={[styles.reward, !affordable ? styles.dim : null]}
            >
              <View style={styles.icon}>
                <RewardIcon name={r.icon} color={affordable ? v2Colors.primary : v2Colors.textSecondary} />
              </View>
              <Text style={[v2Text.bodyBold, styles.flex]}>{r.title}</Text>
              <Text style={styles.cost}>
                {r.cost} {t('points.unit')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mine.length > 0 ? (
        <>
          <Text accessibilityRole="header" style={v2Text.heading}>
            {t('points.requestsTitle')}
          </Text>
          {mine.map((r) => (
            <View key={r.id} style={[v2Card, styles.request]} testID={`v2-request-${r.id}`}>
              <Text style={v2Text.bodyBold}>{r.reward_title}</Text>
              <Text style={v2Text.caption}>
                {t(`points.status.${r.status}`)} · {r.cost} {t('points.unit')}
                {r.status === 'rejected' && r.decision_note ? ` · ${r.decision_note}` : ''}
              </Text>
              {r.status === 'pending' ? (
                <V2Button variant="secondary" label={t('points.cancelRequest')} onPress={() => askCancel(r.id, r.reward_title, r.cost)} disabled={!online} testID={`v2-cancel-request-${r.id}`} />
              ) : null}
            </View>
          ))}
        </>
      ) : null}
      <RewardConfirmSheet reward={choice} available={balance?.available ?? 0} onSend={send} onClose={() => setChoice(null)} />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.lg },
  medal: { width: 60, height: 60, borderRadius: 30, backgroundColor: v2Colors.primary, alignItems: 'center', justifyContent: 'center' },
  big: { ...v2Text.title, fontSize: 34 },
  pending: { ...v2Text.caption, color: v2Colors.pending },
  offline: { ...v2Text.small, color: v2Colors.danger },
  list: { paddingVertical: v2Spacing.sm, gap: v2Spacing.xs },
  reward: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: 60 },
  dim: { opacity: 0.55 },
  icon: { width: V2_TOUCH, height: V2_TOUCH, borderRadius: V2_TOUCH / 2, backgroundColor: v2Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cost: { ...v2Text.bodyBold, color: v2Colors.energyText },
  request: { gap: v2Spacing.sm },
});
