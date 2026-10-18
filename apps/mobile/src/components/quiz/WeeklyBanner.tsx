import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassTile } from '@/components/GlassTile';
import { subjectText } from '@/components/quiz/subject';
import { formatDueDay, type CalendarLanguage } from '@/domain/calendar';
import type { Banner } from '@/domain/weekly-review';
import { colors, glass, line, MIN_TARGET, radius, typography } from '@/theme/tokens';

type Props = {
  banner: Banner;
  /** Parent : bandeau d'UN enfant (prénom en préfixe, « Cần duyệt (n) » en priorité). Enfant : le sien, sans prénom. */
  role: 'parent' | 'child';
  childId: string;
  childName: string;
};

/**
 * Bandeau « Ôn tập » de Hôm nay (D-084) : UN seul bandeau fin à la place d'une ligne par quiz. Un appui ouvre l'écran Ôn tập (de cet enfant côté parent).
 * Tout est calculé par `bannerModel` (domaine) ; le composant n'affiche que.
 */
export function WeeklyBanner({ banner, role, childId, childName }: Props) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const prefix = role === 'parent' ? `${childName} · ` : '';
  const title = banner.total === 0
    ? t('weekly.review.title')
    : banner.done
    ? t('weekly.banner.done', { week: banner.weekNo })
    : t('weekly.banner.title', { week: banner.weekNo, done: banner.validated, total: banner.total });
  const nearest = banner.nearest;
  const nearestText = nearest
    ? t('weekly.banner.nearest', { subject: nearest.item.subject ? subjectText(t, nearest.item.subject) : nearest.item.title, day: formatDueDay(nearest.item.dueOn as string, lang) })
    : null;
  const toValidate = role === 'parent' && banner.toValidate > 0 ? t('weekly.banner.toValidate', { count: banner.toValidate }) : null;
  const waitingText = !toValidate && !nearestText && banner.waiting > 0 ? t('weekly.banner.waiting', { count: banner.waiting }) : null;
  const detail = toValidate ?? nearestText ?? waitingText;
  const urgent = !toValidate && !!nearest?.urgent;
  const label = [prefix + title, detail, urgent && nearest && nearest.days < 0 ? t('weekly.late') : null].filter(Boolean).join(', ');
  const ratio = banner.total > 0 ? banner.validated / banner.total : 0;
  const open = () => router.push(role === 'parent' ? { pathname: '/weekly', params: { child: childId } } : { pathname: '/weekly' });

  if (banner.done && !toValidate) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={open} style={styles.quiet}>
        <BookOpen color={colors.textSecondary} size={20} />
        <Text style={[typography.secondary, styles.flex]}>{prefix + title}</Text>
        <ChevronRight color={colors.textSecondary} size={20} />
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={open} style={styles.card}>
      <GlassTile size={48}>
        <BookOpen color={colors.accent} size={24} />
      </GlassTile>
      <View style={styles.flex}>
        <Text numberOfLines={2} style={styles.title}>
          {prefix + title}
        </Text>
        <View accessible={false} style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
        {detail ? (
          <Text numberOfLines={2} style={[styles.detail, toValidate ? styles.validate : urgent ? styles.urgent : null]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { ...glass, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 12 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET, paddingHorizontal: 6 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.separator, marginTop: 6, marginBottom: 4, overflow: 'hidden', borderWidth: line.width, borderColor: colors.glassBorder },
  fill: { height: '100%', backgroundColor: colors.primary },
  detail: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  urgent: { color: colors.danger },
  validate: { color: colors.warning },
});
