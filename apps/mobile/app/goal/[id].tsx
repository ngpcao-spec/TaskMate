import { useLocalSearchParams } from 'expo-router';
import { GoalForm } from '@/components/GoalForm';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useGoals } from '@/hooks/useGoals';

export default function EditGoal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDisplayedChild();
  const goals = useGoals(d?.child?.id ?? null);
  const goal = goals.data?.find((g) => g.id === id);
  if (!goal) return null;
  return <GoalForm goal={goal} />;
}
