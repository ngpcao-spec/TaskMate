import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { DestinationPicker } from '@/components/adventure/DestinationPicker';
import { Screen, ScreenHeader } from '@/components/ui';
import { DEFAULT_PANDA_NAME } from '@/domain/panda';
import { useAdventure } from '@/hooks/useAdventure';
import { useCompanion } from '@/hooks/useCompanion';
import { useMe } from '@/hooks/useMe';
import { colors } from '@/theme/tokens';

/** Choix de la destination (D-105) : l'enfant seulement (un parent ne lance jamais d'aventure). */
export default function ChooseAdventureScreen() {
  const { t } = useTranslation();
  const me = useMe().data;
  const childId = me?.member.role === 'child' ? me.member.child_id : null;
  const adventure = useAdventure(childId).data;
  const companion = useCompanion(childId).data;
  if (!me) return null;
  if (!childId) return <Redirect href="/" />;
  return (
    <Screen>
      <ScreenHeader title={t('adventure.choose.title')} />
      {adventure ? <DestinationPicker childId={childId} pandaName={companion?.name ?? DEFAULT_PANDA_NAME} adventure={adventure} /> : <ActivityIndicator color={colors.accent} />}
    </Screen>
  );
}
