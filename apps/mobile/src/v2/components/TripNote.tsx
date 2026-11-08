import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { noteFontSize } from '@/domain/adventure-trip';
import { tripImage } from '../images';
import { v2Colors, v2Handwriting } from '../theme';

/** Taille du mot épinglé sur la porte (pt). */
export const NOTE_SIZE = 80;
/** Largeur utile du papier (sous l'épingle, hors du coin replié). */
const PAPER = { left: 10, right: 10, top: 20, bottom: 13 };
const PAPER_WIDTH = NOTE_SIZE - PAPER.left - PAPER.right;

type Props = {
  /** centre du mot (px dans l'en-tête) : la porte de la maison */
  left: number;
  top: number;
  /** « Tớ đi {destination}, sáng mai về nhé! » */
  text: string;
  /** « — {name} » */
  signature: string;
  onPress: () => void;
};

/**
 * Mot épinglé sur la porte pendant le voyage (D-107) : `note.webp` avec le message du panda écrit à la main (Nunito italique, 2 lignes au plus) et
 * sa signature. Toucher rouvre la carte postale de la destination (lecture seule). Libellé = le texte du mot.
 */
export function TripNote({ left, top, text, signature, onPress }: Props) {
  const label = `${text} ${signature}`;
  const size = noteFontSize(text, PAPER_WIDTH);
  return (
    <Pressable
      testID="v2-trip-note"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.note, { left: left - NOTE_SIZE / 2, top: top - NOTE_SIZE / 2 }]}
    >
      <Image source={tripImage('note')} style={styles.paperImg} resizeMode="contain" importantForAccessibility="no" />
      <View style={styles.paper} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.2) }]} numberOfLines={2}>
          {text}
        </Text>
        <Text style={styles.signature} numberOfLines={1}>
          {signature}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  note: { position: 'absolute', width: NOTE_SIZE, height: NOTE_SIZE },
  // taille explicite : sur le web, une image locale sans largeur ni hauteur garde sa taille d'origine (512 px)
  paperImg: { position: 'absolute', top: 0, left: 0, width: NOTE_SIZE, height: NOTE_SIZE },
  // zone d'écriture du papier (sous l'épingle, hors du coin replié)
  paper: { position: 'absolute', ...PAPER, justifyContent: 'center', gap: 1 },
  text: { ...v2Handwriting(9), color: v2Colors.ink, textAlign: 'center' },
  signature: { ...v2Handwriting(7), color: v2Colors.ink, textAlign: 'right' },
});
