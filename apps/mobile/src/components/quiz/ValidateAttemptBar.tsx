import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { useValidateQuizAttempt } from '@/hooks/useQuizzes';
import { useToastStore } from '@/store/toast';
import { typography } from '@/theme/tokens';

/**
 * Validation d'une tentative envoyée (parent) : le parent choisit ICI s'il montre aussi la correction à l'enfant (désactivé par défaut) puis « Duyệt ».
 * Un seul composant pour le détail d'une tentative (D-055) et le détail d'un quiz (D-089) : la même mutation, jamais une copie de la logique.
 */
export function ValidateAttemptBar({ attemptId, onDone }: { attemptId: string; onDone?: () => void }) {
  const { t } = useTranslation();
  const validate = useValidateQuizAttempt();
  const show = useToastStore((s) => s.show);
  const [showCorrection, setShowCorrection] = useState(false);
  return (
    <>
      <View style={styles.switchRow}>
        <Text style={[typography.body, styles.flex]}>{t('revisions.showCorrection')}</Text>
        <Switch accessibilityLabel={t('revisions.showCorrection')} value={showCorrection} onValueChange={setShowCorrection} />
      </View>
      <Button
        label={t('revisions.validate')}
        loading={validate.isPending}
        onPress={() =>
          validate.mutate(
            { attemptId, showCorrection },
            {
              onSuccess: () => {
                show(t('revisions.validatedDone'));
                onDone?.();
              },
            },
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  flex: { flex: 1 },
});
