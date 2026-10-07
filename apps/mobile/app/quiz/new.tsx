import { Redirect } from 'expo-router';
import { NewQuizSet } from '@/components/quiz/NewQuizSet';
import { useMe } from '@/hooks/useMe';

/** Création d'un jeu : PARENT uniquement (route protégée, pas seulement le bouton masqué). */
export default function NewQuizScreen() {
  const me = useMe().data;
  if (!me) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  return <NewQuizSet />;
}
