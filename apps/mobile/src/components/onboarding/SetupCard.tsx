import { useRouter } from 'expo-router';
import { Check, Circle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '@/components/ui';
import { showSetupCard, stepPath } from '@/domain/onboarding';
import { useHideSetupCard, useOnboarding } from '@/hooks/useOnboarding';
import { colors, radius, typography } from '@/theme/tokens';

/**
 * Carte « Hoàn tất cài đặt n/6 » de Hôm nay (parent) : les étapes restantes de l'assistant, d'après les VRAIES données. Visible tant que des étapes manquent
 * (les étapes passées restent à faire) ; « Masquer » la cache (elle revient par Réglages) ; elle disparaît seule quand tout est fait. Ne parle jamais des enfants entre eux.
 */
export function SetupCard({ role }: { role: 'parent' | 'child' }) {
  const { t } = useTranslation();
  const router = useRouter();
  const ob = useOnboarding();
  const hide = useHideSetupCard();
  if (role !== 'parent' || !ob.facts || !ob.progress || !showSetupCard(ob.facts, role)) return null;
  const { steps, done, total, next } = ob.progress;
  const label = t('onboarding.card.counter', { done, total });

  return (
    <Card>
      <View style={styles.top}>
        <Text accessibilityRole="header" style={styles.title}>{t('onboarding.card.title')}</Text>
        <Text accessibilityLabel={label} style={styles.counter}>{`${done}/${total}`}</Text>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: total, now: done }} style={styles.bar}>
        <View style={[styles.fill, { width: `${(done / total) * 100}%` }]} />
      </View>
      {steps.map((s) => {
        const isNext = s.key === next;
        const name = t(`onboarding.steps.${s.key}`);
        const status = s.status === 'done' ? t('onboarding.card.done') : s.status === 'skipped' ? t('onboarding.card.skipped') : null;
        return (
          <View key={s.key} accessible accessibilityLabel={[name, status ?? t('onboarding.card.todo')].join(', ')} style={styles.row}>
            {s.status === 'done' ? <Check color={colors.success} size={20} /> : <Circle color={isNext ? colors.primary : colors.textSecondary} size={20} />}
            <Text style={[styles.step, s.status === 'done' && styles.done, isNext && styles.next, s.status !== 'done' && !isNext && styles.later]}>{name}</Text>
            {s.status === 'skipped' ? <Text style={styles.tag}>{t('onboarding.card.skipped')}</Text> : null}
          </View>
        );
      })}
      {next ? <Button label={t('onboarding.card.continue', { step: t(`onboarding.steps.${next}`) })} onPress={() => router.push(stepPath(next))} /> : null}
      <Button variant="ghost" label={t('onboarding.card.hide')} onPress={() => hide.mutate(true)} loading={hide.isPending} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text },
  counter: { fontSize: 18, fontWeight: '800', color: colors.primary },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.cardStrong, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  step: { flex: 1, fontSize: 15, color: colors.text },
  done: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  next: { fontWeight: '800' },
  later: { color: colors.textSecondary },
  tag: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
});
