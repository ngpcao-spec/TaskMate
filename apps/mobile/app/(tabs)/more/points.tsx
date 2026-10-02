import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProfilePills } from '@/components/ProfilePills';
import { RewardIcon } from '@/components/RewardIcon';
import { Button, Card, Screen, Title } from '@/components/ui';
import { todayInTz } from '@/domain/family-time';
import { canAfford, daysUntilExpiry, recentRequests, reservedByPending } from '@/domain/rewards';
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
import { useOnline } from '@/hooks/useSyncStatus';
import { colors, MIN_TARGET, radius, typography } from '@/theme/tokens';
import type { RewardRequestRow } from '@/types/db';

export default function PointsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const online = useOnline();
  const childId = d?.child?.id ?? null;
  const balance = useProjectedBalance(childId);
  const rewards = useRewards();
  const allRequests = useRequests(d?.viewer.role === 'parent' ? null : childId);
  const request = useRequestReward();
  const cancel = useCancelRequest();
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const [notes, setNotes] = useState<Record<string, string>>({});
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
      <Title>{t('points.title')}</Title>
      {d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={d.child.id} onSelect={d.select} today={today} /> : null}

      <Pressable accessibilityRole="button" accessibilityLabel={t('points.history')} onPress={() => router.push('/more/points-history')}>
        <Card>
          <Text accessibilityLabel={`${balance?.balance ?? 0} ${t('points.unit')}`} style={styles.balance}>
            {balance?.balance ?? 0}
            <Text style={styles.unit}> {t('points.unit')}</Text>
          </Text>
          <Text style={typography.secondary}>{t('points.totalLabel')}</Text>
          {reserved > 0 ? <Text style={styles.reserved}>{t('points.reserved', { reserved })}</Text> : null}
        </Card>
      </Pressable>

      {isParent && pendingQueue.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('points.toApprove', { count: pendingQueue.length })}
          </Text>
          {pendingQueue.map((r) => (
            <Card key={r.id}>
              <Text style={styles.rowTitle}>{t('points.requestLine', { name: childName(r.child_id), title: r.reward_title, cost: r.cost })}</Text>
              <Text style={typography.secondary}>{t('points.expiresIn', { days: daysUntilExpiry(r.expires_at, now) })}</Text>
              <TextInput
                accessibilityLabel={t('points.rejectNote')}
                placeholder={t('points.rejectNote')}
                placeholderTextColor={colors.textSecondary}
                value={notes[r.id] ?? ''}
                onChangeText={(v) => setNotes((n) => ({ ...n, [r.id]: v }))}
                style={styles.input}
              />
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button label={t('points.approve')} onPress={() => approve.mutate(r.id)} disabled={!online} loading={approve.isPending} />
                </View>
                <View style={styles.flex}>
                  <Button variant="secondary" label={t('points.reject')} onPress={() => reject.mutate({ id: r.id, note: notes[r.id]?.trim() || undefined })} disabled={!online} />
                </View>
              </View>
            </Card>
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
      {visibleRewards.map((r) => {
        const affordable = balance ? canAfford(balance.available, r.cost) : false;
        const canRequest = !isParent && !d.readOnly && affordable && online;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}, ${r.cost} ${t('points.unit')}${!affordable ? `, ${t('points.notEnough')}` : ''}`}
            accessibilityState={{ disabled: isParent ? false : !canRequest }}
            disabled={isParent ? false : !canRequest}
            onPress={() => (isParent ? router.push({ pathname: '/reward/[id]', params: { id: r.id } }) : confirmRequest(r.id, r.title, r.cost))}
            style={[styles.reward, !affordable && !isParent && styles.rewardDisabled]}
          >
            <RewardIcon name={r.icon} color={affordable || isParent ? colors.primary : colors.textSecondary} />
            <Text style={[styles.rowTitle, styles.flex]}>{r.title}</Text>
            <Text style={styles.cost}>
              {r.cost} {t('points.unit')}
            </Text>
          </Pressable>
        );
      })}
      {isParent ? <Button label={t('points.addReward')} onPress={() => router.push('/reward/new')} /> : null}

      <View style={styles.banner}>
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
  balance: { fontSize: 40, fontWeight: '800', color: colors.primary },
  unit: { fontSize: 18, fontWeight: '600' },
  reserved: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  section: { gap: 10 },
  sectionTitle: { ...typography.title, color: colors.text },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cost: { fontSize: 15, fontWeight: '700', color: colors.primary },
  actions: { flexDirection: 'row', gap: 8 },
  input: { minHeight: MIN_TARGET, borderRadius: 12, borderWidth: 1, borderColor: '#DDE5F0', paddingHorizontal: 12, color: colors.text, backgroundColor: colors.card },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: 16 },
  rewardDisabled: { opacity: 0.45 },
  offline: { color: colors.danger, fontSize: 13 },
  banner: { backgroundColor: '#E8F1FE', borderRadius: radius.card, padding: 14 },
  bannerText: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
