import { QueryClient, type QueryClientConfig } from '@tanstack/react-query';

/**
 * QueryClient pour les tests. `gcTime: Infinity` : sans cela, démonter un observateur (useMutation/useQuery) programme un
 * timer de ramasse-miettes de 5 min qui garde le processus Jest en vie (« did not exit one second after the test run »).
 */
export function createTestQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: { gcTime: Infinity, retry: false, ...config.defaultOptions?.queries },
      mutations: { gcTime: Infinity, ...config.defaultOptions?.mutations },
    },
  });
}
