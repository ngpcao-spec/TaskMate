import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { taskKeys } from '@/api/keys';
import { fetchTask } from '@/api/tasks';
import { RenewTask } from '@/components/RenewTask';
import { useMe } from '@/hooks/useMe';

/** Renouveler une tâche : PARENT uniquement — route protégée, pas seulement le bouton masqué (D-054). */
export default function RenewTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  const task = useQuery({ queryKey: taskKeys.one(id), queryFn: () => fetchTask(id), enabled: !!id });
  if (!me) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  if (task.isPending) return <ActivityIndicator />;
  if (!task.data) return null;
  return <RenewTask task={task.data} />;
}
