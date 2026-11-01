import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { AdventurePanel } from '@/components/adventure/AdventurePanel';
import { destinationImage, POSTCARD_RATIO } from '@/components/adventure/adventureImages';
import { NavyPanel } from '@/components/ui';
import type { AdventureState } from '@/domain/adventure';
import { DEFAULT_PANDA_NAME, expressionForMood, friendshipLevel, pandaMood, usesStagePose, type CompanionState, type PandaExpression, type PandaMood } from '@/domain/panda';
import { pandaLineKey, pandaLineParams, pickPandaLine, type PandaSituation } from '@/domain/panda-lines';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { usePandaReaction } from '@/store/pandaReaction';
import { colors, radius, spacing } from '@/theme/tokens';
import { pandaExpressionImage, pandaStageImage } from './pandaImages';

type ImageProps = { stage: CompanionState['stage']; mood?: PandaMood; /** Expression imposée (révélation d'une aventure : « surpris », « fier »). */ expression?: PandaExpression; name: string; size: number };

/** Image du panda : pose en pied du stade (calme, content) ou expression de l'humeur. Libellé lu par les lecteurs d'écran : « Panda Bambou, très heureux ». */
export function PandaImage({ stage, mood = 'calme', expression, name, size }: ImageProps) {
  const { t } = useTranslation();
  const source = expression ? pandaExpressionImage(expression) : usesStagePose(mood) ? pandaStageImage(stage) : pandaExpressionImage(expressionForMood(mood));
  return (
    <Image
      source={source}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={t('panda.imageLabel', { name, mood: t(`panda.mood.${expression ?? mood}`) })}
      style={{ width: size, height: size }}
    />
  );
}

type Props = {
  childId: string;
  childName: string;
  state: CompanionState;
  /** Tâches du JOUR LOCAL de cet enfant : faites (cochées, en attente ou validées) et prévues. */
  done: number;
  total: number;
  /** Heure locale de la famille (0..23) : le panda s'endort après 20 h si rien n'est fait. */
  localHour: number;
  /** Aventures (D-105) : jauge, départ, voyage, retour. Absent : le panda seul (lot 1). */
  adventure?: AdventureState;
};

/** Réplique liée à l'aventure (prête, en voyage, rentrée) ; sinon celle du jour. */
const ADVENTURE_SITUATION: Partial<Record<AdventureState['state'], PandaSituation>> = { ready_to_go: 'adventure_ready', away: 'adventure_away', back: 'adventure_back' };

/**
 * Compagnon de l'enfant dans Hôm nay (D-104) : image, nom, bulle, barre d'énergie ⚡ et niveau d'amitié. Affiché dans les cinq thèmes (ce n'est pas un décor),
 * sur le panneau marine du thème (fond opaque). Réaction IMMÉDIATE au coche : expression « très heureux » 2 s, « +5 ⚡ », petit rebond (sauf si
 * « réduire les animations » est activé).
 */
export function PandaCompanion({ childId, childName, state, done, total, localHour, adventure }: Props) {
  const { t } = useTranslation();
  const reacting = usePandaReaction((s) => s.active && s.childId === childId);
  const reactionId = usePandaReaction((s) => (s.childId === childId ? s.id : 0));
  const reduceMotion = useReduceMotion();
  const [lift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reactionId === 0 || reduceMotion) return;
    const native = Platform.OS !== 'web';
    Animated.sequence([
      Animated.timing(lift, { toValue: -12, duration: 140, useNativeDriver: native }),
      Animated.spring(lift, { toValue: 0, friction: 4, useNativeDriver: native }),
    ]).start();
  }, [reactionId, reduceMotion, lift]);

  const name = state.name ?? DEFAULT_PANDA_NAME;
  const mood: PandaMood = reacting ? 'tres-heureux' : pandaMood(done, total, localHour);
  const progress = friendshipLevel(state.energyTotal);
  const adventureSituation = !reacting && adventure ? ADVENTURE_SITUATION[adventure.state] : undefined;
  const travelling = adventure?.state === 'away' ? adventure.active : null;
  const destinationName = adventure?.active ? t(`adventure.destinations.${adventure.active.destination}`) : '';
  const key = adventureSituation
    ? pandaLineKey(state.stage, adventureSituation, done)
    : pickPandaLine({ stage: state.stage, done, total, localHour, event: reacting ? 'checked' : null, seed: done }).key;
  const speech = t(key, pandaLineParams(childName, destinationName));
  const postcard = travelling ? destinationImage(travelling.destination) : null;

  return (
    <NavyPanel>
      <View style={styles.row}>
        {travelling ? (
          // en voyage : la carte postale de la destination, et le panda reste visible en petit à côté (il ne disparaît jamais)
          <View style={styles.travel}>
            {postcard ? <Image source={postcard} resizeMode="contain" accessibilityRole="image" accessibilityLabel={t('adventure.away', { name, destination: destinationName })} style={styles.postcard} /> : null}
            <Animated.View style={[styles.smallPanda, { transform: [{ translateY: lift }] }]}>
              <PandaImage stage={state.stage} mood={mood} name={name} size={56} />
            </Animated.View>
          </View>
        ) : (
          <Animated.View style={{ transform: [{ translateY: lift }] }}>
            <PandaImage stage={state.stage} mood={mood} name={name} size={116} />
          </Animated.View>
        )}
        <View style={styles.info}>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          <Text style={styles.level}>{t('panda.level', { level: progress.level })}</Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t('panda.energy.value', { current: state.energyTotal, next: progress.next })}
            accessibilityValue={{ min: 0, max: progress.next, now: Math.min(state.energyTotal, progress.next) }}
            style={styles.energyRow}
          >
            <Text style={styles.energyIcon}>⚡</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress.progress * 100)}%` }]} />
            </View>
            <Text style={styles.energyText}>
              {state.energyTotal}/{progress.next}
            </Text>
          </View>
        </View>
      </View>
      <View accessibilityLiveRegion="polite" accessibilityLabel={t('panda.speech', { text: speech })} style={styles.bubble}>
        {reacting ? <Text style={styles.reaction}>{t('panda.reaction', pandaLineParams(childName))}</Text> : null}
        <Text style={styles.speech}>{speech}</Text>
      </View>
      {adventure ? <AdventurePanel childId={childId} pandaName={name} adventure={adventure} /> : null}
    </NavyPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  travel: { width: 132, height: 116, justifyContent: 'center' },
  postcard: { width: 116, height: Math.round(116 * POSTCARD_RATIO), borderRadius: radius.control },
  smallPanda: { position: 'absolute', right: 0, bottom: 0 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 22, fontWeight: '800', color: colors.onNavy },
  level: { fontSize: 13, color: colors.onNavySecondary },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  energyIcon: { fontSize: 16, color: colors.onNavy },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.trackOnNavy, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.ringOnNavy },
  energyText: { fontSize: 12, fontWeight: '700', color: colors.onNavy, minWidth: 44, textAlign: 'right' },
  bubble: { backgroundColor: colors.cardSolid, borderRadius: radius.control, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  reaction: { fontSize: 18, fontWeight: '800', color: colors.accent },
  speech: { fontSize: 14, color: colors.text },
});
