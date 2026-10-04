import { useQuery } from '@tanstack/react-query';
import { liveProbeDeps, runProbes } from '@/api/health';
import { config } from '@/config';
import { evaluateHealth, summarize } from '@/domain/health';

/** Diagnostic de production : sondes réelles → constats. Aucun cache (on veut l'état actuel), aucune relance automatique. */
export function useHealth(enabled: boolean) {
  const query = useQuery({
    queryKey: ['health-diagnostic'],
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    networkMode: 'always',
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const probes = await runProbes(liveProbeDeps());
      const items = evaluateHealth(probes, { supabaseUrl: config.supabaseUrl, webUrl: config.webUrl, vapidPublicKey: config.vapidPublicKey });
      return { items, summary: summarize(items) };
    },
  });
  return query;
}
