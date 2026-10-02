import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@/components/ui';
import { buildInviteLink } from '@/domain/invite';
import { colors, typography } from '@/theme/tokens';

type Props = { code: string | null; hint: string; actionLabel: string; onGenerate: () => void; loading?: boolean };

/** Code d'invitation (6 caractères) + QR + bouton de (re)génération — enfant ou co-parent (SPEC §2.1, §5.8). */
export function InviteCard({ code, hint, actionLabel, onGenerate, loading }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      {code ? (
        <View style={styles.invite}>
          <QRCode value={buildInviteLink(code)} size={140} />
          <Text accessibilityLabel={`${t('onboarding.children.inviteCode')} ${code}`} style={styles.code}>
            {code}
          </Text>
          <Text style={[typography.secondary, styles.hint]}>{hint}</Text>
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
  hint: { textAlign: 'center' },
});
