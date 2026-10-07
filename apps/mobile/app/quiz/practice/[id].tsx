import { Redirect, useLocalSearchParams } from 'expo-router';
import { PracticeRun } from '@/components/quiz/PracticeRun';
import { useMe } from '@/hooks/useMe';

/** ENFANT uniquement ; l'identifiant est celui du jeu (le serveur refuse un jeu qui n'est pas le sien). */
export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  if (!me || !id) return null;
  if (me.member.role !== 'child') return <Redirect href="/" />;
  return <PracticeRun setId={id} />;
}
