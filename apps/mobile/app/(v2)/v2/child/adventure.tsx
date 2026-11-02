import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmDialog } from '@/components/confirm';
import { isUnlocked } from '@/domain/adventure';
import { DEFAULT_PANDA_NAME } from '@/domain/panda';
import { startVars, useAdventure, useAdventurePending, useStartAdventure } from '@/hooks/useAdventure';
import { useCompanion } from '@/hooks/useCompanion';
import { useMe } from '@/hooks/useMe';
import { useToastStore } from '@/store/toast';
import { AdventureCard } from '@/v2/components/AdventureCard';
import { V2Button } from '@/v2/components/V2Button';
import { V2Screen } from '@/v2/components/V2Screen';
import { mapImage, MAP_RATIO, mapSpot, pandaWalkImage } from '@/v2/images';
import { v2Colors, v2Font, v2Radius, v2Shadow, V2_TOUCH } from '@/v2/theme';

const MARK = V2_TOUCH + 8;

/**
 * Phiêu lưu (enfant, V2) : la carte du Vietnam, les 6 destinations aux positions de `map-spots.json`. Débloquée : appui pour la choisir quand la jauge
 * est pleine (`adventure_start`, file d'écritures, id fixé) ; verrouillée : cadenas et « Mở ở cấp {n} ». En voyage : le petit panda sur la clairière.
 * Retour, trouvaille et carnet : logique du lot 2 (D-105).
 */
export default function V2ChildAdventure() {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe().data;
  const childId = me?.member.role === 'child' ? me.member.child_id : null;
  const adventure = useAdventure(childId, !!childId).data;
  const companion = useCompanion(childId, !!childId).data;
  const pending = useAdventurePending(childId);
  const start = useStartAdventure();
  const toast = useToastStore((s) => s.show);
  const [width, setWidth] = useState(0);
  const height = Math.round(width * MAP_RATIO);
  const pandaName = companion?.name ?? DEFAULT_PANDA_NAME;

  const choose = (slug: string) => {
    if (!adventure || !childId) return;
    const destination = t(`adventure.destinations.${slug}`);
    if (adventure.state !== 'ready_to_go' || pending) {
      toast(t('adventure.choose.notReady'), 'info');
      return;
    }
    confirmDialog({
      title: t('adventure.choose.confirmTitle', { destination }),
      message: t('adventure.choose.confirmBody', { name: pandaName }),
      confirmLabel: t('adventure.choose.confirmOk'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        start.mutate(startVars(childId, slug));
        router.navigate('/v2/child/home');
      },
    });
  };

  return (
    <V2Screen title={t('v2.tabs.adventure')} testID="v2-adventure-screen">
      {adventure ? (
        <AdventureCard
          adventure={adventure}
          pandaName={pandaName}
          variant={companion?.variant}
          busy={pending}
          onMap={() => undefined}
          onOpenBag={adventure.active ? () => router.push({ pathname: '/adventure/reveal', params: { id: adventure.active!.id } }) : undefined}
        />
      ) : null}
      <View style={styles.map} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} testID="v2-map">
        <Image source={mapImage()} style={{ width, height }} resizeMode="cover" accessibilityRole="image" accessibilityLabel={t('v2.map.label')} />
        {width > 0 && adventure
          ? adventure.destinations.map((dest) => {
              const spot = mapSpot(dest.slug);
              if (!spot) return null;
              const open = isUnlocked(dest, adventure.level);
              const name = t(`adventure.destinations.${dest.slug}`);
              const here = adventure.active?.destination === dest.slug && adventure.state === 'away';
              return (
                <Pressable
                  key={dest.slug}
                  testID={`v2-spot-${dest.slug}`}
                  accessibilityRole="button"
                  accessibilityLabel={open ? (here ? t('v2.map.here', { name: pandaName, destination: name }) : name) : t('adventure.choose.lockedLabel', { destination: name, level: dest.minLevel })}
                  accessibilityState={{ disabled: !open }}
                  disabled={!open}
                  onPress={() => choose(dest.slug)}
                  style={[styles.spot, { left: spot.x * width - MARK / 2, top: spot.y * height - MARK / 2 }]}
                >
                  <View style={[styles.mark, open ? styles.open : styles.locked]}>
                    {open ? (
                      here ? <Image source={pandaWalkImage(companion?.stage ?? 2)} style={styles.panda} resizeMode="contain" /> : <View style={styles.dot} />
                    ) : (
                      <Lock size={20} color={v2Colors.textSecondary} />
                    )}
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
      </View>
      <V2Button variant="secondary" label={adventure ? `${t('adventure.journal.open')} · ${t('adventure.journal.count', { found: adventure.foundCount, total: adventure.totalCount })}` : t('adventure.journal.open')} onPress={() => router.push('/adventure/journal')} />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', borderRadius: v2Radius.card, overflow: 'hidden', backgroundColor: v2Colors.backgroundDeep, ...v2Shadow },
  spot: { position: 'absolute', width: MARK, alignItems: 'center', overflow: 'visible' },
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  open: { backgroundColor: v2Colors.card, borderColor: v2Colors.primary },
  locked: { backgroundColor: v2Colors.cardMuted, borderColor: v2Colors.line },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: v2Colors.primary },
  panda: { width: MARK - 8, height: MARK - 8 },
  tag: { marginTop: 2, backgroundColor: v2Colors.card, borderRadius: v2Radius.pill, paddingHorizontal: 8, paddingVertical: 2, minWidth: 96, alignItems: 'center' },
  tagText: { ...v2Font(800, 11), color: v2Colors.text },
});
