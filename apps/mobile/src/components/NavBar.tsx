import type { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/Avatar';
import { Gradient } from '@/components/Gradient';
import { useMe } from '@/hooks/useMe';
import { useIsWide } from '@/hooks/useLayout';
import { colors, MIN_TARGET, radius, shadow, shadowSmall, line } from '@/theme/tokens';

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Navigation en panneau marine (maquette) : barre du bas sur téléphone, colonne latérale avec « Hi, {prénom} ! » sur grand écran.
 * L'onglet actif est une pastille claire en relief ; les autres sont en texte clair sur fond marine.
 */
export function NavBar({ state, descriptors, navigation }: BarProps) {
  const { t } = useTranslation();
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  const me = useMe().data;
  const name = me?.member.display_name ?? '';
  const childId = me?.member.role === 'child' ? me.member.child_id : null;

  const bar = (
    <View style={[wide ? styles.side : styles.bottom, !wide && { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Gradient from={colors.barFrom} to={colors.barTo} direction="v" />
      {wide ? (
        <View style={styles.hello}>
          {childId ? (
            <Avatar childId={childId} name={name} color={me?.children.find((c) => c.id === childId)?.color} size={76} />
          ) : (
            <View accessible accessibilityLabel={name} style={styles.avatar}>
              <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          {name ? <Text style={styles.helloText}>{t('nav.hi', { name })}</Text> : null}
        </View>
      ) : null}
      <View style={wide ? styles.list : styles.row}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options;
          if (!options) return null;
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const badge = options.tabBarBadge;
          const color = focused ? colors.onNavActive : colors.onBar;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityState={{ selected: focused }}
              aria-selected={focused}
              onPress={onPress}
              style={[wide ? styles.itemWide : styles.item, focused && styles.itemActive]}
            >
              <View>
                {options.tabBarIcon?.({ focused, color, size: wide ? 22 : 24 })}
                {badge !== undefined ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={[wide ? styles.labelWide : styles.label, { color: focused ? colors.onNavActive : colors.onBar }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
  return wide ? <View style={styles.sideFrame}>{bar}</View> : bar;
}

const styles = StyleSheet.create({
  /** Cadre derrière la colonne latérale : même fond que les écrans (pas de bande claire à gauche). */
  sideFrame: { backgroundColor: colors.backgroundTop },
  bottom: { overflow: 'hidden', paddingTop: 8, paddingHorizontal: 8, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: line.width, borderColor: colors.navyBorder, ...shadow },
  side: { width: 248, overflow: 'hidden', paddingTop: 24, paddingHorizontal: 14, margin: 12, marginRight: 0, borderRadius: radius.card + 8, borderWidth: line.width, borderColor: colors.navyBorder, ...shadow },
  hello: { alignItems: 'center', gap: 10, paddingBottom: 20 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyLight, borderWidth: line.width, borderColor: colors.ring, ...shadowSmall },
  avatarText: { color: colors.onNavy, fontSize: 30, fontWeight: '700' },
  helloText: { color: colors.onBar, fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 4 },
  list: { gap: 6 },
  item: { flex: 1, minHeight: MIN_TARGET + 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 },
  itemWide: { minHeight: MIN_TARGET + 8, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  itemActive: { backgroundColor: colors.navActive, borderWidth: line.width, borderColor: colors.ring, ...shadowSmall },
  label: { fontSize: 11, fontWeight: '600' },
  labelWide: { fontSize: 15, fontWeight: '600' },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.onSolid, fontSize: 11, fontWeight: '700' },
});
