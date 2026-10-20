import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { setChildClass, setChildSubject } from '@/api/catalog';
import { queryKeys, quizKeys } from '@/api/keys';
import { Chip } from '@/components/Chip';
import { ChildTabs } from '@/components/onboarding/ChildTabs';
import { useStepNav } from '@/components/onboarding/useStepNav';
import { WizardShell } from '@/components/onboarding/WizardShell';
import { gradeText, subjectText } from '@/components/quiz/subject';
import { Button, Card } from '@/components/ui';
import { COUNTRIES, gradesFor, SUBJECTS, type Country } from '@/domain/catalog';
import type { OnboardingChild, OnboardingFacts } from '@/domain/onboarding';
import { useToastStore } from '@/store/toast';
import { kvStorage } from '@/sync/storage';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';
import i18n from '@/i18n';

const defaultedKey = (childId: string) => `taskmate-onboarding-subjects-defaulted-${childId}`;

/**
 * Étape 3 — révisions : onglets par enfant, un interrupteur par matière. Seules les matières qui ont du contenu PUBLIÉ pour (pays, classe) de l'enfant sont
 * activables ; les autres sont grisées « Chưa có nội dung ». Activer = l'écriture existante de `child_subjects` (décalage de semaine 0 : réglage avancé hors assistant).
 * Par défaut tout ce qui est disponible est activé, une seule fois par enfant et par appareil (un parent qui désactive tout n'est pas ré-activé de force).
 */
export function SubjectsStep({ facts }: { facts: OnboardingFacts }) {
  const { t } = useTranslation();
  const nav = useStepNav('subjects', facts);
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const [picked, setPicked] = useState<string | null>(null);
  const child = facts.children.find((c) => c.id === picked) ?? facts.children[0] ?? null;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
    void queryClient.invalidateQueries({ queryKey: quizKeys.all });
  };
  const toggle = useMutation({
    networkMode: 'always',
    mutationFn: ({ childId, subject, active }: { childId: string; subject: string; active: boolean }) => setChildSubject(childId, subject, active),
    onError: () => show(i18n.t('common.error'), 'error'),
    onSettled: refresh,
  });
  const saveClass = useMutation({
    networkMode: 'always',
    mutationFn: ({ childId, country, grade }: { childId: string; country: string; grade: string }) => setChildClass(childId, country, grade),
    onError: () => show(i18n.t('common.error'), 'error'),
    onSettled: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  // « tout activé par défaut » : une fois par enfant et par appareil, seulement quand rien n'est encore activé
  const applied = useRef(new Set<string>());
  useEffect(() => {
    for (const c of facts.children) {
      if (c.subjects.length > 0 || c.available.length === 0 || applied.current.has(c.id) || kvStorage.getItem(defaultedKey(c.id))) continue;
      applied.current.add(c.id);
      kvStorage.setItem(defaultedKey(c.id), '1');
      void Promise.all(c.available.map((s) => setChildSubject(c.id, s, true))).then(refresh, () => show(i18n.t('common.error'), 'error'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts.children]);

  return (
    <WizardShell
      number={nav.number}
      total={nav.total}
      title={t('onboarding.subjects.title')}
      subtitle={t('onboarding.subjects.subtitle')}
      onNext={nav.goNext}
      onSkip={nav.skip ? () => void nav.skip?.() : undefined}
      skipLoading={nav.skipping}
      onBack={nav.goBack}
    >
      <ChildTabs items={facts.children} value={child?.id ?? ''} onChange={setPicked} label={t('onboarding.subjects.tabs')} />
      {child ? (
        child.country && child.grade ? (
          <Card>
            <Text accessibilityRole="header" style={styles.section}>{t('onboarding.subjects.forChild', { name: child.name, grade: gradeText(t, child.country, child.grade) })}</Text>
            {child.available.length === 0 ? <Text style={typography.secondary}>{t('onboarding.subjects.noneForClass')}</Text> : null}
            {SUBJECTS.map((s) => (
              <SubjectRow
                key={s}
                label={subjectText(t, s)}
                available={child.available.includes(s)}
                value={child.subjects.includes(s)}
                onChange={(active) => toggle.mutate({ childId: child.id, subject: s, active })}
              />
            ))}
          </Card>
        ) : (
          <ClassPicker child={child} saving={saveClass.isPending} onSave={(country, grade) => saveClass.mutate({ childId: child.id, country, grade })} />
        )
      ) : null}
    </WizardShell>
  );
}

function SubjectRow({ label, available, value, onChange }: { label: string; available: boolean; value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessible={false}>
      <View style={styles.flex}>
        <Text style={[styles.subject, !available && styles.off]}>{label}</Text>
        {!available ? <Text style={typography.secondary}>{t('onboarding.subjects.noContent')}</Text> : null}
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={available ? label : `${label}, ${t('onboarding.subjects.noContent')}`}
        accessibilityState={{ checked: available && value, disabled: !available }}
        aria-checked={available && value}
        aria-disabled={!available}
        disabled={!available}
        value={available && value}
        onValueChange={(v) => {
          if (available) onChange(v);
        }}
      />
    </View>
  );
}

/** Enfant créé sans classe : pays + classe ici, pour que ses matières puissent être proposées. */
function ClassPicker({ child, saving, onSave }: { child: OnboardingChild; saving: boolean; onSave: (country: Country, grade: string) => void }) {
  const { t } = useTranslation();
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [grade, setGrade] = useState<string | null>(null);
  return (
    <Card>
      <Text accessibilityRole="header" style={styles.section}>{t('onboarding.subjects.needClass', { name: child.name })}</Text>
      <View style={styles.wrap}>
        {COUNTRIES.map((c) => (
          <Chip key={c} label={t(`catalog.countries.${c}`)} selected={country === c} onPress={() => { setCountry(c); setGrade(null); }} />
        ))}
      </View>
      <View style={styles.wrap}>
        {gradesFor(country).map((g) => (
          <Chip key={g} label={gradeText(t, country, g)} selected={grade === g} onPress={() => setGrade(g)} />
        ))}
      </View>
      <Button label={t('catalog.parent.saveClass')} disabled={!grade} loading={saving} onPress={() => grade && onSave(country, grade)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { ...typography.title, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET },
  subject: { fontSize: 16, fontWeight: '600', color: colors.text },
  off: { color: colors.textSecondary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
