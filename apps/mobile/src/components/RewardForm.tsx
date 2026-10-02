import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { IconChoice } from '@/components/IconChoice';
import { REWARD_ICON_NAMES, RewardIcon } from '@/components/RewardIcon';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useDeleteReward, useSaveReward } from '@/hooks/usePoints';
import type { RewardRow } from '@/types/models';

/** Création / édition d'une récompense — parent uniquement (RLS) ; `childId` null = commune. */
export function RewardForm({ reward }: { reward?: RewardRow }) {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const save = useSaveReward();
  const remove = useDeleteReward();
  const [title, setTitle] = useState(reward?.title ?? '');
  const [cost, setCost] = useState(reward ? String(reward.cost) : '100');
  const [icon, setIcon] = useState(reward?.icon ?? 'gift');
  const [childId, setChildId] = useState<string | null>(reward?.child_id ?? null);
  if (!d || d.viewer.role !== 'parent') return null;

  const costNumber = Number(cost);
  const valid = title.trim().length > 0 && title.trim().length <= 80 && Number.isInteger(costNumber) && costNumber > 0 && costNumber <= 100_000;

  return (
    <Screen>
      <Title>{reward ? t('reward.editTitle') : t('reward.newTitle')}</Title>
      <Card>
        <Field label={t('reward.name')} value={title} onChangeText={setTitle} maxLength={80} />
        <Field label={t('reward.cost')} value={cost} onChangeText={(v) => setCost(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} />
        <View style={styles.wrap}>
          {REWARD_ICON_NAMES.map((name) => (
            <IconChoice key={name} name={name} selected={icon === name} onPress={() => setIcon(name)}>
              <RewardIcon name={name} />
            </IconChoice>
          ))}
        </View>
        <View style={styles.wrap}>
          <Chip label={t('reward.everyone')} selected={childId === null} onPress={() => setChildId(null)} />
          {d.children.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color ?? undefined} selected={childId === c.id} onPress={() => setChildId(c.id)} />
          ))}
        </View>
      </Card>
      <Button
        label={t('common.save')}
        disabled={!valid}
        loading={save.isPending}
        onPress={() =>
          save.mutate({ familyId: d.me.family.id, id: reward?.id, input: { title: title.trim(), icon, cost: costNumber, childId } }, { onSuccess: () => router.back() })
        }
      />
      {reward ? <Button variant="secondary" label={t('reward.delete')} loading={remove.isPending} onPress={() => remove.mutate(reward.id, { onSuccess: () => router.back() })} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
