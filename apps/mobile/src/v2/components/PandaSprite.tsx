import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { pandaExpressionImage, pandaStageImage } from '@/components/companion/pandaImages';
import { expressionForMood, usesStagePose, type PandaExpression, type PandaMood, type PandaStage, type PandaVariant } from '@/domain/panda';
import { WALK_PAUSE_MS, walkPlan } from '@/domain/panda-walk';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { pandaWalkImage } from '../images';

type Props = {
  stage: PandaStage;
  variant?: PandaVariant;
  name: string;
  size: number;
  mood?: PandaMood;
  /** expression imposée (retour d'aventure : « surpris » ; fin de journée : « fier ») */
  expression?: PandaExpression;
  /** pendant une aventure : pose `walk` du stade (sac à dos), va-et-vient lent sur le sol */
  walking?: boolean;
  /** incrémenté à chaque coche : petit saut de joie (sauf « réduire les animations ») */
  hopKey?: number;
  testID?: string;
};

/**
 * Panda de la V2 (D-106) : pose du stade ou expression de l'humeur ; pendant une aventure, il marche avec son sac d'un bord à l'autre du sol
 * (lentement, petit rebond, demi-tour au bord : l'image marche vers la droite, retournée pour la gauche). Aucune animation si « réduire les
 * animations » est activé : le panda reste immobile au centre.
 */
export function PandaSprite({ stage, variant = 'boy', name, size, mood = 'calme', expression, walking = false, hopKey = 0, testID }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const [laneWidth, setLaneWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const [facing] = useState(() => new Animated.Value(1));
  const [bob] = useState(() => new Animated.Value(0));
  const [hop] = useState(() => new Animated.Value(0));
  const plan = walkPlan(laneWidth, size);
  const animated = walking && !reduceMotion && plan !== null;

  useEffect(() => {
    if (hopKey === 0 || reduceMotion) return;
    const native = Platform.OS !== 'web';
    Animated.sequence([
      Animated.timing(hop, { toValue: -14, duration: 140, useNativeDriver: native }),
      Animated.spring(hop, { toValue: 0, friction: 4, useNativeDriver: native }),
    ]).start();
  }, [hopKey, reduceMotion, hop]);

  useEffect(() => {
    const native = Platform.OS !== 'web';
    const p = walkPlan(laneWidth, size);
    x.setValue(p ? p.start : Math.max(0, Math.round((laneWidth - size) / 2)));
    facing.setValue(1);
    bob.setValue(0);
    if (!animated || !p) return;
    const ease = Easing.inOut(Easing.quad);
    // plus lent que la promenade V1 : un voyage, pas une balade
    const slow = (ms: number) => Math.round(ms * 1.6);
    const leg = (to: number, duration: number, face: 1 | -1) =>
      Animated.sequence([
        Animated.timing(facing, { toValue: face, duration: 0, useNativeDriver: native }),
        Animated.timing(x, { toValue: to, duration, easing: ease, useNativeDriver: native }),
        Animated.delay(WALK_PAUSE_MS),
      ]);
    const walk = Animated.sequence([leg(p.range, slow(p.firstLegMs), 1), Animated.loop(Animated.sequence([leg(0, slow(p.crossMs), -1), leg(p.range, slow(p.crossMs), 1)]))]);
    const steps = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -4, duration: 260, easing: ease, useNativeDriver: native }),
        Animated.timing(bob, { toValue: 0, duration: 260, easing: ease, useNativeDriver: native }),
      ]),
    );
    walk.start();
    steps.start();
    return () => {
      walk.stop();
      steps.stop();
    };
  }, [animated, laneWidth, size, x, facing, bob]);

  const source = walking
    ? pandaWalkImage(stage)
    : expression
      ? pandaExpressionImage(expression, 'small', variant)
      : usesStagePose(mood)
        ? pandaStageImage(stage, 'small', variant)
        : pandaExpressionImage(expressionForMood(mood), 'small', variant);
  const label = walking ? t('v2.panda.walking', { name }) : t('panda.imageLabel', { name, mood: t(`panda.mood.${expression ?? mood}`) });

  return (
    <View testID={testID} style={[styles.lane, { height: size }]} onLayout={(e) => setLaneWidth(Math.round(e.nativeEvent.layout.width))}>
      <Animated.View
        testID={testID ? `${testID}-body` : undefined}
        style={[styles.body, { transform: [{ translateX: x }, { translateY: Animated.add(hop, bob) }, { scaleX: facing }] }]}
      >
        <Image source={source} resizeMode="contain" accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lane: { width: '100%' },
  body: { position: 'absolute', left: 0, top: 0 },
});
