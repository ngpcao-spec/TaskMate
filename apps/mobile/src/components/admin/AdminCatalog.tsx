import { useRouter } from 'expo-router';
import { ChartNoAxesColumn, ChevronRight, FilePlus, Plus, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminGate } from '@/components/admin/AdminGate';
import { PurgeQuizDialog } from '@/components/admin/PurgeQuizDialog';
import { Chip } from '@/components/Chip';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { Card, Screen, ScreenHeader } from '@/components/ui';
import { formatShortDate } from '@/domain/calendar';
import { adminQuizState, COUNTRIES, filterCatalog, gradesFor, SUBJECTS, type AdminQuizState } from '@/domain/catalog';
import { todayInTz } from '@/domain/family-time';
import { useCatalogList } from '@/hooks/useCatalog';
import { useMe } from '@/hooks/useMe';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/** Administration → Catalogue : les QCM par pays / classe / matière / semaine, avec leur état et leurs dates (jours locaux). */
export function AdminCatalog() {
  return (
    <AdminGate>
      <Catalog />
    </AdminGate>
  );
}

function Catalog() {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe().data;
  const list = useCatalogList();
  const [country, setCountry] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [purgeId, setPurgeId] = useState<string | null>(null);
  const all = useMemo(() => list.data ?? [], [list.data]);
  const shown = useMemo(() => filterCatalog(all, { country, grade, subject }), [all, country, grade, subject]);
  if (!me) return null;
  const today = todayInTz(new Date(), me.family.timezone);

  return (
    <Screen>
      <ScreenHeader title={t('catalog.admin.title')} />
      <Text style={typography.secondary}>{t('catalog.admin.intro')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.admin.import')} onPress={() => router.push('/admin/import')} style={styles.add}>
        <FilePlus color={colors.primary} size={20} />
        <Text style={styles.addText}>{t('catalog.admin.import')}</Text>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel={t('adminStats.entry')} accessibilityHint={t('adminStats.entryHint')} onPress={() => router.push('/admin/users')} style={styles.addPlain}>
        <ChartNoAxesColumn color={colors.primary} size={20} />
        <Text style={styles.addText}>{t('adminStats.entry')}</Text>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.admin.newEmpty')} onPress={() => router.push('/admin/new')} style={styles.addPlain}>
        <Plus color={colors.primary} size={20} />
        <Text style={styles.addText}>{t('catalog.admin.newEmpty')}</Text>
      </Pressable>

      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('catalog.filters.title')}</Text>
        <Text style={typography.secondary}>{t('catalog.country')}</Text>
        <View style={styles.wrap}>
          <Chip label={t('catalog.filters.all')} selected={country === null} onPress={() => { setCountry(null); setGrade(null); }} />
          {COUNTRIES.map((c) => (
            <Chip key={c} label={t(`catalog.countries.${c}`)} selected={country === c} onPress={() => { setCountry(c); setGrade(null); }} />
          ))}
        </View>
        <Text style={typography.secondary}>{t('catalog.grade')}</Text>
        {country === null ? (
          <Text style={typography.secondary}>{t('catalog.filters.pickCountry')}</Text>
        ) : (
          // TOUTES les classes du pays, qu'elles aient déjà un QCM ou non (liste fermée)
          <View style={styles.wrap}>
            <Chip label={t('catalog.filters.all')} selected={grade === null} onPress={() => setGrade(null)} />
            {gradesFor(country).map((g) => (
              <Chip key={g} label={gradeText(t, country, g)} selected={grade === g} onPress={() => setGrade(g)} />
            ))}
          </View>
        )}
        <Text style={typography.secondary}>{t('catalog.subjectLabel')}</Text>
        <View style={styles.wrap}>
          <Chip label={t('catalog.filters.all')} selected={subject === null} onPress={() => setSubject(null)} />
          {SUBJECTS.map((s) => (
            <Chip key={s} label={subjectText(t, s)} selected={subject === s} onPress={() => setSubject(s)} />
          ))}
        </View>
      </Card>

      {list.isPending ? <ActivityIndicator /> : null}
      {!list.isPending && shown.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('catalog.admin.empty')}</Text> : null}
      {shown.map((q) => {
        const state: AdminQuizState = adminQuizState({ status: q.status, releaseOn: q.release_on, dueOn: q.due_on }, today);
        const place = [t(`catalog.countries.${q.country}`), gradeText(t, q.country, q.grade), subjectText(t, q.subject)].join(' · ');
        const dates = q.release_on && q.due_on ? t('catalog.admin.dates', { from: formatShortDate(q.release_on), to: formatShortDate(q.due_on) }) : t('catalog.admin.noDates');
        const count = t('revisions.questionCount', { count: q.question_count });
        const verify = q.to_verify_count > 0 ? t('catalog.admin.toVerify', { count: q.to_verify_count }) : null;
        return (
          <View key={q.id} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={[`${q.week_label} — ${q.title}`, place, t(`catalog.state.${state}`), dates, count, verify].filter(Boolean).join(', ')}
              onPress={() => router.push({ pathname: '/admin/[id]', params: { id: q.id } })}
              style={styles.cardMain}
            >
              <View style={styles.flex}>
                <Text style={styles.title}>{`${q.week_label} — ${q.title}`}</Text>
                <Text style={typography.secondary}>{place}</Text>
                <Text style={typography.secondary}>{dates}</Text>
                <Text style={typography.secondary}>{[count, verify].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={[styles.badge, state === 'open' ? styles.badgeOn : null]}>{t(`catalog.state.${state}`)}</Text>
              <ChevronRight color={colors.textSecondary} />
            </Pressable>
            {/* suppression définitive (D-091) : bouton frère de la carte (jamais un bouton dans un bouton) */}
            <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.purge.actionFor', { title: q.title })} onPress={() => setPurgeId(q.id)} style={styles.trash}>
              <Trash2 color={colors.danger} size={20} />
            </Pressable>
          </View>
        );
      })}
      <PurgeQuizDialog quizId={purgeId ?? ''} visible={purgeId !== null} onClose={() => setPurgeId(null)} onPurged={() => setPurgeId(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', paddingVertical: 24 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: 16, paddingLeft: 16, paddingRight: 6, paddingVertical: 12 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET + 16 },
  trash: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  badge: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.separator, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  badgeOn: { color: colors.primary, backgroundColor: colors.primaryTint },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TARGET + 4, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primaryTint },
  addPlain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TARGET, borderRadius: 16, borderWidth: 1.5, borderColor: colors.glassBorder, backgroundColor: colors.card },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
