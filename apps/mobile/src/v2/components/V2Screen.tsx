import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v2Colors, v2Shadow, v2Spacing, v2Text, V2_TOUCH } from '../theme';

/** Bouton retour rond (≥ 44 pt) : page précédente, ou l'accueil V2 quand il n'y a pas d'historique (PWA rouverte sur cette page). */
export function V2BackButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/v2'));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={back} style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]} testID="v2-back">
      <ChevronLeft size={24} color={v2Colors.onTopButton} />
    </Pressable>
  );
}

/**
 * Page V2 simple (fond vert doux, titre, contenu défilant, largeur bornée sur grand écran).
 * `back` : page ouverte par-dessus les onglets (ex. Menu) → bouton retour à gauche du titre ; la PWA n'a pas de bouton retour du navigateur.
 */
export function V2Screen({ title, children, right, back = false, testID }: { title?: string; children: ReactNode; right?: ReactNode; back?: boolean; testID?: string }) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen} testID={testID}>
      <ScrollView role="main" contentContainerStyle={styles.content}>
        {title ? (
          <View style={styles.header}>
            {back ? <V2BackButton /> : null}
            <Text accessibilityRole="header" style={[v2Text.title, styles.flex]}>
              {title}
            </Text>
            {right}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const V2_MAX_WIDTH = 640;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2Colors.background },
  content: { padding: v2Spacing.lg, gap: v2Spacing.md, paddingBottom: 32, width: '100%', maxWidth: V2_MAX_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md, minHeight: 44 },
  flex: { flex: 1 },
  back: { width: V2_TOUCH, height: V2_TOUCH, borderRadius: V2_TOUCH / 2, backgroundColor: v2Colors.topButton, alignItems: 'center', justifyContent: 'center', ...v2Shadow },
  pressed: { transform: [{ scale: 0.94 }] },
});
