import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Button, Field } from '@/components/ui';
import { cleanPandaName, PANDA_NAME_MAX, PANDA_TRAITS, type PandaTrait } from '@/domain/panda';
import { colors, typography } from '@/theme/tokens';

type Props = {
  initialName: string;
  initialTrait: PandaTrait;
  submitLabel: string;
  loading?: boolean;
  /** Bouton secondaire optionnel (ex. « Plus tard » de la première étape). */
  secondary?: { label: string; onPress: () => void };
  /** Faux tant que rien n'a changé (écran de réglages). */
  requireChange?: boolean;
  onSubmit: (name: string, trait: PandaTrait) => void;
};

/** Nom (1 à 20 caractères) et trait du panda : même formulaire pour l'étape « Panda của em », les réglages de l'enfant et la fiche du parent. */
export function PandaForm({ initialName, initialTrait, submitLabel, loading = false, secondary, requireChange = false, onSubmit }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [trait, setTrait] = useState<PandaTrait>(initialTrait);
  const clean = cleanPandaName(name);
  const dirty = !requireChange || clean !== initialName || trait !== initialTrait;
  return (
    <View style={styles.form}>
      <Field label={t('panda.setup.nameLabel')} value={name} onChangeText={setName} maxLength={PANDA_NAME_MAX} error={clean === null ? t('panda.setup.nameInvalid') : null} />
      <Text accessibilityRole="header" style={styles.label}>
        {t('panda.setup.traitLabel')}
      </Text>
      <View style={styles.wrap}>
        {PANDA_TRAITS.map((id) => (
          <Chip key={id} label={t(`panda.trait.${id}`)} selected={trait === id} onPress={() => setTrait(id)} />
        ))}
      </View>
      <Button label={submitLabel} disabled={clean === null || !dirty} loading={loading} onPress={() => clean !== null && onSubmit(clean, trait)} />
      {secondary ? <Button variant="ghost" label={secondary.label} disabled={loading} onPress={secondary.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  label: { ...typography.body, fontWeight: '700', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
