import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AdminBulkImport } from '@/components/admin/AdminBulkImport';
import { AdminGate } from '@/components/admin/AdminGate';
import { Chip } from '@/components/Chip';
import { ImportDocument } from '@/components/quiz/ImportDocument';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { Button, Card, Field, Screen, ScreenHeader } from '@/components/ui';
import { COUNTRIES, gradesFor, SUBJECTS } from '@/domain/catalog';
import { typography } from '@/theme/tokens';

type Slot = { country: string; grade: string; subject: string; week: string };

/**
 * Administration → Importer (D-081) : UN fichier, aucun formulaire. Le fichier structuré (blocs [QUIZ]) est lu sans IA ; le repli sur l'IA (Word libre, photos) demande
 * la case (pays, classe, matière, semaine) car rien ne la donne : c'est l'ancien comportement, conservé.
 */
export function AdminImport() {
  return (
    <AdminGate>
      <Flow />
    </AdminGate>
  );
}

function Flow() {
  const [mode, setMode] = useState<'file' | 'ai'>('file');
  if (mode === 'ai') return <AiSlot onBack={() => setMode('file')} />;
  return <AdminBulkImport onUseAi={() => setMode('ai')} />;
}

function AiSlot({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [country, setCountry] = useState<string>(COUNTRIES[0]);
  const [grade, setGrade] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [week, setWeek] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const weekOk = week.trim().length >= 1 && week.trim().length <= 40;

  if (slot) return <ImportDocument catalog={slot} />;
  return (
    <Screen>
      <ScreenHeader title={t('catalog.ai.title')} />
      <Text style={typography.secondary}>{t('catalog.ai.intro')}</Text>
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
        <Field label={t('catalog.week')} value={week} onChangeText={setWeek} maxLength={40} placeholder={t('catalog.weekPlaceholder')} error={week.length > 40 ? t('catalog.errors.week') : null} />
      </Card>
      <Button label={t('catalog.import.continue')} disabled={grade === null || !weekOk} onPress={() => grade && setSlot({ country, grade, subject, week: week.trim() })} />
      <Button variant="secondary" label={t('catalog.ai.back')} onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
