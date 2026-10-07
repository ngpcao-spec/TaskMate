import { useRouter } from 'expo-router';
import { ChevronRight, FileUp, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfilePills } from '@/components/ProfilePills';
import { ScoreHistory } from '@/components/quiz/ScoreHistory';
import { Card, Screen, ScreenHeader } from '@/components/ui';
import { todayInTz } from '@/domain/family-time';
import { historySeries } from '@/domain/quiz';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useChildAttempts, usePendingQuizAttempts, useQuizSets } from '@/hooks/useQuizzes';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/** Plus → Révisions (parent) : les jeux de l'enfant sélectionné, ses évaluations à valider et sa progression. */
export function ParentRevisions() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const childId = d?.child?.id ?? null;
  const sets = useQuizSets(childId, childId !== null);
  const pending = usePendingQuizAttempts(true);
  const attempts = useChildAttempts(childId);
  if (!d || !d.child) return null;
  const today = todayInTz(new Date(), d.me.family.timezone);
  const list = sets.data ?? [];
  const waiting = (pending.data ?? []).filter((a) => a.child_id === d.child?.id);
  const history = historySeries(
    (attempts.data ?? []).filter((a) => a.status === 'validated' && a.score !== null && a.total !== null).map((a) => ({ id: a.id, at: a.validated_at ?? a.started_at, score: a.score as number, total: a.total as number })),
  );

  return (
    <Screen>
      <ScreenHeader title={t('revisions.title')} />
      {d.children.length > 1 ? <ProfilePills profiles={d.children} selectedId={d.child.id} onSelect={d.select} today={today} /> : null}

      {waiting.length > 0 ? (
        <Card>
          <Text accessibilityRole="header" style={styles.section}>{t('revisions.pendingTitle')}</Text>
          {waiting.map((a) => (
            <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`${a.set_title}, ${t('revisions.status.submitted')}`} onPress={() => router.push({ pathname: '/quiz/attempt/[id]', params: { id: a.id } })} style={styles.row}>
              <Text style={styles.rowTitle}>{a.set_title}</Text>
              <Text style={styles.badge}>{t('revisions.status.submitted')}</Text>
              <ChevronRight color={colors.textSecondary} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('revisions.emptyParent')}</Text> : null}
      {list.map((s) => {
        const state = s.status === 'published' ? t('revisions.published') : t('revisions.draft');
        const count = t('revisions.questionCount', { count: s.question_count });
        return (
          <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.title}, ${state}, ${count}`} onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: s.id } })} style={styles.card}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{s.title}</Text>
              <Text style={typography.secondary}>{[s.subject, count].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={[styles.badge, s.status === 'published' ? styles.badgeOn : null]}>{state}</Text>
            <ChevronRight color={colors.textSecondary} />
          </Pressable>
        );
      })}

      <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.new')} onPress={() => router.push('/quiz/new')} style={styles.add}>
        <Plus color={colors.primary} size={20} />
        <Text style={styles.addText}>{t('revisions.new')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.entry')} onPress={() => router.push('/quiz/import')} style={styles.add}>
        <FileUp color={colors.primary} size={20} />
        <Text style={styles.addText}>{t('revisions.import.entry')}</Text>
      </Pressable>

      <ScoreHistory points={history} timezone={d.me.family.timezone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET + 16, backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  badge: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.separator, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  badgeOn: { color: colors.primary, backgroundColor: colors.primaryTint },
  empty: { textAlign: 'center', paddingVertical: 24 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TARGET + 4, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primaryTint },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
