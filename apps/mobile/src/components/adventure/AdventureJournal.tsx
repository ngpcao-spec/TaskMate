import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Card, SectionTitle } from '@/components/ui';
import { journalSections, type AdventureState } from '@/domain/adventure';
import { colors, typography } from '@/theme/tokens';
import { discoveryImage } from './adventureImages';

const ITEM = 72;

/**
 * Carnet « Sổ phiêu lưu » (D-105) : une grille par destination ; trouvaille obtenue en couleur (×N si doublon), pas encore obtenue = silhouette très
 * atténuée et désaturée avec « ? ». Lecture seule (enfant : le sien ; parent : celui d'UN enfant, jamais deux carnets côte à côte).
 */
export function AdventureJournal({ adventure }: { adventure: AdventureState }) {
  const { t } = useTranslation();
  const sections = journalSections(adventure);
  return (
    <View style={styles.wrap}>
      <Text accessibilityLabel={t('adventure.journal.countLabel', { found: adventure.foundCount, total: adventure.totalCount })} style={styles.count}>
        {t('adventure.journal.count', { found: adventure.foundCount, total: adventure.totalCount })}
      </Text>
      {adventure.foundCount === 0 ? <Text style={typography.secondary}>{t('adventure.journal.empty')}</Text> : null}
      {sections.map((section) => (
        <Card key={section.destination}>
          <SectionTitle>{t(`adventure.destinations.${section.destination}`)}</SectionTitle>
          <View style={styles.grid}>
            {section.items.map((item) => {
              const image = discoveryImage(item.slug);
              const found = item.timesFound > 0;
              const name = t(`adventure.discoveries.${item.slug}`);
              return (
                <View
                  key={item.slug}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={found ? t('adventure.journal.foundLabel', { name, count: item.timesFound }) : t('adventure.journal.unknownLabel')}
                  style={styles.item}
                >
                  <View style={styles.tile}>
                    {image ? <Image source={image} resizeMode="contain" style={[styles.image, !found && styles.silhouette]} /> : null}
                    {found ? null : <Text style={styles.unknown}>{t('adventure.journal.unknown')}</Text>}
                    {item.timesFound > 1 ? <Text style={styles.times}>{t('adventure.journal.times', { count: item.timesFound })}</Text> : null}
                  </View>
                  <Text numberOfLines={2} style={styles.itemName}>
                    {found ? name : t('adventure.journal.unknown')}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  count: { fontSize: 28, fontWeight: '800', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: { width: ITEM + 8, alignItems: 'center', gap: 4 },
  tile: { width: ITEM, height: ITEM, alignItems: 'center', justifyContent: 'center' },
  image: { width: ITEM, height: ITEM },
  // silhouette : l'image teintée d'une seule couleur du thème, très atténuée (désaturée)
  silhouette: { tintColor: colors.textSecondary, opacity: 0.25 },
  unknown: { position: 'absolute', fontSize: 28, fontWeight: '800', color: colors.textSecondary },
  times: { position: 'absolute', right: -4, bottom: -2, fontSize: 13, fontWeight: '800', color: colors.accent },
  itemName: { fontSize: 12, color: colors.text, textAlign: 'center' },
});
