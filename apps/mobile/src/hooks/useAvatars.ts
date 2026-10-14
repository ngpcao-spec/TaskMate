import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmAvatar, discardAvatarCandidate, fetchAvatars, generateAvatar, removeAvatar, setAvatarAllowed } from '@/api/avatars';
import { avatarKeys } from '@/api/keys';
import { serverErrorCode } from '@/api/tasks';
import { avatarErrorKey, NO_AVATAR, type AvatarInfo } from '@/domain/avatar';
import i18n from '@/i18n';
import { useToastStore } from '@/store/toast';

/** Avatars et consentements visibles par l'utilisateur (parent : toute la famille ; enfant : lui seul). */
export const useAvatars = (enabled = true) => useQuery({ queryKey: avatarKeys.all, queryFn: fetchAvatars, enabled, staleTime: 30_000 });

/** Avatar d'un enfant (jamais d'erreur : sans avatar, initiale colorée). */
export function useAvatar(childId: string | null | undefined, enabled = true): AvatarInfo {
  const { data } = useAvatars(enabled && !!childId);
  return (childId ? data?.[childId] : undefined) ?? NO_AVATAR;
}

const errorCode = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code !== '' ? code : serverErrorCode(error);
};

function useOnlineAvatarMutation<V, R = void>(fn: (v: V) => Promise<R>, options: { toastOnError?: boolean } = {}) {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  return useMutation<R, unknown, V>({
    networkMode: 'always',
    mutationFn: fn,
    onError: (error) => {
      if (options.toastOnError !== false) show(i18n.t(avatarErrorKey(errorCode(error))), 'error');
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: avatarKeys.all }),
  });
}

export const useSetAvatarAllowed = () => useOnlineAvatarMutation<{ childId: string; allowed: boolean }>(({ childId, allowed }) => setAvatarAllowed(childId, allowed));
/** La génération n'affiche pas de toast : l'écran montre l'erreur à côté du bouton (message adapté à la cause). */
export const useGenerateAvatar = () => useOnlineAvatarMutation<{ image: string; childId: string | null }, Awaited<ReturnType<typeof generateAvatar>>>(({ image, childId }) => generateAvatar(image, childId), { toastOnError: false });
export const useConfirmAvatar = () => useOnlineAvatarMutation<string>(confirmAvatar);
export const useDiscardAvatarCandidate = () => useOnlineAvatarMutation<string>(discardAvatarCandidate, { toastOnError: false });
export const useRemoveAvatar = () => useOnlineAvatarMutation<string>(removeAvatar);
export { errorCode as avatarErrorCode };
