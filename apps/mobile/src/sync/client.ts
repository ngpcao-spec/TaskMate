import { QueryClient } from '@tanstack/react-query';
import { registerMutationDefaults } from './mutations';

export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 jours

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // gcTime >= maxAge de la persistance, sinon le cache est purgé avant d'être relu
        gcTime: CACHE_MAX_AGE,
        staleTime: 30_000,
        // hors ligne : on sert le cache, une seule tentative réseau
        networkMode: 'offlineFirst',
        retry: 1,
      },
      mutations: { networkMode: 'online' }, // en pause hors ligne → file d'attente
    },
  });
  registerMutationDefaults(client);
  return client;
}
