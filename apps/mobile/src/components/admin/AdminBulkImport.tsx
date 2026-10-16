import { onlineManager } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useRouter } from 'expo-router';
import { FileUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { Chip } from '@/components/Chip';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { formatShortDate } from '@/domain/calendar';
import { parseCatalogImport, type ImportError, type ParsedQuiz } from '@/domain/catalog-import';
import { effectiveDecision, planImport, publishable, summarize, writeSteps, type Decisions, type PlanItem, type PublishResult, type StepResult } from '@/domain/catalog-import-plan';
import { quizErrorKey } from '@/domain/quiz';
import { useCatalogBulk } from '@/hooks/useCatalog';
import { documentUploadSupported, pickDocuments } from '@/services/documents';
import { extractFileText } from '@/services/documentText';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type Phase =
  | { name: 'pick' }
  | { name: 'reading' }
  | { name: 'unstructured' }
  | { name: 'unreadable'; key: string }
  | { name: 'errors'; errors: ImportError[] }
  | { name: 'review'; plan: PlanItem[] }
  | { name: 'writing'; done: number; total: number }
  | { name: 'written'; plan: PlanItem[]; results: StepResult[] }
  | { name: 'publishing'; done: number; total: number }
  | { name: 'published'; plan: PlanItem[]; results: StepResult[]; published: PublishResult[] };

/**
 * Administration → Importer : l'admin choisit UN fichier (Word ou PDF avec texte) ; tout le reste (pays, classe, matière, semaine, titre, dates) est lu dans le fichier.
 * Lecture déterministe, sans IA ni quota ; tout est validé AVANT toute écriture (une erreur : rien n'est écrit) ; puis bilan, brouillons, « Publier tout ».
 * Un fichier non structuré (Word libre, photos) garde le repli sur l'IA (`onUseAi`).
 */
export function AdminBulkImport({ onUseAi }: { onUseAi: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const bulk = useCatalogBulk();
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  const [decisions, setDecisions] = useState<Decisions>({});

  const choose = async () => {
    const picked = await pickDocuments('document');
    if (picked.status === 'cancelled' || picked.status === 'unsupported') return;
    if (picked.status === 'error') {
      setPhase({ name: 'unreadable', key: picked.code === 'tooLarge' ? 'revisions.import.errors.tooLarge' : picked.code === 'unsupportedType' ? 'revisions.import.errors.unsupportedType' : 'revisions.import.errors.unreadable' });
      return;
    }
    const file = picked.files[0];
    if (!file) return;
    setPhase({ name: 'reading' });
    const text = await extractFileText(file);
    if (!text.ok) {
      setPhase({ name: 'unreadable', key: text.reason === 'no_text' ? 'catalog.bulk.noText' : text.reason === 'unsupported' ? 'catalog.bulk.unsupportedFile' : 'revisions.import.errors.unreadable' });
      return;
    }
    const parsed = parseCatalogImport(text.text);
    if (!parsed.structured) return setPhase({ name: 'unstructured' });
    if (!parsed.ok) return setPhase({ name: 'errors', errors: parsed.errors });
    if (!onlineManager.isOnline()) return setPhase({ name: 'unreadable', key: 'revisions.import.needNetwork' });
    try {
      const existing = await bulk.loadExisting();
      setDecisions({});
      setPhase({ name: 'review', plan: planImport(parsed.quizzes, existing, newId) }); // ids fixés ici : « réessayer » ne crée jamais de doublon
    } catch {
      setPhase({ name: 'unreadable', key: 'common.error' });
    }
  };

  const save = async (plan: PlanItem[], steps = writeSteps(plan, decisions), previous: StepResult[] = []) => {
    setPhase({ name: 'writing', done: 0, total: steps.length });
    const results = await bulk.write(steps, (done, total) => setPhase({ name: 'writing', done, total }));
    const skipped: StepResult[] = plan.filter((p) => effectiveDecision(p, decisions) === 'skip').map((p) => ({ block: p.quiz.block, id: p.id, outcome: 'skipped' }));
    const kept = previous.filter((r) => !results.some((n) => n.block === r.block));
    setPhase({ name: 'written', plan, results: [...kept, ...results, ...skipped.filter((s) => !kept.some((k) => k.block === s.block))].sort((a, b) => a.block - b.block) });
  };

  const publishAll = async (plan: PlanItem[], results: StepResult[], already: PublishResult[]) => {
    const todo = publishable(results, already);
    setPhase({ name: 'publishing', done: 0, total: todo.length });
    const out = await bulk.publish(todo, (done, total) => setPhase({ name: 'publishing', done, total }));
    const kept = already.filter((p) => !out.some((o) => o.block === p.block));
    setPhase({ name: 'published', plan, results, published: [...kept, ...out].sort((a, b) => a.block - b.block) });
  };

  const place = (q: ParsedQuiz) => [t(`catalog.countries.${q.country}`), gradeText(t, q.country, q.grade), subjectText(t, q.subject), q.week].join(' · ');
  const dates = (q: ParsedQuiz) => (q.releaseOn && q.dueOn ? t('catalog.admin.dates', { from: formatShortDate(q.releaseOn), to: formatShortDate(q.dueOn) }) : t('catalog.admin.noDates'));
  const errorText = (e: string | undefined) => (e ? t(quizErrorKey(e)) : '');

  if (!documentUploadSupported) {
    return (
      <Screen>
        <ScreenHeader title={t('catalog.import.title')} />
        <Text accessibilityRole="alert" style={typography.secondary}>{t('revisions.import.unsupported')}</Text>
      </Screen>
    );
  }

  // ───────────── choix du fichier ─────────────
  if (phase.name === 'pick' || phase.name === 'reading' || phase.name === 'unreadable' || phase.name === 'unstructured') {
    return (
      <Screen>
        <ScreenHeader title={t('catalog.import.title')} />
        <Text style={typography.secondary}>{t('catalog.bulk.intro')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.bulk.choose')} onPress={() => void choose()} disabled={phase.name === 'reading'} style={styles.pick}>
          <FileUp color={colors.primary} size={22} />
          <Text style={styles.pickText}>{t('catalog.bulk.choose')}</Text>
        </Pressable>
        <Text style={typography.secondary}>{t('catalog.bulk.formats')}</Text>
        {phase.name === 'reading' ? (
          <View accessible accessibilityRole="progressbar" accessibilityLabel={t('catalog.bulk.reading')} style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text accessibilityLiveRegion="polite" style={typography.secondary}>{t('catalog.bulk.reading')}</Text>
          </View>
        ) : null}
        {phase.name === 'unreadable' ? <Text accessibilityRole="alert" style={styles.error}>{t(phase.key)}</Text> : null}
        {phase.name === 'unstructured' ? (
          <Card>
            <Text accessibilityRole="header" style={styles.section}>{t('catalog.bulk.unstructuredTitle')}</Text>
            <Text style={typography.secondary}>{t('catalog.bulk.unstructuredBody')}</Text>
            <Button variant="secondary" label={t('catalog.bulk.useAi')} onPress={onUseAi} />
          </Card>
        ) : (
          <Button variant="secondary" label={t('catalog.bulk.useAi')} onPress={onUseAi} />
        )}
      </Screen>
    );
  }

  // ───────────── erreurs de lecture : rien n'est écrit ─────────────
  if (phase.name === 'errors') {
    return (
      <Screen>
        <ScreenHeader title={t('catalog.bulk.errorsTitle')} />
        <Text accessibilityRole="alert" style={styles.error}>{t('catalog.bulk.errorsBody', { count: phase.errors.length })}</Text>
        {phase.errors.map((e, i) => (
          <View key={i} accessible accessibilityLabel={errorLine(t, e)} style={styles.errorRow}>
            <Text style={styles.errorWhere}>{t('catalog.bulk.where', { block: e.block, line: e.line })}</Text>
            <Text style={typography.body}>{t(`catalog.bulk.errors.${e.code}`, { ...e.params, key: e.params?.key ? t(`catalog.bulk.keys.${e.params.key}`) : undefined })}</Text>
          </View>
        ))}
        <Button label={t('catalog.bulk.otherFile')} onPress={() => setPhase({ name: 'pick' })} />
      </Screen>
    );
  }

  // ───────────── bilan avant écriture ─────────────
  if (phase.name === 'review') {
    const steps = writeSteps(phase.plan, decisions);
    const questions = phase.plan.reduce((n, p) => n + p.quiz.questions.length, 0);
    return (
      <Screen>
        <ScreenHeader title={t('catalog.bulk.reviewTitle')} />
        <Text accessibilityRole="header" style={styles.section}>{t('catalog.bulk.detected', { count: phase.plan.length, questions })}</Text>
        {phase.plan.map((p) => (
          <Card key={p.quiz.block}>
            <Text style={styles.title}>{p.quiz.title}</Text>
            <Text style={typography.secondary}>{place(p.quiz)}</Text>
            <Text style={typography.secondary}>{dates(p.quiz)}</Text>
            <Text style={typography.secondary}>{[t('revisions.questionCount', { count: p.quiz.questions.length }), t('catalog.bulk.answersRead')].join(' · ')}</Text>
            {p.conflict ? (
              <View accessibilityRole="alert" style={styles.conflict}>
                <Text style={styles.warn}>{t('catalog.bulk.occupied', { title: p.conflict.existing.title })}</Text>
                {p.conflict.kind === 'replaceable' ? (
                  <View style={styles.wrap}>
                    <Chip label={t('catalog.bulk.skip')} selected={effectiveDecision(p, decisions) === 'skip'} onPress={() => setDecisions({ ...decisions, [p.quiz.block]: 'skip' })} />
                    <Chip label={t('catalog.bulk.replace')} selected={effectiveDecision(p, decisions) === 'replace'} onPress={() => setDecisions({ ...decisions, [p.quiz.block]: 'replace' })} />
                  </View>
                ) : (
                  <Text style={typography.secondary}>{t(p.conflict.kind === 'published' ? 'catalog.bulk.cannotReplacePublished' : 'catalog.bulk.cannotReplaceAttempts')}</Text>
                )}
              </View>
            ) : null}
          </Card>
        ))}
        <Button label={t('catalog.bulk.save', { count: steps.length })} disabled={steps.length === 0} onPress={() => void save(phase.plan)} />
        <Button variant="secondary" label={t('catalog.bulk.otherFile')} onPress={() => setPhase({ name: 'pick' })} />
      </Screen>
    );
  }

  if (phase.name === 'writing' || phase.name === 'publishing') {
    const label = t(phase.name === 'writing' ? 'catalog.bulk.writing' : 'catalog.bulk.publishing', { done: phase.done, total: phase.total });
    return (
      <Screen>
        <ScreenHeader title={t('catalog.bulk.resultTitle')} />
        <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.row}>
          <ActivityIndicator color={colors.primary} />
          <Text accessibilityLiveRegion="polite" style={typography.secondary}>{label}</Text>
        </View>
      </Screen>
    );
  }

  // ───────────── résultat : brouillons, puis publication ─────────────
  const { plan, results } = phase;
  const published = phase.name === 'published' ? phase.published : [];
  const counts = summarize(results);
  const todo = publishable(results, published);
  const failed = results.filter((r) => r.outcome === 'failed');
  return (
    <Screen>
      <ScreenHeader title={t('catalog.bulk.resultTitle')} />
      <Text accessibilityLiveRegion="polite" style={styles.section}>{t('catalog.bulk.summary', counts)}</Text>
      {plan.map((p) => {
        const r = results.find((x) => x.block === p.quiz.block);
        const pub = published.find((x) => x.block === p.quiz.block);
        const status = pub ? (pub.outcome === 'published' ? t('catalog.bulk.result.published') : t('catalog.bulk.result.stayedDraft')) : r ? t(`catalog.bulk.result.${r.outcome}`) : '';
        const reason = pub?.outcome === 'draft' ? errorText(pub.error) : r?.outcome === 'failed' ? errorText(r.error) : '';
        return (
          <Pressable
            key={p.quiz.block}
            accessibilityRole="button"
            accessibilityLabel={[p.quiz.title, place(p.quiz), status, reason].filter(Boolean).join(', ')}
            disabled={!r || r.outcome === 'failed'}
            onPress={() => router.push({ pathname: '/admin/[id]', params: { id: p.id } })}
            style={styles.resultRow}
          >
            <View style={styles.flex}>
              <Text style={styles.title}>{p.quiz.title}</Text>
              <Text style={typography.secondary}>{place(p.quiz)}</Text>
              {reason ? <Text accessibilityRole="alert" style={styles.warn}>{reason}</Text> : null}
            </View>
            <Text style={[styles.badge, pub?.outcome === 'published' ? styles.badgeOn : null, r?.outcome === 'failed' ? styles.badgeKo : null]}>{status}</Text>
          </Pressable>
        );
      })}
      {failed.length > 0 ? (
        <Button
          variant="secondary"
          label={t('catalog.bulk.retry', { count: failed.length })}
          onPress={() => void save(plan, writeSteps(plan, decisions).filter((s) => failed.some((f) => f.block === s.item.quiz.block)), results.filter((r) => r.outcome !== 'failed'))}
        />
      ) : null}
      {todo.length > 0 ? <Button label={t('catalog.bulk.publishAll', { count: todo.length })} onPress={() => void publishAll(plan, results, published)} /> : null}
      <Button variant="secondary" label={t('catalog.bulk.backToCatalog')} onPress={() => router.replace('/admin')} />
    </Screen>
  );
}

function errorLine(t: TFunction, e: ImportError): string {
  return `${t('catalog.bulk.where', { block: e.block, line: e.line })} ${t(`catalog.bulk.errors.${e.code}`, { ...e.params, key: e.params?.key ? t(`catalog.bulk.keys.${e.params.key}`) : undefined })}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  error: { color: colors.danger, fontSize: 14 },
  warn: { color: colors.warning, fontSize: 14, fontWeight: '600' },
  conflict: { gap: 8 },
  errorRow: { backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 2 },
  errorWhere: { fontSize: 13, fontWeight: '700', color: colors.danger },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TARGET + 16, backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  badge: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.separator, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  badgeOn: { color: colors.primary, backgroundColor: colors.primaryTint },
  badgeKo: { color: colors.danger, backgroundColor: colors.warningTint },
  pick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: MIN_TARGET + 24, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryTint, paddingHorizontal: 16 },
  pickText: { fontSize: 17, fontWeight: '700', color: colors.primary },
});
