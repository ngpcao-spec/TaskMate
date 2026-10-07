import { Redirect, useLocalSearchParams } from 'expo-router';
import { AttemptDetail } from '@/components/quiz/AttemptDetail';
import { useMe } from '@/hooks/useMe';

/** Détail et validation d'une tentative : PARENT uniquement. */
export default function AttemptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  if (!me || !id) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  return <AttemptDetail attemptId={id} />;
}
