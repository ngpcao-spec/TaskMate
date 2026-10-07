import { Redirect, useLocalSearchParams } from 'expo-router';
import { EvaluationRun } from '@/components/quiz/EvaluationRun';
import { useMe } from '@/hooks/useMe';

/** ENFANT uniquement ; l'identifiant est celui du jeu (le serveur refuse un jeu qui n'est pas le sien). */
export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  if (!me || !id) return null;
  if (me.member.role !== 'child') return <Redirect href="/" />;
  return <EvaluationRun setId={id} />;
}
