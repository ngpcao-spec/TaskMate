import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { AdventureJournal } from '@/components/adventure/AdventureJournal';
import { Screen, ScreenHeader } from '@/components/ui';
import { useAdventure } from '@/hooks/useAdventure';
import { useMe } from '@/hooks/useMe';
import { colors } from '@/theme/tokens';

/** Carnet « Sổ phiêu lưu » (D-105), lecture seule : l'enfant ouvre le sien ; un parent ouvre celui d'UN enfant de sa famille (`?child=`). */
export default function AdventureJournalScreen() {
  const { t } = useTranslation();
  const { child } = useLocalSearchParams<{ child?: string }>();
  const me = useMe().data;
  const isChild = me?.member.role === 'child';
  const target = me ? (isChild ? me.member.child_id : (me.children.find((c) => c.id === child)?.id ?? null)) : null;
  const adventure = useAdventure(target).data;
  if (!me) return null;
  const name = me.children.find((c) => c.id === target)?.name ?? '';
  return (
    <Screen>
      <ScreenHeader title={isChild ? t('adventure.journal.title') : t('adventure.journal.titleOf', { child: name })} />
      {!target ? null : adventure ? <AdventureJournal adventure={adventure} /> : <ActivityIndicator color={colors.accent} />}
    </Screen>
  );
}
