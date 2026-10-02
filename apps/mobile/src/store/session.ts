import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type SessionState = {
  authReady: boolean;
  session: Session | null;
  /** Enfant affiché (mode parent). Mode enfant : géré par le rôle, jamais par ce champ. */
  displayedChildId: string | null;
  setSession: (session: Session | null) => void;
  setDisplayedChildId: (id: string | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  authReady: false,
  session: null,
  displayedChildId: null,
  setSession: (session) => set({ session, authReady: true }),
  setDisplayedChildId: (displayedChildId) => set({ displayedChildId }),
}));
