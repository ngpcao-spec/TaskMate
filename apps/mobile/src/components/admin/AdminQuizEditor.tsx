import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminGate } from '@/components/admin/AdminGate';
import { PurgeQuizDialog } from '@/components/admin/PurgeQuizDialog';
import { Chip } from '@/components/Chip';
import { confirmDialog } from '@/components/confirm';
import { PickerField } from '@/components/PickerField';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { Button, Card, Field, Screen, ScreenHeader } from '@/components/ui';
import { adminQuizState, suggestedDates } from '@/domain/catalog';
import { MATERIAL_KINDS } from '@/domain/documents';
import { todayInTz } from '@/domain/family-time';
import { isExamSet, LETTERS, moveItem, PAPER_MODES, paperFlags, paperModeOf, publishBlockers } from '@/domain/quiz';
import {
  useCatalogQuestions, useCatalogQuiz, useConfirmCatalogAnswers, useDeleteCatalogQuestion, useDeleteCatalogQuiz, useReorderCatalogQuestions, useSetCatalogDates, useSetCatalogKind,
  useSetCatalogPaper, useSetCatalogStatus, useUpdateCatalogInfo,
} from '@/hooks/useCatalog';
import { useMe } from '@/hooks/useMe';
import { useToastStore } from '@/store/toast';
import { colors, line, MIN_TARGET, typography } from '@/theme/tokens';

/**
 * Administration → éditeur d'un QCM du catalogue : semaine et titre, type de support, support papier, dates (mise à disposition + échéance, jours LOCAUX
 * de la famille), questions avec relecture des réponses (toucher une lettre = confirmer cette réponse), publication / dépublication.
 * Un QCM publié ou ayant déjà des tentatives n'est plus modifiable (sauf ses dates) : dépublier ne supprime AUCUNE tentative.
 */
export function AdminQuizEditor({ quizId }: { quizId: string }) {
  return (
    <AdminGate>
      <Editor quizId={quizId} />
    </AdminGate>
  );
}

function Editor({ quizId }: { quizId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe().data;
  const show = useToastStore((s) => s.show);
  const quiz = useCatalogQuiz(quizId);
  const questions = useCatalogQuestions(quizId);
  const info = useUpdateCatalogInfo();
  const setKind = useSetCatalogKind();
  const setPaper = useSetCatalogPaper();
  const setDates = useSetCatalogDates();
  const status = useSetCatalogStatus();
  const confirm = useConfirmCatalogAnswers();
  const delQ = useDeleteCatalogQuestion();
  const reorder = useReorderCatalogQuestions();
  const del = useDeleteCatalogQuiz();
  const [purging, setPurging] = useState(false);
  const [weekEdit, setWeek] = useState<string | null>(null);
  const [titleEdit, setTitle] = useState<string | null>(null);
  // dates : undefined = pas touchée (valeur du serveur) ; null = retirée
  const [releaseEdit, setReleaseEdit] = useState<string | null | undefined>(undefined);
  const [dueEdit, setDueEdit] = useState<string | null | undefined>(undefined);

  if (!me) return null;
  if (quiz.isPending || questions.isPending) return <ActivityIndicator />;
  const q = quiz.data;
  if (!q) return <Screen><ScreenHeader title={t('catalog.editor.title')} /><Text style={typography.secondary}>{t('catalog.editor.notFound')}</Text></Screen>;

  const list = questions.data ?? [];
  const today = todayInTz(new Date(), me.family.timezone);
  const isDraft = q.status === 'draft';
  const locked = !isDraft || q.attempts_count > 0;
  const lockMessage = !isDraft ? t('revisions.lockedPublished') : q.attempts_count > 0 ? t('revisions.lockedAttempts') : null;
  const week = weekEdit ?? q.week_label;
  const title = titleEdit ?? q.title;
  const infoChanged = week.trim() !== q.week_label || title.trim() !== q.title;
  const infoValid = week.trim().length >= 1 && week.trim().length <= 40 && title.trim().length >= 1 && title.trim().length <= 80;
  const release = releaseEdit !== undefined ? releaseEdit : q.release_on;
  const due = dueEdit !== undefined ? dueEdit : q.due_on;
  const datesChanged = release !== q.release_on || due !== q.due_on;
  const datesOrderOk = !release || !due || due >= release;
  const state = adminQuizState({ status: q.status, releaseOn: release, dueOn: due }, today);
  const blockers = publishBlockers(q.material_kind, list);
  const exam = isExamSet(q.material_kind);
  const place = [t(`catalog.countries.${q.country}`), gradeText(t, q.country, q.grade), subjectText(t, q.subject)].join(' · ');

  const saveDates = () => setDates.mutateAsync({ quizId, releaseOn: release, dueOn: due }).then(() => { setReleaseEdit(undefined); setDueEdit(undefined); show(t('catalog.editor.datesSaved')); }, () => undefined);
  const chooseRelease = (value: string) => {
    setReleaseEdit(value);
    if (dueEdit === undefined && (q.due_on === null || q.release_on === null || release === null)) setDueEdit(suggestedDates(value).dueOn); // échéance proposée : le dimanche qui suit
  };
  const publish = async () => {
    if (datesChanged) {
      try {
        await setDates.mutateAsync({ quizId, releaseOn: release, dueOn: due });
      } catch {
        return; // message déjà affiché ; on ne publie pas avec des dates refusées
      }
      setReleaseEdit(undefined);
      setDueEdit(undefined);
    }
    status.mutate({ quizId, status: 'published' }, { onSuccess: () => show(t('catalog.editor.published')) });
  };
  const move = (from: number, to: number) => reorder.mutate({ quizId, ids: moveItem(list.map((x) => x.id), from, to) });
  const remove = () =>
    confirmDialog({
      title: t('catalog.editor.deleteTitle'),
      message: t('catalog.editor.deleteBody'),
      confirmLabel: t('catalog.editor.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () => del.mutate(quizId, { onSuccess: () => router.back() }),
    });

  return (
    <Screen>
      <ScreenHeader title={t('catalog.editor.title')} />
      <Text style={typography.secondary}>{place}</Text>
      <Text style={[styles.badge, state === 'open' ? styles.badgeOn : null]}>{t(`catalog.state.${state}`)}</Text>

      <Card>
        <Field label={t('catalog.week')} value={week} onChangeText={setWeek} maxLength={40} editable={!locked} />
        <Field label={t('catalog.titleField')} value={title} onChangeText={setTitle} maxLength={80} editable={!locked} />
        {infoChanged && !locked ? <Button variant="secondary" label={t('revisions.saveInfo')} disabled={!infoValid} loading={info.isPending} onPress={() => info.mutate({ quizId, week: week.trim(), title: title.trim() }, { onSuccess: () => { setWeek(null); setTitle(null); } })} /> : null}
      </Card>

      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('revisions.material.title')}</Text>
        {locked ? (
          <Text style={typography.body}>{t(`revisions.material.kinds.${q.material_kind}`)}</Text>
        ) : (
          <View style={styles.wrap}>
            {MATERIAL_KINDS.map((k) => (
              <Chip key={k} label={t(`revisions.material.kinds.${k}`)} selected={q.material_kind === k} onPress={() => { if (q.material_kind !== k) setKind.mutate({ quizId, kind: k }); }} />
            ))}
          </View>
        )}
        {q.kind_detected ? <Text style={typography.secondary}>{t('revisions.material.detectedNote')}</Text> : null}
      </Card>

      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('revisions.paper.title')}</Text>
        {locked ? (
          <Text style={typography.body}>{t(`revisions.paper.${paperModeOf(q)}`)}</Text>
        ) : (
          <View style={styles.wrap}>
            {PAPER_MODES.map((m) => (
              <Chip key={m} label={t(`revisions.paper.${m}`)} selected={paperModeOf(q) === m} onPress={() => { if (paperModeOf(q) !== m) setPaper.mutate({ quizId, paper: paperFlags(m).paper, sheetOnly: paperFlags(m).sheetOnly }); }} />
            ))}
          </View>
        )}
        <Text style={typography.secondary}>{t('revisions.paper.hint')}</Text>
      </Card>

      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('catalog.editor.datesTitle')}</Text>
        <Text style={typography.secondary}>{t('catalog.editor.datesHint')}</Text>
        {release !== null ? (
          <PickerField label={t('catalog.editor.release')} mode="date" value={release} onChange={chooseRelease} />
        ) : (
          <Button variant="secondary" label={t('catalog.editor.setRelease')} onPress={() => chooseRelease(suggestedDates(today).releaseOn as string)} />
        )}
        {due !== null ? (
          <PickerField label={t('catalog.editor.due')} mode="date" value={due} onChange={setDueEdit} />
        ) : release !== null ? (
          <Button variant="secondary" label={t('catalog.editor.setDue')} onPress={() => setDueEdit(suggestedDates(release).dueOn)} />
        ) : null}
        {!datesOrderOk ? <Text accessibilityRole="alert" style={styles.error}>{t('catalog.server.invalidDates')}</Text> : null}
        {datesChanged ? <Button label={t('catalog.editor.saveDates')} disabled={!datesOrderOk} loading={setDates.isPending} onPress={saveDates} /> : null}
      </Card>

      {lockMessage ? <Text accessibilityRole="alert" style={styles.error}>{lockMessage}</Text> : null}
      {q.attempts_count > 0 ? <Text style={typography.secondary}>{t('catalog.editor.attempts', { count: q.attempts_count })}</Text> : null}

      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('revisions.noQuestions')}</Text> : null}
      {list.map((item, i) => {
        const n = item.origin_number ?? i + 1;
        const needsConfirm = item.to_verify || (exam && !item.confirmed);
        return (
          <View key={item.id} style={styles.q}>
            <Text style={styles.qPrompt}>{`${item.origin_number !== null ? t('revisions.badges.number', { n: item.origin_number }) : String(i + 1)}. ${item.prompt}`}</Text>
            {item.needs_figure ? <Text style={styles.flag}>{t('revisions.badges.figure')}</Text> : null}
            {item.to_verify ? <Text style={styles.flag}>{t('revisions.badges.toVerify')}</Text> : null}
            {item.choices.map((c, ci) => {
              const right = ci === item.correct_index;
              return (
                <Pressable
                  key={ci}
                  accessibilityRole="button"
                  accessibilityLabel={t('catalog.editor.choiceLabel', { letter: LETTERS[ci] ?? '?', text: c, state: right ? t('catalog.editor.correct') : t('catalog.editor.setCorrect') })}
                  accessibilityState={{ selected: right, disabled: locked }}
                  disabled={locked}
                  onPress={() => { if (!right || needsConfirm) confirm.mutate({ quizId, answers: [{ question_id: item.id, correct: ci }] }); }}
                  style={[styles.choice, right && styles.choiceRight]}
                >
                  <Text style={[styles.letter, right && styles.letterRight]}>{LETTERS[ci] ?? '?'}</Text>
                  <Text style={styles.choiceText}>{c}</Text>
                  {right ? <Check color={colors.success} size={20} /> : null}
                </Pressable>
              );
            })}
            {item.explanation ? <Text style={typography.secondary}>{item.explanation}</Text> : null}
            {item.source ? <Text style={typography.secondary}>{t('catalog.editor.source', { source: item.source })}</Text> : null}
            {!locked && needsConfirm ? <Button variant="secondary" label={t('revisions.badges.confirm', { n })} loading={confirm.isPending} onPress={() => confirm.mutate({ quizId, answers: [{ question_id: item.id, correct: item.correct_index }] })} /> : null}
            {!locked ? (
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('revisions.moveUp')}: ${item.prompt}`} disabled={i === 0} onPress={() => move(i, i - 1)} style={[styles.icon, i === 0 && styles.off]}>
                  <ArrowUp color={colors.primary} size={20} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('revisions.moveDown')}: ${item.prompt}`} disabled={i === list.length - 1} onPress={() => move(i, i + 1)} style={[styles.icon, i === list.length - 1 && styles.off]}>
                  <ArrowDown color={colors.primary} size={20} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('revisions.editQuestion')}: ${item.prompt}`} onPress={() => router.push({ pathname: '/admin/question', params: { quiz: quizId, id: item.id } })} style={styles.icon}>
                  <Pencil color={colors.primary} size={20} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('revisions.deleteQuestion')}: ${item.prompt}`} onPress={() => delQ.mutate(item.id)} style={styles.icon}>
                  <Trash2 color={colors.danger} size={20} />
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}

      {!locked ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.addQuestion')} onPress={() => router.push({ pathname: '/admin/question', params: { quiz: quizId } })} style={styles.add}>
          <Plus color={colors.primary} size={20} />
          <Text style={styles.addText}>{t('revisions.addQuestion')}</Text>
        </Pressable>
      ) : null}

      {isDraft ? (
        <>
          {blockers.toVerify > 0 ? <Text style={styles.flag}>{t('revisions.blockers.toVerify', { count: blockers.toVerify })}</Text> : null}
          {blockers.unconfirmed > 0 ? <Text style={styles.flag}>{t('revisions.blockers.unconfirmed', { count: blockers.unconfirmed })}</Text> : null}
          {release === null || due === null ? <Text style={styles.flag}>{t('catalog.editor.datesNeeded')}</Text> : null}
          <Button label={t('revisions.publish')} disabled={list.length === 0 || blockers.blocked || release === null || due === null || !datesOrderOk} onPress={publish} loading={status.isPending || setDates.isPending} />
        </>
      ) : (
        <>
          <Text style={typography.secondary}>{t('catalog.editor.unpublishHint')}</Text>
          <Button variant="secondary" label={t('revisions.unpublish')} onPress={() => status.mutate({ quizId, status: 'draft' }, { onSuccess: () => show(t('catalog.editor.unpublished')) })} loading={status.isPending} />
        </>
      )}
      {isDraft && q.attempts_count === 0 ? <Button variant="secondary" label={t('catalog.editor.delete')} onPress={remove} loading={del.isPending} /> : null}
      {/* suppression définitive (D-091) : même publié, même commencé ; confirmation par le titre exact, points conservés */}
      <Button variant="danger" label={t('catalog.purge.action')} accessibilityLabel={t('catalog.purge.actionFor', { title: q.title })} onPress={() => setPurging(true)} />
      <PurgeQuizDialog quizId={quizId} visible={purging} onClose={() => setPurging(false)} onPurged={() => { setPurging(false); router.back(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  error: { color: colors.danger, fontSize: 14 },
  flag: { fontSize: 13, fontWeight: '600', color: colors.warning },
  empty: { textAlign: 'center', paddingVertical: 16 },
  badge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.separator, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  badgeOn: { color: colors.primary, backgroundColor: colors.primaryTint },
  q: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 8 },
  qPrompt: { fontSize: 16, color: colors.text },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET, borderRadius: 12, borderWidth: line.width, borderColor: colors.glassBorder, paddingHorizontal: 12, backgroundColor: colors.cardStrong },
  choiceRight: { borderColor: colors.success },
  letter: { width: 24, fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  letterRight: { color: colors.success },
  choiceText: { flex: 1, fontSize: 15, color: colors.text },
  actions: { flexDirection: 'row', gap: 4 },
  icon: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TARGET + 4, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primaryTint },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
