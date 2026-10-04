import { kvStorage } from '@/sync/storage.web';

/**
 * Web : pas de Keychain. La session Supabase est dans localStorage (même modèle que supabase-js par défaut) ;
 * la protection repose sur l'origine HTTPS et la RLS, jamais sur le secret du client.
 */
export const secureGet = async (key: string): Promise<string | null> => kvStorage.getItem(key);
export const secureSet = async (key: string, value: string): Promise<void> => kvStorage.setItem(key, value);
export const secureRemove = async (key: string): Promise<void> => kvStorage.removeItem(key);

export const supabaseAuthStorage = {
  getItem: secureGet,
  setItem: secureSet,
  removeItem: secureRemove,
};
