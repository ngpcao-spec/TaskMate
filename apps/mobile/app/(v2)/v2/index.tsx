import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMe } from '@/hooks/useMe';
import { SceneHeader } from '@/v2/components/SceneHeader';
import { v2Card, v2Colors, v2Spacing, v2Text } from '@/v2/theme';

/** Aiguillage de la V2 : l'enfant vers ses onglets ; le parent vers les siens (lot A3 : accueil provisoire en attendant). */
export default function V2Index() {
  const { t } = useTranslation();
  const me = useMe().data;
  if (!me) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={v2Colors.primary} />
      </View>
    );
  }
  if (me.member.role === 'child') return <Redirect href="/v2/child/home" />;
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
  screen: { flex: 1, backgroundColor: v2Colors.background, justifyContent: 'flex-start' },
  card: { margin: v2Spacing.lg },
});
