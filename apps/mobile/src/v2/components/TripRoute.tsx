import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { pandaStageImage } from '@/components/companion/pandaImages';
import { ARRIVE_MS, curveDots, TRACE_MS, type Point } from '@/domain/adventure-trip';
import type { PandaStage, PandaVariant } from '@/domain/panda';
import { mapSpot, tripImage } from '../images';
import { v2Colors } from '../theme';

/** Nombre de points du pointillé, et taille de la tête du panda qui le parcourt. */
const DOTS = 22;
export const ROUTE_HEAD = 40;
const HOME_MARK = 60;

type Props = {
  width: number;
  height: number;
  /** destination du trajet (clairière) ; `null` = seulement la maison */
  destination: string | null;
  stage: PandaStage;
  variant?: PandaVariant;
  /** trace le pointillé de la maison jusqu'à la clairière (≈ 1,8 s, rebond à l'arrivée) ; sinon trajet déjà tracé, tête sur la clairière */
  animate?: boolean;
  reduceMotion: boolean;
  /** fin réelle du tracé et du rebond (ou immédiate avec « réduire les animations ») */
  onDone?: () => void;
  homeLabel: string;
};

/** Tête du panda (visage du stade) dans un rond : le haut de la pose du stade, recadré. */
export function PandaHead({ stage, variant = 'boy', size = ROUTE_HEAD }: { stage: PandaStage; variant?: PandaVariant; size?: number }) {
  return (
    <View style={[styles.head, { width: size, height: size, borderRadius: size / 2 }]} importantForAccessibility="no-hide-descendants">
      <Image source={pandaStageImage(stage, 'small', variant)} resizeMode="contain" style={{ width: size * 1.9, height: size * 1.9, marginTop: size * 0.75 }} />
    </View>
  );
}

/**
 * Trajet du voyage sur la carte (D-107) : la maison du panda au point `home` de `map-spots.json`, un pointillé en courbe douce jusqu'à la clairière
 * choisie et la tête du panda. Départ : le pointillé se trace et la tête avance dessus, puis rebondit sur la clairière. Pendant le voyage : trajet
 * dessiné, tête posée sur la clairière.
 */
export function TripRoute({ width, height, destination, stage, variant, animate = false, reduceMotion, onDone, homeLabel }: Props) {
  const home = mapSpot('home');
  const dest = destination ? mapSpot(destination) : null;
  const a: Point | null = home ? { x: home.x * width, y: home.y * height } : null;
  const b: Point | null = dest ? { x: dest.x * width, y: dest.y * height } : null;
  const dots = useMemo(() => (a && b ? curveDots(a, b, DOTS) : []), [a?.x, a?.y, b?.x, b?.y]); // eslint-disable-line react-hooks/exhaustive-deps
  const running = animate && !reduceMotion && dots.length > 0;
  const [progress] = useState(() => new Animated.Value(running ? 0 : 1));
  const [bounce] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!animate) return;
    if (!running) {
      progress.setValue(1);
      onDone?.();
      return;
    }
    const native = Platform.OS !== 'web';
    progress.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: TRACE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1.3, duration: ARRIVE_MS / 2, useNativeDriver: native }),
        Animated.timing(bounce, { toValue: 1, duration: ARRIVE_MS / 2, useNativeDriver: native }),
      ]),
    ]);
    seq.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => seq.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, running]);

  const inputs = dots.map((_, i) => i / (dots.length - 1));
  const headX = dots.length > 1 ? progress.interpolate({ inputRange: inputs, outputRange: dots.map((p) => p.x - ROUTE_HEAD / 2) }) : 0;
  const headY = dots.length > 1 ? progress.interpolate({ inputRange: inputs, outputRange: dots.map((p) => p.y - ROUTE_HEAD / 2) }) : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="v2-trip-route">
      {a ? (
        <Image
          source={tripImage('home-marker')}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={homeLabel}
          testID="v2-map-home"
          style={[styles.home, { left: a.x - HOME_MARK / 2, top: a.y - HOME_MARK / 2 }]}
        />
      ) : null}
      {dots.map((p, i) => {
        // le premier et le dernier point restent sous la maison et la clairière
        if (i === 0 || i === dots.length - 1) return null;
        const t = i / (dots.length - 1);
        const opacity = running ? progress.interpolate({ inputRange: [Math.max(0, t - 0.02), t], outputRange: [0, 1], extrapolate: 'clamp' }) : 1;
        return <Animated.View key={i} testID="v2-trip-dot" style={[styles.dot, { left: p.x - 4, top: p.y - 4, opacity }]} />;
      })}
      {b ? (
        <Animated.View testID="v2-trip-head" style={[styles.headPos, { transform: [{ translateX: headX }, { translateY: headY }, { scale: bounce }] }]}>
          <PandaHead stage={stage} variant={variant} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  home: { position: 'absolute', width: HOME_MARK, height: HOME_MARK },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: v2Colors.card, borderWidth: 2, borderColor: v2Colors.energy },
  headPos: { position: 'absolute', left: 0, top: 0 },
  head: { overflow: 'hidden', alignItems: 'center', backgroundColor: v2Colors.card, borderWidth: 3, borderColor: v2Colors.energy },
});
