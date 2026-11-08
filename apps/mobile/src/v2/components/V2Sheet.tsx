import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { SHEET_SCRIM_OPACITY, v2Colors, v2Radius, v2Shadow, v2Spacing, v2Text } from '../theme';
import { V2Button } from './V2Button';
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
 * (largeur limitée sur tablette), au-dessus d'un voile ; glisse depuis le bas (sans animation si « réduire les animations »).
 */
export function V2Sheet({ visible, onClose, label, children, testID }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  return (
    <Modal visible={visible} transparent animationType={reduce ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('v2.trip.close')} testID={testID ? `${testID}-scrim` : undefined} />
        <View style={[styles.sheet, { paddingBottom: v2Spacing.lg + insets.bottom }]} accessibilityViewIsModal accessibilityLabel={label} role="dialog" aria-modal testID={testID}>
          <View style={styles.handle} importantForAccessibility="no" />
          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type ConfirmProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmation V2 : titre, message, action et « Hủy » traduits (jamais la boîte du navigateur). */
export function V2ConfirmSheet({ visible, title, message, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel }: ConfirmProps) {
  return (
    <V2Sheet visible={visible} onClose={onCancel} label={title} testID="v2-confirm">
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.actions}>
        <V2Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} testID="v2-confirm-ok" />
        <V2Button label={cancelLabel} variant="secondary" onPress={onCancel} testID="v2-confirm-cancel" />
      </View>
    </V2Sheet>
  );
}

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
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: v2Colors.line, marginBottom: v2Spacing.sm },
  body: { paddingHorizontal: v2Spacing.lg, gap: v2Spacing.md },
  title: { ...v2Text.title, textAlign: 'center' },
  message: { ...v2Text.body, color: v2Colors.textSecondary, textAlign: 'center' },
  actions: { gap: v2Spacing.sm, marginTop: v2Spacing.sm },
});
