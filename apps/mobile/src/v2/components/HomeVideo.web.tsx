import { Asset } from 'expo-asset';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { homeVideoLayout, homeVideoSize } from '@/domain/home-video';
import { HOME_VIDEO_SOURCES } from '../video';
import { syncPlayback } from '../videoPlayback';
import type { HomeVideoProps } from './HomeVideo';

const FADE_MS = 200;
const uri = (mod: unknown): string => {
  try {
    return Asset.fromModule(mod as number).uri;
  } catch {
    return '';
  }
};

/**
 * Vidéo d'accueil (web, D-106), posée par-dessus le décor fixe et le `PandaSprite` de `SceneHeader` (qui restent dessous : ils portent le libellé
 * d'accessibilité du panda et réapparaissent en fondu pendant une réaction). Décorative : `aria-hidden`, aucun focus.
 * - `<video autoPlay muted loop playsInline preload="metadata">`, webm puis mp4 (480 px sous 400 de large), cadrée par `homeVideoLayout` ;
 * - image fixe (poster) tant que la vidéo n'est pas prête, puis fondu de 200 ms ;
 * - pause quand l'onglet est caché ou quand Hôm nay n'a plus le focus (`active`), reprise au retour ;
 * - `visible` faux (réaction au coche) : fondu vers le décor fixe, vidéo en pause.
 */
export function HomeVideo({ visible, active, topClear, groundOffset, width, height }: HomeVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const playing = visible && active && !hidden;
  useEffect(() => syncPlayback(ref.current, playing), [playing, width, height]);

  // taille connue d'avance (largeur de l'écran, hauteur de l'en-tête) : le poster s'affiche dès le premier rendu, sans attendre une mesure (iPhone : D-106)
  const layout = width > 0 && height > 0 ? homeVideoLayout({ width, height, groundY: height - groundOffset, topClear }) : null;
  const small = homeVideoSize(width) === 'small';
  const poster = uri(HOME_VIDEO_SOURCES.poster);

  return (
    <View
      testID="v2-home-video"
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.layer, { opacity: visible ? 1 : 0 }]}
    >
      {layout ? (
        <>
          {/* écran large : de part et d'autre de la boîte vidéo, l'image fixe floutée */}
          {layout.boxLeft > 0 ? <img src={poster} alt="" aria-hidden style={{ ...fill, objectFit: 'cover', filter: 'blur(10px)', transform: 'scale(1.08)' }} /> : null}
          <div
            data-testid="v2-home-video-box"
            data-panda-top={layout.pandaTop}
            data-panda-bottom={layout.pandaBottom}
            style={{ position: 'absolute', top: 0, bottom: 0, left: layout.boxLeft, width: layout.boxWidth, overflow: 'hidden' }}
          >
            <video
              ref={ref}
              data-testid="v2-home-video-element"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={poster}
              aria-hidden
              tabIndex={-1}
              onCanPlay={() => setReady(true)}
              onPlaying={() => setReady(true)}
              style={{ ...fill, objectFit: 'cover', objectPosition: `50% ${layout.objectPositionY}%` }}
            >
              <source src={uri(HOME_VIDEO_SOURCES.webm)} type="video/webm" />
              <source src={uri(small ? HOME_VIDEO_SOURCES.mp4Small : HOME_VIDEO_SOURCES.mp4)} type="video/mp4" />
            </video>
            <img
              data-testid="v2-home-video-poster"
              src={poster}
              alt=""
              aria-hidden
              style={{ ...fill, objectFit: 'cover', objectPosition: `50% ${layout.objectPositionY}%`, opacity: ready ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}
            />
          </div>
        </>
      ) : null}
    </View>
  );
}

const fill = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;
const styles = StyleSheet.create({
  layer: { overflow: 'hidden', transitionProperty: 'opacity', transitionDuration: `${FADE_MS}ms` } as never,
});
