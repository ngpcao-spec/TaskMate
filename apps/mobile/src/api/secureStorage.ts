import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Stockage de session Supabase dans le Keychain/Keystore.
 * SecureStore limite la taille d'une valeur (~2 Ko sur iOS) : on découpe en morceaux.
 */
const CHUNK = 1800;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

export async function secureGet(key: string): Promise<string | null> {
  const n = await SecureStore.getItemAsync(countKey(key));
  if (n === null) return null;
  const parts: string[] = [];
  for (let i = 0; i < Number(n); i += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

export async function secureRemove(key: string): Promise<void> {
  const n = await SecureStore.getItemAsync(countKey(key));
  for (let i = 0; i < Number(n ?? 0); i += 1) await SecureStore.deleteItemAsync(chunkKey(key, i));
  await SecureStore.deleteItemAsync(countKey(key));
}

export async function secureSet(key: string, value: string): Promise<void> {
  await secureRemove(key);
  const total = Math.max(1, Math.ceil(value.length / CHUNK));
  for (let i = 0; i < total; i += 1) {
    await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await SecureStore.setItemAsync(countKey(key), String(total));
}

/** Web (aperçu/captures) : pas de Keychain → localStorage. Mobile : SecureStore (chunké). */
const webStorage = {
  getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => void globalThis.localStorage?.setItem(key, value),
  removeItem: async (key: string) => void globalThis.localStorage?.removeItem(key),
};

export const supabaseAuthStorage =
  Platform.OS === 'web'
    ? webStorage
    : {
        getItem: secureGet,
        setItem: secureSet,
        removeItem: secureRemove,
      };
