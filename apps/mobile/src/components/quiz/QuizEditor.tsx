import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { Button, Card, Field, Screen, ScreenHeader } from '@/components/ui';
import { formatShortDate } from '@/domain/calendar';
import { todayInTz } from '@/domain/family-time';
import { moveItem, validateSetTitle } from '@/domain/quiz';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import {
  useCopyQuizSet, useDeleteQuestion, useDeleteQuizSet, useParentQuestions, useQuizSet, useRelaunchEvaluation, useReorderQuestions, useSetAttempts, useSetQuizStatus, useUpdateQuizSet,
} from '@/hooks/useQuizzes';
import { useToastStore } from '@/store/toast';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/**
 * Éditeur d'un jeu (parent) : titre/matière, questions (ajout, modification, suppression, réordonnancement), publication,
 * copie vers un enfant, relance d'évaluation, résultats. Un jeu publié ou ayant des tentatives n'est pas modifiable (copier).
 */
export function QuizEditor({ setId }: { setId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const show = useToastStore((s) => s.show);
  const set = useQuizSet(setId);
  const questions = useParentQuestions(setId);
  const attempts = useSetAttempts(setId);
  const update = useUpdateQuizSet();
  const status = useSetQuizStatus();
  const copy = useCopyQuizSet();
  const del = useDeleteQuizSet();
  const delQ = useDeleteQuestion();
  const reorder = useReorderQuestions();
  const relaunch = useRelaunchEvaluation();
  // saisie en cours (null = pas de modification : on affiche la valeur du serveur)
  const [titleEdit, setTitle] = useState<string | null>(null);
  const [subjectEdit, setSubject] = useState<string | null>(null);

  if (!d) return null;
  if (set.isPending) return <ActivityIndicator />;
  const s = set.data;
  if (!s) return null;
  const title = titleEdit ?? s.title;
  const subject = subjectEdit ?? s.subject ?? '';
  const tz = d.me.family.timezone;
  const list = questions.data ?? [];
  const tries = attempts.data ?? [];
  const isDraft = s.status === 'draft';
  const locked = !isDraft || tries.length > 0;
  const lockMessage = !isDraft ? t('revisions.lockedPublished') : tries.length > 0 ? t('revisions.lockedAttempts') : null;
  const titleErrors = validateSetTitle(title, subject);
  const changed = title.trim() !== s.title || (subject.trim() || null) !== (s.subject ?? null);
  const openEvaluation = tries.some((a) => a.status === 'in_progress');
  const hasEvaluation = tries.length > 0;
  const childName = d.children.find((c) => c.id === s.child_id)?.name ?? '';

  const move = (from: number, to: number) => {
    const ids = moveItem(list.map((q) => q.id), from, to);
    reorder.mutate({ setId, ids });
  };

  return (
    <Screen>
      <ScreenHeader title={t('revisions.editorTitle')} />
      <Text style={typography.secondary}>{childName}</Text>

      <Card>
        <Field label={t('revisions.titleField')} value={title} onChangeText={setTitle} maxLength={120} editable={isDraft} error={titleErrors.includes('titleRequired') ? t('revisions.errors.titleRequired') : titleErrors.includes('titleTooLong') ? t('revisions.errors.titleTooLong') : null} />
        <Field label={t('revisions.subjectField')} value={subject} onChangeText={setSubject} maxLength={80} editable={isDraft} error={titleErrors.includes('subjectTooLong') ? t('revisions.errors.subjectTooLong') : null} />
        {changed ? <Button variant="secondary" label={t('revisions.saveInfo')} disabled={titleErrors.length > 0} onPress={() => update.mutate({ id: setId, patch: { title: title.trim(), subject: subject.trim() || null } })} /> : null}
      </Card>

      {lockMessage ? <Text accessibilityRole="alert" style={styles.lock}>{lockMessage}</Text> : null}

      {list.length === 0 ? <Text style={[typography.secondary, styles.empty]}>{t('revisions.noQuestions')}</Text> : null}
      {list.map((q, i) => (
        <View key={q.id} style={styles.q}>
          <Text style={styles.qPrompt}>{`${i + 1}. ${q.prompt}`}</Text>
          {!locked ? (
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('revisions.moveUp')}: ${q.prompt}`} disabled={i === 0} onPress={() => move(i, i - 1)} style={[styles.icon, i === 0 && styles.off]}>
                <ArrowUp color={colors.primary} size={20} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('revisions.moveDown')}: ${q.prompt}`} disabled={i === list.length - 1} onPress={() => move(i, i + 1)} style={[styles.icon, i === list.length - 1 && styles.off]}>
                <ArrowDown color={colors.primary} size={20} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('revisions.editQuestion')}: ${q.prompt}`} onPress={() => router.push({ pathname: '/quiz/question', params: { set: setId, id: q.id } })} style={styles.icon}>
                <Pencil color={colors.primary} size={20} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t('revisions.deleteQuestion')}: ${q.prompt}`} onPress={() => delQ.mutate(q.id)} style={styles.icon}>
                <Trash2 color={colors.danger} size={20} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}

      {!locked ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.addQuestion')} onPress={() => router.push({ pathname: '/quiz/question', params: { set: setId } })} style={styles.add}>
          <Plus color={colors.primary} size={20} />
          <Text style={styles.addText}>{t('revisions.addQuestion')}</Text>
        </Pressable>
      ) : null}

      {isDraft ? (
        <Button label={t('revisions.publish')} disabled={list.length === 0} onPress={() => status.mutate({ setId, status: 'published' })} loading={status.isPending} />
      ) : (
        <Button variant="secondary" label={t('revisions.unpublish')} onPress={() => status.mutate({ setId, status: 'draft' })} loading={status.isPending} />
      )}

      {s.status === 'published' && hasEvaluation && !openEvaluation ? (
        <Button variant="secondary" label={t('revisions.relaunch')} onPress={() => relaunch.mutate({ setId, attemptId: newId() }, { onSuccess: () => show(t('revisions.relaunched')) })} loading={relaunch.isPending} />
      ) : null}

      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('revisions.results')}</Text>
        {tries.length === 0 ? <Text style={typography.secondary}>{t('revisions.noResults')}</Text> : null}
        {tries.map((a) => {
          const day = formatShortDate(todayInTz(new Date(a.started_at), tz));
          const score = a.score !== null && a.total !== null ? `, ${t('revisions.score', { score: a.score, total: a.total })}` : '';
          return (
            <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`${day}, ${t(`revisions.status.${a.status}`)}${score}`} onPress={() => router.push({ pathname: '/quiz/attempt/[id]', params: { id: a.id } })} style={styles.attempt}>
              <Text style={styles.attemptMain}>{day}</Text>
              <Text style={styles.attemptStatus}>{t(`revisions.status.${a.status}`)}{score.replace(',', ' ·')}</Text>
            </Pressable>
          );
        })}
      </Card>

      {d.children.map((c) => (
        <Button key={c.id} variant="secondary" label={t('revisions.copyFor', { name: c.name })} loading={copy.isPending} onPress={() => {
          const id = newId();
          copy.mutate({ source: setId, newSet: id, childId: c.id }, { onSuccess: () => { show(t('revisions.copied')); router.replace({ pathname: '/quiz/[id]', params: { id } }); } });
        }} />
      ))}
      <Button variant="secondary" label={t('revisions.delete')} onPress={() => del.mutate(setId, { onSuccess: () => router.back() })} loading={del.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lock: { color: colors.danger, fontSize: 14 },
  empty: { textAlign: 'center', paddingVertical: 16 },
  q: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 8 },
  qPrompt: { fontSize: 16, color: colors.text },
  actions: { flexDirection: 'row', gap: 4 },
  icon: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TARGET + 4, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primaryTint },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  attempt: { minHeight: MIN_TARGET, justifyContent: 'center', gap: 2 },
  attemptMain: { fontSize: 15, color: colors.text },
  attemptStatus: { fontSize: 13, color: colors.textSecondary },
});
