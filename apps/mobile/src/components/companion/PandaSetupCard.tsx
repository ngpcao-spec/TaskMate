import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { DEFAULT_PANDA_NAME, SKIPPED_PANDA_NAME, SKIPPED_PANDA_TRAIT, type CompanionState } from '@/domain/panda';
import { useSetupCompanion } from '@/hooks/useCompanion';
import { colors, typography } from '@/theme/tokens';
import { PandaImage } from './PandaCompanion';
import { PandaForm } from './PandaForm';

/**
 * Première fois (D-104) : l'enfant n'a pas encore de ligne dans `companions` → petite étape « Panda của em » (nom proposé « Bambou », 6 traits). Il peut la
 * passer : le panda s'appelle alors « Panda ». L'étape vient de la base (une fois par enfant, pas une fois par appareil) : elle disparaît dès que la ligne existe.
 */
export function PandaSetupCard({ childId, state }: { childId: string; state: CompanionState }) {
  const { t } = useTranslation();
  const setup = useSetupCompanion();
  return (
    <Card>
      <View style={styles.head}>
        <PandaImage stage={state.stage} name={SKIPPED_PANDA_NAME} size={96} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={typography.title}>
            {t('panda.setup.title')}
          </Text>
          <Text style={styles.intro}>{t('panda.setup.intro')}</Text>
        </View>
      </View>
      <PandaForm
        initialName={DEFAULT_PANDA_NAME}
        initialTrait="curious"
        submitLabel={t('panda.setup.save')}
        loading={setup.isPending}
        secondary={{ label: t('panda.setup.skip'), onPress: () => setup.mutate({ childId, name: SKIPPED_PANDA_NAME, trait: SKIPPED_PANDA_TRAIT }) }}
        onSubmit={(name, trait) => setup.mutate({ childId, name, trait })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
  intro: { fontSize: 14, color: colors.textSecondary },
});
