import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAccount, deleteChild, fetchDevices, revokeDevice, updateChild, updateFamilyTimezone } from '@/api/account';
import { createInvite } from '@/api/family';
import { queryKeys } from '@/api/keys';
import i18n from '@/i18n';
import { useToastStore } from '@/store/toast';

export const useDevices = (enabled: boolean) => useQuery({ queryKey: ['devices'], queryFn: fetchDevices, enabled });

function useAdminMutation<V, R = void>(fn: (v: V) => Promise<R>, invalidate: readonly (readonly string[])[], success?: string) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<R, unknown, V>({
    networkMode: 'always', // gestion du foyer : en ligne uniquement
    mutationFn: fn,
    onSuccess: () => success && show(i18n.t(success)),
    onError: () => show(i18n.t('common.error'), 'error'),
    onSettled: () => {
      for (const key of invalidate) void queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}

export const useRevokeDevice = () => useAdminMutation((id: string) => revokeDevice(id), [['devices']], 'settings.deviceRevoked');
export const useUpdateChild = () =>
  useAdminMutation(({ id, patch }: { id: string; patch: Parameters<typeof updateChild>[1] }) => updateChild(id, patch), [queryKeys.me], 'taskForm.saved');
export const useDeleteChild = () => useAdminMutation((id: string) => deleteChild(id), [queryKeys.me], 'settings.childDeleted');
export const useUpdateTimezone = () =>
  useAdminMutation(({ familyId, timezone }: { familyId: string; timezone: string }) => updateFamilyTimezone(familyId, timezone), [queryKeys.me], 'taskForm.saved');
/** Génère un code d'invitation : `childId` = code enfant, `null` = co-parent. */
export const useCreateInvite = () => useAdminMutation<string | null, string>((childId) => createInvite(childId), []);
export const useDeleteAccount = () => useAdminMutation<void>(() => deleteAccount(), []);
