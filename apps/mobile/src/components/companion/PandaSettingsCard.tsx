import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Card } from '@/components/ui';
import { STAGE_OFFSETS, type StageOffset } from '@/domain/panda';
import { useCompanion, useSetStageOffset, useSetupCompanion } from '@/hooks/useCompanion';
import { colors, typography } from '@/theme/tokens';
import { PandaImage } from './PandaCompanion';
import { PandaForm } from './PandaForm';

const OFFSET_KEY: Record<StageOffset, 'younger' | 'same' | 'older'> = { [-1]: 'younger', 0: 'same', 1: 'older' };

/**
 * Réglages du panda DE L'ENFANT (D-104) : nom, trait et « garder le panda plus jeune / plus grand » (−1, 0, +1). Le décalage de stade n'est
 * modifiable que par l'enfant (le serveur refuse un parent) : cette carte n'est affichée que dans la session de l'enfant.
 */
export function PandaSettingsCard({ childId }: { childId: string }) {
  const { t } = useTranslation();
  const state = useCompanion(childId).data;
  const setup = useSetupCompanion();
  const offset = useSetStageOffset();
  if (!state || !state.hasCompanion) return null;
  const name = state.name ?? '';
  return (
    <Card>
      <View style={styles.head}>
        <PandaImage stage={state.stage} name={name} size={72} />
        <Text accessibilityRole="header" style={typography.title}>
          {t('panda.settings.title')}
        </Text>
      </View>
      <PandaForm
        key={`${name}/${state.trait}`}
        initialName={name}
        initialTrait={state.trait ?? 'kind'}
        submitLabel={t('panda.settings.save')}
        loading={setup.isPending}
        requireChange
        onSubmit={(n, trait) => setup.mutate({ childId, name: n, trait })}
      />
      <Text accessibilityRole="header" style={styles.label}>
        {t('panda.settings.stageTitle')}
      </Text>
      <Text style={styles.hint}>{t('panda.settings.stageHint')}</Text>
      <View style={styles.wrap}>
        {STAGE_OFFSETS.map((o) => (
          <Chip key={o} label={t(`panda.settings.${OFFSET_KEY[o]}`)} selected={state.stageOffset === o} onPress={() => offset.mutate({ childId, offset: o })} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { ...typography.body, fontWeight: '700', color: colors.text },
  hint: { ...typography.secondary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
