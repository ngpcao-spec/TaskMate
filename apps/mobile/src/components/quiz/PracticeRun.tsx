import { onlineManager } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import type { AnswerFeedback } from '@/api/quizzes';
import { ChoiceButton } from '@/components/quiz/ChoiceButton';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { originalIndex, shuffleChoices } from '@/domain/quiz';
import { useCheckAnswer, useChildQuestions, useFinishPractice, useStartPractice } from '@/hooks/useQuizzes';
import { colors, typography } from '@/theme/tokens';

/** Entraînement : une question à la fois, retour IMMÉDIAT (juste/faux, bonne réponse, explication) donné par le serveur. */
export function PracticeRun({ setId }: { setId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [attemptId] = useState(newId);
  const questions = useChildQuestions(setId);
  const start = useStartPractice();
  const check = useCheckAnswer();
  const finish = useFinishPractice();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [done, setDone] = useState<{ score: number; total: number } | null>(null);

  useEffect(() => {
    start.mutate({ setId, attemptId }, { onSuccess: () => setStarted(true) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = questions.data ?? [];
  const q = list[index];
  const shuffled = useMemo(() => (q ? shuffleChoices(q.choices, `${attemptId}:${q.question_id}`) : null), [q, attemptId]);

  if (!onlineManager.isOnline() && !started) {
    return (
      <Screen>
        <ScreenHeader title={t('revisions.child.practice')} />
        <Text accessibilityRole="alert" style={typography.secondary}>{t('revisions.child.needNetwork')}</Text>
      </Screen>
    );
  }
  if (questions.isPending || !started) return <ActivityIndicator />;

  if (done) {
    return (
      <Screen>
        <ScreenHeader title={t('revisions.child.practiceDone')} />
        <Card>
          <Text accessibilityRole="header" style={styles.score}>{t('revisions.child.scoreIs', { score: done.score, total: done.total })}</Text>
        </Card>
        <Button label={t('revisions.child.seeResult')} onPress={() => router.replace({ pathname: '/quiz/result/[id]', params: { id: attemptId } })} />
        <Button variant="secondary" label={t('revisions.child.back')} onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!q || !shuffled) return null;

  const onPick = (displayed: number) => {
    if (feedback || check.isPending) return;
    setPicked(displayed);
    check.mutate({ attemptId, questionId: q.question_id, choice: originalIndex(shuffled.order, displayed) }, { onSuccess: setFeedback });
  };
  const correctDisplayed = feedback ? shuffled.order.indexOf(feedback.correct_index) : -1;
  const last = index === list.length - 1;

  const next = () => {
    if (last) {
      finish.mutate(attemptId, { onSuccess: setDone });
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setFeedback(null);
  };

  return (
    <Screen>
      <ScreenHeader title={t('revisions.child.practice')} />
      <Text style={typography.secondary}>{t('revisions.child.questionOf', { n: index + 1, total: list.length })}</Text>
      <Text accessibilityRole="header" style={styles.prompt}>{q.prompt}</Text>
      <View style={styles.choices} accessibilityRole="radiogroup">
        {shuffled.choices.map((choice, displayed) => {
          const mark = feedback ? (displayed === correctDisplayed ? 'correct' : displayed === picked ? 'wrong' : null) : null;
          return <ChoiceButton key={displayed} label={choice} selected={picked === displayed} mark={mark} disabled={feedback !== null || check.isPending} onPress={() => onPick(displayed)} />;
        })}
      </View>
      {feedback ? (
        <Card>
          <Text accessibilityRole="alert" style={[styles.verdict, feedback.correct ? styles.right : styles.wrong]}>{feedback.correct ? t('revisions.child.right') : t('revisions.child.wrong')}</Text>
          {!feedback.correct ? <Text style={styles.line}>{t('revisions.correctAnswer', { answer: q.choices[feedback.correct_index] ?? '' })}</Text> : null}
          {feedback.explanation ? <Text style={styles.line}>{feedback.explanation}</Text> : null}
        </Card>
      ) : null}
      {feedback ? <Button label={last ? t('revisions.child.finish') : t('revisions.child.next')} onPress={next} loading={finish.isPending} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  prompt: { fontSize: 20, fontWeight: '700', color: colors.text },
  choices: { gap: 10 },
  verdict: { fontSize: 18, fontWeight: '700' },
  right: { color: colors.success },
  wrong: { color: colors.danger },
  line: { fontSize: 15, color: colors.text },
  score: { fontSize: 28, fontWeight: '800', color: colors.text },
});
