import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChoiceButton } from '@/components/quiz/ChoiceButton';
import { Card } from '@/components/ui';
import { LETTERS, questionTag } from '@/domain/quiz';
import type { PlayQuestionRow } from '@/api/quizzes';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type Props = {
  questions: readonly PlayQuestionRow[];
  chosen: Readonly<Record<string, number | null | undefined>>;
  onChoose: (questionId: string, displayed: number) => void;
  /** « Feuille seule » : uniquement numéros et lettres (le serveur n'envoie alors aucun énoncé). */
  sheetOnly: boolean;
};

/**
 * « Phiếu trả lời » (D-062) : l'enfant lit le sujet sur papier et répond ici. Chaque question porte son NUMÉRO d'origine bien visible ;
 * les choix A à D sont de grands boutons (≥ 44 pt). Une question qui dépend d'une figure affiche le bandeau « Xem hình / bảng trên đề giấy ».
 * Aucun retour juste/faux : l'enfant ne connaît jamais la bonne réponse pendant la feuille.
 */
export function AnswerSheet({ questions, chosen, onChoose, sheetOnly }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.list}>
      {questions.map((q, i) => {
        const n = questionTag(q.origin_number, i);
        const selected = chosen[q.question_id];
        return (
          <Card key={q.question_id}>
            <Text accessibilityRole="header" style={styles.number}>{t('revisions.sheet.question', { n })}</Text>
            {q.needs_figure ? (
              <View accessible accessibilityRole="alert" accessibilityLabel={t('revisions.sheet.figure', { n })} style={styles.figure}>
                <Text style={styles.figureText}>{t('revisions.sheet.figure', { n })}</Text>
              </View>
            ) : null}
            {!sheetOnly && q.prompt !== '' ? <Text style={styles.prompt}>{q.prompt}</Text> : null}
            {sheetOnly ? (
              <View accessibilityRole="radiogroup" style={styles.letters}>
                {q.choices.map((_, c) => {
                  const on = selected === c;
                  return (
                    <Pressable
                      key={c}
                      accessibilityRole="radio"
                      accessibilityLabel={t('revisions.sheet.choice', { n, letter: LETTERS[c] })}
                      accessibilityState={{ selected: on, checked: on }}
                      aria-checked={on}
                      onPress={() => onChoose(q.question_id, c)}
                      style={[styles.letter, on && styles.letterOn]}
                    >
                      <Text style={[styles.letterText, on && styles.letterTextOn]}>{LETTERS[c]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View accessibilityRole="radiogroup" style={styles.choices}>
                {q.choices.map((choice, c) => (
                  <ChoiceButton key={c} label={`${LETTERS[c]}. ${choice}`} selected={selected === c} onPress={() => onChoose(q.question_id, c)} />
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  number: { fontSize: 22, fontWeight: '800', color: colors.text },
  figure: { backgroundColor: colors.primaryTint, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, padding: 10 },
  figureText: { fontSize: 14, fontWeight: '700', color: colors.text },
  prompt: { ...typography.body, color: colors.text },
  letters: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  letter: { width: MIN_TARGET + 12, height: MIN_TARGET + 12, borderRadius: 999, borderWidth: 2, borderColor: '#D5DFEC', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  letterOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  letterText: { fontSize: 22, fontWeight: '800', color: colors.textSecondary },
  letterTextOn: { color: '#fff' },
  choices: { gap: 10 },
});
