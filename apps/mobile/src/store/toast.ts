import { create } from 'zustand';

type Toast = { id: number; message: string; tone: 'info' | 'error' };
type ToastState = {
  toast: Toast | null;
  show: (message: string, tone?: Toast['tone']) => void;
  dismiss: () => void;
};

let nextId = 1;
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message, tone = 'info') => set({ toast: { id: nextId++, message, tone } }),
  dismiss: () => set({ toast: null }),
}));
