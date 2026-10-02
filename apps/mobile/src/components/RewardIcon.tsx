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

/** Teinte de la pastille d'icône (maquette « Điểm thưởng »). */
export const REWARD_TINTS: Record<string, string> = {
  gift: '#F5762E',
  'gamepad-2': '#F5762E',
  film: '#3B4A9B',
  smartphone: '#1E88F5',
  cookie: '#F5A623',
  star: '#F5B301',
  pizza: '#E5484D',
  popcorn: '#F5A623',
  ticket: '#8B5CF6',
  trophy: '#F5B301',
};
