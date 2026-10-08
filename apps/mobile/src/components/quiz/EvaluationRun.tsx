import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { AnswerSheet } from '@/components/quiz/AnswerSheet';
import { ChoiceButton } from '@/components/quiz/ChoiceButton';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { answeredCount, answersPayload, unansweredCount } from '@/domain/quiz';
import { useChildQuestions, useChildQuizSets, useStartQuizEvaluation, useSubmitQuizEvaluation } from '@/hooks/useQuizzes';
import { colors, typography } from '@/theme/tokens';

/**
 * Seul parcours de l'enfant : il répond à toutes les questions (ordre et choix mélangés par le serveur, jamais de retour juste/faux),
 * envoie ses réponses, puis attend la validation. L'envoi (mis en file hors ligne, rejeu idempotent) ne renvoie AUCUN résultat.
 * Jeu « support papier » (D-062) : même parcours sur la « Phiếu trả lời » (numéros d'origine, lettres A à D, jamais mélangés).
 */
export function EvaluationRun({ setId }: { setId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const sets = useChildQuizSets();
  const start = useStartQuizEvaluation();
  const submit = useSubmitQuizEvaluation();
  const [freshId] = useState(newId);
  const startedRef = useRef(false);
  const [chosen, setChosen] = useState<Record<string, number | null>>({}); // positions AFFICHÉES
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

  // les questions ne sont demandées qu'une fois la tentative créée côté serveur (reprise, ou démarrage confirmé)
  const questions = useChildQuestions(attemptId ?? '', !!resuming || start.isSuccess);
  const list = questions.data ?? [];

  if (sets.isPending) return <ActivityIndicator />;
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

  if (questions.isPending) return <ActivityIndicator />;

  const missing = unansweredCount(list, chosen);
  const onSend = () => {
    if (missing > 0 && !warned) {
      setWarned(true);
      return;
    }
    submit.mutate({ attemptId, answers: answersPayload(list, chosen) });
    setSent(true);
  };

  const paper = info.paper_support;
  const choose = (questionId: string, displayed: number) => {
    setChosen({ ...chosen, [questionId]: displayed });
    setWarned(false);
  };

  return (
    <Screen>
      <ScreenHeader title={info.title} />
      {paper ? (
        <>
          <Text accessibilityRole="header" style={styles.sheetTitle}>{t('revisions.sheet.title')}</Text>
          <Text style={typography.secondary}>{info.answer_sheet_only ? t('revisions.sheet.intro') : t('revisions.sheet.introPaper')}</Text>
          <Text accessibilityLiveRegion="polite" style={typography.secondary}>{t('revisions.sheet.progress', { done: answeredCount(list, chosen), total: list.length })}</Text>
          <AnswerSheet questions={list} chosen={chosen} onChoose={choose} sheetOnly={info.answer_sheet_only} />
        </>
      ) : (
        <>
          <Text style={typography.secondary}>{t('revisions.child.evalIntro')}</Text>
          {list.map((q, i) => (
            <View key={q.question_id} style={styles.q}>
              <Text style={typography.secondary}>{t('revisions.child.questionOf', { n: i + 1, total: list.length })}</Text>
              <Text accessibilityRole="header" style={styles.prompt}>{q.prompt}</Text>
              <View style={styles.choices} accessibilityRole="radiogroup">
                {q.choices.map((choice, displayed) => (
                  <ChoiceButton key={displayed} label={choice} selected={chosen[q.question_id] === displayed} onPress={() => choose(q.question_id, displayed)} />
                ))}
              </View>
            </View>
          ))}
        </>
      )}
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
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
});
