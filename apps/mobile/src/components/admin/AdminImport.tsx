import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { AdminGate } from '@/components/admin/AdminGate';
import { Chip } from '@/components/Chip';
import { ImportDocument } from '@/components/quiz/ImportDocument';
import { subjectText } from '@/components/quiz/subject';
import { Button, Card, Field, Screen, ScreenHeader } from '@/components/ui';
import { COUNTRIES, normalizeGrade, SUBJECTS } from '@/domain/catalog';
import { useCreateCatalogQuiz } from '@/hooks/useCatalog';
import { typography } from '@/theme/tokens';

type Slot = { country: string; grade: string; subject: string; week: string };

/**
 * Administration → Importer : l'admin choisit la CASE (pays, classe, matière, semaine « Tuần N »), puis dépose le Word / PDF / photos : même chaîne que
 * l'import des familles (génération IA, signalements « à vérifier », relecture), enregistrée en BROUILLON dans cette case. Ou crée un QCM vide à saisir.
 */
export function AdminImport() {
  return (
    <AdminGate>
      <Flow />
    </AdminGate>
  );
}

function Flow() {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateCatalogQuiz();
  const [country, setCountry] = useState<string>(COUNTRIES[0]);
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [week, setWeek] = useState('');
  const [title, setTitle] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const normalizedGrade = normalizeGrade(grade);
  const weekOk = week.trim().length >= 1 && week.trim().length <= 40;
  const valid = normalizedGrade !== null && weekOk;

  if (slot) return <ImportDocument catalog={slot} />;

  return (
    <Screen>
      <ScreenHeader title={t('catalog.import.title')} />
      <Text style={typography.secondary}>{t('catalog.import.intro')}</Text>
      <Card>
        <Text style={typography.secondary}>{t('catalog.country')}</Text>
        <View style={styles.wrap}>
          {COUNTRIES.map((c) => (
            <Chip key={c} label={t(`catalog.countries.${c}`)} selected={country === c} onPress={() => setCountry(c)} />
          ))}
        </View>
        <Field label={t('catalog.grade')} value={grade} onChangeText={setGrade} maxLength={12} autoCapitalize="characters" placeholder={t('catalog.gradePlaceholder')} error={grade.trim().length > 12 ? t('catalog.errors.grade') : null} />
        <Text style={typography.secondary}>{t('catalog.subjectLabel')}</Text>
        <View style={styles.wrap}>
          {SUBJECTS.map((s) => (
            <Chip key={s} label={subjectText(t, s)} selected={subject === s} onPress={() => setSubject(s)} />
          ))}
        </View>
        <Field label={t('catalog.week')} value={week} onChangeText={setWeek} maxLength={40} placeholder={t('catalog.weekPlaceholder')} error={week.length > 40 ? t('catalog.errors.week') : null} />
      </Card>
      <Button label={t('catalog.import.continue')} disabled={!valid} onPress={() => normalizedGrade && setSlot({ country, grade: normalizedGrade, subject, week: week.trim() })} />

      <Card>
        <Text accessibilityRole="header" style={typography.body}>{t('catalog.import.manualTitle')}</Text>
        <Text style={typography.secondary}>{t('catalog.import.manualHelp')}</Text>
        <Field label={t('catalog.titleField')} value={title} onChangeText={setTitle} maxLength={80} />
        <Button
          variant="secondary"
          label={t('catalog.import.manual')}
          disabled={!valid || title.trim().length < 1}
          loading={create.isPending}
          onPress={() => {
            if (!normalizedGrade) return;
            const id = newId(); // id fixé à la création : un rejeu ne crée jamais de doublon
            create.mutate({ id, country, grade: normalizedGrade, subject, week: week.trim(), title: title.trim() }, { onSuccess: () => router.replace({ pathname: '/admin/[id]', params: { id } }) });
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
