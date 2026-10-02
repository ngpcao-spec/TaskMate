import { BookOpen, Dumbbell, Ellipsis, House, User, type LucideIcon } from 'lucide-react-native';
import { CATEGORY_COLORS, type TaskCategory } from '@/theme/categories';

const ICONS: Record<TaskCategory, LucideIcon> = {
  study: BookOpen,
  sport: Dumbbell,
  chores: House,
  personal: User,
  other: Ellipsis,
};

export function CategoryIcon({ category, size = 20 }: { category: TaskCategory; size?: number }) {
  const Icon = ICONS[category];
  return <Icon size={size} color={CATEGORY_COLORS[category]} />;
}
