import { useLocalSearchParams } from 'expo-router';
import { AdminQuizEditor } from '@/components/admin/AdminQuizEditor';

/** Administration → éditeur d'un QCM du catalogue : administrateur uniquement. */
export default function AdminQuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <AdminQuizEditor quizId={id} />;
}
