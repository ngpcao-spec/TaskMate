import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmDialog } from '@/components/confirm';
import { isUnlocked, type AdventureState } from '@/domain/adventure';
import { startVars, useStartAdventure } from '@/hooks/useAdventure';
import { useToastStore } from '@/store/toast';
import { colors, glass, MIN_TARGET, radius, spacing } from '@/theme/tokens';
import { destinationImage, POSTCARD_RATIO } from './adventureImages';

const CARD_WIDTH = 160; // < 360 : les cartes postales sont petites (D-105)

type Props = { childId: string; pandaName: string; adventure: AdventureState };

/**
 * Choix de la destination (enfant) : les cartes postales dans l'ordre du catalogue ; verrouillées = grisées avec « Mở ở cấp {n} ». Un appui sur une
 * destination débloquée demande confirmation puis envoie `adventure_start` par la file d'écritures (id fixé ici).
 */
export function DestinationPicker({ childId, pandaName, adventure }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const start = useStartAdventure();
  const toast = useToastStore((s) => s.show);

  const choose = (slug: string) => {
    const destination = t(`adventure.destinations.${slug}`);
    if (adventure.state !== 'ready_to_go') {
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
        router.back();
      },
    });
  };

  return (
    <View style={styles.grid}>
      {adventure.destinations.map((d) => {
        const open = isUnlocked(d, adventure.level);
        const name = t(`adventure.destinations.${d.slug}`);
        const image = destinationImage(d.slug);
        return (
          <Pressable
            key={d.slug}
            accessibilityRole="button"
            accessibilityLabel={open ? name : t('adventure.choose.lockedLabel', { destination: name, level: d.minLevel })}
            accessibilityState={{ disabled: !open }}
            aria-disabled={!open}
            disabled={!open}
            onPress={() => choose(d.slug)}
            style={[styles.card, !open && styles.locked]}
          >
            {image ? <Image source={image} resizeMode="contain" style={styles.image} /> : null}
            <Text style={styles.name}>{name}</Text>
            {open ? null : <Text style={styles.lockText}>{t('adventure.choose.locked', { level: d.minLevel })}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  card: { ...glass, width: CARD_WIDTH + 16, minHeight: MIN_TARGET, borderRadius: radius.card, padding: 8, alignItems: 'center', gap: 4 },
  locked: { opacity: 0.45 },
  image: { width: CARD_WIDTH, height: Math.round(CARD_WIDTH * POSTCARD_RATIO) },
  name: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
  lockText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
