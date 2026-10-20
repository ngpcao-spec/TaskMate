import { TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { Button, ErrorText, Field } from '@/components/ui';
import { hasNoAttempts, purgeConfirmed, purgeConfirmText, type PurgeResult } from '@/domain/catalog-purge';
import { useCatalogQuizImpact, usePurgeCatalogQuiz } from '@/hooks/useCatalog';
import { useToastStore } from '@/store/toast';
import { colors, line, radius, shadow, typography } from '@/theme/tokens';

type Props = {
  quizId: string;
  visible: boolean;
  onClose: () => void;
  /** Appelé après une suppression réussie (liste rafraîchie, retour à la liste…). */
  onPurged: (result: PurgeResult) => void;
};

/**
 * Suppression DÉFINITIVE d'un QCM du catalogue, même publié et commencé (D-091). Montre l'impact lu en base, dit que les points déjà gagnés sont CONSERVÉS,
 * puis demande de retaper le titre exact : le bouton rouge reste inactif tant qu'il ne correspond pas (la base le revérifie : `confirm_mismatch`).
 * L'écran n'a aucune logique de suppression : tout est dans `catalog_purge_quiz`.
 */
export function PurgeQuizDialog({ quizId, visible, onClose, onPurged }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* le contenu n'existe que modale ouverte : saisie remise à zéro et impact relu à CHAQUE ouverture */}
        <PurgeBody quizId={quizId} onClose={onClose} onPurged={onPurged} />
      </View>
    </Modal>
  );
}

function PurgeBody({ quizId, onClose, onPurged }: Omit<Props, 'visible'>) {
  const { t } = useTranslation();
  const show = useToastStore((s) => s.show);
  const impact = useCatalogQuizImpact(quizId, true);
  const purge = usePurgeCatalogQuiz();
  const [typed, setTyped] = useState('');

  const i = impact.data;
  const ready = !!i && !impact.isFetching;
  const matches = ready && purgeConfirmed(typed, i.title);
  const place = i ? [t(`catalog.countries.${i.country}`), gradeText(t, i.country, i.grade), subjectText(t, i.subject), i.week_label].join(' · ') : '';

  const confirm = () => {
    if (!i || !matches) return;
    purge.mutate(
      { quizId, confirm: purgeConfirmText(typed) },
      {
        onSuccess: (result) => {
          show(
            result.purged
              ? t('catalog.purge.done', { title: result.title, attempts: result.counts.attempts, children: result.counts.children, points: result.counts.points })
              : t('catalog.purge.alreadyGone'),
          );
          onPurged(result);
        },
      },
    );
  };

  return (
    <View accessibilityViewIsModal aria-modal accessibilityRole="alert" style={styles.dialog}>
      <View style={styles.head}>
        <TriangleAlert color={colors.danger} size={24} />
        <Text accessibilityRole="header" style={styles.title}>{t('catalog.purge.title')}</Text>
      </View>

      {impact.isPending || impact.isFetching ? <ActivityIndicator accessibilityLabel={t('catalog.purge.loading')} color={colors.primary} /> : null}
      {impact.isError && !impact.isFetching ? (
        <>
          <ErrorText>{t('catalog.purge.loadError')}</ErrorText>
          <Button variant="secondary" label={t('catalog.purge.retry')} onPress={() => void impact.refetch()} />
        </>
      ) : null}

      {ready && i ? (
        <>
          <Text style={styles.quizTitle}>{i.title}</Text>
          <Text style={typography.secondary}>{place}</Text>
          {hasNoAttempts(i) ? (
            <Text style={styles.impact}>{t('catalog.purge.noAttempts')}</Text>
          ) : (
            <>
              <Text accessibilityRole="summary" style={styles.impact}>
                {t('catalog.purge.impact', { children: i.children, attempts: i.attempts, validated: i.validated, points: i.points })}
              </Text>
              <Text style={typography.secondary}>
                {t('catalog.purge.breakdown', { families: i.families, inProgress: i.in_progress, submitted: i.submitted, validated: i.validated })}
              </Text>
            </>
          )}
          <Text style={styles.warning}>{t('catalog.purge.warning')}</Text>
          <Field
            label={t('catalog.purge.typeTitle', { title: i.title })}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={i.title}
            editable={!purge.isPending}
          />
          <Button variant="danger" label={t('catalog.purge.confirm')} accessibilityLabel={t('catalog.purge.confirmFor', { title: i.title })} disabled={!matches} loading={purge.isPending} onPress={confirm} />
        </>
      ) : null}
      <Button variant="ghost" label={t('common.cancel')} onPress={onClose} disabled={purge.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(20,38,56,0.55)' },
  dialog: { width: '100%', maxWidth: 460, gap: 12, padding: 24, borderRadius: radius.card, backgroundColor: colors.cardSolid, borderWidth: line.width, borderColor: colors.glassBorder, ...shadow },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  quizTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  impact: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 22 },
  warning: { fontSize: 14, color: colors.danger, lineHeight: 20 },
});
