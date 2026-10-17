import { useRouter } from 'expo-router';
import { BookOpen, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassTile } from '@/components/GlassTile';
import { subjectText } from '@/components/quiz/subject';
import { formatDueDay, type CalendarLanguage } from '@/domain/calendar';
import { shouldCollapse, type WeeklyItem } from '@/domain/weekly-quiz';
import type { WeeklyGroup } from '@/hooks/useWeeklyQuizzes';
import { colors, glass, line, MIN_TARGET, radius, typography } from '@/theme/tokens';

type Props = {
  groups: readonly WeeklyGroup[];
  role: 'parent' | 'child';
  /** Parent : sélectionne l'enfant avant d'ouvrir ses révisions. */
  onSelectChild?: (childId: string) => void;
};

/** Texte d'état d'une ligne (enfant : « En attente de validation » ; parent : « À valider »). */
export function weeklyStateText(t: (key: string, o?: Record<string, unknown>) => string, item: WeeklyItem, role: 'parent' | 'child'): string {
  switch (item.state) {
    case 'in_progress':
      return t('weekly.state.in_progress', { done: item.progress?.answered ?? 0, total: item.progress?.total ?? 0 });
    case 'waiting':
      return t(role === 'parent' ? 'weekly.state.toValidate' : 'weekly.state.waiting');
    case 'validated':
      return item.result ? t('weekly.state.validatedScore', { score: item.result.score, total: item.result.total }) : t('weekly.state.validated');
    default:
      return t(role === 'parent' ? 'weekly.state.todoParent' : 'weekly.state.todo');
  }
}

/**
 * « Révisions de la semaine » (D-083) : ligne CALCULÉE dans Hôm nay (aucune ligne dans `tasks`). Enfant : ses quiz seulement. Parent : un bloc par enfant, sans classement.
 * Plus d'une ligne pour un même enfant : repliées sous « Révisions (n) ».
 */
export function WeeklyQuizSection({ groups, role, onSelectChild }: Props) {
  const filled = groups.filter((g) => g.items.length > 0);
  if (filled.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {filled.map((g) => (
        <WeeklyBlock key={g.childId} group={g} role={role} showName={role === 'parent'} onSelectChild={onSelectChild} />
      ))}
    </View>
  );
}

function WeeklyBlock({ group, role, showName, onSelectChild }: { group: WeeklyGroup; role: 'parent' | 'child'; showName: boolean; onSelectChild?: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const collapsed = shouldCollapse(group.items.length);
  const lateCount = group.items.filter((i) => i.late).length;
  return (
    <View style={styles.block}>
      {showName ? (
        <Text accessibilityRole="header" style={styles.name}>
          {group.childName}
        </Text>
      ) : null}
      <View style={styles.list}>
        {collapsed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('weekly.group', { count: group.items.length })}${lateCount > 0 ? `, ${t('weekly.late')}` : ''}`}
            accessibilityState={{ expanded: open }}
            aria-expanded={open}
            onPress={() => setOpen((v) => !v)}
            style={styles.head}
          >
            <GlassTile size={44}>
              <BookOpen color={colors.accent} size={22} />
            </GlassTile>
            <Text style={styles.headText}>{t('weekly.group', { count: group.items.length })}</Text>
            {lateCount > 0 ? <Badge text={t('weekly.late')} tone="warning" /> : null}
            {open ? <ChevronUp color={colors.textSecondary} /> : <ChevronDown color={colors.textSecondary} />}
          </Pressable>
        ) : null}
        {!collapsed || open ? group.items.map((item, i) => <WeeklyLine key={item.quizId} item={item} role={role} childId={group.childId} onSelectChild={onSelectChild} separated={collapsed || i > 0} withIcon={!collapsed} />) : null}
      </View>
    </View>
  );
}

/** Ouverture d'une ligne. Enfant : reprise de la tentative en cours, sinon la page du quiz. Parent : « À valider » → la validation existante ; sinon les révisions de l'enfant. */
export function useWeeklyOpen(role: 'parent' | 'child', onSelectChild?: (id: string) => void) {
  const router = useRouter();
  return (item: WeeklyItem, childId: string) => {
    if (role === 'child') {
      router.push({ pathname: item.state === 'in_progress' ? '/quiz/evaluate/[id]' : '/quiz/[id]', params: { id: item.quizId } });
    } else if (item.state === 'waiting' && item.attemptId) {
      router.push({ pathname: '/quiz/attempt/[id]', params: { id: item.attemptId } });
    } else {
      onSelectChild?.(childId);
      router.push('/(tabs)/more/revisions');
    }
  };
}

/** Carte « date limite » du calendrier : mêmes ouvertures et mêmes états que la ligne de Hôm nay. */
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
          <Badge text={stateText} tone={item.state === 'validated' ? 'success' : item.state === 'waiting' && role === 'parent' ? 'warning' : 'primary'} />
          {item.late ? <Badge text={t('weekly.late')} tone="warning" /> : null}
        </View>
      </View>
      <ChevronRight color={colors.textSecondary} />
    </Pressable>
  );
}

function Badge({ text, tone }: { text: string; tone: 'warning' | 'success' | 'primary' }) {
  const bg = tone === 'warning' ? colors.warningTint : tone === 'success' ? colors.successTint : colors.primaryTint;
  const fg = tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.accent;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

function WeeklyLine({ item, role, childId, onSelectChild, separated, withIcon }: { item: WeeklyItem; role: 'parent' | 'child'; childId: string; onSelectChild?: (id: string) => void; separated: boolean; withIcon: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const due = item.dueOn ? t('weekly.dueBefore', { day: formatDueDay(item.dueOn, lang) }) : null;
  const subject = item.subject ? subjectText(t, item.subject) : null;
  const stateText = weeklyStateText(t, item, role);
  const title = t('weekly.line', { title: item.title });
  const tone = item.state === 'validated' ? 'success' : item.state === 'waiting' && role === 'parent' ? 'warning' : 'primary';
  const openItem = useWeeklyOpen(role, onSelectChild);
  const open = () => openItem(item, childId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subject, due, stateText, item.late ? t('weekly.late') : null].filter(Boolean).join(', ')}
      onPress={open}
      style={[styles.line, separated && styles.separated]}
    >
      {withIcon ? (
        <GlassTile size={44}>
          <BookOpen color={colors.accent} size={22} />
        </GlassTile>
      ) : null}
      <View style={styles.flex}>
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        {subject || due ? <Text style={typography.secondary}>{[subject, due].filter(Boolean).join(' · ')}</Text> : null}
        <View style={styles.badges}>
          <Badge text={stateText} tone={tone} />
          {item.late ? <Badge text={t('weekly.late')} tone="warning" /> : null}
        </View>
      </View>
      <ChevronRight color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  block: { gap: 6 },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  list: { ...glass, borderRadius: radius.card, paddingHorizontal: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET + 16 },
  headText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET + 16, paddingVertical: 10 },
  dueCard: { ...glass, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET + 16, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10 },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: line.width, borderColor: colors.glassBorder },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
