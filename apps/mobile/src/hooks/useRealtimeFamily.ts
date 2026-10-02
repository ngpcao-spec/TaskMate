import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { subscribeFamilyRealtime } from '@/sync/realtime';

export function useRealtimeFamily(familyId: string | null): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!familyId) return;
    return subscribeFamilyRealtime(queryClient, familyId);
  }, [queryClient, familyId]);
}
