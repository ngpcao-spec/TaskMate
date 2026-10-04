import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '@/components/ui';
import { validateBirthDate } from '@/domain/birth-date';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

export const CHILD_PALETTE = [colors.primary, colors.mint, '#8B5CF6', '#F5A623', '#E5484D'] as const;

type Props = {
  name: string;
  onName: (v: string) => void;
  birthDate: string;
  onBirthDate: (v: string) => void;
  color: string;
  onColor: (v: string) => void;
  today: string;
};

/** Prénom, date de naissance et couleur d'un enfant : formulaire commun à l'onboarding et à « Ajouter un enfant ». */
export function ChildProfileFields({ name, onName, birthDate, onBirthDate, color, onColor, today }: Props) {
  const { t } = useTranslation();
  const birthError = birthDate === '' ? null : validateBirthDate(birthDate, today);
  return (
    <>
      <Field label={t('onboarding.children.name')} value={name} onChangeText={onName} maxLength={40} />
      <Field
        label={t('onboarding.children.birthDate')}
        placeholder="2012-05-01"
        value={birthDate}
        onChangeText={onBirthDate}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={birthError ? t(`onboarding.children.errors.${birthError}`) : null}
      />
      <Text style={typography.secondary}>{t('onboarding.children.color')}</Text>
      <View style={styles.palette}>
        {CHILD_PALETTE.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={`${t('onboarding.children.color')} ${c}`}
            accessibilityState={{ selected: color === c }}
            aria-checked={color === c}
            onPress={() => onColor(c)}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
          />
        ))}
      </View>
    </>
  );
}

/** Profil saisi complet et valide ? */
export const isChildProfileValid = (name: string, birthDate: string, today: string): boolean =>
  name.trim() !== '' && birthDate !== '' && validateBirthDate(birthDate, today) === null;

const styles = StyleSheet.create({
  palette: { flexDirection: 'row', gap: 12 },
  swatch: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: 3, borderColor: 'transparent' },
  swatchSelected: { borderColor: colors.text },
});
