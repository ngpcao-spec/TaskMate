import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { ChoiceButton } from '@/components/quiz/ChoiceButton';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { answersPayload, originalIndex, shuffleChoices, unansweredCount } from '@/domain/quiz';
import { useChildQuestions, useChildQuizSets, useStartQuizEvaluation, useSubmitQuizEvaluation } from '@/hooks/useQuizzes';
import { colors, typography } from '@/theme/tokens';

/**
 * Évaluation : toutes les questions, aucun retour. L'envoi (mis en file hors ligne, rejeu idempotent) ne renvoie AUCUN résultat :
 * l'enfant voit « Đã nộp, chờ phụ huynh duyệt » puis, seulement après validation du parent, son score.
 */
export function EvaluationRun({ setId }: { setId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const sets = useChildQuizSets();
  const questions = useChildQuestions(setId);
  const start = useStartQuizEvaluation();
  const submit = useSubmitQuizEvaluation();
  const [freshId] = useState(newId);
  const startedRef = useRef(false);
  const [chosen, setChosen] = useState<Record<string, number | null>>({}); // indices D'ORIGINE
  const [warned, setWarned] = useState(false);
  const [sent, setSent] = useState(false);

  const info = (sets.data ?? []).find((s) => s.set_id === setId);
  const resuming = info?.evaluation_status === 'in_progress' ? info.evaluation_attempt_id : null;
  const attemptId = resuming ?? (info?.can_start_evaluation ? freshId : null);

  useEffect(() => {
    if (!info || startedRef.current || resuming || !info.can_start_evaluation) return;
    startedRef.current = true;
    start.mutate({ setId, attemptId: freshId });
  }, [info?.set_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => questions.data ?? [], [questions.data]);
  const shuffles = useMemo(() => new Map(list.map((q) => [q.question_id, shuffleChoices(q.choices, `${attemptId ?? ''}:${q.question_id}`)])), [list, attemptId]);

  if (sets.isPending || questions.isPending) return <ActivityIndicator />;
  if (!info) return null;

  if (sent || info.evaluation_status === 'submitted') {
    return (
      <Screen>
        <ScreenHeader title={info.title} />
        <Card>
          <Text accessibilityRole="header" style={styles.waiting}>{t('revisions.child.waiting')}</Text>
          <Text style={typography.secondary}>{t('revisions.child.waitingBody')}</Text>
        </Card>
        <Button label={t('revisions.child.back')} onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!attemptId) {
    // déjà passée (validée) : seul le parent peut en relancer une
    return (
      <Screen>
        <ScreenHeader title={info.title} />
        <Text style={typography.secondary}>{t('revisions.child.taken')}</Text>
        <Button label={t('revisions.child.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const missing = unansweredCount(list, chosen);
  const onSend = () => {
    if (missing > 0 && !warned) {
      setWarned(true);
      return;
    }
    submit.mutate({ attemptId, answers: answersPayload(list, chosen) });
    setSent(true);
  };

  return (
    <Screen>
      <ScreenHeader title={info.title} />
      <Text style={typography.secondary}>{t('revisions.child.evalIntro')}</Text>
      {list.map((q, i) => {
        const sh = shuffles.get(q.question_id);
        if (!sh) return null;
        return (
          <View key={q.question_id} style={styles.q}>
            <Text style={typography.secondary}>{t('revisions.child.questionOf', { n: i + 1, total: list.length })}</Text>
            <Text accessibilityRole="header" style={styles.prompt}>{q.prompt}</Text>
            <View style={styles.choices} accessibilityRole="radiogroup">
              {sh.choices.map((choice, displayed) => (
                <ChoiceButton key={displayed} label={choice} selected={chosen[q.question_id] === originalIndex(sh.order, displayed)} onPress={() => { setChosen({ ...chosen, [q.question_id]: originalIndex(sh.order, displayed) }); setWarned(false); }} />
              ))}
            </View>
          </View>
        );
      })}
      {warned && missing > 0 ? <Text accessibilityRole="alert" style={styles.warn}>{t('revisions.child.unanswered', { count: missing })}</Text> : null}
      <Button label={warned && missing > 0 ? t('revisions.child.submitAnyway') : t('revisions.child.submit')} onPress={onSend} loading={submit.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  q: { gap: 8 },
  prompt: { fontSize: 18, fontWeight: '700', color: colors.text },
  choices: { gap: 10 },
  warn: { color: colors.danger, fontSize: 14 },
  waiting: { fontSize: 17, fontWeight: '700', color: colors.warning },
});
