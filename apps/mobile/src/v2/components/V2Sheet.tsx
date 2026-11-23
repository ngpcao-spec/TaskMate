import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { SHEET_SCRIM_OPACITY, v2Colors, v2Radius, v2Shadow, v2Spacing } from '../theme';
import { V2_MAX_WIDTH } from './V2Screen';

type Props = {
  visible: boolean;
  /** fond touché, bouton retour Android, Échap : ferme la feuille */
  onClose: () => void;
  /** nom de la feuille pour les lecteurs d'écran */
  label: string;
  children: ReactNode;
  testID?: string;
};

/**
 * Feuille du bas de la V2 (D-107) : remplace toute fenêtre système (`window.confirm`, `Alert.alert`). Crème arrondie, posée en bas de l'écran
 * (largeur limitée sur tablette), au-dessus d'un voile ; glisse depuis le bas (sans animation si « réduire les animations »). Se ferme par un toucher
 * du voile, le retour Android / Échap, ou en la faisant glisser vers le bas (au-delà de `SHEET_DISMISS_DRAG` ou d'un geste rapide).
 */
export function V2Sheet({ visible, onClose, label, children, testID }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [drag] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        // geste vertical vers le bas seulement : les touchers et le défilement horizontal restent aux enfants
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (shouldDismissSheet(g.dy, g.vy)) {
            onClose();
            return;
          }
          Animated.spring(drag, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
        },
        onPanResponderTerminate: () => drag.setValue(0),
      }),
    [drag, onClose],
  );
  return (
    <Modal visible={visible} transparent animationType={reduce ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('v2.trip.close')} testID={testID ? `${testID}-scrim` : undefined} />
        <Animated.View
          {...pan.panHandlers}
          style={[styles.sheet, { paddingBottom: v2Spacing.lg + insets.bottom, transform: [{ translateY: drag }] }]}
          accessibilityViewIsModal
          accessibilityLabel={label}
          role="dialog"
          aria-modal
          testID={testID}
        >
          <View style={styles.handleZone} testID={testID ? `${testID}-handle` : undefined} importantForAccessibility="no">
            <View style={styles.handle} />
          </View>
          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Distance (pt) au-delà de laquelle une feuille glissée vers le bas se ferme ; ou geste rapide (vitesse > 0,8). */
export const SHEET_DISMISS_DRAG = 90;
export const shouldDismissSheet = (dy: number, vy: number): boolean => dy > SHEET_DISMISS_DRAG || (dy > 20 && vy > 0.8);

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: v2Colors.sheetScrim, opacity: SHEET_SCRIM_OPACITY },
  sheet: {
    width: '100%',
    maxWidth: V2_MAX_WIDTH,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: v2Colors.card,
    borderTopLeftRadius: v2Radius.card,
    borderTopRightRadius: v2Radius.card,
    paddingTop: v2Spacing.sm,
    ...v2Shadow,
  },
  handleZone: { alignSelf: 'stretch', alignItems: 'center', paddingBottom: v2Spacing.sm },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: v2Colors.line },
  body: { paddingHorizontal: v2Spacing.lg, gap: v2Spacing.md },
});
