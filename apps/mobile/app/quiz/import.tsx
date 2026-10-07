import { Redirect } from 'expo-router';
import { ImportDocument } from '@/components/quiz/ImportDocument';
import { useMe } from '@/hooks/useMe';

/** Génération de questions depuis un document : PARENT uniquement (route protégée, pas seulement le bouton masqué). */
export default function ImportScreen() {
  const me = useMe().data;
  if (!me) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  return <ImportDocument />;
}
