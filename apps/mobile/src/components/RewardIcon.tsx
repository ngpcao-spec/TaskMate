import { Cookie, Film, Gamepad2, Gift, Pizza, Popcorn, Smartphone, Star, Ticket, Trophy, type LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme/tokens';

export const REWARD_ICONS: Record<string, LucideIcon> = {
  'gamepad-2': Gamepad2,
  film: Film,
  smartphone: Smartphone,
  cookie: Cookie,
  gift: Gift,
  star: Star,
  pizza: Pizza,
  popcorn: Popcorn,
  ticket: Ticket,
  trophy: Trophy,
};
export const REWARD_ICON_NAMES = Object.keys(REWARD_ICONS);

export function RewardIcon({ name, size = 24, color = colors.primary }: { name: string; size?: number; color?: string }) {
  const Icon = REWARD_ICONS[name] ?? Gift;
  return <Icon size={size} color={color} />;
}
