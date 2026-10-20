import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { queryKeys } from '@/api/keys';
import { ChildTabs } from '@/components/onboarding/ChildTabs';
import { useStepNav } from '@/components/onboarding/useStepNav';
import { WizardShell } from '@/components/onboarding/WizardShell';
import { Card, ErrorText, Field } from '@/components/ui';
import { todayInTz } from '@/domain/family-time';
import type { OnboardingFacts } from '@/domain/onboarding';
import { clampCost, clampPoints, REWARD_TEMPLATES, rewardInputs, TASK_TEMPLATES, taskRecurrences, type PickedReward, type PickedTask } from '@/domain/onboarding-templates';
import { useMe } from '@/hooks/useMe';
import { useSaveReward } from '@/hooks/usePoints';
import { useCreateRecurrences } from '@/hooks/useRecurrences';
import { RewardIcon } from '@/components/RewardIcon';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type TaskPicks = Record<string, Record<string, string>>; // enfant → modèle → points saisis (absent = non coché)
type RewardPicks = Record<string, string>; // modèle → coût saisi (absent = non coché)

/**
 * Étape 5 — tâches et récompenses (facultatif) : modèles à cocher, points et coûts préremplis et modifiables. Les tâches sont des SÉRIES créées par le flux existant
 * (le parent seul crée, jamais l'enfant) ; les récompenses sont communes à la famille. « Tiếp tục » crée ce qui est coché puis passe à l'étape suivante.
 */
export function ContentStep({ facts }: { facts: OnboardingFacts }) {
  const { t } = useTranslation();
  const me = useMe().data;
  const nav = useStepNav('content', facts);
  const queryClient = useQueryClient();
  const createSeries = useCreateRecurrences();
  const saveReward = useSaveReward();
  const [picked, setPicked] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskPicks>({});
  const [rewards, setRewards] = useState<RewardPicks>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const child = facts.children.find((c) => c.id === picked) ?? facts.children[0] ?? null;
  if (!me) return null;

  const setTaskPoints = (childId: string, key: string, value: string | null) =>
    setTasks((cur) => {
      const mine = { ...(cur[childId] ?? {}) };
      if (value === null) delete mine[key];
      else mine[key] = value;
      return { ...cur, [childId]: mine };
    });
  const setRewardCost = (key: string, value: string | null) =>
    setRewards((cur) => {
      const next = { ...cur };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });

  const taskCount = Object.values(tasks).reduce((n, m) => n + Object.keys(m).length, 0);
  const rewardCount = Object.keys(rewards).length;

  const next = async () => {
    setError(null);
    if (taskCount + rewardCount > 0) {
      setBusy(true);
      try {
        const today = todayInTz(new Date(), me.family.timezone);
        const picks: Record<string, PickedTask[]> = {};
        for (const [childId, mine] of Object.entries(tasks)) {
          picks[childId] = TASK_TEMPLATES.filter((tpl) => mine[tpl.key] !== undefined).map((template) => ({ template, title: t(`onboarding.templates.tasks.${template.key}`), points: clampPoints(Number(mine[template.key])) }));
        }
        const rows = taskRecurrences(picks, today);
        if (rows.length > 0) await createSeries.mutateAsync({ familyId: me.family.id, memberId: me.member.id, rows });
        const pickedRewards: PickedReward[] = REWARD_TEMPLATES.filter((r) => rewards[r.key] !== undefined).map((template) => ({ template, title: t(`onboarding.templates.rewards.${template.key}`), cost: clampCost(Number(rewards[template.key])) }));
        for (const input of rewardInputs(pickedRewards)) await saveReward.mutateAsync({ familyId: me.family.id, input });
        setTasks({});
        setRewards({});
        await queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
      } catch {
        setError(t('onboarding.content.failed'));
        return;
      } finally {
        setBusy(false);
      }
    }
    nav.goNext();
  };

  return (
    <WizardShell
      number={nav.number}
      total={nav.total}
      title={t('onboarding.content.title')}
      subtitle={t('onboarding.content.subtitle')}
      onNext={() => void next()}
      nextLoading={busy}
      onSkip={nav.skip ? () => void nav.skip?.() : undefined}
      skipLoading={nav.skipping}
      onBack={nav.goBack}
    >
      <ChildTabs items={facts.children} value={child?.id ?? ''} onChange={setPicked} label={t('onboarding.content.tabs')} />
      {child ? (
        <Card>
          <Text accessibilityRole="header" style={styles.section}>{t('onboarding.content.tasksFor', { name: child.name })}</Text>
          <Text style={typography.secondary}>{t('onboarding.content.tasksHint')}</Text>
          {TASK_TEMPLATES.map((tpl) => {
            const value = tasks[child.id]?.[tpl.key];
            const title = t(`onboarding.templates.tasks.${tpl.key}`);
            return (
              <TemplateRow
                key={tpl.key}
                title={title}
                detail={tpl.rule === 'daily' ? t('onboarding.content.daily') : t('onboarding.content.weekdays', { days: tpl.weekdays?.map((d) => t(`onboarding.content.day.${d}`)).join(', ') })}
                checked={value !== undefined}
                amount={value ?? String(tpl.points)}
                amountLabel={t('onboarding.content.pointsFor', { title })}
                suffix={t('onboarding.content.points')}
                onToggle={(on) => setTaskPoints(child.id, tpl.key, on ? String(tpl.points) : null)}
                onAmount={(v) => setTaskPoints(child.id, tpl.key, v.replace(/\D/g, ''))}
              />
            );
          })}
        </Card>
      ) : null}
      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('onboarding.content.rewardsTitle')}</Text>
        <Text style={typography.secondary}>{t('onboarding.content.rewardsHint')}</Text>
        {REWARD_TEMPLATES.map((r) => {
          const value = rewards[r.key];
          const title = t(`onboarding.templates.rewards.${r.key}`);
          return (
            <TemplateRow
              key={r.key}
              title={title}
              icon={<RewardIcon name={r.icon} size={22} />}
              checked={value !== undefined}
              amount={value ?? String(r.cost)}
              amountLabel={t('onboarding.content.costFor', { title })}
              suffix={t('onboarding.content.points')}
              onToggle={(on) => setRewardCost(r.key, on ? String(r.cost) : null)}
              onAmount={(v) => setRewardCost(r.key, v.replace(/\D/g, ''))}
            />
          );
        })}
      </Card>
      <ErrorText>{error}</ErrorText>
    </WizardShell>
  );
}

function TemplateRow({ title, detail, icon, checked, amount, amountLabel, suffix, onToggle, onAmount }: {
  title: string; detail?: string; icon?: React.ReactNode; checked: boolean; amount: string; amountLabel: string; suffix: string; onToggle: (on: boolean) => void; onAmount: (v: string) => void;
}) {
  return (
    <View style={styles.row}>
      <Switch accessibilityRole="switch" accessibilityLabel={title} accessibilityState={{ checked }} aria-checked={checked} value={checked} onValueChange={onToggle} />
      {icon}
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={typography.secondary}>{detail}</Text> : null}
      </View>
      {checked ? (
        <View style={styles.amount}>
          <Field label={amountLabel} value={amount} onChangeText={onAmount} keyboardType="number-pad" maxLength={5} style={styles.amountInput} />
          <Text style={typography.secondary}>{suffix}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { ...typography.title, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  amount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountInput: { minWidth: 72, textAlign: 'center' },
});
