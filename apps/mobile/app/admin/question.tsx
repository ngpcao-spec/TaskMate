import { useLocalSearchParams } from 'expo-router';
import { AdminGate } from '@/components/admin/AdminGate';
import { QuestionEditor } from '@/components/quiz/QuestionEditor';

/** Administration → ajout / modification d'une question du catalogue : administrateur uniquement. */
export default function AdminQuestionScreen() {
  const { quiz, id } = useLocalSearchParams<{ quiz: string; id?: string }>();
  if (!quiz) return null;
  return (
    <AdminGate>
      <QuestionEditor setId={quiz} questionId={id} catalog />
    </AdminGate>
  );
}
