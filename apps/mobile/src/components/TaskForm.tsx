import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { Chip } from '@/components/Chip';
import { PickerField } from '@/components/PickerField';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { defaultTaskSlot, todayInTz } from '@/domain/family-time';
import { DEFAULT_POINTS, taskFormSchema, toTaskFields, type TaskFormValues } from '@/domain/task-form';
import { taskPermissions } from '@/domain/permissions';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useCreateTasks, useDeleteTask, useUpdateTask } from '@/hooks/useTasks';
import { CATEGORY_COLORS, TASK_CATEGORIES } from '@/theme/categories';
import { typography } from '@/theme/tokens';
import type { TaskRow } from '@/types/db';

type Props = { task?: TaskRow };

/** Formulaire « Thêm việc » / édition (SPEC §3.4). Les droits sont aussi appliqués par la RLS. */
export function TaskForm({ task }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const create = useCreateTasks();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const [showMore, setShowMore] = useState(false);

  const isParent = d?.viewer.role === 'parent';
  const tz = d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh';

  const defaults = useMemo<TaskFormValues>(() => {
    if (task) {
      return {
        title: task.title,
        category: task.category,
        date: task.date,
        timeKind: task.time_kind,
        startTime: task.start_time?.slice(0, 5),
        endTime: task.end_time?.slice(0, 5),
        note: task.note ?? '',
        points: task.points,
        childIds: [task.child_id],
      };
    }
    const slot = defaultTaskSlot(new Date(), tz);
    return {
      title: '',
      category: 'study',
      date: slot.date ?? todayInTz(new Date(), tz),
      timeKind: 'range',
      startTime: slot.start,
      endTime: slot.end,
      note: '',
      points: DEFAULT_POINTS,
      childIds: d?.child ? [d.child.id] : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: defaults, mode: 'onChange' });
  const { control, handleSubmit, setValue, formState } = form;
  const timeKind = useWatch({ control, name: 'timeKind' });

  if (!d) return null;
  const perms = task ? taskPermissions(d.viewer, task) : { canToggle: true, canEdit: true, canDelete: false };
  const err = (key?: string) => (key ? t(`taskForm.errors.${key}`) : null);

  const onSubmit = handleSubmit((raw) => {
    const parsed = taskFormSchema.parse(raw);
    const fields = toTaskFields(parsed, isParent);
    if (task) {
      const { child_id: _child, ...patch } = fields[0]!;
      update.mutate({ id: task.id, patch, childIds: [task.child_id] }, { onSuccess: () => router.back() });
    } else {
      create.mutate(
        { familyId: d.me.family.id, memberId: d.me.member.id, tasks: fields.map((f) => ({ ...f, id: newId() })) },
        { onSuccess: () => router.back() },
      );
    }
  });

  const busy = create.isPending || update.isPending;
  const timeKinds = ['range', 'deadline', 'anytime'] as const;

  return (
    <Screen>
      <Title>{task ? t('taskForm.editTitle') : t('taskForm.title')}</Title>
      <Card>
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <Field
              label={t('taskForm.name')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              maxLength={80}
              error={fieldState.isTouched ? err(fieldState.error?.message) : null}
            />
          )}
        />
        <Text style={typography.secondary}>{t('taskForm.category')}</Text>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <View style={styles.wrap}>
              {TASK_CATEGORIES.map((c) => (
                <Chip key={c} label={t(`category.${c}`)} color={CATEGORY_COLORS[c]} selected={field.value === c} onPress={() => field.onChange(c)} />
              ))}
            </View>
          )}
        />
      </Card>

      <Card>
        <Text style={typography.secondary}>{t('taskForm.time')}</Text>
        <Controller
          control={control}
          name="date"
          render={({ field, fieldState }) => (
            <PickerField label={t('taskForm.date')} mode="date" value={field.value} onChange={field.onChange} error={err(fieldState.error?.message)} />
          )}
        />
        <Controller
          control={control}
          name="timeKind"
          render={({ field }) => (
            <View style={styles.wrap}>
              {timeKinds.map((k) => (
                <Chip
                  key={k}
                  label={t(`taskForm.kind.${k}`)}
                  selected={field.value === k}
                  onPress={() => {
                    field.onChange(k);
                    if (k !== 'anytime' && !form.getValues('endTime')) {
                      setValue('startTime', defaults.startTime, { shouldValidate: true });
                      setValue('endTime', defaults.endTime, { shouldValidate: true });
                    }
                  }}
                />
              ))}
            </View>
          )}
        />
        {timeKind !== 'anytime' ? (
          <View style={styles.row}>
            {timeKind === 'range' ? (
              <Controller
                control={control}
                name="startTime"
                render={({ field, fieldState }) => (
                  <PickerField label={t('taskForm.from')} mode="time" value={field.value ?? '08:00'} onChange={field.onChange} error={err(fieldState.error?.message)} />
                )}
              />
            ) : null}
            <Controller
              control={control}
              name="endTime"
              render={({ field, fieldState }) => (
                <PickerField
                  label={timeKind === 'range' ? t('taskForm.to') : t('taskForm.before')}
                  mode="time"
                  value={field.value ?? '21:00'}
                  onChange={field.onChange}
                  error={err(fieldState.error?.message)}
                />
              )}
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <Controller
          control={control}
          name="note"
          render={({ field, fieldState }) => (
            <Field
              label={t('taskForm.note')}
              value={field.value ?? ''}
              onChangeText={field.onChange}
              multiline
              maxLength={500}
              style={styles.note}
              error={err(fieldState.error?.message)}
            />
          )}
        />
      </Card>

      {isParent ? (
        <>
          <Button variant="ghost" label={showMore ? t('taskForm.lessOptions') : t('taskForm.moreOptions')} onPress={() => setShowMore((v) => !v)} />
          {showMore ? (
            <Card>
              <Controller
                control={control}
                name="points"
                render={({ field, fieldState }) => (
                  <Field
                    label={t('taskForm.points')}
                    value={String(field.value)}
                    onChangeText={(v) => field.onChange(v === '' ? Number.NaN : Number(v.replace(/\D/g, '')))}
                    keyboardType="number-pad"
                    maxLength={4}
                    error={err(fieldState.error?.message)}
                  />
                )}
              />
              {!task && d.children.length > 1 ? (
                <>
                  <Text style={typography.secondary}>{t('taskForm.forWhom')}</Text>
                  <Controller
                    control={control}
                    name="childIds"
                    render={({ field }) => (
                      <View style={styles.wrap}>
                        {d.children.map((c) => {
                          const on = field.value.includes(c.id);
                          return (
                            <Chip
                              key={c.id}
                              role="checkbox"
                              label={c.name}
                              color={c.color ?? undefined}
                              selected={on}
                              onPress={() => field.onChange(on ? field.value.filter((id) => id !== c.id) : [...field.value, c.id])}
                            />
                          );
                        })}
                      </View>
                    )}
                  />
                </>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}

      <Button label={t('common.save')} onPress={onSubmit} loading={busy} disabled={!formState.isValid || !perms.canEdit} />
      {task && perms.canDelete ? (
        <Button
          variant="secondary"
          label={t('taskForm.delete')}
          onPress={() => remove.mutate(task, { onSuccess: () => router.back() })}
          loading={remove.isPending}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  note: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
});
