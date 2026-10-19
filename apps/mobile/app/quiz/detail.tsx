import { Redirect, useLocalSearchParams } from 'expo-router';
import { ParentQuizDetail } from '@/components/quiz/ParentQuizDetail';
import { useMe } from '@/hooks/useMe';

/** Détail d'un quiz du catalogue (D-089) : PARENT uniquement, pour SON enfant (`?child=&quiz=`, `&attempt=` pour le repli d'une notification). */
export default function QuizDetailScreen() {
  const { child, quiz, attempt } = useLocalSearchParams<{ child?: string; quiz?: string; attempt?: string }>();
  const me = useMe().data;
  if (!me || !child || !quiz) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  return <ParentQuizDetail childId={child} quizId={quiz} attemptId={attempt ?? null} />;
}
