import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { useChildResult } from '@/hooks/useQuizzes';
import { colors, typography } from '@/theme/tokens';

/** Résultat d'UNE tentative (enfant). Score et correction n'arrivent du serveur qu'une fois la tentative validée. */
export function ResultView({ attemptId }: { attemptId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const result = useChildResult(attemptId);
  if (result.isPending) return <ActivityIndicator />;
  const r = result.data;
  if (!r) return null;

  if (r.status !== 'validated' || r.score === undefined || r.total === undefined) {
    return (
      <Screen>
        <ScreenHeader title={t('revisions.title')} />
        <Card>
          <Text accessibilityRole="header" style={styles.waiting}>{t('revisions.child.waiting')}</Text>
          <Text style={typography.secondary}>{t('revisions.child.waitingBody')}</Text>
        </Card>
        <Button label={t('revisions.child.back')} onPress={() => router.back()} />
      </Screen>
    );
  }
  const answer = (choices: string[], index: number | null) => (index === null ? t('revisions.noAnswer') : (choices[index] ?? t('revisions.noAnswer')));

  return (
    <Screen>
      <ScreenHeader title={t(`revisions.kind.${r.kind}`)} />
      <Card>
        <Text accessibilityRole="header" style={styles.score}>{t('revisions.child.scoreIs', { score: r.score, total: r.total })}</Text>
      </Card>
      <Text accessibilityRole="header" style={styles.section}>{t('revisions.detail')}</Text>
      {(r.questions ?? []).map((q, i) => (
        <Card key={q.question_id}>
          <View style={styles.head}>
            {q.is_correct ? <Check color={colors.success} size={20} /> : <X color={colors.danger} size={20} />}
            <Text style={styles.prompt}>{`${i + 1}. ${q.prompt}`}</Text>
          </View>
          <Text style={[styles.line, q.is_correct ? styles.ok : styles.ko]}>{t('revisions.given', { answer: answer(q.choices, q.choice_index) })}</Text>
          {!q.is_correct ? <Text style={styles.line}>{t('revisions.correctAnswer', { answer: answer(q.choices, q.correct_index) })}</Text> : null}
          {q.explanation ? <Text style={typography.secondary}>{q.explanation}</Text> : null}
        </Card>
      ))}
      <Button variant="secondary" label={t('revisions.child.back')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  waiting: { fontSize: 17, fontWeight: '700', color: colors.warning },
  score: { fontSize: 28, fontWeight: '800', color: colors.text },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  head: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  prompt: { flex: 1, fontSize: 16, color: colors.text },
  line: { fontSize: 14, color: colors.text },
  ok: { color: colors.success },
  ko: { color: colors.danger },
});
