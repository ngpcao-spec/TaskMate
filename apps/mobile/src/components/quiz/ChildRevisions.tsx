import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, ScreenHeader } from '@/components/ui';
import { evaluationView } from '@/domain/quiz';
import { useChildQuizSets } from '@/hooks/useQuizzes';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/** « Ôn tập » (enfant) : SES jeux publiés uniquement (RPC `child_quiz_sets`, jamais un brouillon ni un jeu de l'autre enfant). */
export function ChildRevisions() {
  const { t } = useTranslation();
  const router = useRouter();
  const sets = useChildQuizSets();
  if (sets.isPending) return <ActivityIndicator />;
  const list = sets.data ?? [];
  return (
    <Screen>
      <ScreenHeader title={t('revisions.title')} />
      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('revisions.emptyChild')}</Text> : null}
      {list.map((s) => {
        const view = evaluationView(s.evaluation_status);
        const note = view === 'waiting' ? t('revisions.child.waiting') : view === 'in_progress' ? t('revisions.child.resume') : null;
        const count = t('revisions.questionCount', { count: s.question_count });
        return (
          <Pressable key={s.set_id} accessibilityRole="button" accessibilityLabel={[s.title, count, note].filter(Boolean).join(', ')} onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: s.set_id } })} style={styles.card}>
            <View style={styles.flex}>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={typography.secondary}>{[s.subject, count].filter(Boolean).join(' · ')}</Text>
              {note ? <Text style={styles.note}>{note}</Text> : null}
            </View>
            <ChevronRight color={colors.textSecondary} />
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET + 16, backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  note: { fontSize: 13, fontWeight: '600', color: colors.warning },
});
