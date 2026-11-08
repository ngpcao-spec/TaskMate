import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { adventureErrorKey, isUnlocked } from '@/domain/adventure';
import { DEFAULT_PANDA_NAME } from '@/domain/panda';
import { serverErrorCode } from '@/api/tasks';
import { startVars, useAdventure, useAdventurePending, useStartAdventure } from '@/hooks/useAdventure';
import { useCompanion } from '@/hooks/useCompanion';
import { useMe } from '@/hooks/useMe';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTripStore } from '@/store/trip';
import { AdventureCard } from '@/v2/components/AdventureCard';
import { PostcardSheet } from '@/v2/components/PostcardSheet';
import { TripRoute } from '@/v2/components/TripRoute';
import { V2Button } from '@/v2/components/V2Button';
import { V2Screen } from '@/v2/components/V2Screen';
import { mapImage, MAP_RATIO, mapSpot } from '@/v2/images';
import { v2Colors, v2Font, v2Radius, v2Shadow, V2_TOUCH } from '@/v2/theme';

const MARK = V2_TOUCH + 8;

/**
 * Phiêu lưu (enfant, V2) : la carte du Vietnam, la maison du panda et les 6 destinations aux positions de `map-spots.json`. Toucher une destination
 * ouvre sa carte postale (D-107 : `PostcardSheet`, débloquée ou verrouillée) ; « Lên đường! » envoie `adventure_start` (file d'écritures, id fixé).
 * Départ ACCEPTÉ : le trajet se trace de la maison à la clairière (≈ 1,8 s, passable d'un toucher), puis Hôm nay montre le panda qui s'en va.
 * Refus : message doux dans la feuille, aucune séquence. Pendant le voyage : trajet dessiné, tête du panda sur la clairière.
 */
export default function V2ChildAdventure() {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe().data;
  const childId = me?.member.role === 'child' ? me.member.child_id : null;
  const childName = me?.children?.find((c) => c.id === childId)?.name ?? '';
  const adventure = useAdventure(childId, !!childId).data;
  const companion = useCompanion(childId, !!childId).data;
  const pending = useAdventurePending(childId);
  const start = useStartAdventure();
  const reduceMotion = useReduceMotion();
  const depart = useTripStore((s) => s.depart);
  const [width, setWidth] = useState(0);
  const [sheet, setSheet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<string | null>(null);
  const height = Math.round(width * MAP_RATIO);
  const pandaName = companion?.name ?? DEFAULT_PANDA_NAME;
  const stage = companion?.stage ?? 2;

  const openSheet = (slug: string) => {
    setError(null);
    setSheet(slug);
  };
  const goHome = () => router.navigate('/v2/child/home');
  // fin du tracé (ou toucher pour passer) : Hôm nay prend la suite (le panda quitte la maison), sauf si l'enfant a passé la séquence
  const finishTrace = (skipped: boolean) => {
    if (!trace || !childId) return;
    if (!skipped) depart({ childId, destination: trace, at: Date.now() });
    setTrace(null);
    goHome();
  };
  const go = (slug: string) => {
    if (!childId) return;
    setError(null);
    start.mutate(
      { ...startVars(childId, slug), quiet: true },
      {
        onSuccess: () => {
          setSheet(null);
          // « réduire les animations » : directement l'état final (maison vide, mot sur la porte)
          if (reduceMotion) goHome();
          else setTrace(slug);
        },
        onError: (e) => {
          const key = adventureErrorKey(serverErrorCode(e));
          if (key) setError(t(key));
        },
      },
    );
  };

  const sheetDest = sheet && adventure ? adventure.destinations.find((d) => d.slug === sheet) : undefined;
  const awayAt = adventure?.state === 'away' && adventure.active ? adventure.active.destination : null;
  const routeDest = trace ?? awayAt;

  return (
    <V2Screen title={t('v2.tabs.adventure')} testID="v2-adventure-screen">
      {adventure ? (
        <AdventureCard
          adventure={adventure}
          pandaName={pandaName}
          variant={companion?.variant}
          busy={pending}
          onMap={() => undefined}
          onOpenBag={adventure.state === 'back' ? goHome : undefined}
        />
      ) : null}
      <View style={styles.map} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} testID="v2-map">
        <Image source={mapImage()} style={{ width, height }} resizeMode="cover" accessibilityRole="image" accessibilityLabel={t('v2.map.label')} />
        {width > 0 ? (
          <TripRoute
            key={trace ? `trace-${trace}` : `static-${routeDest ?? 'none'}`}
            width={width}
            height={height}
            destination={routeDest}
            stage={stage}
            variant={companion?.variant}
            animate={trace !== null}
            reduceMotion={reduceMotion}
            onDone={() => finishTrace(false)}
            homeLabel={t('v2.trip.homeLabel', { name: pandaName })}
          />
        ) : null}
        {width > 0 && adventure
          ? adventure.destinations.map((dest) => {
              const spot = mapSpot(dest.slug);
              if (!spot) return null;
              const open = isUnlocked(dest, adventure.level);
              const name = t(`adventure.destinations.${dest.slug}`);
              const here = routeDest === dest.slug;
              return (
                <Pressable
                  key={dest.slug}
                  testID={`v2-spot-${dest.slug}`}
                  accessibilityRole="button"
                  accessibilityLabel={open ? (here && awayAt ? t('v2.map.here', { name: pandaName, destination: name }) : name) : t('adventure.choose.lockedLabel', { destination: name, level: dest.minLevel })}
                  disabled={trace !== null}
                  onPress={() => openSheet(dest.slug)}
                  style={[styles.spot, { left: spot.x * width - MARK / 2, top: spot.y * height - MARK / 2 }]}
                >
                  <View style={[styles.mark, open ? styles.open : styles.locked, here && !trace ? styles.hidden : null]}>
                    {open ? <View style={styles.dot} /> : <Lock size={20} color={v2Colors.textSecondary} />}
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText} numberOfLines={1}>
                      {open ? name : t('adventure.choose.locked', { level: dest.minLevel })}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          : null}
        {trace ? (
          <Pressable
            testID="v2-trip-skip"
            accessibilityRole="button"
            accessibilityLabel={t('v2.trip.skip')}
            onPress={() => finishTrace(true)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </View>
      <V2Button variant="secondary" label={adventure ? `${t('adventure.journal.open')} · ${t('adventure.journal.count', { found: adventure.foundCount, total: adventure.totalCount })}` : t('adventure.journal.open')} onPress={() => router.push('/adventure/journal')} />
      {adventure && sheetDest ? (
        <PostcardSheet
          visible
          destination={sheetDest}
          adventure={adventure}
          stage={stage}
          pandaName={pandaName}
          childName={childName}
          pending={pending || start.isPending}
          error={error}
          onGo={() => go(sheetDest.slug)}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', borderRadius: v2Radius.card, overflow: 'hidden', backgroundColor: v2Colors.backgroundDeep, ...v2Shadow },
  spot: { position: 'absolute', width: MARK, alignItems: 'center', overflow: 'visible' },
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  open: { backgroundColor: v2Colors.card, borderColor: v2Colors.primary },
  locked: { backgroundColor: v2Colors.cardMuted, borderColor: v2Colors.line },
  // la tête du panda occupe la clairière pendant le voyage (et à la fin du tracé)
  hidden: { opacity: 0 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: v2Colors.primary },
  tag: { marginTop: 2, backgroundColor: v2Colors.card, borderRadius: v2Radius.pill, paddingHorizontal: 8, paddingVertical: 2, minWidth: 96, alignItems: 'center' },
  tagText: { ...v2Font(800, 11), color: v2Colors.text },
});
