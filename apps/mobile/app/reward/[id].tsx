import { useLocalSearchParams } from 'expo-router';
import { RewardForm } from '@/components/RewardForm';
import { useRewards } from '@/hooks/usePoints';

export default function EditReward() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rewards = useRewards();
  const reward = rewards.data?.find((r) => r.id === id);
  if (!reward) return null;
  return <RewardForm reward={reward} />;
}
