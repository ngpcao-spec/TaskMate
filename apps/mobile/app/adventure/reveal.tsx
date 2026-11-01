import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AdventureReveal } from '@/components/adventure/AdventureReveal';
import { Screen, ScreenHeader } from '@/components/ui';
import { DEFAULT_PANDA_NAME } from '@/domain/panda';
import { useCompanion } from '@/hooks/useCompanion';
import { useMe } from '@/hooks/useMe';

/** Révélation de la trouvaille (D-105) : l'enfant seulement (un parent ne récupère jamais d'aventure). `?id=` = l'aventure. */
export default function RevealAdventureScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useMe().data;
  const childId = me?.member.role === 'child' ? me.member.child_id : null;
  const companion = useCompanion(childId).data;
  if (!me) return null;
  if (!childId || !id) return <Redirect href="/" />;
  const child = me.children.find((c) => c.id === childId);
  return (
    <Screen>
      <ScreenHeader title={t('adventure.journal.title')} />
      <AdventureReveal childId={childId} adventureId={id} childName={child?.name ?? ''} pandaName={companion?.name ?? DEFAULT_PANDA_NAME} stage={companion?.stage ?? 1} />
    </Screen>
  );
}
