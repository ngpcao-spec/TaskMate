import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { formatDueDay, type CalendarLanguage } from '@/domain/calendar';
import { DEFAULT_PANDA_NAME } from '@/domain/panda';
import { useAdventure } from '@/hooks/useAdventure';
import { useCompanion, useSetupCompanion } from '@/hooks/useCompanion';
import { colors, typography } from '@/theme/tokens';
import { PandaImage } from './PandaCompanion';
import { PandaForm } from './PandaForm';

/**
 * Le panda d'UN enfant dans sa fiche (parent, D-104) : image, nom, niveau d'amitié. Le parent peut renommer le panda et choisir son trait ; jamais le stade
 * (décidé par l'enfant). Une seule fiche par enfant : jamais deux pandas côte à côte, jamais de comparaison entre enfants.
 */
export function ParentPandaCard({ childId, childName }: { childId: string; childName: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const state = useCompanion(childId).data;
  const adventure = useAdventure(childId).data;
  const setup = useSetupCompanion();
  const [editing, setEditing] = useState(false);
  if (!state) return null;
  const name = state.name ?? DEFAULT_PANDA_NAME;
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <PandaImage stage={state.stage} name={name} size={64} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('panda.parent.card', { child: childName })}
          </Text>
          {state.hasCompanion ? (
            <Text style={typography.secondary}>
              {name} · {t('panda.level', { level: state.level })}
            </Text>
          ) : (
            <Text style={typography.secondary}>{t('panda.parent.notSet', { child: childName })}</Text>
          )}
        </View>
      </View>
      {editing ? (
        <PandaForm
          initialName={name}
          initialTrait={state.trait ?? 'curious'}
          submitLabel={t('panda.parent.save')}
          loading={setup.isPending}
          requireChange={state.hasCompanion}
          onSubmit={(n, trait) => setup.mutate({ childId, name: n, trait }, { onSuccess: () => setEditing(false) })}
        />
      ) : (
        <Button variant="secondary" label={t('panda.parent.rename')} onPress={() => setEditing(true)} />
      )}
      <Text style={typography.secondary}>{t('panda.parent.stageNote')}</Text>
      {/* D-105 : l'aventure en cours de CET enfant et son carnet en lecture seule ; le parent ne lance ni ne récupère jamais d'aventure */}
      {adventure ? (
        <Text style={typography.body}>
          {adventure.active
            ? adventure.state === 'back'
              ? t('adventure.parent.back', { destination: t(`adventure.destinations.${adventure.active.destination}`) })
              : t('adventure.parent.inProgress', {
                  destination: t(`adventure.destinations.${adventure.active.destination}`),
                  date: formatDueDay(adventure.active.returnsOn, (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'vi') as CalendarLanguage),
                })
            : t('adventure.parent.none')}
        </Text>
      ) : null}
      <Button variant="secondary" label={t('adventure.parent.viewJournal')} onPress={() => router.push({ pathname: '/adventure/journal', params: { child: childId } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
});
