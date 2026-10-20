import { Redirect } from 'expo-router';
import { ChildSetup } from '@/components/onboarding/ChildSetup';
import { useMe } from '@/hooks/useMe';

/** Mini-parcours enfant (D-090) : ENFANT uniquement ; un parent est renvoyé à l'accueil (il a son assistant). */
export default function ChildSetupScreen() {
  const me = useMe().data;
  if (!me) return null;
  if (me.member.role !== 'child') return <Redirect href="/" />;
  return <ChildSetup />;
}
