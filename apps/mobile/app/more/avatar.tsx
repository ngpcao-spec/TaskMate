import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { confirmDialog } from '@/components/confirm';
import { Button, Card, ErrorText, Screen, ScreenHeader, Subtitle } from '@/components/ui';
import { avatarErrorKey, avatarUri } from '@/domain/avatar';
import { avatarErrorCode, useAvatar, useConfirmAvatar, useDiscardAvatarCandidate, useGenerateAvatar, useRemoveAvatar, useSetAvatarAllowed } from '@/hooks/useAvatars';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { portraitSupported, pickPortrait, type PortraitSource } from '@/services/documents';
import { useToastStore } from '@/store/toast';
import { colors, line, MIN_TARGET, shadow, typography } from '@/theme/tokens';

type Step = { kind: 'idle' } | { kind: 'generating' } | { kind: 'preview'; candidate: string; remaining: number };

/**
 * Ảnh đại diện (D-071) : l'enfant (ou un parent pour lui) charge un portrait, une IA le transforme en avatar « dessin animé », on valide l'aperçu.
 * Le parent doit d'abord CONSENTIR (le portrait part vers un service d'IA) ; la photo n'est conservée nulle part, seul le dessin l'est.
 */
export default function AvatarScreen() {
  const { t } = useTranslation();
  const d = useDisplayedChild();
  const child = d?.child ?? null;
  const info = useAvatar(child?.id);
  const show = useToastStore((s) => s.show);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const setAllowed = useSetAvatarAllowed();
  const generate = useGenerateAvatar();
  const confirm = useConfirmAvatar();
  const discard = useDiscardAvatarCandidate();
  const remove = useRemoveAvatar();
  if (!d || !child) return null;
  const isParent = d.viewer.role === 'parent';
  const busy = step.kind === 'generating';

  const start = async (source: PortraitSource) => {
    setError(null);
    const picked = await pickPortrait(source);
    if (picked.status === 'cancelled') return;
    if (picked.status === 'unsupported') return setError('avatar.unsupported');
    if (picked.status === 'error') return setError(avatarErrorKey(picked.code));
    setStep({ kind: 'generating' });
    try {
      const out = await generate.mutateAsync({ image: picked.data, childId: isParent ? child.id : null });
      setStep({ kind: 'preview', candidate: out.candidate, remaining: out.remaining });
    } catch (e) {
      setError(avatarErrorKey(avatarErrorCode(e)));
      setStep({ kind: 'idle' });
    }
  };
  const use = async () => {
    try {
      await confirm.mutateAsync(child.id);
      setStep({ kind: 'idle' });
      show(t('avatar.saved'));
    } catch {
      /* le toast d'erreur est affiché par la mutation ; l'aperçu reste affiché pour réessayer */
    }
  };
  const leavePreview = () => {
    discard.mutate(child.id);
    setStep({ kind: 'idle' });
  };
  const askRemove = () =>
    confirmDialog({
      title: t('avatar.removeTitle'),
      message: t('avatar.removeBody'),
      confirmLabel: t('avatar.removeOk'),
      cancelLabel: t('avatar.cancel'),
      destructive: true,
      onConfirm: () => remove.mutate(child.id, { onSuccess: () => show(t('avatar.removed')) }),
    });

  return (
    <Screen>
      <ScreenHeader title={t('avatar.title')} />
      <Card>
        <View style={styles.center}>
          {step.kind === 'preview' ? (
            <Image source={{ uri: avatarUri(step.candidate) }} accessibilityLabel={t('avatar.previewImage')} accessibilityIgnoresInvertColors style={styles.preview} testID="avatar-preview" />
          ) : (
            <Avatar childId={child.id} name={child.name} color={child.color} size={160} accessibilityLabel={t('avatar.current', { name: child.name })} />
          )}
          {step.kind === 'idle' && info.uri === null ? <Subtitle>{t('avatar.none')}</Subtitle> : null}
        </View>
      </Card>

      {isParent ? (
        <Card>
          <Text accessibilityRole="header" style={styles.section}>
            {t('avatar.consentTitle')}
          </Text>
          <Text style={typography.secondary}>{t('avatar.consentBody', { name: child.name })}</Text>
          <View style={styles.switchRow}>
            <Text style={[typography.body, styles.flex, { color: colors.text }]}>{t('avatar.consentSwitch', { name: child.name })}</Text>
            <Switch
              accessibilityLabel={t('avatar.consentSwitch', { name: child.name })}
              value={info.allowed}
              disabled={setAllowed.isPending || busy}
              onValueChange={(allowed) => setAllowed.mutate({ childId: child.id, allowed })}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </Card>
      ) : null}

      {!portraitSupported ? (
        <Card>
          <Text style={typography.secondary}>{t('avatar.unsupported')}</Text>
        </Card>
      ) : !info.allowed ? (
        isParent ? null : (
          <Card>
            <Text accessibilityLiveRegion="polite" style={typography.body}>
              {t('avatar.childLocked')}
            </Text>
          </Card>
        )
      ) : (
        <Card>
          {step.kind === 'generating' ? (
            <View accessibilityLiveRegion="polite" style={styles.generating}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[typography.body, { color: colors.text }]}>{t('avatar.generating')}</Text>
            </View>
          ) : step.kind === 'preview' ? (
            <View style={styles.actions}>
              <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.text }]}>
                {t('avatar.preview')}
              </Text>
              <Text style={typography.secondary}>{t('avatar.remaining', { count: step.remaining })}</Text>
              <Button label={t('avatar.use')} onPress={() => void use()} loading={confirm.isPending} />
              <Button label={t('avatar.retry')} variant="secondary" onPress={leavePreview} disabled={confirm.isPending} />
              <Button label={t('avatar.cancel')} variant="ghost" onPress={leavePreview} disabled={confirm.isPending} />
            </View>
          ) : (
            <View style={styles.actions}>
              <Text style={typography.secondary}>{t('avatar.hint')}</Text>
              <Button label={t('avatar.pickGallery')} onPress={() => void start('gallery')} />
              <Button label={t('avatar.pickCamera')} variant="secondary" onPress={() => void start('camera')} />
              {info.uri !== null ? <Button label={t('avatar.remove')} variant="ghost" onPress={askRemove} loading={remove.isPending} /> : null}
            </View>
          )}
          <ErrorText>{error ? t(error) : null}</ErrorText>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: 12 },
  preview: { width: 200, height: 200, borderRadius: 100, borderWidth: line.width, borderColor: colors.ring, backgroundColor: colors.cardStrong, ...shadow },
  section: { ...typography.title, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET },
  generating: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET },
  actions: { gap: 10 },
});
