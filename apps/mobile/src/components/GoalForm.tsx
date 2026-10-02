import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { IconChoice } from '@/components/IconChoice';
import { GoalIcon } from '@/components/GoalIcon';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { GOAL_ICONS, goalFormSchema, type GoalFormValues } from '@/domain/goals';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useDeleteGoal, useSaveGoal } from '@/hooks/useGoals';
import type { GoalRow } from '@/types/models';

/** « + Thêm mục tiêu » / édition : titre, icône, cible (entier ≥ 1), unité optionnelle (SPEC §3.6). */
export function GoalForm({ goal }: { goal?: GoalRow }) {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const save = useSaveGoal();
  const remove = useDeleteGoal();
  const { control, handleSubmit, formState } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    mode: 'onChange',
    defaultValues: { title: goal?.title ?? '', icon: (goal?.icon as GoalFormValues['icon']) ?? 'target', target: goal?.target ?? 5, unit: goal?.unit ?? '' },
  });
  if (!d || !d.child || d.readOnly) return null;
  const child = d.child;
  const err = (key?: string) => (key ? t(`goals.errors.${key}`) : null);

  const submit = handleSubmit((raw) => {
    const v = goalFormSchema.parse(raw);
    save.mutate(
      { familyId: d.me.family.id, memberId: d.me.member.id, childId: child.id, id: goal?.id, input: { title: v.title, icon: v.icon, target: v.target, unit: v.unit || null } },
      { onSuccess: () => router.back() },
    );
  });

  return (
    <Screen>
      <Title>{goal ? t('goals.editTitle') : t('goals.add')}</Title>
      <Card>
        <Controller control={control} name="title" render={({ field, fieldState }) => (
          <Field label={t('goals.name')} value={field.value} onChangeText={field.onChange} maxLength={80} error={fieldState.isTouched ? err(fieldState.error?.message) : null} />
        )} />
        <Controller control={control} name="target" render={({ field, fieldState }) => (
          <Field
            label={t('goals.target')}
            value={Number.isNaN(field.value) ? '' : String(field.value)}
            onChangeText={(v) => field.onChange(v === '' ? Number.NaN : Number(v.replace(/\D/g, '')))}
            keyboardType="number-pad"
            maxLength={6}
            error={err(fieldState.error?.message)}
          />
        )} />
        <Controller control={control} name="unit" render={({ field, fieldState }) => (
          <Field label={t('goals.unit')} value={field.value ?? ''} onChangeText={field.onChange} maxLength={20} error={err(fieldState.error?.message)} />
        )} />
        <Controller control={control} name="icon" render={({ field }) => (
          <View style={styles.wrap}>
            {GOAL_ICONS.map((name) => (
              <IconChoice key={name} name={name} selected={field.value === name} onPress={() => field.onChange(name)}>
                <GoalIcon name={name} />
              </IconChoice>
            ))}
          </View>
        )} />
      </Card>
      <Button label={t('common.save')} onPress={submit} disabled={!formState.isValid} loading={save.isPending} />
      {goal ? <Button variant="secondary" label={t('goals.delete')} loading={remove.isPending} onPress={() => remove.mutate(goal, { onSuccess: () => router.back() })} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
