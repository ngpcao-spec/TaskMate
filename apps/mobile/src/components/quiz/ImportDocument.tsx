import { onlineManager } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Camera, FileText, Image as ImageIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { GenerateError } from '@/api/generate';
import { Chip } from '@/components/Chip';
import { Button, Card, Field, Screen, ScreenHeader } from '@/components/ui';
import { clampCount, DOC_LIMITS, generateErrorKey, selectionErrorKey, validateSelection } from '@/domain/documents';
import { validateSetTitle } from '@/domain/quiz';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useGenerateQuestions } from '@/hooks/useQuizzes';
import { documentUploadSupported, pickDocuments, type PickedFile, type PickSource } from '@/services/documents';
import { useToastStore } from '@/store/toast';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/**
 * « Créer à partir d'un document » (parent) : photos / PDF / Word → questions générées par une IA, enregistrées en BROUILLON puis ouvertes
 * dans l'éditeur de relecture. Le document est envoyé au service d'IA sans être conservé (mention affichée).
 */
export function ImportDocument() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const generate = useGenerateQuestions();
  const show = useToastStore((s) => s.show);
  const [childId, setChildId] = useState<string | null>(d?.child?.id ?? null);
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [count, setCount] = useState<number>(DOC_LIMITS.defaultQuestions);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [setId] = useState(newId); // id fixé à la création : une nouvelle tentative réutilise le même jeu (jamais deux brouillons)
  if (!d) return null;

  const lang = (['vi', 'fr', 'en'].includes(i18n.language) ? i18n.language : 'auto') as 'vi' | 'fr' | 'en' | 'auto';
  const titleErrors = validateSetTitle(title || 'x', subject);

  const pick = async (source: PickSource) => {
    setError(null);
    const result = await pickDocuments(source);
    if (result.status === 'cancelled' || result.status === 'unsupported') return;
    if (result.status === 'error') {
      setError(result.code === 'tooLarge' ? 'revisions.import.errors.tooLarge' : result.code === 'unsupportedType' ? 'revisions.import.errors.unsupportedType' : 'revisions.import.errors.unreadable');
      return;
    }
    // une photo suivante complète les photos ; un PDF ou un Word remplace la sélection
    const incoming = result.files;
    const next = incoming[0]?.kind === 'image' && files.every((f) => f.kind === 'image') ? [...files, ...incoming] : incoming;
    const invalid = validateSelection(next);
    if (invalid) {
      setError(selectionErrorKey(invalid));
      return;
    }
    setFiles(next);
  };

  const canGenerate = files.length > 0 && childId !== null && titleErrors.length === 0 && !generate.isPending;
  const submit = () => {
    if (!canGenerate || !childId) return;
    if (!onlineManager.isOnline()) {
      setError('revisions.import.needNetwork');
      return;
    }
    setError(null);
    generate.mutate(
      { setId, childId, title: title.trim() || undefined, subject: subject.trim() || undefined, count, language: lang, files: files.map((f) => ({ name: f.name, mediaType: f.mediaType, data: f.data })) },
      {
        onSuccess: (r) => {
          show(r.truncated ? `${t('revisions.import.done', { count: r.count })} ${t('revisions.import.truncated')}` : t('revisions.import.done', { count: r.count }));
          router.replace({ pathname: '/quiz/[id]', params: { id: r.set_id } });
        },
        onError: (e) => setError(e instanceof GenerateError ? generateErrorKey(e.code) : 'revisions.import.errors.generic'),
      },
    );
  };
  const failure = generate.error instanceof GenerateError ? generate.error : null;
  const errorText = error ? t(error, { used: failure?.details.used as number | undefined, limit: failure?.details.limit as number | undefined }) : null;

  if (!documentUploadSupported) {
    return (
      <Screen>
        <ScreenHeader title={t('revisions.import.title')} />
        <Text accessibilityRole="alert" style={typography.secondary}>{t('revisions.import.unsupported')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('revisions.import.title')} />
      <Card>
        <Text style={styles.notice}>{t('revisions.import.intro')}</Text>
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
      <Field label={t('revisions.import.subject')} value={subject} onChangeText={setSubject} maxLength={60} error={titleErrors.includes('subjectTooLong') ? t('revisions.errors.subjectTooLong') : null} />
      <Field label={t('revisions.import.titleField')} value={title} onChangeText={setTitle} maxLength={100} error={title.trim().length > 80 ? t('revisions.errors.titleTooLong') : null} />

      <Text style={typography.secondary}>{t('revisions.import.count')}</Text>
      <View style={styles.stepper}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.less')} disabled={count <= DOC_LIMITS.minQuestions} onPress={() => setCount(clampCount(count - 1))} style={styles.stepBtn}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.stepValue}>{t('revisions.import.countValue', { count })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.more')} disabled={count >= DOC_LIMITS.maxQuestions} onPress={() => setCount(clampCount(count + 1))} style={styles.stepBtn}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.sources}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.takePhoto')} onPress={() => void pick('camera')} style={styles.source}>
          <Camera color={colors.primary} size={22} />
          <Text style={styles.sourceText}>{t('revisions.import.takePhoto')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.pickPhotos')} onPress={() => void pick('gallery')} style={styles.source}>
          <ImageIcon color={colors.primary} size={22} />
          <Text style={styles.sourceText}>{t('revisions.import.pickPhotos')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.pickFile')} onPress={() => void pick('document')} style={styles.source}>
          <FileText color={colors.primary} size={22} />
          <Text style={styles.sourceText}>{t('revisions.import.pickFile')}</Text>
        </Pressable>
      </View>

      <Text accessibilityRole="header" style={styles.section}>{t('revisions.import.selected')}</Text>
      {files.length === 0 ? <Text style={typography.secondary}>{t('revisions.import.none')}</Text> : null}
      {files.map((f, i) => (
        <View key={`${f.name}-${i}`} style={styles.file}>
          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('revisions.import.remove', { name: f.name })} onPress={() => setFiles(files.filter((_, j) => j !== i))} style={styles.remove}>
            <X color={colors.danger} size={20} />
          </Pressable>
        </View>
      ))}

      {errorText ? <Text accessibilityRole="alert" style={styles.error}>{errorText}</Text> : null}
      {generate.isPending ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={t('revisions.import.generating')} style={styles.progress}>
          <ActivityIndicator color={colors.primary} />
          <Text accessibilityLiveRegion="polite" style={typography.secondary}>{t('revisions.import.generating')}</Text>
        </View>
      ) : null}
      <Button label={t('revisions.import.generate')} onPress={submit} disabled={!canGenerate} loading={generate.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { fontSize: 14, color: colors.text, lineHeight: 20 },
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
