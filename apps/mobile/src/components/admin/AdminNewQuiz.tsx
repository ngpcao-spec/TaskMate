import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { newId } from '@/api/ids';
import { AdminGate } from '@/components/admin/AdminGate';
import { Chip } from '@/components/Chip';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { Button, Card, Field, Screen, ScreenHeader } from '@/components/ui';
import { COUNTRIES, gradesFor, SUBJECTS } from '@/domain/catalog';
import { useCreateCatalogQuiz } from '@/hooks/useCatalog';
import { typography } from '@/theme/tokens';

/** Administration → créer un QCM VIDE dans une case du catalogue (classes en liste fermée) ; les questions s'ajoutent ensuite une à une dans l'éditeur. */
export function AdminNewQuiz() {
  return (
    <AdminGate>
      <Form />
    </AdminGate>
  );
}

function Form() {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateCatalogQuiz();
  const [country, setCountry] = useState<string>(COUNTRIES[0]);
  const [grade, setGrade] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [week, setWeek] = useState('');
  const [title, setTitle] = useState('');
  const valid = grade !== null && week.trim().length >= 1 && title.trim().length >= 1;
  return (
    <Screen>
      <ScreenHeader title={t('catalog.new.title')} />
      <Text style={typography.secondary}>{t('catalog.import.manualHelp')}</Text>
      <Card>
        <Text style={typography.secondary}>{t('catalog.country')}</Text>
        <View style={styles.wrap}>
          {COUNTRIES.map((c) => (
            <Chip key={c} label={t(`catalog.countries.${c}`)} selected={country === c} onPress={() => { setCountry(c); setGrade(null); }} />
          ))}
        </View>
        <Text style={typography.secondary}>{t('catalog.grade')}</Text>
        <View style={styles.wrap}>
          {gradesFor(country).map((g) => (
            <Chip key={g} label={gradeText(t, country, g)} selected={grade === g} onPress={() => setGrade(g)} />
          ))}
        </View>
        <Text style={typography.secondary}>{t('catalog.subjectLabel')}</Text>
        <View style={styles.wrap}>
          {SUBJECTS.map((s) => (
            <Chip key={s} label={subjectText(t, s)} selected={subject === s} onPress={() => setSubject(s)} />
          ))}
        </View>
        <Field label={t('catalog.week')} value={week} onChangeText={setWeek} maxLength={40} placeholder={t('catalog.weekPlaceholder')} />
        <Field label={t('catalog.titleField')} value={title} onChangeText={setTitle} maxLength={80} />
      </Card>
      <Button
        label={t('catalog.import.manual')}
        disabled={!valid}
        loading={create.isPending}
        onPress={() => {
          if (!grade) return;
          const id = newId(); // id fixé à la création : un rejeu ne crée jamais de doublon
          create.mutate({ id, country, grade, subject, week: week.trim(), title: title.trim() }, { onSuccess: () => router.replace({ pathname: '/admin/[id]', params: { id } }) });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
