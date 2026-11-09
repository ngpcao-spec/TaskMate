import { Asset } from 'expo-asset';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { homeVideoSources, tripVideoLayout, videoShowsFrames } from '@/domain/home-video';
import type { TripVideoProps } from './TripVideo';

const FADE_MS = 200;
const uri = (mod: unknown): string => {
  try {
    return Asset.fromModule(mod as number).uri;
  } catch {
    return '';
  }
};

/**
 * Vidéo de voyage (web, D-107) : pendant l'aventure, le panda marche avec son sac dans le décor qui défile, À LA PLACE de la maison vide.
 * - `<video autoPlay muted loop playsInline>`, webm puis mp4 (mp4 d'abord sur Safari, 480 px sous 400 px de large), posée exactement sur son
 *   aperçu fixe (`Image` React Native, visible même si la vidéo ne joue jamais) ; elle n'apparaît (fondu) qu'une fois une image peinte.
 * - Cadrage `tripVideoLayout` : cover sans zoom ni déformation, pieds sur la ligne de sol ; autour (bande du haut, côtés d'un écran large),
 *   l'aperçu flouté.
 * - `still` : l'aperçu seul. Pause quand l'onglet est caché ou que Hôm nay n'a plus le focus.
 * - Lecture refusée (`NotAllowedError`) ou aucune source lisible : `onFailed` (l'écran revient à la maison vide + mot). Jamais d'écran noir.
 * Décorative (`aria-hidden`) : le toucher (rouvrir la carte postale) est un bouton séparé, posé par l'écran.
 */
export function TripVideo({ video, mode, active, onFailed, topClear, groundOffset, width, height }: TripVideoProps) {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [painted, setPainted] = useState(false);
  // élément attaché par une fonction `ref` stable (setState) : la lecture se synchronise dès qu'il existe
  const [node, setNode] = useState<HTMLVideoElement | null>(null);
  const failed = useRef(onFailed);
  useEffect(() => {
    failed.current = onFailed;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const playing = mode === 'video' && active && !hidden;
  useEffect(() => {
    const v = node;
    if (!v || typeof v.play !== 'function' || typeof v.pause !== 'function') return;
    if (!playing) {
      v.pause();
      return;
    }
    void Promise.resolve(v.play()).catch((e: unknown) => {
      // lecture automatique refusée (iPhone en économie d'énergie…) : maison vide + mot ; une simple interruption (pause, démontage) est ignorée
      if ((e as { name?: string } | null)?.name === 'NotAllowedError') failed.current();
    });
  }, [playing, node]);

  // démontage (ou élément remplacé) : source libérée
  useEffect(
    () => () => {
      if (!node) return;
      try {
        node.pause();
        node.removeAttribute('src');
        node.load();
      } catch {
        // déjà détachée
      }
    },
    [node],
  );

  if (width <= 0 || height <= 0) return null;
  const l = tripVideoLayout({ width, height, groundY: height - groundOffset, topClear }, video.geometry);
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const sources = homeVideoSources(ua, width);
  const rect = { left: l.image.left, top: l.image.top, width: l.image.width, height: l.image.height };
  const onFrame = (e: { currentTarget: { paused: boolean; currentTime: number } }) => {
    if (!painted && videoShowsFrames(e.currentTarget)) setPainted(true);
  };

  return (
    <View testID="v2-trip-video" aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* bande du haut (vidéo descendue) et côtés d'un écran large : l'aperçu flouté, jamais un fond uni */}
      <Image source={video.sources.poster as number} resizeMode="cover" blurRadius={10} style={styles.fill} accessibilityIgnoresInvertColors />
      <div
        data-testid="v2-trip-video-box"
        data-mode={mode}
        data-ready={mode === 'still' || painted ? 'true' : 'false'}
        data-panda-top={l.pandaTop}
        data-panda-bottom={l.pandaBottom}
        data-drop={l.drop}
        style={{ position: 'absolute', top: 0, bottom: 0, left: l.boxLeft, width: l.boxWidth, overflow: 'hidden' }}
      >
        <Image testID="v2-trip-video-poster" source={video.sources.poster as number} resizeMode="stretch" accessibilityIgnoresInvertColors style={[styles.abs, rect]} />
        {mode === 'video' ? (
          <video
            ref={setNode}
            data-testid="v2-trip-video-element"
            data-clip={video.key}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={uri(video.sources.poster)}
            aria-hidden
            tabIndex={-1}
            onPlaying={onFrame}
            onTimeUpdate={onFrame}
            onError={() => failed.current()}
            // rectangle exact de l'image (même rapport que la vidéo) : aucune déformation, aucun zoom
            style={{ position: 'absolute', ...rect, objectFit: 'fill', opacity: painted ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
          >
            {sources.map((s, i) => (
              // l'échec de la DERNIÈRE source (aucune lisible) arrive sur `<source>`, pas sur `<video>`
              <source key={s.key} src={uri(video.sources[s.key])} type={s.type} onError={i === sources.length - 1 ? () => failed.current() : undefined} />
            ))}
          </video>
        ) : null}
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  // taille explicite : sur le web, une image locale sans largeur ni hauteur garde sa taille d'origine
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  abs: { position: 'absolute' },
});
