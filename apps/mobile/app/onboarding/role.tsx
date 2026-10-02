import { useRouter } from 'expo-router';
import { Mountain } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SplashBackground } from '@/components/SplashBackground';
import { MIN_TARGET, radius } from '@/theme/tokens';

/** Splash (maquette 1 : illustration, logo, slogan, « Bắt đầu ») puis choix du rôle (SPEC §2.1, §3.1). */
export default function RoleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [slogan1, slogan2] = t('app.slogan').split(/\s+—\s+|,\s+/);

  return (
    <View style={styles.root}>
      <SplashBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <Mountain color="#fff" size={56} strokeWidth={1.8} />
          <Text accessibilityRole="header" style={styles.name}>
            {t('app.name')}
          </Text>
          <Text style={styles.slogan}>
            {slogan1}
            {slogan2 ? `\n${slogan2}` : ''}
          </Text>
        </View>
        <View style={styles.actions}>
          {started ? (
            <>
              <Text accessibilityRole="header" style={styles.question}>
                {t('onboarding.role.title')}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.role.parent')} onPress={() => router.push('/onboarding/parent-auth')} style={styles.cta}>
                <Text style={styles.ctaText}>{t('onboarding.role.parent')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.role.child')} onPress={() => router.push('/onboarding/join')} style={[styles.cta, styles.ctaOutline]}>
                <Text style={[styles.ctaText, styles.ctaOutlineText]}>{t('onboarding.role.child')}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.start')} onPress={() => setStarted(true)} style={styles.cta}>
              <Text style={styles.ctaText}>{t('common.start')}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A3C8F' },
  safe: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 10, marginTop: 56 },
  name: { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },
  slogan: { color: '#fff', fontSize: 17, textAlign: 'center', lineHeight: 24, opacity: 0.95 },
  actions: { gap: 12 },
  question: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  cta: { minHeight: MIN_TARGET + 12, borderRadius: radius.pill, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#0A2A66', fontSize: 17, fontWeight: '700' },
  ctaOutline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#fff' },
  ctaOutlineText: { color: '#fff' },
});
