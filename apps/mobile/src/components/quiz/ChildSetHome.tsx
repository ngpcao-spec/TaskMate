import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ScoreHistory } from '@/components/quiz/ScoreHistory';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { evaluationView, historySeries } from '@/domain/quiz';
import { useChildHistory, useChildQuizSets } from '@/hooks/useQuizzes';
import { useMe } from '@/hooks/useMe';
import { colors, typography } from '@/theme/tokens';

/** Accueil d'un jeu (enfant) : passer l'évaluation, voir SA progression. Aucun score avant la validation du parent ; seul le parent relance. */
export function ChildSetHome({ setId }: { setId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe().data;
  const sets = useChildQuizSets();
  const history = useChildHistory(setId);
  if (sets.isPending) return <ActivityIndicator />;
  const info = (sets.data ?? []).find((s) => s.set_id === setId);
  if (!info) return null;
  const view = evaluationView(info.evaluation_status);
  const points = historySeries((history.data ?? []).map((h) => ({ id: h.attempt_id, at: h.validated_at, score: h.score, total: h.total })));

  return (
    <Screen>
      <ScreenHeader title={info.title} />
      <Text style={typography.secondary}>{[info.subject, t('revisions.questionCount', { count: info.question_count })].filter(Boolean).join(' · ')}</Text>

      {view === 'todo' ? <Button label={t('revisions.child.evaluate')} onPress={() => router.push({ pathname: '/quiz/evaluate/[id]', params: { id: setId } })} /> : null}
      {view === 'in_progress' ? <Button label={t('revisions.child.resume')} onPress={() => router.push({ pathname: '/quiz/evaluate/[id]', params: { id: setId } })} /> : null}
      {view === 'waiting' ? (
        <Card>
          <Text accessibilityRole="header" style={styles.waiting}>{t('revisions.child.waiting')}</Text>
          <Text style={typography.secondary}>{t('revisions.child.waitingBody')}</Text>
        </Card>
      ) : null}
      {view === 'validated' && info.evaluation_attempt_id ? (
        <>
          <Button variant="secondary" label={t('revisions.child.seeResult')} onPress={() => router.push({ pathname: '/quiz/result/[id]', params: { id: info.evaluation_attempt_id as string } })} />
          <Text style={typography.secondary}>{t('revisions.child.taken')}</Text>
        </>
      ) : null}

      <ScoreHistory points={points} timezone={me?.family.timezone ?? 'Asia/Ho_Chi_Minh'} />
    </Screen>
  );
}

const styles = StyleSheet.create({ waiting: { fontSize: 17, fontWeight: '700', color: colors.warning } });
