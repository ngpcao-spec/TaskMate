import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import { destinationImage, discoveryImage, POSTCARD_MAX_WIDTH, POSTCARD_RATIO } from '@/components/adventure/adventureImages';
import { isUnlocked, type AdventureState, type CatalogDestination } from '@/domain/adventure';
import { departureBlock } from '@/domain/adventure-trip';
import type { PandaStage } from '@/domain/panda';
import { inviteSituation, pandaLineKey, pandaLineParams } from '@/domain/panda-lines';
import { v2Colors, v2Radius, v2Spacing, v2Text } from '../theme';
import { V2Button } from './V2Button';
import { V2Sheet } from './V2Sheet';

const FIND = 52;

type Props = {
  visible: boolean;
  destination: CatalogDestination;
  adventure: AdventureState;
  stage: PandaStage;
  pandaName: string;
  childName: string;
  /** une écriture d'aventure attend (hors ligne, ou en cours d'envoi) */
  pending: boolean;
  /** rouverte depuis le mot épinglé pendant le voyage : aucune action */
  readOnly?: boolean;
  /** refus doux du serveur (`gauge_not_full`, `destination_locked`…), déjà traduit */
  error?: string | null;
  onGo: () => void;
  onClose: () => void;
};

/**
 * Feuille « carte postale » d'une destination (D-107) : image, nom, invitation du panda dans la voix de son stade, trouvailles de cette destination
 * (obtenues en couleur ; sinon atténuées, désaturées et sans nom) avec le compteur, puis « Lên đường! » (actif seulement jauge pleine) et « Để sau ».
 * Verrouillée : image atténuée, « Mở ở cấp {n} » et le niveau actuel, sans départ. Lecture seule (mot épinglé) : « Đóng » seulement.
 */
export function PostcardSheet({ visible, destination, adventure, stage, pandaName, childName, pending, readOnly = false, error = null, onGo, onClose }: Props) {
  const { t } = useTranslation();
  const slug = destination.slug;
  const name = t(`adventure.destinations.${slug}`);
  const open = isUnlocked(destination, adventure.level);
  const times = new Map(adventure.found.map((f) => [f.slug, f.timesFound]));
  const found = destination.discoveries.filter((d) => (times.get(d) ?? 0) > 0).length;
  const total = destination.discoveries.length;
  const invite = inviteSituation(slug);
  const block = departureBlock(adventure, pending);
  const image = destinationImage(slug);
  const line = readOnly
    ? t(pandaLineKey(stage, 'adventure_away', 0), pandaLineParams(childName, name))
    : open && invite
      ? t(pandaLineKey(stage, invite, adventure.foundCount), pandaLineParams(childName, name))
      : null;
  const hint =
    error ??
    (block?.kind === 'missing'
      ? t('v2.celebration.missing', { n: block.energy })
      : block?.kind === 'busy'
        ? t('v2.trip.busy', { name: pandaName })
        : block?.kind === 'pending'
          ? t('adventure.pending')
          : null);

  return (
    <V2Sheet visible={visible} onClose={onClose} label={t('v2.trip.sheetLabel', { destination: name })} testID={`v2-postcard-${slug}`}>
      {image ? (
        <View style={styles.cardWrap}>
          <Image
            source={image}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={name}
            style={[styles.card, open ? null : styles.dim]}
            testID="v2-postcard-image"
          />
        </View>
      ) : null}
      <Text style={styles.name} accessibilityRole="header">
        {name}
      </Text>
      {open ? null : (
        <View style={styles.lockBox}>
          <Text style={styles.locked}>{t('adventure.choose.locked', { level: destination.minLevel })}</Text>
          <Text style={styles.level}>{t('v2.trip.level', { level: adventure.level })}</Text>
        </View>
      )}
      {line ? (
        <View style={styles.quote}>
          <Text style={styles.quoteText} accessibilityLabel={`${pandaName}: ${line}`}>
            {line}
          </Text>
        </View>
      ) : null}

      {total > 0 ? (
        <View style={styles.finds}>
          <View style={styles.findsHead}>
            <Text style={v2Text.bodyBold}>{t('v2.trip.finds')}</Text>
            <Text style={styles.count} accessibilityLabel={t('adventure.journal.countLabel', { found, total })}>
              {t('adventure.journal.count', { found, total })}
            </Text>
          </View>
          <View style={styles.findRow}>
            {destination.discoveries.map((d) => {
              const got = (times.get(d) ?? 0) > 0;
              const img = discoveryImage(d);
              const label = got ? t(`adventure.discoveries.${d}`) : t('adventure.journal.unknownLabel');
              return (
                <View key={d} style={styles.find} accessible accessibilityLabel={label} testID={`v2-find-${d}${got ? '' : '-unknown'}`}>
                  <View style={[styles.findBox, got ? null : styles.findBoxUnknown]}>
                    {img ? <Image source={img} resizeMode="contain" style={[styles.findImg, got ? null : styles.silhouette]} importantForAccessibility="no" /> : null}
                  </View>
                  <Text style={styles.findName} numberOfLines={1} importantForAccessibility="no">
                    {got ? t(`adventure.discoveries.${d}`) : t('adventure.journal.unknown')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {readOnly ? (
        <V2Button label={t('v2.trip.close')} variant="secondary" onPress={onClose} testID="v2-postcard-close" />
      ) : (
        <View style={styles.actions}>
          {open ? (
            <>
              {hint ? (
                <Text style={styles.hint} accessibilityLiveRegion="polite" testID="v2-postcard-hint">
                  {hint}
                </Text>
              ) : null}
              <V2Button label={t('v2.trip.go')} onPress={onGo} disabled={block !== null} testID="v2-postcard-go" />
            </>
          ) : null}
          <V2Button label={t('v2.trip.later')} variant="secondary" onPress={onClose} testID="v2-postcard-later" />
        </View>
      )}
    </V2Sheet>
  );
}

const styles = StyleSheet.create({
  cardWrap: { alignItems: 'center' },
  // assez petite pour que « Lên đường! » reste visible sans défiler sur un téléphone (390 × 844)
  card: { width: '100%', maxWidth: Math.min(POSTCARD_MAX_WIDTH, 250), aspectRatio: 1 / POSTCARD_RATIO },
  dim: { opacity: 0.4 },
  name: { ...v2Text.title, textAlign: 'center' },
  lockBox: { alignItems: 'center', gap: 2 },
  locked: { ...v2Text.heading, color: v2Colors.textSecondary },
  level: v2Text.body,
  quote: { backgroundColor: v2Colors.primarySoft, borderRadius: v2Radius.control, padding: v2Spacing.md },
  quoteText: { ...v2Text.bodyBold, textAlign: 'center' },
  finds: { gap: v2Spacing.sm },
  findsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { ...v2Text.bodyBold, color: v2Colors.energyText },
  findRow: { flexDirection: 'row', flexWrap: 'wrap', gap: v2Spacing.sm, justifyContent: 'center' },
  find: { width: FIND + 12, alignItems: 'center', gap: 2 },
  findBox: { width: FIND, height: FIND, borderRadius: v2Radius.small, backgroundColor: v2Colors.cardMuted, alignItems: 'center', justifyContent: 'center' },
  findBoxUnknown: { backgroundColor: v2Colors.track },
  findImg: { width: FIND - 8, height: FIND - 8 },
  // trouvaille pas encore obtenue : silhouette (atténuée, désaturée), nom caché
  silhouette: { opacity: 0.3, filter: 'grayscale(1)' } as never,
  findName: { ...v2Text.caption, textAlign: 'center' },
  actions: { gap: v2Spacing.sm },
  hint: { ...v2Text.bodyBold, color: v2Colors.energyText, textAlign: 'center' },
});
