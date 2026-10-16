import { useRouter } from 'expo-router';
import { ChevronRight, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { Chip } from '@/components/Chip';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { weekStatusLabel, WeekStatusBadge } from '@/components/quiz/WeekStatus';
import { Button, Card } from '@/components/ui';
import { formatShortDate } from '@/domain/calendar';
import { canShift, COUNTRIES, gradesFor, isCountry, isGradeOf, SUBJECTS } from '@/domain/catalog';
import { quizWeekStatus } from '@/domain/quiz-week';
import { useChildSubjects, useParentCatalog, useRelaunchCatalogEvaluation, useSetChildClass, useSetChildSubject, useShiftChildSubject } from '@/hooks/useCatalog';
import { useToastStore } from '@/store/toast';
import type { ChildRow } from '@/types/models';
import { colors, line, MIN_TARGET, typography } from '@/theme/tokens';

/**
 * Révisions (parent) → catalogue (D-080) : la CLASSE de l'enfant (pays + classe), les matières ACTIVÉES, le décalage d'une semaine par matière, et l'état de
 * chaque QCM du catalogue distribué à cet enfant. La famille ne crée rien : l'enfant reçoit automatiquement le QCM de la semaine. Le parent ne voit
 * les bonnes réponses d'un QCM qu'une fois qu'il a été ENVOYÉ par son enfant (écran de validation).
 */
export function ParentCatalog({ child, today }: { child: ChildRow; today: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const show = useToastStore((s) => s.show);
  const subjects = useChildSubjects(child.id);
  const overview = useParentCatalog(child.id);
  const setClass = useSetChildClass();
  const setSubject = useSetChildSubject();
  const shift = useShiftChildSubject();
  const relaunch = useRelaunchCatalogEvaluation();
  const [countryEdit, setCountry] = useState<string | null>(null);
  const [gradeEdit, setGrade] = useState<string | null>(null);
  const country = countryEdit ?? child.country ?? COUNTRIES[0];
  // classe en LISTE FERMÉE du pays : changer de pays efface la classe choisie (VN ≠ FR)
  const grade = gradeEdit !== null ? gradeEdit : countryEdit === null || countryEdit === child.country ? child.grade : null;
  const hasClass = isCountry(child.country) && isGradeOf(child.country, child.grade);
  const changed = grade !== null && isGradeOf(country, grade) && (country !== (child.country ?? null) || grade !== (child.grade ?? null));
  const active = new Map((subjects.data ?? []).map((s) => [s.subject, s.week_offset]));
  const rows = overview.data ?? [];

  const offsetText = (offset: number) => (offset === 0 ? t('catalog.parent.offsetNone') : offset > 0 ? t('catalog.parent.offsetLater', { count: offset }) : t('catalog.parent.offsetEarlier', { count: -offset }));

  return (
    <>
      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('catalog.parent.classTitle')}</Text>
        <Text style={typography.secondary}>{t('catalog.parent.classHelp', { name: child.name })}</Text>
        <View style={styles.wrap}>
          {COUNTRIES.map((c) => (
            <Chip key={c} label={t(`catalog.countries.${c}`)} selected={country === c} onPress={() => { setCountry(c); setGrade(null); }} />
          ))}
        </View>
        <Text style={typography.secondary}>{t('catalog.grade')}</Text>
        <View style={styles.wrap}>
          {gradesFor(country).map((g) => (
            <Chip key={g} label={gradeText(t, country, g)} selected={grade === g} onPress={() => setGrade(g)} />
          ))}
        </View>
        {changed ? (
          <Button
            label={t('catalog.parent.saveClass')}
            loading={setClass.isPending}
            onPress={() => grade && setClass.mutate({ childId: child.id, country, grade }, { onSuccess: () => { setCountry(null); setGrade(null); show(t('catalog.parent.classSaved')); } })}
          />
        ) : null}
      </Card>

      {hasClass ? (
        <Card>
          <Text accessibilityRole="header" style={styles.section}>{t('catalog.parent.subjectsTitle')}</Text>
          <Text style={typography.secondary}>{t('catalog.parent.subjectsHelp')}</Text>
          <View style={styles.wrap}>
            {SUBJECTS.map((s) => (
              <Chip key={s} role="checkbox" label={subjectText(t, s)} selected={active.has(s)} onPress={() => setSubject.mutate({ childId: child.id, subject: s, active: !active.has(s) })} />
            ))}
          </View>
          {SUBJECTS.filter((s) => active.has(s)).map((s) => {
            const offset = active.get(s) ?? 0;
            return (
              <View key={s} style={styles.shiftRow}>
                <View style={styles.flex}>
                  <Text style={styles.shiftTitle}>{subjectText(t, s)}</Text>
                  <Text style={typography.secondary}>{offsetText(offset)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('catalog.parent.shiftEarlier', { subject: subjectText(t, s) })}
                  disabled={!canShift(offset, -1) || shift.isPending}
                  onPress={() => shift.mutate({ childId: child.id, subject: s, delta: -1 })}
                  style={[styles.shiftBtn, !canShift(offset, -1) && styles.off]}
                >
                  <Minus color={colors.primary} size={20} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('catalog.parent.shiftLater', { subject: subjectText(t, s) })}
                  disabled={!canShift(offset, 1) || shift.isPending}
                  onPress={() => shift.mutate({ childId: child.id, subject: s, delta: 1 })}
                  style={[styles.shiftBtn, !canShift(offset, 1) && styles.off]}
                >
                  <Plus color={colors.primary} size={20} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : (
        <Text style={typography.secondary}>{t('catalog.parent.noClass')}</Text>
      )}

      {hasClass && active.size > 0 && rows.length === 0 && !overview.isPending ? <Text style={[typography.secondary, styles.empty]}>{t('catalog.parent.emptyCatalog')}</Text> : null}
      {rows.map((r) => {
        const place = [r.week_label, subjectText(t, r.subject)].join(' · ');
        const dates = t('catalog.admin.dates', { from: formatShortDate(r.release_on), to: formatShortDate(r.due_on) });
        const week = r.available ? quizWeekStatus({ dueOn: r.due_on, today, attemptStatus: r.attempt_status, answered: r.answered_count, total: r.question_count }) : null;
        const weekText = week ? weekStatusLabel(t, week) : t('catalog.parent.notYet', { day: formatShortDate(r.release_on) });
        const submitted = r.attempt_id !== null && (r.attempt_status === 'submitted' || r.attempt_status === 'validated');
        const canRelaunch = r.attempt_status === 'validated';
        const body = (
          <View style={styles.flex}>
            <Text style={styles.title}>{r.title}</Text>
            <Text style={typography.secondary}>{place}</Text>
            <Text style={typography.secondary}>{dates}</Text>
            <WeekStatusBadge label={weekText} late={week?.late ?? false} />
            {r.score !== null && r.total !== null && r.attempt_status === 'validated' ? <Text style={typography.secondary}>{t('revisions.score', { score: r.score, total: r.total })}</Text> : null}
          </View>
        );
        return (
          <View key={r.quiz_id} style={styles.card}>
            {submitted ? (
              <Pressable accessibilityRole="button" accessibilityLabel={[r.title, place, dates, weekText].join(', ')} onPress={() => router.push({ pathname: '/quiz/attempt/[id]', params: { id: r.attempt_id as string } })} style={styles.cardMain}>
                {body}
                <ChevronRight color={colors.textSecondary} />
              </Pressable>
            ) : (
              <View accessible accessibilityLabel={[r.title, place, dates, weekText].join(', ')} style={styles.cardMain}>
                {body}
              </View>
            )}
            {canRelaunch ? (
              <Button
                variant="secondary"
                label={t('revisions.relaunch')}
                loading={relaunch.isPending}
                onPress={() => relaunch.mutate({ quizId: r.quiz_id, childId: child.id, attemptId: newId() }, { onSuccess: () => show(t('revisions.relaunched')) })}
              />
            ) : null}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1, gap: 4, alignItems: 'flex-start' },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', paddingVertical: 12 },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: MIN_TARGET },
  shiftTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  shiftBtn: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: line.width, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardStrong },
  off: { opacity: 0.35 },
  card: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET + 16 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
});
