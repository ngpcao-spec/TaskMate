import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useOnline, usePendingWrites } from '@/hooks/useSyncStatus';
import { colors } from '@/theme/tokens';

/** Bandeau discret : hors ligne, ou N écritures en cours de synchronisation. Rien si tout est à jour. */
export function SyncBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  const pending = usePendingWrites();
  if (online && pending === 0) return null;
  return (
    <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" style={[styles.bar, !online && styles.offline]}>
      <Text style={styles.text}>{online ? t('sync.pending', { count: pending }) : t('sync.offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 16 },
  offline: { backgroundColor: colors.text },
  text: { color: colors.onPrimary, fontSize: 13, textAlign: 'center' },
});
