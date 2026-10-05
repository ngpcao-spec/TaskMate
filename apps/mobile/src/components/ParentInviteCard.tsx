import { format } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { Button, Card } from '@/components/ui';
import { formatInviteCode } from '@/domain/parent-invite';
import { useActiveParentInvite, useCreateParentInvite, useRevokeParentInvite } from '@/hooks/useFamilyAdmin';
import { copyText } from '@/services/clipboard';
import { colors, typography } from '@/theme/tokens';

/**
 * « Inviter un parent » : code à usage unique valable 24 h, HACHÉ en base — le clair n'existe qu'à la génération, d'où
 * l'affichage unique (copie possible). Régénérer annule le précédent ; l'invitation peut aussi être annulée.
 */
export function ParentInviteCard() {
  const { t } = useTranslation();
  const invite = useActiveParentInvite(true);
  const create = useCreateParentInvite();
  const revoke = useRevokeParentInvite();
  const [shown, setShown] = useState<{ code: string; expiresAt: Date } | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

  const generate = () =>
    create.mutate(undefined, {
      onSuccess: (code) => {
        setCopied(null);
        setShown({ code, expiresAt: new Date(Date.now() + 24 * 3_600_000) });
      },
    });
  const cancel = () => revoke.mutate(undefined, { onSuccess: () => setShown(null) });
  const active = invite.data ?? null;

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.section}>{t('parentInvite.title')}</Text>
      <Text style={typography.secondary}>{t('parentInvite.hint')}</Text>
      {shown ? (
        <>
          <Text selectable accessibilityLabel={t('parentInvite.codeIs', { code: formatInviteCode(shown.code) })} style={styles.code}>{formatInviteCode(shown.code)}</Text>
          <Text accessibilityRole="alert" style={styles.warning}>{t('parentInvite.shownOnce', { date: format(shown.expiresAt, 'dd/MM HH:mm') })}</Text>
          <Button variant="secondary" label={t('parentInvite.copy')} onPress={() => void copyText(shown.code).then(setCopied)} />
          {copied !== null ? <Text accessibilityLiveRegion="polite" style={copied ? styles.ok : styles.warning}>{copied ? t('parentInvite.copied') : t('parentInvite.copyFailed')}</Text> : null}
        </>
      ) : active ? (
        <Text style={typography.secondary}>{t('parentInvite.active', { date: format(new Date(active.expires_at), 'dd/MM HH:mm') })}</Text>
      ) : (
        <Text style={typography.secondary}>{t('parentInvite.none')}</Text>
      )}
      <Button
        label={shown || active ? t('parentInvite.regenerate') : t('parentInvite.generate')}
        onPress={generate}
        loading={create.isPending}
      />
      {shown || active ? <Button variant="secondary" label={t('parentInvite.revoke')} onPress={cancel} loading={revoke.isPending} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.title, color: colors.text },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 2, color: colors.primary },
  warning: { ...typography.secondary, color: colors.danger },
  ok: { ...typography.secondary, color: colors.success },
});
