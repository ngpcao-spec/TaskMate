import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import type { PandaStage } from '@/domain/panda';
import { pandaWalkImage } from '../images';

type Props = {
  stage: PandaStage;
  size: number;
  /** `out` : du centre jusqu'à sortir par la droite (départ) ; `in` : entre par la gauche et s'arrête au centre (retour) */
  direction: 'out' | 'in';
  durationMs: number;
  /** « réduire les animations » : aucune marche, fin immédiate */
  reduceMotion: boolean;
  onDone: () => void;
  label: string;
  testID?: string;
};

/**
 * Panda qui marche avec son sac (pose `walk` du stade, orientée vers la DROITE) pour le départ et le retour d'aventure (D-107). Mouvement seulement :
 * la fin (`onDone`) arrive à la fin réelle de l'animation ; avec « réduire les animations », tout de suite.
 */
export function PandaWalker({ stage, size, direction, durationMs, reduceMotion, onDone, label, testID }: Props) {
  const [lane, setLane] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      onDone();
      return;
    }
    if (lane <= 0) return;
    const native = Platform.OS !== 'web';
    const center = (lane - size) / 2;
    const from = direction === 'out' ? center : -size;
    const to = direction === 'out' ? lane + size : center;
    x.setValue(from);
    const ease = direction === 'out' ? Easing.in(Easing.quad) : Easing.out(Easing.quad);
    const walk = Animated.timing(x, { toValue: to, duration: durationMs, easing: ease, useNativeDriver: native });
    const steps = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -5, duration: 220, useNativeDriver: native }),
        Animated.timing(bob, { toValue: 0, duration: 220, useNativeDriver: native }),
      ]),
    );
    steps.start();
    walk.start(({ finished }) => {
      steps.stop();
      bob.setValue(0);
      if (finished) onDone();
    });
    return () => {
      walk.stop();
      steps.stop();
    };
    // `onDone` volontairement hors des dépendances : la marche ne redémarre pas quand l'écran se redessine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lane, size, direction, durationMs, reduceMotion, x, bob]);

  return (
    <View testID={testID} style={[styles.lane, { height: size }]} onLayout={(e) => setLane(Math.round(e.nativeEvent.layout.width))}>
      <Animated.View style={[styles.body, { transform: [{ translateX: x }, { translateY: bob }] }]}>
        <Image source={pandaWalkImage(stage)} resizeMode="contain" accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lane: { width: '100%' },
  body: { position: 'absolute', left: 0, top: 0 },
});
