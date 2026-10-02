import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@/components/ui';
import { config } from '@/config';
import { buildShareableInviteLink } from '@/domain/invite';
import { shareLink } from '@/services/share';
import { useToastStore } from '@/store/toast';
import { colors, typography } from '@/theme/tokens';

type Props = { code: string | null; hint: string; actionLabel: string; onGenerate: () => void; loading?: boolean };

/** Origine publique de la web app : variable d'environnement, sinon origine du navigateur (web), sinon aucune. */
function webOrigin(): string | null {
  if (config.webUrl) return config.webUrl;
  return typeof window !== 'undefined' && window.location?.origin?.startsWith('http') ? window.location.origin : null;
}

/** Code d'invitation (6 caractères) + QR + lien partageable + bouton de (re)génération — enfant ou co-parent (SPEC §5.8). */
export function InviteCard({ code, hint, actionLabel, onGenerate, loading }: Props) {
  const { t } = useTranslation();
  const show = useToastStore((s) => s.show);
  const link = code ? buildShareableInviteLink(code, webOrigin()) : null;
  const share = async () => {
    if (!link) return;
    const outcome = await shareLink(link);
    if (outcome === 'copied') show(t('onboarding.children.linkCopied'));
    else if (outcome === 'failed') show(t('common.error'), 'error');
  };
  return (
    <View style={styles.wrap}>
      {code && link ? (
        <View style={styles.invite}>
          <QRCode value={link} size={140} />
          <Text accessibilityLabel={`${t('onboarding.children.inviteCode')} ${code}`} style={styles.code}>
            {code}
          </Text>
          <Text accessibilityLabel={`${t('onboarding.children.linkLabel')} ${link}`} selectable style={[typography.secondary, styles.link]}>
            {link}
          </Text>
          <Text style={[typography.secondary, styles.hint]}>{hint}</Text>
          <Button variant="secondary" label={t('onboarding.children.shareLink')} onPress={() => void share()} />
        </View>
      ) : null}
      <Button variant="secondary" label={actionLabel} onPress={onGenerate} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  invite: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  code: { fontSize: 32, fontWeight: '700', letterSpacing: 6, color: colors.text },
  link: { textAlign: 'center' },
  hint: { textAlign: 'center' },
});
