import { createMMKV } from 'react-native-mmkv';

/** Stockage local synchrone (cache des requêtes, préférences). La session auth reste dans SecureStore. */
const mmkv = createMMKV({ id: 'taskmate' });

export const kvStorage = {
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string): void => mmkv.set(key, value),
  removeItem: (key: string): void => void mmkv.remove(key),
};
