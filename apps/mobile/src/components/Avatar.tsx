import { Image, StyleSheet, Text, View } from 'react-native';
import { useAvatar } from '@/hooks/useAvatars';
import { childColor } from '@/theme/childColor';
import { colors, line, shadowSmall } from '@/theme/tokens';

type Props = {
  /** Enfant dont on affiche l'avatar ; absent = simple initiale (ex. un parent). */
  childId?: string | null;
  name: string;
  /** Couleur enregistrée de l'enfant (affichée via `childColor`). */
  color?: string | null;
  size?: number;
  /** Libellé lu par les lecteurs d'écran (par défaut le prénom). */
  accessibilityLabel?: string;
};

/**
 * Pastille d'un enfant : son avatar « dessin animé » (D-071) s'il en a un, sinon l'initiale sur sa couleur. L'avatar est une image d'illustration :
 * le prénom reste le texte lu par les lecteurs d'écran.
 */
export function Avatar({ childId, name, color, size = 52, accessibilityLabel }: Props) {
  const { uri } = useAvatar(childId);
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel ?? name} style={[styles.base, box, { backgroundColor: childColor(color) }]}>
      {uri ? (
        <Image source={{ uri }} accessibilityIgnoresInvertColors style={box} resizeMode="cover" testID="avatar-image" />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>{name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: line.width, borderColor: colors.ring, ...shadowSmall },
  initial: { color: colors.onPrimary, fontWeight: '700' },
});
