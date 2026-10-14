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
  gift: '#B8613A',
  'gamepad-2': '#B8613A',
  film: '#4B5AA5',
  smartphone: '#3A7CA5',
  cookie: '#C98E36',
  star: '#C98E36',
  pizza: '#B8454E',
  popcorn: '#C98E36',
  ticket: '#7C79C2',
  trophy: '#C98E36',
};
