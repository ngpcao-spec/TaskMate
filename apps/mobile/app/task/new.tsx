import { Redirect } from 'expo-router';
import { TaskForm } from '@/components/TaskForm';
import { useMe } from '@/hooks/useMe';

/** Création de tâche : PARENT uniquement (SPEC v4 §3.4) — route protégée, pas seulement le bouton masqué. */
export default function NewTask() {
  const me = useMe().data;
  if (!me) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  return <TaskForm />;
}
