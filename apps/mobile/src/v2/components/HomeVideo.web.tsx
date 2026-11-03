import { Asset } from 'expo-asset';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { homeVideoLayout, homeVideoSources, videoShowsFrames } from '@/domain/home-video';
import { CROSSFADE_MS, READY_TIMEOUT_MS, type PandaAnim } from '@/domain/panda-animation';
import { syncPlayback } from '../videoPlayback';
import type { HomeVideoSources } from '../video';
import type { HomeClip, HomeVideoProps } from './HomeVideo';

const FADE_MS = 200;
const uri = (mod: unknown): string => {
  try {
    return Asset.fromModule(mod as number).uri;
  } catch {
    return '';
  }
};

/** Une couche `<video>` : au plus DEUX à la fois (celle qu'on voit, celle qui se prépare), fondu croisé entre elles. */
type Layer = { id: string; name: PandaAnim; sources: HomeVideoSources; loop: boolean; painted: boolean };
type Stack = { layers: Layer[]; wantedId: string; still: boolean };

const layerId = (clip: HomeClip) => (clip.name === 'idle' ? `idle:${clip.key}` : `${clip.name}:${clip.key}:${clip.serial}`);
const layerOf = (clip: HomeClip): Layer => ({ id: layerId(clip), name: clip.name, sources: clip.sources, loop: clip.loop, painted: false });

/** Couches après une nouvelle demande : la couche visible reste, la nouvelle se prépare par-dessus (une préparation en cours est remplacée). */
export function nextLayers(cur: Layer[], wanted: HomeClip, still: boolean, wasStill: boolean): Layer[] {
  if (still) return [];
  if (wasStill) return [layerOf(wanted)];
  // déjà là (ex. retour au repos pendant le fondu vers une réaction) : elle redevient la couche du dessus, celles au-dessus partent
  const idx = cur.findIndex((l) => l.id === layerId(wanted));
  if (idx >= 0) return idx === cur.length - 1 ? cur : cur.slice(0, idx + 1);
  const front = [...cur].reverse().find((l) => l.painted) ?? cur[0];
  return front ? [front, layerOf(wanted)] : [layerOf(wanted)];
}

/**
 * Vidéo d'accueil et réactions du panda (web, D-106) : UN seul lecteur, posé par-dessus l'aperçu fixe (`HomePoster`).
 * - Repos : `<video autoPlay muted loop playsInline>` ; réactions : même cadrage, une seule lecture, fin = événement `ended` (jamais un minuteur).
 * - Changement de vidéo : la suivante se prépare dans une 2ᵉ couche (`preload="auto"`, invisible), puis fondu croisé de 150 ms dès qu'elle PEINT
 *   une image ; l'ancienne est retirée ensuite (source libérée). Réaction pas prête en 1,5 s (ou lecture refusée, fichier absent) : couche
 *   abandonnée, `onFailed`. Jamais de rectangle noir : tant que rien n'est peint, on voit la couche précédente, ou l'aperçu fixe dessous.
 * - `still` (panda endormi) : image fixe à la place de toute vidéo.
 * - Pause quand l'onglet est caché (`visibilitychange`) ou que Hôm nay n'a plus le focus ; reprise au retour.
 * - Réactions préparées légèrement (`preload="metadata"`) une fois le repos lancé ; tout est libéré au démontage.
 * Décorative : `aria-hidden`, aucun focus (le toucher du panda est un bouton séparé, posé par l'écran).
 */
export function HomeVideo({ video, clip, still, prefetch, onStarted, onEnded, onFailed, visible, active, topClear, groundOffset, width, height }: HomeVideoProps) {
  const wanted: HomeClip = clip ?? { name: 'idle', key: video.key, sources: video.sources, loop: true, serial: 0 };
  const wantedId = layerId(wanted);
  const showingStill = still !== undefined;
  const [stack, setStack] = useState<Stack>(() => ({ layers: showingStill ? [] : [layerOf(wanted)], wantedId, still: showingStill }));
  // nouvelle demande (ou passage image ↔ vidéo) : couches recalculées pendant le rendu (« état dérivé de la demande précédente »)
  let layers = stack.layers;
  if (stack.wantedId !== wantedId || stack.still !== showingStill) {
    layers = nextLayers(stack.layers, wanted, showingStill, stack.still);
    setStack({ layers, wantedId, still: showingStill });
  }
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const els = useRef(new Map<string, HTMLVideoElement>());
  // la couche s'enregistre (élément monté) ou se retire (démonté : source libérée)
  const register = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) {
      els.current.set(id, el);
      return;
    }
    const old = els.current.get(id);
    if (old) release(old);
    els.current.delete(id);
  }, []);
  const live = useRef<{ layers: Layer[]; onStarted?: HomeVideoProps['onStarted']; onEnded?: HomeVideoProps['onEnded']; onFailed?: HomeVideoProps['onFailed'] }>({ layers });
  useEffect(() => {
    live.current = { layers, onStarted, onEnded, onFailed };
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // réaction demandée : abandonnée si elle ne peint rien en 1,5 s (le repos, lui, n'est jamais abandonné : l'aperçu fixe reste dessous)
  const wantedName = wanted.name;
  useEffect(() => {
    if (wantedName === 'idle' || showingStill) return;
    const t = setTimeout(() => {
      const l = live.current.layers.find((x) => x.id === wantedId);
      if (!l || l.painted) return;
      setStack((s) => ({ ...s, layers: s.layers.filter((x) => x.id !== wantedId) }));
      live.current.onFailed?.(wantedName);
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [wantedId, wantedName, showingStill]);

  // démontage : sources libérées
  useEffect(() => {
    const map = els.current;
    return () => {
      for (const el of map.values()) release(el);
      map.clear();
    };
  }, []);

  // couche peinte : fondu croisé de 150 ms, puis les couches plus anciennes disparaissent (et libèrent leur source)
  const fades = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const set = fades.current;
    return () => set.forEach(clearTimeout);
  }, []);
  const markPainted = (id: string, name: PandaAnim, el: { paused: boolean; currentTime: number }) => {
    if (!videoShowsFrames(el)) return;
    const l = live.current.layers.find((x) => x.id === id);
    if (!l || l.painted) return;
    setStack((s) => ({ ...s, layers: s.layers.map((x) => (x.id === id ? { ...x, painted: true } : x)) }));
    const t = setTimeout(() => {
      fades.current.delete(t);
      setStack((s) => {
        const idx = s.layers.findIndex((y) => y.id === id);
        return idx > 0 ? { ...s, layers: s.layers.slice(idx) } : s;
      });
      live.current.onStarted?.(name);
    }, CROSSFADE_MS);
    fades.current.add(t);
  };
  const fail = (l: Layer) => {
    if (l.painted || l.name === 'idle') return;
    setStack((s) => ({ ...s, layers: s.layers.filter((x) => x.id !== l.id) }));
    live.current.onFailed?.(l.name);
  };

  // lecture : la couche la plus récente joue ; tout s'arrête si l'onglet est caché ou l'écran quitté
  const playing = visible && active && !hidden && !showingStill;
  useEffect(() => {
    const top = layers[layers.length - 1];
    for (const l of layers) {
      const el = els.current.get(l.id) ?? null;
      const shouldPlay = playing && l === top;
      // une réaction finie reste sur sa dernière image (jamais relancée)
      if (shouldPlay && el && !l.loop && el.ended) continue;
      syncPlayback(el, shouldPlay);
    }
  }, [layers, playing]);

  // préparation légère des réactions, une fois le repos lancé
  const idlePainted = layers.some((l) => l.name === 'idle' && l.painted);
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const prefetchUris = (prefetch ?? []).map((s) => uri(s[homeVideoSources(ua, width)[0]!.key])).join('|');
  useEffect(() => {
    if (!idlePainted || typeof document === 'undefined' || !prefetchUris) return;
    const made: HTMLVideoElement[] = [];
    for (const src of prefetchUris.split('|')) {
      try {
        const v = document.createElement('video');
        v.muted = true;
        v.preload = 'metadata';
        v.src = src;
        made.push(v);
      } catch {
        // rien : la vidéo se chargera au premier besoin
      }
    }
    return () => made.forEach(release);
  }, [idlePainted, prefetchUris]);

  // taille connue d'avance (largeur de l'écran, hauteur de l'en-tête) : aucune mesure à attendre (iPhone : D-106)
  const layout = width > 0 && height > 0 ? homeVideoLayout({ width, height, groundY: height - groundOffset, topClear }, video.geometry) : null;
  const sources = homeVideoSources(ua, width);
  const shown = showingStill || layers.some((l) => l.painted);
  const current = showingStill ? 'sleep-still' : ([...layers].reverse().find((l) => l.painted)?.name ?? 'none');

  return (
    <View
      testID="v2-home-video"
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.layer, { opacity: visible ? 1 : 0 }]}
    >
      {layout ? (
        <div
          data-testid="v2-home-video-box"
          data-panda-top={layout.pandaTop}
          data-panda-bottom={layout.pandaBottom}
          data-ready={shown ? 'true' : 'false'}
          data-anim={current}
          style={{ position: 'absolute', top: 0, bottom: 0, left: layout.boxLeft, width: layout.boxWidth, overflow: 'hidden', opacity: shown ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
        >
          {showingStill ? (
            <img data-testid="v2-home-video-still" src={uri(still)} alt="" aria-hidden style={{ ...fill, objectFit: 'cover', objectPosition: `50% ${layout.objectPositionY}%` }} />
          ) : (
            layers.map((l) => (
              <LayerVideo
                key={l.id}
                id={l.id}
                register={register}
                data-anim={l.name}
                data-painted={l.painted ? 'true' : 'false'}
                loop={l.loop}
                onPlaying={(e) => markPainted(l.id, l.name, e.currentTarget)}
                onTimeUpdate={(e) => markPainted(l.id, l.name, e.currentTarget)}
                onEnded={() => {
                  if (!l.loop) live.current.onEnded?.(l.name);
                }}
                onError={() => fail(l)}
                style={{ ...fill, objectFit: 'cover', objectPosition: `50% ${layout.objectPositionY}%`, opacity: l.painted ? 1 : 0, transition: `opacity ${CROSSFADE_MS}ms ease` }}
              >
                {sources.map((s, i) => (
                  // l'échec de la DERNIÈRE source (aucune lisible) arrive sur `<source>`, pas sur `<video>`
                  <source key={s.key} src={uri(l.sources[s.key])} type={s.type} onError={i === sources.length - 1 ? () => fail(l) : undefined} />
                ))}
              </LayerVideo>
            ))
          )}
        </div>
      ) : null}
    </View>
  );
}

type LayerVideoProps = {
  id: string;
  register: (id: string, el: HTMLVideoElement | null) => void;
  'data-anim': string;
  'data-painted': string;
  loop: boolean;
  onPlaying: (e: { currentTarget: HTMLVideoElement }) => void;
  onTimeUpdate: (e: { currentTarget: HTMLVideoElement }) => void;
  onEnded: () => void;
  onError: () => void;
  style: object;
  children: ReactNode;
};

/**
 * Une couche du lecteur (même `<video>` pour le repos et toutes les réactions) : sa fonction `ref` est STABLE (sinon chaque rendu détacherait et
 * rechargerait la vidéo). `muted`, `playsInline`, `autoPlay` ; `loop` pour le repos seulement.
 */
function LayerVideo({ id, register, loop, children, ...rest }: LayerVideoProps) {
  const ref = useCallback((el: HTMLVideoElement | null) => register(id, el), [id, register]);
  return (
    <video ref={ref} data-testid="v2-home-video-element" autoPlay muted loop={loop} playsInline preload="auto" aria-hidden tabIndex={-1} {...rest}>
      {children}
    </video>
  );
}

/** Libère la vidéo (le navigateur relâche le fichier et le décodeur). */
function release(el: HTMLVideoElement): void {
  try {
    el.pause();
    el.removeAttribute('src');
    el.load();
  } catch {
    // élément déjà détaché
  }
}

const fill = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;
const styles = StyleSheet.create({
  layer: { overflow: 'hidden', transitionProperty: 'opacity', transitionDuration: `${FADE_MS}ms` } as never,
});
