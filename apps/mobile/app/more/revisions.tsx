import { ChildRevisions } from '@/components/quiz/ChildRevisions';
import { ParentRevisions } from '@/components/quiz/ParentRevisions';
import { useMe } from '@/hooks/useMe';

/** Plus → Révisions : le parent gère les jeux de l'enfant sélectionné ; l'enfant ne voit que les siens (D-055). */
export default function RevisionsScreen() {
  const me = useMe().data;
  if (!me) return null;
  return me.member.role === 'parent' ? <ParentRevisions /> : <ChildRevisions />;
}
