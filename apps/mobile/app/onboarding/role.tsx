import { useRouter } from 'expo-router';
import { Mountain } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassTile } from '@/components/GlassTile';
import { SplashBackground } from '@/components/SplashBackground';
import { colors, MIN_TARGET, radius, shadowSmall } from '@/theme/tokens';

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
          <GlassTile size={92}>
            <Mountain color={colors.accent} size={48} strokeWidth={1.8} />
          </GlassTile>
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
              <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.role.child')} onPress={() => router.push('/onboarding/child-login')} style={[styles.cta, styles.ctaOutline]}>
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
  root: { flex: 1, backgroundColor: colors.navyDeep },
  safe: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', gap: 12, marginTop: 56 },
  name: { color: colors.text, fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },
  slogan: { color: colors.text, fontSize: 17, textAlign: 'center', lineHeight: 24 },
  actions: { gap: 12 },
  question: { color: colors.onNavy, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  cta: { minHeight: MIN_TARGET + 12, borderRadius: radius.pill, backgroundColor: colors.primary, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', ...shadowSmall },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ctaOutline: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.55)' },
  ctaOutlineText: { color: colors.onNavy },
});
