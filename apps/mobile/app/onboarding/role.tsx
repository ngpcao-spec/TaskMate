import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Screen, Title } from '@/components/ui';
import { colors, typography } from '@/theme/tokens';

/** Splash (logo + slogan + « Bắt đầu ») puis choix du rôle (SPEC §2.1, §3.1). */
export default function RoleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [started, setStarted] = useState(false);

  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <View style={styles.logo} accessible accessibilityLabel={t('app.name')}>
          <Text style={styles.logoMark}>✓</Text>
        </View>
        <Text style={[typography.title, styles.name]}>{t('app.name')}</Text>
        <Text style={[typography.secondary, styles.slogan]}>{t('app.slogan')}</Text>
      </View>
      {started ? (
        <View style={styles.actions}>
          <Title>{t('onboarding.role.title')}</Title>
          <Button label={t('onboarding.role.parent')} onPress={() => router.push('/onboarding/parent-auth')} />
          <Button
            variant="secondary"
            label={t('onboarding.role.child')}
            onPress={() => router.push('/onboarding/join')}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button label={t('common.start')} onPress={() => setStarted(true)} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: { color: '#fff', fontSize: 52, fontWeight: '700' },
  name: { color: colors.text, fontSize: 30 },
  slogan: { textAlign: 'center', paddingHorizontal: 24 },
  actions: { gap: 12 },
});
