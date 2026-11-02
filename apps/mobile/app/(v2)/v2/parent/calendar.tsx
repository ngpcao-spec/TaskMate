import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import V1Calendar from '../../../(tabs)/calendar';
import { v2Colors, v2Shadow, v2Spacing } from '@/v2/theme';

/**
 * Lịch du parent (V2) : le calendrier de la V1 (planification, ouverture d'une tâche) et « + » pour créer une tâche ou une récurrence ; le formulaire
 * (`/task/new`, logique unique `TaskForm`) propose la grille des 36 icônes dans l'interface V2.
 */
export default function V2ParentCalendar() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <V1Calendar />
      <Pressable accessibilityRole="button" accessibilityLabel={t('today.addTask')} onPress={() => router.push('/task/new')} style={styles.fab} testID="v2-add-task">
        <Plus size={28} color={v2Colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fab: { position: 'absolute', right: v2Spacing.lg, bottom: v2Spacing.lg, width: 60, height: 60, borderRadius: 30, backgroundColor: v2Colors.primary, alignItems: 'center', justifyContent: 'center', ...v2Shadow },
});
