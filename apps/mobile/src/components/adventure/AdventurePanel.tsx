import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import type { AdventureState } from '@/domain/adventure';
import { useAdventurePending } from '@/hooks/useAdventure';
import { colors, MIN_TARGET, radius } from '@/theme/tokens';

type Props = { childId: string; pandaName: string; adventure: AdventureState };

/**
 * Aventures dans le panneau du panda (D-105, vue enfant) : jauge « Phiêu lưu 18/30 », puis selon l'état « Đi phiêu lưu! » (choix de la destination),
 * « {name} đang ở {destination}, mai về nhé! » ou « {name} về rồi! » (révélation), et le lien vers le carnet. Posé sur le panneau marine : textes `onNavy`.
 */
export function AdventurePanel({ childId, pandaName, adventure }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const pending = useAdventurePending(childId);
  const ratio = adventure.cost > 0 ? Math.min(1, adventure.gauge / adventure.cost) : 0;
  const destination = adventure.active ? t(`adventure.destinations.${adventure.active.destination}`) : '';
  return (
    <View style={styles.box}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('adventure.gaugeLabel', { value: adventure.gauge, cost: adventure.cost })}
        accessibilityValue={{ min: 0, max: adventure.cost, now: adventure.gauge }}
        style={styles.gaugeRow}
      >
        <Text style={styles.gaugeText}>{t('adventure.gauge', { value: adventure.gauge, cost: adventure.cost })}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      </View>

      {pending ? <Text style={styles.note}>{t('adventure.pending')}</Text> : null}
      {adventure.state === 'ready_to_go' && !pending ? <Button label={t('adventure.go')} onPress={() => router.push('/adventure/choose')} /> : null}
      {adventure.state === 'away' ? <Text style={styles.note}>{t('adventure.away', { name: pandaName, destination })}</Text> : null}
      {adventure.state === 'back' && adventure.active && !pending ? (
        <Button label={t('adventure.back', { name: pandaName })} onPress={() => router.push({ pathname: '/adventure/reveal', params: { id: adventure.active!.id } })} />
      ) : null}

      <Pressable accessibilityRole="button" accessibilityLabel={t('adventure.journal.open')} onPress={() => router.push('/adventure/journal')} style={styles.link}>
        <Text style={styles.linkText}>
          {t('adventure.journal.open')} · {t('adventure.journal.count', { found: adventure.foundCount, total: adventure.totalCount })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gaugeText: { fontSize: 13, fontWeight: '700', color: colors.onNavy, minWidth: 96 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.trackOnNavy, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.ringOnNavy },
  note: { fontSize: 14, fontWeight: '600', color: colors.onNavy },
  link: { minHeight: MIN_TARGET, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4, borderRadius: radius.control },
  linkText: { fontSize: 14, fontWeight: '700', color: colors.onNavy, textDecorationLine: 'underline' },
});
