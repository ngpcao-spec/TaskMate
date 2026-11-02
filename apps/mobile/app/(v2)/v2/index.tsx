import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SceneHeader } from '@/v2/components/SceneHeader';
import { v2Card, v2Colors, v2Spacing, v2Text } from '@/v2/theme';

/** Accueil V2 provisoire (lot A1 : fondations). Remplacé par les écrans enfant (A2) et parent (A3). */
export default function V2Home() {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <SceneHeader scene="home" height={320} />
      <View style={[v2Card, styles.card]}>
        <Text style={v2Text.bodyBold}>{t('v2.placeholder')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2Colors.background },
  card: { margin: v2Spacing.lg },
});
