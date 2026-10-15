import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { formatDueDay, type CalendarLanguage } from '@/domain/calendar';
import { todayInTz } from '@/domain/family-time';
import { isPastDue } from '@/domain/quiz-week';
import { useMe } from '@/hooks/useMe';
import { colors, typography } from '@/theme/tokens';

/**
 * Date limite d'un quiz (D-079) : « À finir avant dimanche 26/10 ». Le jour est celui de la FAMILLE (jamais dérivé de l'UTC). Une date passée est dite
 * sans reproche à l'enfant (« tu peux encore finir ») : le retard est une information et ne bloque jamais. Rien à afficher sans date limite.
 */
export function DueLabel({ dueOn }: { dueOn: string | null | undefined }) {
  const { t, i18n } = useTranslation();
  const me = useMe().data;
  if (!dueOn) return null;
  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage;
  const day = formatDueDay(dueOn, lang);
  const isChild = me?.member.role === 'child';
  const past = isPastDue(dueOn, todayInTz(new Date(), me?.family.timezone ?? 'Asia/Ho_Chi_Minh'));
  const text = isChild ? t(past ? 'revisions.week.duePast' : 'revisions.week.dueChild', { day }) : t('revisions.week.dueParent', { day });
  return <Text style={[typography.secondary, past && isChild ? styles.past : null]}>{text}</Text>;
}

const styles = StyleSheet.create({ past: { color: colors.warning, fontWeight: '600' } });
