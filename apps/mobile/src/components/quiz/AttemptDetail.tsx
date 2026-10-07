import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { formatShortDate } from '@/domain/calendar';
import { todayInTz } from '@/domain/family-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useAttemptDetail, useValidateQuizAttempt } from '@/hooks/useQuizzes';
import { useToastStore } from '@/store/toast';
import { colors, typography } from '@/theme/tokens';

/**
 * Détail d'une tentative (parent) : réponse par question, score calculé par le serveur. « Valider » rend le résultat à l'enfant ;
 * le parent choisit ICI s'il voit aussi la correction (bonne réponse + explication) — désactivé par défaut, réglage conservé par le serveur.
 */
export function AttemptDetail({ attemptId }: { attemptId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const detail = useAttemptDetail(attemptId);
  const validate = useValidateQuizAttempt();
  const show = useToastStore((s) => s.show);
  const [showCorrection, setShowCorrection] = useState(false);
  if (!d) return null;
  if (detail.isPending) return <ActivityIndicator />;
  const data = detail.data;
  if (!data) return null;
  const { attempt, set, questions } = data;
  const childName = d.children.find((c) => c.id === attempt.child_id)?.name ?? '';
  const day = formatShortDate(todayInTz(new Date(attempt.started_at), d.me.family.timezone));
  const answer = (q: (typeof questions)[number], index: number | null) => (index === null ? t('revisions.noAnswer') : (q.choices[index] ?? t('revisions.noAnswer')));

  return (
    <Screen>
      <ScreenHeader title={set?.title ?? t('revisions.results')} />
      <Text style={typography.secondary}>{`${childName} · ${day} · ${t(`revisions.status.${attempt.status}`)}`}</Text>
      {attempt.score !== null && attempt.total !== null ? <Text accessibilityRole="header" style={styles.score}>{t('revisions.score', { score: attempt.score, total: attempt.total })}</Text> : null}

      <Text accessibilityRole="header" style={styles.section}>{t('revisions.detail')}</Text>
      {questions.map((q, i) => (
        <Card key={q.id}>
          <View style={styles.head}>
            {q.is_correct ? <Check color={colors.success} size={20} /> : <X color={colors.danger} size={20} />}
            <Text style={styles.prompt}>{`${i + 1}. ${q.prompt}`}</Text>
          </View>
          <Text style={[styles.line, q.is_correct ? styles.ok : styles.ko]}>{t('revisions.given', { answer: answer(q, q.choice_index) })}</Text>
          {!q.is_correct ? <Text style={styles.line}>{t('revisions.correctAnswer', { answer: answer(q, q.correct_index) })}</Text> : null}
        </Card>
      ))}

      {attempt.status === 'validated' ? (
        <Text style={typography.secondary}>{t(attempt.show_correction ? 'revisions.correctionShown' : 'revisions.correctionHidden')}</Text>
      ) : null}
      {attempt.status === 'submitted' ? (
        <View style={styles.switchRow}>
          <Text style={[typography.body, styles.flex]}>{t('revisions.showCorrection')}</Text>
          <Switch accessibilityLabel={t('revisions.showCorrection')} value={showCorrection} onValueChange={setShowCorrection} />
        </View>
      ) : null}
      {attempt.status === 'submitted' ? (
        <Button label={t('revisions.validate')} loading={validate.isPending} onPress={() => validate.mutate({ attemptId, showCorrection }, { onSuccess: () => { show(t('revisions.validatedDone')); router.back(); } })} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  flex: { flex: 1 },
  score: { fontSize: 28, fontWeight: '800', color: colors.text },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  head: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  prompt: { flex: 1, fontSize: 16, color: colors.text },
  line: { fontSize: 14, color: colors.text },
  ok: { color: colors.success },
  ko: { color: colors.danger },
});
