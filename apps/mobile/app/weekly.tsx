import { useLocalSearchParams } from 'expo-router';
import { WeeklyReview } from '@/components/quiz/WeeklyReview';

/** Ôn tập (D-084) : l'enfant ouvre le sien ; le parent ouvre celui de l'enfant du bandeau (`?child=`). */
export default function WeeklyScreen() {
  const { child } = useLocalSearchParams<{ child?: string }>();
  return <WeeklyReview childId={child ?? null} />;
}
