import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { discoveryImage } from '@/components/adventure/adventureImages';
import { pandaExpressionImage, pandaStageImage } from '@/components/companion/pandaImages';
import { WALK_IN_MS } from '@/domain/adventure-trip';
import type { PandaStage, PandaVariant } from '@/domain/panda';
import { tripImage } from '../images';
import { v2Card, v2Colors, v2Spacing, v2Text, V2_TOUCH } from '../theme';
import { PandaWalker } from './PandaWalker';
import { V2Button } from './V2Button';

const GIFT = 72;
const FIND = 96;
const CONFETTI = 14;

type SceneProps = {
  stage: PandaStage;
  variant?: PandaVariant;
  pandaName: string;
  size: number;
  /** `enter` : il entre par la gauche ; `gift` : au centre, paquet fermé à ses pieds ; `open` : paquet ouvert, trouvaille qui monte */
  step: 'enter' | 'gift' | 'open';
  reduceMotion: boolean;
  onEntered: () => void;
  onOpen: () => void;
  /** paquet touché, résultat pas encore reçu */
  opening: boolean;
  /** trouvaille (paquet ouvert) */
  discovery?: string | null;
  destinationName: string;
};

/** Confettis légers (désactivés avec « réduire les animations ») : petits carrés qui tombent une fois en tournant. */
function Confetti() {
  const [fall] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(fall, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' });
    a.start();
    return () => a.stop();
  }, [fall]);
  const tones = [v2Colors.confettiA, v2Colors.confettiB, v2Colors.confettiC];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="v2-trip-confetti" importantForAccessibility="no-hide-descendants">
      {Array.from({ length: CONFETTI }, (_, i) => {
        const x = ((i * 37) % 100) / 100;
        const drift = (i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 6);
        return (
          <Animated.View
            key={i}
            style={[
              styles.confetto,
              {
                left: `${Math.round(x * 100)}%`,
                backgroundColor: tones[i % 3],
                opacity: fall.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-20, 160 + (i % 4) * 30] }) },
                  { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
                  { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 360}deg`] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * Retour d'aventure dans le décor de Hôm nay (D-107) : le panda entre par la gauche avec son sac et s'arrête au centre ; le paquet fermé apparaît à
 * ses pieds avec un petit rebond ; toucher le paquet (« Mở quà », ≥ 44 pt) l'ouvre ; paquet ouvert : lueur, confettis légers, la trouvaille monte
 * du paquet en grandissant. « Réduire les animations » : chaque étape s'affiche directement, sans mouvement ni confettis.
 */
export function ReturnScene({ stage, variant = 'boy', pandaName, size, step, reduceMotion, onEntered, onOpen, opening, discovery, destinationName }: SceneProps) {
  const { t } = useTranslation();
  const [pop] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [rise] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (step !== 'gift' || reduceMotion) return;
    pop.setValue(0);
    const a = Animated.spring(pop, { toValue: 1, friction: 4, tension: 80, useNativeDriver: Platform.OS !== 'web' });
    a.start();
    return () => a.stop();
  }, [step, reduceMotion, pop]);
  useEffect(() => {
    if (step !== 'open' || !discovery || reduceMotion) return;
    rise.setValue(0);
    const a = Animated.timing(rise, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.4)), useNativeDriver: Platform.OS !== 'web' });
    a.start();
    return () => a.stop();
  }, [step, discovery, reduceMotion, rise]);

  if (step === 'enter') {
    return (
      <PandaWalker
        testID="v2-trip-walk-in"
        stage={stage}
        size={size}
        direction="in"
        durationMs={WALK_IN_MS}
        reduceMotion={reduceMotion}
        onDone={onEntered}
        label={t('v2.trip.coming', { name: pandaName })}
      />
    );
  }
  const findImg = discovery ? discoveryImage(discovery) : null;
  return (
    <View style={[styles.stage, { height: size }]} testID={step === 'open' ? 'v2-trip-opened' : 'v2-trip-gift'}>
      <Image
        source={step === 'open' ? pandaExpressionImage('fier', 'small', variant) : pandaStageImage(stage, 'small', variant)}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel={t('panda.imageLabel', { name: pandaName, mood: t(`panda.mood.${step === 'open' ? 'fier' : 'content'}`) })}
        style={{ width: size, height: size }}
      />
      {step === 'gift' ? (
        <Animated.View style={[styles.gift, { transform: [{ scale: pop }] }]}>
          <Pressable
            testID="v2-trip-gift-button"
            accessibilityRole="button"
            accessibilityLabel={t('v2.adventure.openGift')}
            accessibilityState={{ busy: opening }}
            disabled={opening}
            onPress={onOpen}
            style={styles.giftHit}
          >
            <Image source={tripImage('gift-closed')} resizeMode="contain" style={styles.giftImg} importantForAccessibility="no" />
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.gift} pointerEvents="none">
          <View style={styles.glow} testID="v2-trip-glow" />
          <Image source={tripImage('gift-open')} resizeMode="contain" style={styles.giftImg} accessibilityRole="image" accessibilityLabel={t('v2.trip.gift', { destination: destinationName })} />
          {findImg ? (
            <Animated.View
              style={[
                styles.find,
                {
                  opacity: rise.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
                  transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [30, -FIND + 6] }) }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
                },
              ]}
              testID="v2-trip-find"
            >
              <Image source={findImg} resizeMode="contain" style={{ width: FIND, height: FIND }} importantForAccessibility="no" />
            </Animated.View>
          ) : null}
        </View>
      )}
      {step === 'open' && !reduceMotion ? <Confetti /> : null}
    </View>
  );
}

type CardProps = {
  discoveryName: string;
  /** réplique de récit de la destination (ou `adventure_duplicate`), dans la voix du stade */
  line: string;
  duplicate: boolean;
  times: number;
  onStore: () => void;
};

/** Carte de la trouvaille sous le décor (D-107) : son nom, la réplique du panda, « Cất vào sổ » qui referme tout. */
export function RevealCard({ discoveryName, line, duplicate, times, onStore }: CardProps) {
  const { t } = useTranslation();
  return (
    <View style={[v2Card, styles.card]} testID="v2-trip-reveal">
      <Text style={styles.findName} accessibilityRole="header">
        {discoveryName}
      </Text>
      {duplicate ? <Text style={styles.dup}>{t('adventure.reveal.duplicate', { count: times })}</Text> : null}
      <Text style={styles.line} accessibilityLiveRegion="polite">
        {line}
      </Text>
      <V2Button label={t('v2.trip.store')} onPress={onStore} testID="v2-trip-store" />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  // paquet posé aux pieds du panda, un peu devant à droite
  gift: { position: 'absolute', bottom: -6, left: '50%', marginLeft: v2Spacing.md, width: GIFT, height: GIFT, alignItems: 'center', justifyContent: 'center' },
  giftHit: { width: Math.max(GIFT, V2_TOUCH), height: Math.max(GIFT, V2_TOUCH), alignItems: 'center', justifyContent: 'center' },
  giftImg: { width: GIFT, height: GIFT },
  glow: { position: 'absolute', width: GIFT * 1.6, height: GIFT * 1.6, borderRadius: GIFT, backgroundColor: v2Colors.glow, opacity: 0.7 },
  find: { position: 'absolute', bottom: GIFT / 2, alignItems: 'center' },
  confetto: { position: 'absolute', top: 0, width: 8, height: 10, borderRadius: 2 },
  card: { alignItems: 'center', gap: v2Spacing.sm },
  findName: { ...v2Text.title, textAlign: 'center' },
  dup: { ...v2Text.bodyBold, color: v2Colors.energyText },
  line: { ...v2Text.body, textAlign: 'center' },
});
