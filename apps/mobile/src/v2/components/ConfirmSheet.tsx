import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { v2Colors, v2Spacing, v2Text } from '../theme';
import { V2Button } from './V2Button';
import { V2Sheet } from './V2Sheet';

export type ConfirmSheetAction = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; testID?: string };

type Props = {
  visible: boolean;
  /** voile touché, glissement vers le bas, retour Android, Échap */
  onClose: () => void;
  title: string;
  message?: string;
  /** pictogramme dans un rond vert clair, au-dessus du titre */
  icon?: ReactNode;
  /** contenu propre à la confirmation (carte de récompense, solde…) */
  children?: ReactNode;
  /** boutons pleine largeur, en pilule, de haut en bas (action principale d'abord) */
  actions: readonly ConfirmSheetAction[];
  testID?: string;
};

/**
 * Confirmation dans l'application (D-111) : feuille du bas V2 (`V2Sheet` : crème, coins 24, poignée, voile, fermeture au toucher du voile ou en la
 * glissant vers le bas), icône facultative, titre, message, contenu libre et boutons en pilule. Remplace toute fenêtre système (`window.confirm`,
 * `Alert.alert`) : `confirmDialog` y passe par `V2ConfirmHost`, et les écrans peuvent la monter directement (`RewardConfirmSheet`).
 */
export function ConfirmSheet({ visible, onClose, title, message, icon, children, actions, testID = 'confirm-sheet' }: Props) {
  return (
    <V2Sheet visible={visible} onClose={onClose} label={title} testID={testID}>
      {icon ? (
        <View style={styles.iconRound} importantForAccessibility="no">
          {icon}
        </View>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children}
      <View style={styles.actions}>
        {actions.map((a) => (
          <V2Button key={a.label} label={a.label} variant={a.variant ?? 'primary'} onPress={a.onPress} testID={a.testID} />
        ))}
      </View>
    </V2Sheet>
  );
}

const styles = StyleSheet.create({
  iconRound: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: v2Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...v2Text.title, textAlign: 'center' },
  message: { ...v2Text.body, color: v2Colors.textSecondary, textAlign: 'center' },
  actions: { gap: v2Spacing.sm, marginTop: v2Spacing.sm },
});
