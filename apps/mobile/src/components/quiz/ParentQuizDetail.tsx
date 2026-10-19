import { Redirect } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/quiz/WeeklyDueCard';
import { subjectText } from '@/components/quiz/subject';
import { ValidateAttemptBar } from '@/components/quiz/ValidateAttemptBar';
import { Button, Card, ErrorText, Screen, ScreenHeader } from '@/components/ui';
import { formatDueDay, type CalendarLanguage } from '@/domain/calendar';
import { choiceMarks, detailSummary, isForbidden, needsCheck, questionNumber, type DetailState } from '@/domain/quiz-detail';
import { useParentQuizDetail } from '@/hooks/useCatalog';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { colors, line, typography } from '@/theme/tokens';
import type { ParentQuizQuestion } from '@/api/catalog';
import type { QuizMaterialKind } from '@/types/models';

type Props = {
  childId: string;
  quizId: string;
  /** Tentative visée par une notification : repli vers la validation d'un jeu de la famille (qui n'est pas un quiz du catalogue). */
  attemptId?: string | null;
};

const TONE: Record<DetailState, 'neutral' | 'primary' | 'warning' | 'success'> = { todo: 'neutral', in_progress: 'primary', waiting: 'warning', validated: 'success' };

/**
 * Détail d'un quiz du catalogue pour le PARENT (D-089) : questions numérotées, 4 choix dans l'ordre d'origine, bonne réponse (✓), explication,
 * réponse de l'enfant (marquée si fausse). Le parent voit la clé ; l'enfant n'a jamais cet écran ni cette RPC (D-052). Lecture seule, sauf la validation
 * d'une tentative envoyée, qui réutilise exactement le même composant que « Duyệt » (`ValidateAttemptBar`).
 */
export function ParentQuizDetail({ childId, quizId, attemptId }: Props) {
  const { t, i18n } = useTranslation();
  const d = useDisplayedChild();
  const isParent = d?.viewer.role === 'parent';
  // un enfant ne déclenche aucune lecture (le serveur la refuserait de toute façon)
  const detail = useParentQuizDetail(isParent ? childId : null, quizId);
  if (!d || !isParent) return null;

  if (detail.isPending) {
    return (
      <Screen>
        <ScreenHeader title={t('weekly.review.title')} />
        <ActivityIndicator color={colors.primary} accessibilityLabel={t('quizDetail.loading')} />
      </Screen>
    );
  }
  if (detail.error || !detail.data) {
    if (isForbidden(detail.error) && attemptId) return <Redirect href={{ pathname: '/quiz/attempt/[id]', params: { id: attemptId } }} />;
    return (
      <Screen>
        <ScreenHeader title={t('weekly.review.title')} />
        <ErrorText>{isForbidden(detail.error) ? t('quizDetail.forbidden') : t('quizDetail.error')}</ErrorText>
        {isForbidden(detail.error) ? null : <Button variant="secondary" label={t('quizDetail.retry')} onPress={() => void detail.refetch()} />}
      </Screen>
    );
  }

  const { quiz, attempt, questions } = detail.data;
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const childName = d.children.find((c) => c.id === childId)?.name ?? '';
  const subject = subjectText(t, quiz.subject);
  const summary = detailSummary(attempt, quiz.question_count);
  const showChild = summary.state !== 'todo';
  const statusText = t(`quizDetail.status.${summary.state}`);

  return (
    <Screen>
      <ScreenHeader title={`${subject} · ${quiz.title}`} />
      <View accessible accessibilityLabel={[`${subject}, ${quiz.title}`, statusText, t('quizDetail.meta', { name: childName, week: quiz.week_label })].join(', ')} style={styles.summary}>
        <View style={styles.summaryTop}>
          <Text style={typography.secondary}>{`${t('quizDetail.meta', { name: childName, week: quiz.week_label })} · ${t('weekly.review.due', { day: formatDueDay(quiz.due_on, lang) })}`}</Text>
          <Badge text={statusText} tone={TONE[summary.state]} />
        </View>
        {summary.state === 'in_progress' ? <Text style={styles.strong}>{t('quizDetail.answered', { done: summary.answered, total: summary.total })}</Text> : null}
        {summary.score !== null && summary.scoreTotal !== null ? <Text accessibilityRole="header" style={styles.score}>{t('quizDetail.score', { score: summary.score, total: summary.scoreTotal })}</Text> : null}
        {summary.points !== null ? <Text style={styles.strong}>{summary.points > 0 ? t('quizDetail.points', { points: summary.points }) : t('quizDetail.pointsNone')}</Text> : null}
        {summary.state === 'todo' ? <Text style={typography.secondary}>{t('quizDetail.preview')}</Text> : null}
        {summary.state === 'in_progress' ? <Text style={typography.secondary}>{t('quizDetail.inProgressNote')}</Text> : null}
      </View>

      <Text accessibilityRole="header" style={styles.section}>{t('quizDetail.questionsTitle')}</Text>
      {questions.map((q) => (
        <QuestionCard key={q.question_id} q={q} kind={quiz.material_kind} showChild={showChild} />
      ))}

      {attempt?.status === 'submitted' ? <ValidateAttemptBar attemptId={attempt.id} /> : null}
    </Screen>
  );
}

function QuestionCard({ q, kind, showChild }: { q: ParentQuizQuestion; kind: QuizMaterialKind; showChild: boolean }) {
  const { t } = useTranslation();
  const marks = choiceMarks(q, showChild);
  const answered = q.choice_index !== null;
  const wrong = marks.some((m) => m.wrong);
  const check = needsCheck(q, kind);
  return (
    <Card>
      <View style={styles.qHead}>
        <Text style={styles.qNumber}>{t('quizDetail.question', { n: questionNumber(q) })}</Text>
        <View style={styles.flags}>
          {q.needs_figure ? <View accessible accessibilityLabel={t('quizDetail.needsFigureA11y')}><Badge text={t('quizDetail.needsFigure')} tone="neutral" /></View> : null}
          {check ? <View accessible accessibilityLabel={t('quizDetail.needsCheckA11y')}><Badge text={t('quizDetail.needsCheck')} tone="warning" /></View> : null}
        </View>
      </View>
      <Text style={styles.prompt}>{q.prompt}</Text>
      {marks.map((m) => {
        const flags = [m.correct ? t('quizDetail.correct') : null, m.chosen ? (m.wrong ? t('quizDetail.childWrong') : t('quizDetail.childRight')) : null].filter(Boolean);
        return (
          <View
            key={m.index}
            accessible
            accessibilityLabel={t('quizDetail.choiceA11y', { letter: m.letter, text: m.text, marks: flags.length ? ` — ${flags.join(', ')}` : '' })}
            style={[styles.choice, m.correct && styles.choiceCorrect, m.wrong && styles.choiceWrong]}
          >
            <Text style={styles.letter}>{m.letter}</Text>
            <View style={styles.choiceBody}>
              <Text style={styles.choiceText}>{m.text}</Text>
              {m.correct || m.chosen ? (
                <Text style={[styles.choiceTag, m.wrong ? styles.tagWrong : styles.tagOk]}>
                  {[m.correct ? t('quizDetail.correct') : null, m.chosen ? t('quizDetail.childChoice') : null].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            {m.correct ? <Check color={colors.success} size={20} /> : m.wrong ? <X color={colors.danger} size={20} /> : null}
          </View>
        );
      })}
      {showChild && !answered ? <Text style={[typography.secondary, wrong ? styles.tagWrong : null]}>{t('quizDetail.notAnswered')}</Text> : null}
      {q.explanation ? <Text style={typography.secondary}>{t('quizDetail.explanation', { text: q.explanation })}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 6 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  strong: { fontSize: 15, fontWeight: '700', color: colors.text },
  score: { fontSize: 28, fontWeight: '800', color: colors.text },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  qNumber: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  flags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  prompt: { fontSize: 16, fontWeight: '600', color: colors.text },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: line.width, borderColor: colors.glassBorder },
  choiceCorrect: { borderColor: colors.success, backgroundColor: colors.successTint },
  choiceWrong: { borderColor: colors.danger },
  letter: { width: 22, fontSize: 15, fontWeight: '800', color: colors.textSecondary },
  choiceBody: { flex: 1, gap: 2 },
  choiceText: { fontSize: 15, color: colors.text },
  choiceTag: { fontSize: 12, fontWeight: '700' },
  tagOk: { color: colors.success },
  tagWrong: { color: colors.danger },
});
