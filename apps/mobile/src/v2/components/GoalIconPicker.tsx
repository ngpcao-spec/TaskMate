import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_ICON, GOAL_ICONS, type GoalIcon } from '@/domain/goal-icons';
import type { TaskCategory } from '@/types/models';
import { goalIconImage } from '../images';
import { v2Colors, v2Radius, v2Spacing, v2Text, V2_TOUCH } from '../theme';

type Props = { value: string | null; category: TaskCategory; onChange: (icon: GoalIcon | null) => void };

/** Grille des 36 icônes d'objectifs (parent, V2) ; « Tự động » = icône de la catégorie (valeur nulle). */
export function GoalIconPicker({ value, category, onChange }: Props) {
  const { t } = useTranslation();
  const auto = CATEGORY_ICON[category] ?? 'reveil';
  const cell = (key: string, icon: GoalIcon, selected: boolean, label: string, onPress: () => void) => (
    <Pressable key={key} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected, checked: selected }} aria-checked={selected} onPress={onPress} style={[styles.cell, selected ? styles.on : null]} testID={`goal-icon-${key}`}>
      <Image source={goalIconImage(icon)} style={styles.img} resizeMode="contain" />
    </Pressable>
  );
  return (
    <View style={styles.box} accessibilityRole="radiogroup" accessibilityLabel={t('v2.icons.title')}>
      <Text style={v2Text.bodyBold}>{t('v2.icons.title')}</Text>
      <View style={styles.grid}>
        {cell('auto', auto, value === null, t('v2.icons.auto', { name: t(`v2.icons.names.${auto}`) }), () => onChange(null))}
        {GOAL_ICONS.map((i) => cell(i, i, value === i, t(`v2.icons.names.${i}`), () => onChange(i)))}
      </View>
    </View>
  );
}

const SIZE = Math.max(52, V2_TOUCH);
const styles = StyleSheet.create({
  box: { gap: v2Spacing.sm, backgroundColor: v2Colors.card, borderRadius: v2Radius.control, padding: v2Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: v2Spacing.sm },
  cell: { width: SIZE, height: SIZE, borderRadius: v2Radius.small, borderWidth: 2, borderColor: v2Colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: v2Colors.card },
  on: { borderColor: v2Colors.primary, backgroundColor: v2Colors.primarySoft },
  img: { width: SIZE - 12, height: SIZE - 12 },
});
