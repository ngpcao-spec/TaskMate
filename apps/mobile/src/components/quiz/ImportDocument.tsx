import { onlineManager } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Camera, FileText, Image as ImageIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { GenerateError, type GenerateResult } from '@/api/generate';
import { Chip } from '@/components/Chip';
import { Button, Card, Field, Screen, ScreenHeader } from '@/components/ui';
import {
  allowsKey, clampCount, DOC_LIMITS, generateErrorKey, instructionTooLong, MATERIAL_KINDS, REQUEST_KINDS, reviewRoute, selectionErrorKey, summaryNotices, validateSelection,
  type FileRole, type MaterialKind, type RequestKind,
} from '@/domain/documents';
import { validateSetTitle } from '@/domain/quiz';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useGenerateQuestions } from '@/hooks/useQuizzes';
import { documentUploadSupported, pickDocuments, type PickedFile, type PickSource } from '@/services/documents';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type RoleFile = PickedFile & { role: FileRole };

/**
 * « Créer à partir d'un document » (parent) : photos / PDF / Word → questions générées par une IA, enregistrées en BROUILLON.
 * Tout est facultatif : le type de support et le nombre de questions sont en « Auto » par défaut (l'IA décide, le serveur plafonne), la consigne est vide.
 * Après la génération, le parent voit le type retenu (« Détecté : examen papier »), les avertissements (plafond, non-QCM ignorés, figures) et peut
 * corriger le type puis relancer sur le même brouillon. Le document est envoyé à un service d'IA externe sans être conservé (mention affichée).
 */
export function ImportDocument() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const generate = useGenerateQuestions();
  const [childId, setChildId] = useState<string | null>(d?.child?.id ?? null);
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [instruction, setInstruction] = useState('');
  const [kind, setKind] = useState<RequestKind>('auto');
  const [precise, setPrecise] = useState(false);
  const [count, setCount] = useState<number>(DOC_LIMITS.defaultQuestions);
  const [files, setFiles] = useState<RoleFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixKind, setFixKind] = useState<MaterialKind>('course');
  const [setId] = useState(newId); // id fixé à la création : une nouvelle tentative réutilise le même jeu (jamais deux brouillons)
  if (!d) return null;

  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'auto') as 'vi' | 'fr' | 'en' | 'auto';
  const titleErrors = validateSetTitle(title || 'x', subject);
  const activeKind: RequestKind = fixing ? fixKind : kind;
  const keyAllowed = allowsKey(activeKind);
  const examFiles = files.filter((f) => f.role === 'exam');
  const keyFiles = files.filter((f) => f.role === 'key');
  const kindLabel = (k: MaterialKind) => t(`revisions.material.kinds.${k}`);

  const pick = async (source: PickSource, role: FileRole) => {
    setError(null);
    const picked = await pickDocuments(source);
    if (picked.status === 'cancelled' || picked.status === 'unsupported') return;
    if (picked.status === 'error') {
      setError(picked.code === 'tooLarge' ? 'revisions.import.errors.tooLarge' : picked.code === 'unsupportedType' ? 'revisions.import.errors.unsupportedType' : 'revisions.import.errors.unreadable');
      return;
    }
    // une photo suivante complète les photos du même rôle ; un PDF ou un Word remplace la sélection de ce rôle
    const incoming = picked.files.map((f): RoleFile => ({ ...f, role }));
    const same = files.filter((f) => f.role === role);
    const others = files.filter((f) => f.role !== role);
    const merged = incoming[0]?.kind === 'image' && same.every((f) => f.kind === 'image') ? [...same, ...incoming] : incoming;
    const next = [...others, ...merged];
    const invalid = validateSelection(next);
    if (invalid) {
      setError(selectionErrorKey(invalid));
      return;
    }
    setFiles(next);
  };

  const chooseKind = (k: RequestKind) => {
    setKind(k);
    if (!allowsKey(k)) setFiles((current) => current.filter((f) => f.role === 'exam')); // un corrigé n'a de sens qu'avec Auto ou « examen avec corrigé »
  };

  const noteTooLong = instructionTooLong(instruction);
  const needsKey = activeKind === 'exam_key' && keyFiles.length === 0;
  const canGenerate = examFiles.length > 0 && childId !== null && titleErrors.length === 0 && !noteTooLong && !needsKey && !generate.isPending && (!fixing || result !== null);

  const submit = () => {
    if (!canGenerate || !childId) return;
    if (!onlineManager.isOnline()) {
      setError('revisions.import.needNetwork');
      return;
    }
    setError(null);
    const sendKind: RequestKind = fixing ? fixKind : kind;
    const sendFiles = files.filter((f) => f.role === 'exam' || allowsKey(sendKind));
    generate.mutate(
      {
        setId, childId, title: title.trim() || undefined, subject: subject.trim() || undefined, kind: sendKind, count: precise ? count : 'auto',
        instruction: instruction.trim() || undefined, retry: result !== null, language: lang,
        files: sendFiles.map((f) => ({ name: f.name, mediaType: f.mediaType, data: f.data, role: f.role })),
      },
      {
        onSuccess: (r) => {
          setResult(r);
          setFixing(false);
        },
        onError: (e) => setError(e instanceof GenerateError ? generateErrorKey(e.code) : 'revisions.import.errors.generic'),
      },
    );
  };
  const failure = generate.error instanceof GenerateError ? generate.error : null;
  const errorText = error ? t(error, { used: failure?.details.used as number | undefined, limit: failure?.details.limit as number | undefined, max: failure?.details.max as number | undefined }) : null;

  if (!documentUploadSupported) {
    return (
      <Screen>
        <ScreenHeader title={t('revisions.import.title')} />
        <Text accessibilityRole="alert" style={typography.secondary}>{t('revisions.import.unsupported')}</Text>
      </Screen>
    );
  }

  const sources = (role: FileRole) => (
    <View style={styles.sources}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(role === 'key' ? 'revisions.import.takeKeyPhoto' : 'revisions.import.takePhoto')} onPress={() => void pick('camera', role)} style={styles.source}>
        <Camera color={colors.primary} size={22} />
        <Text style={styles.sourceText}>{t(role === 'key' ? 'revisions.import.takeKeyPhoto' : 'revisions.import.takePhoto')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t(role === 'key' ? 'revisions.import.pickKeyPhotos' : 'revisions.import.pickPhotos')} onPress={() => void pick('gallery', role)} style={styles.source}>
        <ImageIcon color={colors.primary} size={22} />
        <Text style={styles.sourceText}>{t(role === 'key' ? 'revisions.import.pickKeyPhotos' : 'revisions.import.pickPhotos')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t(role === 'key' ? 'revisions.import.pickKeyFile' : 'revisions.import.pickFile')} onPress={() => void pick('document', role)} style={styles.source}>
        <FileText color={colors.primary} size={22} />
        <Text style={styles.sourceText}>{t(role === 'key' ? 'revisions.import.pickKeyFile' : 'revisions.import.pickFile')}</Text>
      </Pressable>
    </View>
  );
  const fileRows = (list: RoleFile[], empty: string) => (
    <>
      {list.length === 0 ? <Text style={typography.secondary}>{empty}</Text> : null}
      {list.map((f, i) => (
        <View key={`${f.role}-${f.name}-${i}`} style={styles.file}>
          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.remove', { name: f.name })} onPress={() => setFiles(files.filter((x) => x !== f))} style={styles.remove}>
            <X color={colors.danger} size={20} />
          </Pressable>
        </View>
      ))}
    </>
  );
  const keyBlock = keyAllowed ? (
    <>
      <Text accessibilityRole="header" style={styles.section}>{t('revisions.import.keySection')}</Text>
      <Text style={typography.secondary}>{t(activeKind === 'exam_key' ? 'revisions.import.keyRequiredHelp' : 'revisions.import.keyOptional')}</Text>
      {sources('key')}
      {fileRows(keyFiles, t('revisions.import.noneKey'))}
    </>
  ) : null;
  const progress = generate.isPending ? (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t('revisions.import.generating')} style={styles.progress}>
      <ActivityIndicator color={colors.primary} />
      <Text accessibilityLiveRegion="polite" style={typography.secondary}>{t('revisions.import.generating')}</Text>
    </View>
  ) : null;

  // ───────────── résultat de la génération ─────────────
  if (result && !fixing) {
    const notices = summaryNotices(result);
    const exam = reviewRoute(result.kind) === '/quiz/answers';
    return (
      <Screen>
        <ScreenHeader title={t('revisions.import.result.title')} />
        <Card>
          <Text accessibilityRole="header" style={styles.detected}>
            {t(result.kind_detected ? 'revisions.import.result.detected' : 'revisions.import.result.chosen', { kind: kindLabel(result.kind).toLocaleLowerCase(i18n.language) })}
          </Text>
          <Text style={typography.body}>{t('revisions.import.result.saved', { count: result.count })}</Text>
        </Card>
        {notices.map((n) => (
          <Text key={n.key} accessibilityRole="alert" style={styles.notice}>{t(n.key, n.values)}</Text>
        ))}
        <Button label={t(exam ? 'revisions.import.result.openGrid' : 'revisions.import.result.open')} onPress={() => router.replace({ pathname: exam ? '/quiz/answers' : '/quiz/[id]', params: { id: result.set_id } })} />
        <Button variant="secondary" label={t('revisions.import.result.fix')} onPress={() => { setFixKind(result.kind); setFixing(true); setError(null); }} />
      </Screen>
    );
  }

  // ───────────── correction du type et relance (même brouillon) ─────────────
  if (result && fixing) {
    return (
      <Screen>
        <ScreenHeader title={t('revisions.import.result.fix')} />
        <Text style={typography.secondary}>{t('revisions.import.result.fixHelp')}</Text>
        <View style={styles.wrap}>
          {MATERIAL_KINDS.map((k) => (
            <Chip key={k} label={t(`revisions.import.kinds.${k}.label`)} selected={fixKind === k} onPress={() => setFixKind(k)} />
          ))}
        </View>
        <Text style={typography.secondary}>{t(`revisions.import.kinds.${fixKind}.help`)}</Text>
        {fixKind === 'exam_key' ? keyBlock : null}
        {errorText ? <Text accessibilityRole="alert" style={styles.error}>{errorText}</Text> : null}
        {progress}
        <Button label={t('revisions.import.result.relaunch')} onPress={submit} disabled={!canGenerate} loading={generate.isPending} />
        <Button variant="secondary" label={t('revisions.import.result.cancelFix')} onPress={() => { setFixing(false); setError(null); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('revisions.import.title')} />
      <Card>
        <Text style={styles.notice2}>{t('revisions.import.intro')}</Text>
      </Card>

      {d.children.length > 1 ? (
        <>
          <Text style={typography.secondary}>{t('revisions.import.child')}</Text>
          <View style={styles.wrap}>
            {d.children.map((c) => (
              <Chip key={c.id} label={c.name} color={c.color ?? undefined} selected={childId === c.id} onPress={() => setChildId(c.id)} />
            ))}
          </View>
        </>
      ) : null}

      <Text accessibilityRole="header" style={styles.section}>{t('revisions.kinds.label')}</Text>
      <View style={styles.wrap}>
        {REQUEST_KINDS.map((k) => (
          <Chip key={k} label={t(`revisions.import.kinds.${k}.label`)} selected={kind === k} onPress={() => chooseKind(k)} />
        ))}
      </View>
      <Text style={typography.secondary}>{t(`revisions.import.kinds.${kind}.help`)}</Text>

      <Field label={t('revisions.import.subject')} value={subject} onChangeText={setSubject} maxLength={60} error={titleErrors.includes('subjectTooLong') ? t('revisions.errors.subjectTooLong') : null} />
      <Field label={t('revisions.import.titleField')} value={title} onChangeText={setTitle} maxLength={100} error={title.trim().length > 80 ? t('revisions.errors.titleTooLong') : null} />

      <Text style={typography.secondary}>{t('revisions.import.count')}</Text>
      <View style={styles.wrap}>
        <Chip label={t('revisions.import.countAuto')} selected={!precise} onPress={() => setPrecise(false)} />
        <Chip label={t('revisions.import.countPrecise')} selected={precise} onPress={() => setPrecise(true)} />
      </View>
      {precise ? (
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.less')} disabled={count <= DOC_LIMITS.minQuestions} onPress={() => setCount(clampCount(count - 1))} style={styles.stepBtn}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.stepValue}>{t('revisions.import.countValue', { count })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.more')} disabled={count >= DOC_LIMITS.maxQuestions} onPress={() => setCount(clampCount(count + 1))} style={styles.stepBtn}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={typography.secondary}>{t('revisions.import.countAutoHelp')}</Text>
      )}

      <Field
        label={t('revisions.import.instructionLabel')}
        placeholder={t('revisions.import.instructionPlaceholder')}
        value={instruction}
        onChangeText={setInstruction}
        multiline
        error={noteTooLong ? t('revisions.import.errors.instructionTooLong') : null}
      />
      <Text style={typography.secondary}>{t('revisions.import.instructionCounter', { count: instruction.trim().length })}</Text>

      <Text accessibilityRole="header" style={styles.section}>{t('revisions.import.examSection')}</Text>
      {sources('exam')}
      <Text accessibilityRole="header" style={styles.section}>{t('revisions.import.selected')}</Text>
      {fileRows(examFiles, t('revisions.import.none'))}
      {keyBlock}

      {errorText ? <Text accessibilityRole="alert" style={styles.error}>{errorText}</Text> : null}
      {progress}
      <Button label={t('revisions.import.generate')} onPress={submit} disabled={!canGenerate} loading={generate.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { fontSize: 14, color: colors.warning, lineHeight: 20 },
  notice2: { fontSize: 14, color: colors.text, lineHeight: 20 },
  detected: { fontSize: 18, fontWeight: '700', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: 999, borderWidth: 1.5, borderColor: '#D5DFEC', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stepText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  stepValue: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 110, textAlign: 'center' },
  sources: { gap: 10 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET + 8, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryTint, paddingHorizontal: 16 },
  sourceText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  file: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: MIN_TARGET, backgroundColor: colors.card, borderRadius: 12, paddingLeft: 14 },
  fileName: { flex: 1, fontSize: 15, color: colors.text },
  remove: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 14 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
