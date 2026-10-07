import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { Chip } from '@/components/Chip';
import { Button, Field, Screen, ScreenHeader } from '@/components/ui';
import { validateSetTitle } from '@/domain/quiz';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useCreateQuizSet } from '@/hooks/useQuizzes';
import { typography } from '@/theme/tokens';

/** Création manuelle d'un jeu (titre, matière, UN enfant). Le jeu naît en brouillon ; les questions s'ajoutent ensuite. */
export function NewQuizSet() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const create = useCreateQuizSet();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [childId, setChildId] = useState<string | null>(d?.child?.id ?? null);
  const [touched, setTouched] = useState(false);
  if (!d) return null;
  const errors = validateSetTitle(title, subject);
  const canSubmit = errors.length === 0 && childId !== null;

  const submit = () => {
    setTouched(true);
    if (!canSubmit || !childId) return;
    const id = newId();
    // le jeu doit exister côté serveur avant d'ouvrir l'éditeur (RPC des questions) : on navigue au succès
    create.mutate({ id, familyId: d.me.family.id, childId, memberId: d.me.member.id, title, subject: subject.trim() || null }, { onSuccess: () => router.replace({ pathname: '/quiz/[id]', params: { id } }) });
  };

  return (
    <Screen>
      <ScreenHeader title={t('revisions.newTitle')} />
      <Field label={t('revisions.titleField')} value={title} onChangeText={setTitle} maxLength={120} error={touched && errors.includes('titleRequired') ? t('revisions.errors.titleRequired') : errors.includes('titleTooLong') ? t('revisions.errors.titleTooLong') : null} />
      <Field label={t('revisions.subjectField')} value={subject} onChangeText={setSubject} maxLength={80} error={errors.includes('subjectTooLong') ? t('revisions.errors.subjectTooLong') : null} />
      {d.children.length > 1 ? (
        <>
          <Text style={typography.secondary}>{t('revisions.childField')}</Text>
          <View style={styles.wrap}>
            {d.children.map((c) => (
              <Chip key={c.id} label={c.name} color={c.color ?? undefined} selected={childId === c.id} onPress={() => setChildId(c.id)} />
            ))}
          </View>
        </>
      ) : null}
      <Button label={t('revisions.create')} onPress={submit} disabled={!canSubmit} loading={create.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
