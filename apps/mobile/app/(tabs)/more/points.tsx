import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfilePills } from '@/components/ProfilePills';
import { REWARD_TINTS, RewardIcon } from '@/components/RewardIcon';
import { RewardRequestCard } from '@/components/RewardRequestCard';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { todayInTz } from '@/domain/family-time';
import { canAfford, recentRequests, reservedByPending } from '@/domain/rewards';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import {
  useApproveRequest,
  useCancelRequest,
  useProjectedBalance,
  useRejectRequest,
  useRequestReward,
  useRequests,
  useRewards,
} from '@/hooks/usePoints';
import { useApprovalCounts } from '@/hooks/useApprovals';
import { useOnline } from '@/hooks/useSyncStatus';
import { colors, radius, shadow, typography } from '@/theme/tokens';
import type { RewardRequestRow } from '@/types/models';

export default function PointsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const online = useOnline();
  const childId = d?.child?.id ?? null;
  const balance = useProjectedBalance(childId, d?.viewer.role ?? 'child');
  const rewards = useRewards();
  const allRequests = useRequests(d?.viewer.role === 'parent' ? null : childId);
  const counts = useApprovalCounts(d?.viewer.role === 'parent');
  const request = useRequestReward();
  const cancel = useCancelRequest();
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  if (!d || !d.child) return null;

  const now = new Date();
  const isParent = d.viewer.role === 'parent';
  const today = todayInTz(now, d.me.family.timezone);
  const requests = allRequests.data ?? [];
  const pendingQueue = isParent ? requests.filter((r) => r.status === 'pending' && new Date(r.expires_at) > now) : [];
  const myRequests = recentRequests(requests.filter((r) => r.child_id === d.child?.id), now);
  const reserved = balance?.reserved ?? reservedByPending(myRequests, now);
  const childName = (id: string) => d.children.find((c) => c.id === id)?.name ?? '';
  const visibleRewards = (rewards.data ?? []).filter((r) => r.child_id === null || r.child_id === d.child?.id);

  const confirmRequest = (rewardId: string, title: string, cost: number) =>
    Alert.alert(t('points.confirmTitle'), t('points.confirmBody', { title, cost }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('points.confirmYes'), onPress: () => request.mutate(rewardId) },
    ]);

  const renderRequestStatus = (r: RewardRequestRow) => t(`points.status.${r.status}`);

  return (
    <Screen>
      <ScreenHeader title={t('points.title')} />
      {d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={d.child.id} onSelect={d.select} today={today} showName /> : null}

      <Pressable accessibilityRole="button" accessibilityLabel={t('points.history')} onPress={() => router.push('/more/points-history')}>
        <Card>
          <View style={styles.balanceRow}>
            <View style={styles.medal}>
              <Star color="#fff" fill="#fff" size={30} />
            </View>
            <View style={styles.flex}>
              <Text accessibilityLabel={`${balance?.balance ?? 0} ${t('points.unit')}`} style={styles.balance}>
                {balance?.balance ?? 0}
                <Text style={styles.unit}> {t('points.unit')}</Text>
              </Text>
              <Text style={typography.secondary}>{t('points.totalLabel')}</Text>
              {reserved > 0 ? <Text style={styles.reserved}>{t('points.reserved', { reserved })}</Text> : null}
              {(balance?.pendingTaskPoints ?? 0) > 0 ? <Text style={styles.pendingTasks}>{t('points.pendingTasks', { points: balance?.pendingTaskPoints })}</Text> : null}
            </View>
          </View>
        </Card>
      </Pressable>

      {isParent && counts.total > 0 ? (
        <Button variant="secondary" label={t('approvals.openQueue', { count: counts.total })} onPress={() => router.push('/approvals')} />
      ) : null}
      {isParent && pendingQueue.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('points.toApprove', { count: pendingQueue.length })}
          </Text>
          {pendingQueue.map((r) => (
            <RewardRequestCard key={r.id} request={r} childName={childName(r.child_id)} now={now} online={online} busy={approve.isPending} onApprove={() => approve.mutate(r.id)} onReject={(note) => reject.mutate({ id: r.id, note })} />
          ))}
        </View>
      ) : null}

      {isParent ? (
        <Button variant="secondary" label={t('points.adjust')} onPress={() => router.push({ pathname: '/points-adjust', params: { childId: d.child?.id } })} />
      ) : null}

      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {t('points.rewardsTitle')}
      </Text>
      {!online && !isParent && !d.readOnly ? <Text style={styles.offline}>{t('points.needsNetwork')}</Text> : null}
      <View style={styles.rewardsCard}>
        {visibleRewards.map((r, index) => {
          const affordable = balance ? canAfford(balance.available, r.cost) : false;
          const canRequest = !isParent && !d.readOnly && affordable && online;
          const tint = REWARD_TINTS[r.icon] ?? colors.primary;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}, ${r.cost} ${t('points.unit')}${!affordable ? `, ${t('points.notEnough')}` : ''}`}
              accessibilityState={{ disabled: isParent ? false : !canRequest }}
              disabled={isParent ? false : !canRequest}
              onPress={() => (isParent ? router.push({ pathname: '/reward/[id]', params: { id: r.id } }) : confirmRequest(r.id, r.title, r.cost))}
              style={[styles.reward, index > 0 && styles.rewardSeparator, !affordable && !isParent && styles.rewardDisabled]}
            >
              <View style={[styles.rewardTile, { backgroundColor: `${tint}22` }]}>
                <RewardIcon name={r.icon} color={affordable || isParent ? tint : colors.textSecondary} />
              </View>
              <Text style={[styles.rowTitle, styles.flex]}>{r.title}</Text>
              <Text style={styles.cost}>
                {r.cost} {t('points.unit')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {isParent ? <Button label={t('points.addReward')} onPress={() => router.push('/reward/new')} /> : null}

      <View style={styles.banner}>
        <Star color={colors.warning} fill={colors.warning} size={22} />
        <Text style={styles.bannerText}>{t('points.banner')}</Text>
      </View>

      {!d.readOnly && myRequests.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('points.requestsTitle')}
          </Text>
          {myRequests.map((r) => (
            <Card key={r.id}>
              <Text style={styles.rowTitle}>{r.reward_title}</Text>
              <Text style={typography.secondary}>
                {renderRequestStatus(r)} · {r.cost} {t('points.unit')}
                {r.status === 'rejected' && r.decision_note ? ` · ${r.decision_note}` : ''}
              </Text>
              {r.status === 'pending' && !isParent ? (
                <Button variant="secondary" label={t('points.cancelRequest')} onPress={() => cancel.mutate(r.id)} disabled={!online} />
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  medal: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F5B301', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFD965' },
  balance: { fontSize: 36, fontWeight: '800', color: colors.text },
  unit: { fontSize: 20, fontWeight: '700' },
  reserved: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  pendingTasks: { fontSize: 13, color: '#B86E00', fontWeight: '600', marginTop: 2 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  rowTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  cost: { fontSize: 15, fontWeight: '600', color: colors.text },
  rewardsCard: { backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: 14, ...shadow },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  rewardSeparator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  rewardTile: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rewardDisabled: { opacity: 0.45 },
  offline: { color: colors.danger, fontSize: 13 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primaryTint, borderRadius: radius.card, padding: 14 },
  bannerText: { flex: 1, color: colors.text, fontSize: 13 },
});
