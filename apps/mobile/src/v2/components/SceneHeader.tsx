import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sceneImage } from '../images';
import { v2Colors, v2Font, v2Radius, v2Shadow, v2Spacing, V2_TOUCH } from '../theme';

/** Hauteur (pt) du fondu au bas de l'en-tête quand le décor est prolongé (sous les pieds du panda : le sol est à `SCENE_GROUND_OFFSET`). */
export const EXTEND_FADE = 20;

export type TopButton = { key: string; Icon: LucideIcon; label: string; onPress: () => void; badge?: number };

type Props = {
  /** décor : `home` (bambouseraie) ou le slug d'une destination ; inconnu = maison */
  scene: string;
  height: number;
  left?: TopButton[];
  right?: TopButton[];
  /** le panda (posé sur le sol, au centre du décor) */
  children?: ReactNode;
  /** calque posé sur le décor et le panda, sous les boutons du haut (vidéo d'accueil, D-106) */
  overlay?: ReactNode;
  /**
   * Image posée sur le décor fixe (aperçu de la vidéo d'accueil, D-106). Quand `backdropVisible`, elle couvre le décor et le panda dessiné est masqué
   * (fondu de 200 ms ; il reste monté : son libellé est lu par les lecteurs d'écran) ; sinon (réaction au coche), décor fixe et panda reviennent.
   * Jamais de calque vide : sur iPhone, une vidéo qui ne joue pas (lecture refusée, économie d'énergie) laisse voir cet aperçu, pas le fond.
   */
  backdrop?: ReactNode;
  backdropVisible?: boolean;
  /**
   * Couleur qui prolonge le décor sous l'en-tête (vidéo d'accueil, D-106) : l'en-tête perd ses coins arrondis du bas et un fondu vers cette couleur
   * adoucit son bord, pour que le fond de l'écran (de la même couleur) continue la vidéo sans jointure.
   */
  extendColor?: string | null;
  testID?: string;
};

function RoundTop({ b }: { b: TopButton }) {
  const label = b.badge ? `${b.label} (${b.badge})` : b.label;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={b.onPress} style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null]} testID={`v2-top-${b.key}`}>
      <b.Icon size={22} color={v2Colors.onTopButton} />
      {b.badge ? (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <Text style={styles.badgeText}>{b.badge > 9 ? '9+' : b.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** En-tête V2 : décor plein cadre (ciel en haut, sol libre au centre), boutons ronds du haut, panda posé sur le sol. */
export function SceneHeader({ scene, height, left = [], right = [], children, overlay, backdrop, backdropVisible = false, extendColor = null, testID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={[styles.wrap, { height: height + insets.top }, extendColor ? { backgroundColor: extendColor, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : null]}>
      <View testID="v2-scene-layer" style={styles.sceneLayer} pointerEvents="box-none">
        <Image source={sceneImage(scene)} resizeMode="cover" style={styles.scene} accessibilityIgnoresInvertColors importantForAccessibility="no" testID={`v2-scene-${scene}`} />
        {backdrop ? (
          <View testID="v2-scene-backdrop" style={[styles.fade, { opacity: backdropVisible ? 1 : 0 }]} pointerEvents="none">
            {backdrop}
          </View>
        ) : null}
        <View testID="v2-scene-ground" style={[styles.groundLayer, styles.fade, { opacity: backdrop && backdropVisible ? 0 : 1 }]} pointerEvents="box-none">
          <View style={styles.ground}>{children}</View>
        </View>
      </View>
      {overlay}
      {extendColor ? (
        <View
          testID="v2-scene-extend"
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[styles.extend, { backgroundImage: `linear-gradient(to bottom, transparent, ${extendColor})` } as object]}
        />
      ) : null}
      <View style={[styles.top, { paddingTop: insets.top + v2Spacing.sm }]}>
        <View style={styles.group}>{left.map((b) => <RoundTop key={b.key} b={b} />)}</View>
        <View style={styles.group}>{right.map((b) => <RoundTop key={b.key} b={b} />)}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: v2Colors.backgroundDeep, borderBottomLeftRadius: v2Radius.card, borderBottomRightRadius: v2Radius.card },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: v2Spacing.lg },
  group: { flexDirection: 'row', gap: v2Spacing.sm },
  btn: { width: V2_TOUCH, height: V2_TOUCH, borderRadius: V2_TOUCH / 2, backgroundColor: v2Colors.topButton, alignItems: 'center', justifyContent: 'center', ...v2Shadow },
  pressed: { transform: [{ scale: 0.94 }] },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: v2Colors.badge, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...v2Font(800, 11), color: v2Colors.onBadge },
  // web : sans largeur ni hauteur explicites, une image locale garde sa taille d'origine (720 px) au lieu de couvrir l'en-tête
  scene: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  sceneLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transitionProperty: 'opacity', transitionDuration: '200ms' } as never,
  // fondu du bas de l'en-tête vers la couleur qui le prolonge (web : `background-image` passe tel quel par react-native-web)
  extend: { position: 'absolute', left: 0, right: 0, bottom: 0, height: EXTEND_FADE },
  groundLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // sol : bas du décor, où le panda marche
  ground: { position: 'absolute', left: v2Spacing.lg, right: v2Spacing.lg, bottom: v2Spacing.xl },
});

/** Distance (pt) entre le bas de l'en-tête et le sol où se posent les pieds du panda. */
export const SCENE_GROUND_OFFSET = v2Spacing.xl;
/** Hauteur (pt, sous la zone sûre) occupée par les boutons du haut : rien d'important au-dessus. */
export const SCENE_TOP_CLEAR = v2Spacing.sm + V2_TOUCH + v2Spacing.sm;
