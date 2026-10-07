import { Redirect, useLocalSearchParams } from 'expo-router';
import { ResultView } from '@/components/quiz/ResultView';
import { useMe } from '@/hooks/useMe';

/** Résultat d'une tentative : ENFANT uniquement (le parent passe par le détail de tentative). */
export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  if (!me || !id) return null;
  if (me.member.role !== 'child') return <Redirect href="/" />;
  return <ResultView attemptId={id} />;
}
