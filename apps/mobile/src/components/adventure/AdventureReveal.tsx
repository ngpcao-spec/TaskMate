import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { PandaImage } from '@/components/companion/PandaCompanion';
import { Button, Card } from '@/components/ui';
import type { PandaStage } from '@/domain/panda';
import { pandaLineKey, pandaLineParams, storySituation } from '@/domain/panda-lines';
import { useAdventure, useCollectAdventure } from '@/hooks/useAdventure';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors, spacing, typography } from '@/theme/tokens';
import { discoveryImage } from './adventureImages';

/** Pause entre « surpris » et l'apparition de la trouvaille (aucune avec « réduire les animations »). */
export const REVEAL_DELAY_MS = 900;

type Props = { childId: string; adventureId: string; childName: string; pandaName: string; stage: PandaStage };

/**
 * Révélation (D-105) : `adventure_collect` part par la file d'écritures (id = celui de l'aventure : rejouable, le SERVEUR tire la trouvaille) ; le panda
 * est « surpris », puis la trouvaille apparaît (petit effet, sauf « réduire les animations ») avec son nom et une réplique de récit, puis « fier ».
 * Hors ligne : « en attente ». Rouvrir l'écran après coup relit la même trouvaille (`last` de `adventure_state`).
 */
export function AdventureReveal({ childId, adventureId, childName, pandaName, stage }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const adventure = useAdventure(childId).data;
  const collect = useCollectAdventure();
  const reduce = useReduceMotion();
  const mutate = collect.mutate;
  useEffect(() => {
    mutate({ childId, adventureId });
  }, [mutate, childId, adventureId]);

  const last = adventure?.last?.id === adventureId ? adventure.last : null;
  const result = collect.data ?? (last ? { discoverySlug: last.discoverySlug, duplicate: last.duplicate, destination: last.destination } : null);
  const slug = result?.discoverySlug ?? null;

  const [shownSlug, setShownSlug] = useState<string | null>(null);
  const [appear] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!slug) return;
    const timer = setTimeout(() => {
      setShownSlug(slug);
      if (!reduce) Animated.spring(appear, { toValue: 1, friction: 5, useNativeDriver: Platform.OS !== 'web' }).start();
    }, reduce ? 0 : REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [slug, reduce, appear]);

  const shown = slug !== null && shownSlug === slug;
  const destination = result ? t(`adventure.destinations.${result.destination}`) : '';
  const discovery = slug ? t(`adventure.discoveries.${slug}`) : '';
  const times = adventure?.found.find((f) => f.slug === slug)?.timesFound ?? 1;
  const situation = result?.duplicate ? 'adventure_duplicate' : (result && storySituation(result.destination)) || 'adventure_back';
  const image = slug ? discoveryImage(slug) : null;
  const appearStyle = reduce ? null : { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] };

  return (
    <Card>
      <View style={styles.center}>
        <Text accessibilityRole="header" style={typography.title}>
          {t('adventure.reveal.title', { name: pandaName })}
        </Text>
        <PandaImage stage={stage} expression={shown ? 'fier' : 'surpris'} name={pandaName} size={140} />
        {!result ? (
          <Text style={typography.secondary}>{collect.isPending ? (collect.isPaused ? t('adventure.pending') : t('adventure.reveal.opening')) : t('adventure.reveal.nothing')}</Text>
        ) : !shown ? (
          <Text style={typography.secondary}>{t('adventure.reveal.opening')}</Text>
        ) : (
          <>
            <Animated.View style={appearStyle}>
              {image ? <Image source={image} resizeMode="contain" accessibilityRole="image" accessibilityLabel={discovery} style={styles.discovery} /> : null}
            </Animated.View>
            <Text style={styles.found}>{t('adventure.reveal.found', { name: pandaName, discovery })}</Text>
            {result.duplicate ? <Text style={styles.duplicate}>{t('adventure.reveal.duplicate', { count: times })}</Text> : null}
            <Text accessibilityLiveRegion="polite" style={styles.story}>
              {t(pandaLineKey(stage, situation, times), pandaLineParams(childName, destination))}
            </Text>
          </>
        )}
      </View>
      <Button label={t('adventure.reveal.openJournal')} variant="secondary" onPress={() => router.replace('/adventure/journal')} />
      <Button label={t('adventure.reveal.done')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'))} />
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  discovery: { width: 160, height: 160 },
  found: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  duplicate: { fontSize: 14, fontWeight: '700', color: colors.accent },
  story: { fontSize: 15, color: colors.text, textAlign: 'center' },
});
