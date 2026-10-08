import { useRouter } from 'expo-router';
import { Check, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { gridOrder, LETTERS, publishBlockers } from '@/domain/quiz';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useConfirmAnswers, useParentQuestions, useQuizSet, useSetQuizStatus } from '@/hooks/useQuizzes';
import { useToastStore } from '@/store/toast';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type Local = { choice: number; confirmed: boolean };

/**
 * Grille « Đáp án » (parent, types examen) : une ligne par question avec son NUMÉRO D'ORIGINE, les choix A à D en pastilles et la réponse proposée
 * pré-sélectionnée. Le parent confirme CHAQUE réponse (toucher la pastille = confirmer) ; les questions « à vérifier » ou « dépend d'une figure »
 * sont mises en évidence. La publication reste refusée par le serveur tant qu'une réponse n'est pas confirmée.
 */
export function AnswerGrid({ setId }: { setId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const show = useToastStore((s) => s.show);
  const set = useQuizSet(setId);
  const questions = useParentQuestions(setId);
  const confirm = useConfirmAnswers();
  const status = useSetQuizStatus();
  const [local, setLocal] = useState<Record<string, Local>>({});

  if (!d) return null;
  if (set.isPending || questions.isPending) return <ActivityIndicator />;
  const s = set.data;
  if (!s) return null;
  const list = gridOrder(questions.data ?? []);
  const locked = s.status !== 'draft';
  const stateOf = (q: (typeof list)[number]): Local => local[q.id] ?? { choice: q.correct_index, confirmed: q.confirmed && !q.to_verify };
  const changed = list.filter((q) => {
    const l = local[q.id];
    return l !== undefined && l.confirmed && (!q.confirmed || q.to_verify || l.choice !== q.correct_index);
  });
  const remaining = list.filter((q) => !stateOf(q).confirmed).length;
  const server = publishBlockers(s.material_kind, questions.data ?? []);
  const canPublish = !locked && list.length > 0 && changed.length === 0 && !server.blocked;

  const choose = (q: (typeof list)[number], choice: number) => setLocal({ ...local, [q.id]: { choice, confirmed: true } });
  const confirmPlain = () => {
    const next = { ...local };
    for (const q of list) {
      const cur = stateOf(q);
      if (!cur.confirmed && !q.to_verify && !q.needs_figure) next[q.id] = { choice: cur.choice, confirmed: true };
    }
    setLocal(next);
  };
  const save = () =>
    confirm.mutate(
      { setId, answers: changed.map((q) => ({ question_id: q.id, correct: stateOf(q).choice })) },
      { onSuccess: () => { setLocal({}); show(t('revisions.grid.saved')); } },
    );

  return (
    <Screen>
      <ScreenHeader title={t('revisions.grid.title')} />
      <Text style={typography.secondary}>{`${d.children.find((c) => c.id === s.child_id)?.name ?? ''} · ${t(`revisions.material.kinds.${s.material_kind}`)}`}</Text>
      <Card>
        <Text style={styles.intro}>{t('revisions.grid.intro')}</Text>
      </Card>
      {s.kind_detected ? <Text style={typography.secondary}>{t('revisions.material.detectedNote')}</Text> : null}
      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('revisions.grid.empty')}</Text> : null}

      {list.map((q, i) => {
        const cur = stateOf(q);
        const n = q.origin_number ?? i + 1;
        const label = t(q.origin_number !== null ? 'revisions.grid.question' : 'revisions.grid.unnumbered', { n });
        const flagged = q.to_verify || q.needs_figure;
        return (
          <View key={q.id} style={[styles.row, flagged && !cur.confirmed && styles.flagged]}>
            <View style={styles.head}>
              <Text accessibilityRole="header" style={styles.number}>{label}</Text>
              {cur.confirmed ? (
                <View accessible accessibilityLabel={t('revisions.grid.confirmedBadge')} style={styles.okBadge}>
                  <Check color={colors.success} size={16} />
                  <Text style={styles.okText}>{t('revisions.grid.confirmedBadge')}</Text>
                </View>
              ) : null}
              {!locked ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.grid.edit', { n })} onPress={() => router.push({ pathname: '/quiz/question', params: { set: setId, id: q.id } })} style={styles.icon}>
                  <Pencil color={colors.primary} size={20} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.prompt} numberOfLines={3}>{q.prompt}</Text>
            {q.needs_figure ? <Text accessibilityRole="alert" style={styles.warn}>{t('revisions.grid.figureBadge')}</Text> : null}
            {q.to_verify && !cur.confirmed ? <Text accessibilityRole="alert" style={styles.warn}>{t('revisions.grid.toVerifyBadge')}</Text> : null}
            <View accessibilityRole="radiogroup" style={styles.letters}>
              {q.choices.map((_, c) => {
                const selected = cur.choice === c;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="radio"
                    accessibilityLabel={t('revisions.grid.choice', { n, letter: LETTERS[c] })}
                    accessibilityState={{ selected, checked: selected, disabled: locked }}
                    aria-checked={selected}
                    disabled={locked}
                    onPress={() => choose(q, c)}
                    style={[styles.pill, selected && (cur.confirmed ? styles.pillConfirmed : styles.pillSuggested)]}
                  >
                    <Text style={[styles.pillText, selected && (cur.confirmed ? styles.pillTextOnConfirmed : styles.pillTextSelected)]}>{LETTERS[c]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      {!locked && list.length > 0 ? (
        <>
          <Text accessibilityLiveRegion="polite" style={remaining > 0 || changed.length > 0 ? styles.warn : typography.secondary}>
            {changed.length > 0 ? t('revisions.grid.unsaved') : remaining > 0 ? t('revisions.grid.remaining', { count: remaining }) : t('revisions.grid.allConfirmed')}
          </Text>
          <Button variant="secondary" label={t('revisions.grid.confirmPlain')} onPress={confirmPlain} />
          <Button variant="secondary" label={t('revisions.grid.save')} disabled={changed.length === 0} onPress={save} loading={confirm.isPending} />
          {server.toVerify > 0 ? <Text style={styles.warn}>{t('revisions.blockers.toVerify', { count: server.toVerify })}</Text> : null}
          <Button label={t('revisions.publish')} disabled={!canPublish} onPress={() => status.mutate({ setId, status: 'published' }, { onSuccess: () => router.replace({ pathname: '/quiz/[id]', params: { id: setId } }) })} loading={status.isPending} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: colors.text, lineHeight: 20 },
  empty: { textAlign: 'center', paddingVertical: 16 },
  row: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 8, borderWidth: 2, borderColor: 'transparent' },
  flagged: { borderColor: colors.warning },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  number: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  icon: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  prompt: { fontSize: 14, color: colors.textSecondary },
  warn: { fontSize: 14, fontWeight: '600', color: colors.warning },
  okBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  okText: { fontSize: 13, fontWeight: '600', color: colors.success },
  letters: { flexDirection: 'row', gap: 10 },
  pill: { width: MIN_TARGET + 6, height: MIN_TARGET + 6, borderRadius: 999, borderWidth: 2, borderColor: '#D5DFEC', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  pillSuggested: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  pillConfirmed: { borderColor: colors.success, backgroundColor: colors.success },
  pillText: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  pillTextSelected: { color: colors.text },
  pillTextOnConfirmed: { color: '#fff' },
});
