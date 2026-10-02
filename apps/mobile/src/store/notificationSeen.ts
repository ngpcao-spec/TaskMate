import { create } from 'zustand';
import { kvStorage } from '@/sync/storage';

const KEY = 'taskmate-notification-seen';

function load(): Record<string, string> {
  try {
    return JSON.parse(kvStorage.getItem(KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

type State = { seen: Record<string, string>; markSeen: (memberId: string, at: string) => void };

/** Dernier passage dans le centre de notifications, par membre (local à l'appareil). */
export const useNotificationSeen = create<State>((set, get) => ({
  seen: load(),
  markSeen: (memberId, at) => {
    const current = get().seen[memberId];
    if (current && new Date(current).getTime() >= new Date(at).getTime()) return;
    const seen = { ...get().seen, [memberId]: at };
    kvStorage.setItem(KEY, JSON.stringify(seen));
    set({ seen });
  },
}));
