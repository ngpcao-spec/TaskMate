import { useLocalSearchParams } from 'expo-router';
import { ChildSetHome } from '@/components/quiz/ChildSetHome';
import { QuizEditor } from '@/components/quiz/QuizEditor';
import { useMe } from '@/hooks/useMe';

/** Parent : éditeur du jeu. Enfant : accueil de SON jeu (évaluation) ; le serveur refuse tout autre jeu. */
export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  if (!me || !id) return null;
  return me.member.role === 'parent' ? <QuizEditor setId={id} /> : <ChildSetHome setId={id} />;
}
