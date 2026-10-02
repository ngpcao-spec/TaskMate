import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { taskKeys } from '@/api/keys';
import { fetchTask } from '@/api/tasks';
import { TaskForm } from '@/components/TaskForm';

export default function EditTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useQuery({ queryKey: taskKeys.one(id), queryFn: () => fetchTask(id) });
  if (task.isPending) return <ActivityIndicator />;
  if (!task.data) return null;
  return <TaskForm task={task.data} />;
}
