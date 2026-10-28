import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AdminGate } from '@/components/admin/AdminGate';
import { Button, Card, ErrorText, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { classLabel, countriesLabel, formatDate } from '@/domain/admin-stats';
import { useAdminFamily } from '@/hooks/useAdminStats';
import { serverErrorCode } from '@/api/tasks';
import { colors, typography } from '@/theme/tokens';

const USAGE_ROWS = ['tasksCreated', 'tasksGenerated', 'tasksCompleted', 'tasksValidated', 'quizzesSubmitted', 'quizzesValidated', 'rewardRequests', 'aiCalls', 'avatarCalls'] as const;

/** Fiche d'une famille (D-102) : les mêmes champs que la liste + compteurs d'usage sur 30 jours. Aucun contenu, aucun prénom d'enfant. Lecture seule. */
export function AdminFamilyDetail() {
  return (
    <AdminGate>
      <Detail />
    </AdminGate>
  );
}

function Detail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useAdminFamily(typeof id === 'string' ? id : '');
  const f = q.data;
  return (
    <Screen>
      <ScreenHeader title={f?.name ?? t('adminStats.family.title')} multiline />
      {q.isPending && typeof id === 'string' ? <ActivityIndicator accessibilityLabel={t('adminStats.loading')} color={colors.primary} /> : null}
      {q.isError || typeof id !== 'string' ? (
        <View style={styles.gap}>
          <ErrorText>{serverErrorCode(q.error) === 'family_not_found' ? t('adminStats.family.notFound') : t('adminStats.error')}</ErrorText>
          <Button label={t('adminStats.retry')} variant="secondary" onPress={() => void q.refetch()} />
        </View>
      ) : null}
      {f ? (
        <>
          <Card>
            <Text style={[styles.badge, f.status === 'active' ? styles.badgeOn : null]}>{t(`adminStats.families.status.${f.status}`)}</Text>
            <Field label={t('adminStats.family.creator')} value={f.creatorEmail ?? t('adminStats.families.noEmail')} />
            <Field label={t('adminStats.family.countries')} value={countriesLabel(f.countries)} />
            <Field label={t('adminStats.kpi.parents')} value={String(f.parents)} />
            <Field label={t('adminStats.kpi.children')} value={String(f.children)} />
            <Field label={t('adminStats.family.classes')} value={f.classes.length === 0 ? t('adminStats.family.noChildren') : f.classes.map(classLabel).join(', ')} />
            <Field label={t('adminStats.families.created', { date: '' }).trim()} value={formatDate(f.createdAt)} />
            <Field label={t('adminStats.families.sort.last_active_at')} value={f.lastActiveAt ? formatDate(f.lastActiveAt) : t('adminStats.families.never')} />
            <Field label={t('adminStats.families.sort.notifications')} value={f.notifications ? t('adminStats.families.notificationsOn') : t('adminStats.families.notificationsOff')} />
            <Field label={t('adminStats.family.devices')} value={String(f.activeDevices)} />
          </Card>
          <SectionTitle>{t('adminStats.family.usage')}</SectionTitle>
          <Card>
            {USAGE_ROWS.map((key) => (
              <View key={key} accessible accessibilityLabel={`${t(`adminStats.usage.${key}`)}: ${f.usage30d[key]}`} style={styles.row}>
                <Text style={styles.label}>{t(`adminStats.usage.${key}`)}</Text>
                <Text style={styles.value}>{f.usage30d[key]}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

/** Ligne « libellé / valeur » en lecture seule (aucun champ de saisie : cet écran ne modifie rien). */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.field}>
      <Text style={typography.secondary}>{label}</Text>
      <Text selectable style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  field: { gap: 2, minHeight: 44, justifyContent: 'center' },
  fieldValue: { color: colors.text, fontSize: 16, fontWeight: '600' },
  badge: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  badgeOn: { color: colors.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, alignItems: 'center', gap: 8 },
  label: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  value: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
