import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { taskKeys } from '@/api/keys';
import { fetchTask } from '@/api/tasks';
import { TaskDetail } from '@/components/TaskDetail';
import { TaskForm } from '@/components/TaskForm';
import { useMe } from '@/hooks/useMe';

/** Parent : édition. Enfant : détail en lecture seule (route d'édition protégée, SPEC v4 §3.4). */
export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  const task = useQuery({ queryKey: taskKeys.one(id), queryFn: () => fetchTask(id) });
  if (!me || task.isPending) return <ActivityIndicator />;
  if (!task.data) return null;
  return me.member.role === 'parent' ? <TaskForm task={task.data} /> : <TaskDetail task={task.data} />;
}
