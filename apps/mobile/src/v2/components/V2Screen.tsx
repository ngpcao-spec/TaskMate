import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v2Colors, v2Spacing, v2Text } from '../theme';

/** Page V2 simple (fond vert doux, titre, contenu défilant, largeur bornée sur grand écran). */
export function V2Screen({ title, children, right, testID }: { title?: string; children: ReactNode; right?: ReactNode; testID?: string }) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen} testID={testID}>
      <ScrollView role="main" contentContainerStyle={styles.content}>
        {title ? (
          <View style={styles.header}>
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
});
