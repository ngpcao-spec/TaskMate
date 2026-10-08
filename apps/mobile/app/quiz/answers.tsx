import { Redirect, useLocalSearchParams } from 'expo-router';
import { AnswerGrid } from '@/components/quiz/AnswerGrid';
import { useMe } from '@/hooks/useMe';

/** Grille « Đáp án » : confirmation des réponses d'un examen avant publication — PARENT uniquement (route protégée, pas seulement le bouton masqué). */
export default function AnswersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  if (!me || !id) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  return <AnswerGrid setId={id} />;
}
