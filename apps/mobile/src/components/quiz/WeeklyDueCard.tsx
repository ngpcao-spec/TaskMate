import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassTile } from '@/components/GlassTile';
import type { WeeklyItem } from '@/domain/weekly-quiz';
import { colors, glass, line, MIN_TARGET, radius } from '@/theme/tokens';

/** Texte d'état d'un quiz (enfant : « Đợi phụ huynh duyệt » ; parent : « Cần duyệt »). */
export function weeklyStateText(t: (key: string, o?: Record<string, unknown>) => string, item: WeeklyItem, role: 'parent' | 'child'): string {
  switch (item.state) {
    case 'in_progress':
      return t('weekly.state.in_progress', { done: item.progress?.answered ?? 0, total: item.progress?.total ?? 0 });
    case 'waiting':
      return t(role === 'parent' ? 'weekly.state.toValidate' : 'weekly.state.waiting');
    case 'upcoming':
      return t('weekly.state.upcoming');
    case 'validated':
      return item.pointsAwarded > 0 ? t('weekly.state.validatedPoints', { points: item.pointsAwarded }) : t('weekly.state.validated');
    default:
      return t(role === 'parent' ? 'weekly.state.todoParent' : 'weekly.state.todo');
  }
}

export type BadgeTone = 'warning' | 'success' | 'primary' | 'neutral';
/** Pastille d'état : fonds opaques du thème (D-076), texte jamais `text`. */
export function Badge({ text, tone }: { text: string; tone: BadgeTone }) {
  const bg = tone === 'warning' ? colors.warningTint : tone === 'success' ? colors.successTint : tone === 'neutral' ? colors.cardStrong : colors.primaryTint;
  const fg = tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : tone === 'neutral' ? colors.textSecondary : colors.accent;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export const toneOf = (item: WeeklyItem, role: 'parent' | 'child'): BadgeTone =>
  item.state === 'upcoming' ? 'neutral' : item.state === 'validated' ? 'success' : item.state === 'waiting' && role === 'parent' ? 'warning' : 'primary';

/** Ouverture depuis le calendrier. Enfant : reprise de la tentative en cours, sinon la page du quiz. Parent : « Cần duyệt » → la validation existante ; sinon l'écran Ôn tập de l'enfant. */
export function useWeeklyOpen(role: 'parent' | 'child', onSelectChild?: (id: string) => void) {
  const router = useRouter();
  return (item: WeeklyItem, childId: string) => {
    if (role === 'child') {
      router.push({ pathname: item.state === 'in_progress' ? '/quiz/evaluate/[id]' : '/quiz/[id]', params: { id: item.quizId } });
    } else if (item.state === 'waiting' && item.attemptId) {
      router.push({ pathname: '/quiz/attempt/[id]', params: { id: item.attemptId } });
    } else {
      onSelectChild?.(childId);
      router.push({ pathname: '/weekly', params: { child: childId } });
    }
  };
}

/** Carte « date limite » du calendrier. */
export function WeeklyDueCard({ item, role, childId, childName, onSelectChild }: { item: WeeklyItem; role: 'parent' | 'child'; childId: string; childName: string; onSelectChild?: (id: string) => void }) {
  const { t } = useTranslation();
  const openItem = useWeeklyOpen(role, onSelectChild);
  const stateText = weeklyStateText(t, item, role);
  const label = t(role === 'parent' ? 'weekly.dueCardParent' : 'weekly.dueCard', { title: item.title, name: childName });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[label, stateText, item.late ? t('weekly.late') : null].filter(Boolean).join(', ')} onPress={() => openItem(item, childId)} style={styles.dueCard}>
      <GlassTile size={44}>
        <BookOpen color={colors.accent} size={22} />
      </GlassTile>
      <View style={styles.flex}>
        <Text numberOfLines={2} style={styles.title}>
          {label}
        </Text>
        <View style={styles.badges}>
          <Badge text={stateText} tone={toneOf(item, role)} />
          {item.late ? <Badge text={t('weekly.late')} tone="warning" /> : null}
        </View>
      </View>
      <ChevronRight color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  dueCard: { ...glass, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET + 16, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: line.width, borderColor: colors.glassBorder },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
