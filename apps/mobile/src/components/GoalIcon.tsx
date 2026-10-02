import { Bike, BookOpen, Dumbbell, Heart, Music, Star, Target, Trophy, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/tokens';

const ICONS: Record<string, LucideIcon> = {
  target: Target,
  'book-open': BookOpen,
  dumbbell: Dumbbell,
  star: Star,
  trophy: Trophy,
  heart: Heart,
  music: Music,
  bike: Bike,
};

export function GoalIcon({ name, size = 24, color = colors.primary }: { name: string; size?: number; color?: string }) {
  const Icon = ICONS[name] ?? Target;
  return <Icon size={size} color={color} />;
}
