import { Redirect, useLocalSearchParams } from 'expo-router';
import { QuestionEditor } from '@/components/quiz/QuestionEditor';
import { useMe } from '@/hooks/useMe';

/** Ajout / modification d'une question : PARENT uniquement. */
export default function QuestionScreen() {
  const { set, id } = useLocalSearchParams<{ set: string; id?: string }>();
  const me = useMe().data;
  if (!me || !set) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  return <QuestionEditor setId={set} questionId={id} />;
}
