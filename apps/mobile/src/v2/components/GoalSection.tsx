import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DaySection } from '@/domain/day-sections';
import { v2Card, v2Colors, v2Spacing, v2Text, V2_TOUCH } from '../theme';

type Props = { section: DaySection; count: number; children: ReactNode; initiallyOpen?: boolean };

/** Carte crème d'un moment de la journée, repliable (titre = bouton). */
export function GoalSection({ section, count, children, initiallyOpen = true }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(initiallyOpen);
  const name = t(`v2.section.${section}`);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.card} testID={`v2-section-${section}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('v2.section.label', { section: name, count })}
        accessibilityHint={t(open ? 'v2.section.collapse' : 'v2.section.expand')}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.header}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {name}
        </Text>
        <Chevron size={22} color={v2Colors.textSecondary} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...v2Card, paddingVertical: v2Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: V2_TOUCH },
  title: v2Text.heading,
  body: { gap: v2Spacing.xs },
});
