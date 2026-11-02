import { Image, StyleSheet, View } from 'react-native';
import { homeVideoLayout } from '@/domain/home-video';
import { HOME_VIDEO_SOURCES } from '../video';

type Props = { topClear: number; groundOffset: number; width: number; height: number };

/**
 * Aperçu fixe de la vidéo d'accueil (D-106) : première image de la vidéo, posée À LA PLACE du décor fixe, exactement là où la vidéo peindra
 * (`homeVideoLayout().image`, cover sans déformation). C'est une `Image` React Native, comme le décor : elle s'affiche sur iPhone même quand la
 * vidéo ne joue pas (lecture automatique refusée, économie d'énergie, chargement lent) — la vidéo ne fait qu'apparaître par-dessus quand elle joue.
 * Écran large : de part et d'autre de la boîte, la même image floutée.
 */
export function HomePoster({ topClear, groundOffset, width, height }: Props) {
  if (width <= 0 || height <= 0) return null;
  const l = homeVideoLayout({ width, height, groundY: height - groundOffset, topClear });
  return (
    <View testID="v2-home-video-poster" style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      {l.boxLeft > 0 ? <Image source={HOME_VIDEO_SOURCES.poster} resizeMode="cover" blurRadius={10} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors /> : null}
      <View style={[styles.box, { left: l.boxLeft, width: l.boxWidth }]}>
        <Image
          source={HOME_VIDEO_SOURCES.poster}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
          style={[styles.image, { left: l.image.left, top: l.image.top, width: l.image.width, height: l.image.height }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  image: { position: 'absolute' },
});
