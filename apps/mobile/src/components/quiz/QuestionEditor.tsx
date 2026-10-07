import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { Button, Field, Screen, ScreenHeader } from '@/components/ui';
import { MAX_CHOICES, nextPosition, normalizeQuestion, validateQuestion, type QuestionDraft } from '@/domain/quiz';
import { useParentQuestions, useUpsertQuestion } from '@/hooks/useQuizzes';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/** Ajout / modification d'une question (parent) : énoncé, 3 à 4 choix, bonne réponse, explication facultative. */
export function QuestionEditor({ setId, questionId }: { setId: string; questionId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const questions = useParentQuestions(setId);
  const upsert = useUpsertQuestion();
  const fixedId = useRef(questionId ?? newId()); // id fixé à la création : un rejeu ne crée jamais de doublon
  const existing = useMemo(() => (questions.data ?? []).find((q) => q.id === questionId), [questions.data, questionId]);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [touched, setTouched] = useState(false);

  if (questionId && questions.isPending) return <ActivityIndicator />;
  const value: QuestionDraft = draft ?? {
    prompt: existing?.prompt ?? '',
    choices: Array.from({ length: MAX_CHOICES }, (_, i) => existing?.choices[i] ?? ''),
    correctIndex: existing ? existing.correct_index : null,
    explanation: existing?.explanation ?? '',
  };
  const patch = (p: Partial<QuestionDraft>) => setDraft({ ...value, ...p });
  const errors = validateQuestion(value);
  const has = (e: (typeof errors)[number]) => touched && errors.includes(e);

  const save = () => {
    setTouched(true);
    const normalized = normalizeQuestion(value);
    if (!normalized) return;
    const position = existing ? existing.position : nextPosition((questions.data ?? []).map((q) => q.position));
    upsert.mutate({ id: fixedId.current, setId, position, prompt: normalized.prompt, choices: normalized.choices, correct: normalized.correct, explanation: normalized.explanation }, { onSuccess: () => router.back() });
  };

  return (
    <Screen>
      <ScreenHeader title={t('revisions.questionTitle')} />
      <Field label={t('revisions.prompt')} value={value.prompt} onChangeText={(prompt) => patch({ prompt })} multiline maxLength={600} style={styles.multiline} error={has('promptRequired') ? t('revisions.errors.promptRequired') : errors.includes('promptTooLong') ? t('revisions.errors.promptTooLong') : null} />
      {value.choices.map((choice, i) => (
        <View key={i} style={styles.choiceRow}>
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={t('revisions.correctFor', { n: i + 1 })}
            accessibilityState={{ selected: value.correctIndex === i, checked: value.correctIndex === i }}
            aria-checked={value.correctIndex === i}
            onPress={() => patch({ correctIndex: i })}
            style={[styles.radio, value.correctIndex === i && styles.radioOn]}
          >
            {value.correctIndex === i ? <View style={styles.radioDot} /> : null}
          </Pressable>
          <View style={styles.flex}>
            <Field label={t('revisions.choice', { n: i + 1 })} value={choice} onChangeText={(text) => patch({ choices: value.choices.map((c, j) => (j === i ? text : c)) })} maxLength={260} />
          </View>
        </View>
      ))}
      {has('choicesCount') ? <Text accessibilityRole="alert" style={styles.error}>{t('revisions.errors.choicesCount')}</Text> : null}
      {has('duplicateChoices') ? <Text accessibilityRole="alert" style={styles.error}>{t('revisions.errors.duplicateChoices')}</Text> : null}
      {errors.includes('choiceTooLong') ? <Text accessibilityRole="alert" style={styles.error}>{t('revisions.errors.choiceTooLong')}</Text> : null}
      {has('correctRequired') ? <Text accessibilityRole="alert" style={styles.error}>{t('revisions.errors.correctRequired')}</Text> : null}
      {has('correctEmpty') ? <Text accessibilityRole="alert" style={styles.error}>{t('revisions.errors.correctEmpty')}</Text> : null}
      <Text style={typography.secondary}>{t('revisions.correctMark')}</Text>
      <Field label={t('revisions.explanation')} value={value.explanation} onChangeText={(explanation) => patch({ explanation })} multiline maxLength={600} style={styles.multiline} error={errors.includes('explanationTooLong') ? t('revisions.errors.explanationTooLong') : null} />
      <Button label={t('revisions.save')} onPress={save} loading={upsert.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  multiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  choiceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  radio: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, marginTop: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D5DFEC', backgroundColor: colors.card },
  radioOn: { borderColor: colors.success },
  radioDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.success },
  error: { color: colors.danger, fontSize: 13 },
});
