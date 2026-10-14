import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Card } from '@/components/ui';
import { switchTheme, theme, THEME_IDS, type ThemeId } from '@/theme';
import { colors, typography } from '@/theme/tokens';

/** Choix de l'apparence (par appareil). Web : l'app se recharge et applique le thème ; natif : il faut fermer puis rouvrir l'app. */
export function ThemeCard() {
  const { t } = useTranslation();
  const [restart, setRestart] = useState(false);
  const pick = (id: ThemeId) => setRestart(switchTheme(id) === 'manual');
  return (
    <Card>
      <Text accessibilityRole="header" style={styles.section}>
        {t('theme.title')}
      </Text>
      <View style={styles.wrap}>
        {THEME_IDS.map((id) => (
          <Chip key={id} label={t(`theme.${id}`)} selected={theme.id === id} onPress={() => pick(id)} />
        ))}
      </View>
      {restart ? (
        <Text accessibilityLiveRegion="polite" style={typography.secondary}>
          {t('theme.restart')}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.title, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
