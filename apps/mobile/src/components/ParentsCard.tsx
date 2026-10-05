import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { confirmDialog } from '@/components/confirm';
import { Button, Card } from '@/components/ui';
import { useLeaveFamily, useParents } from '@/hooks/useFamilyAdmin';
import { useToastStore } from '@/store/toast';
import { colors, typography } from '@/theme/tokens';

/** Parents de la famille ; un parent peut la quitter, le dernier ne peut partir qu'en supprimant la famille. */
export function ParentsCard({ myMemberId }: { myMemberId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const parents = useParents(true);
  const leave = useLeaveFamily();
  const list = parents.data ?? [];
  const isLast = list.length <= 1;

  const confirmLeave = () =>
    confirmDialog({
      title: t('parents.leaveTitle'),
      message: t('parents.leaveBody'),
      confirmLabel: t('parents.leave'),
      cancelLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () =>
        leave.mutate(undefined, {
          onSuccess: () => {
            show(t('parents.left'));
            queryClient.clear(); // reste connecté : l'écran « créer ou rejoindre une famille » s'ouvre
            router.replace('/');
          },
        }),
    });

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.section}>{t('parents.title')}</Text>
      {list.map((p) => (
        <Text key={p.id} style={styles.row}>
          {p.display_name}
          {p.id === myMemberId ? ` ${t('parents.you')}` : ''}
        </Text>
      ))}
      {isLast ? (
        <Text style={typography.secondary}>{t('parents.lastParent')}</Text>
      ) : (
        <Button variant="secondary" label={t('parents.leave')} onPress={confirmLeave} loading={leave.isPending} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.title, color: colors.text },
  row: { fontSize: 16, color: colors.text, minHeight: 28 },
});
