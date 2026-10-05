import { type ChangeEvent, type CSSProperties } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type Props = { label: string; mode: 'date' | 'time'; value: string; onChange: (value: string) => void; error?: string | null };

/**
 * Version web (PWA, Safari iOS) : champs natifs <input type="time|date"> — le navigateur affiche son propre
 * sélecteur (roulette sur iOS). Les valeurs restent des chaînes locales « HH:MM » / « YYYY-MM-DD » telles que le
 * navigateur les fournit : aucun passage par Date ni par un timestamp UTC (le jour reste celui de la famille).
 */
export function PickerField({ label, mode, value, onChange, error }: Props) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (next) onChange(next); // champ vidé (bouton « Effacer » du navigateur) : on garde la valeur courante
  };
  return (
    <View style={styles.wrap}>
      <Text style={typography.secondary}>{label}</Text>
      <input
        type={mode}
        value={value}
        onChange={handle}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        required
        style={inputStyle}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

// 16 px minimum : en dessous, Safari iOS zoome la page au focus.
const inputStyle: CSSProperties = {
  boxSizing: 'border-box',
  minHeight: MIN_TARGET,
  width: '100%',
  borderRadius: 12,
  border: '1px solid #DDE5F0',
  backgroundColor: colors.card,
  color: colors.text,
  fontSize: 16,
  fontFamily: 'inherit',
  paddingLeft: 16,
  paddingRight: 16,
};

const styles = StyleSheet.create({
  wrap: { gap: 4, flex: 1 },
  error: { color: colors.danger, fontSize: 13 },
});
