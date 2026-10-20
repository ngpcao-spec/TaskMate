import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { addChildWithAccount, ChildAccountError } from '@/api/childAccounts';
import { setChildClass } from '@/api/catalog';
import { queryKeys } from '@/api/keys';
import { Chip } from '@/components/Chip';
import { CHILD_PALETTE, ChildProfileFields, isChildProfileValid } from '@/components/ChildProfileFields';
import { ChildLoginSheet } from '@/components/onboarding/ChildLoginSheet';
import { useStepNav } from '@/components/onboarding/useStepNav';
import { WizardShell } from '@/components/onboarding/WizardShell';
import { gradeText } from '@/components/quiz/subject';
import { Button, Card, ErrorText, Field } from '@/components/ui';
import { COUNTRIES, gradesFor, type Country } from '@/domain/catalog';
import { CHILD_PASSWORD_MIN, normalizeLoginId, validateChildPassword, validateLoginId } from '@/domain/child-account';
import { todayInTz } from '@/domain/family-time';
import { loginIdTaken, type OnboardingFacts } from '@/domain/onboarding';
import { useChildAccounts } from '@/hooks/useFamilyAdmin';
import { useMe } from '@/hooks/useMe';
import { useSessionStore } from '@/store/session';
import { useToastStore } from '@/store/toast';
import { colors, typography } from '@/theme/tokens';

type Created = { id: string; name: string; loginId: string; password: string };

/**
 * Étape 2 — enfants (OBLIGATOIRE : pas de « Bỏ qua » tant qu'aucun enfant n'existe). Création par la voie existante (profil + Edge Function `create-child`),
 * puis fiche de connexion. Le mot de passe n'existe que dans l'état local de cet écran.
 */
export function ChildrenStep({ facts }: { facts: OnboardingFacts }) {
  const { t } = useTranslation();
  const me = useMe().data;
  const nav = useStepNav('children', facts);
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const select = useSessionStore((s) => s.setDisplayedChildId);
  const accounts = useChildAccounts(true);
  const [adding, setAdding] = useState(facts.children.length === 0);
  const [created, setCreated] = useState<Created | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [color, setColor] = useState<string>(CHILD_PALETTE[facts.children.length % CHILD_PALETTE.length] ?? CHILD_PALETTE[0]);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [grade, setGrade] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;

  const today = todayInTz(new Date(), me.family.timezone);
  const taken = loginIdTaken((accounts.data ?? []).map((a) => a.login_id), normalizeLoginId(loginId));
  const loginIdError = loginId === '' ? null : validateLoginId(loginId);
  const passwordError = password === '' ? null : validateChildPassword(password);
  const valid = isChildProfileValid(name, birthDate, today) && loginId !== '' && loginIdError === null && !taken && password !== '' && passwordError === null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const child = await addChildWithAccount(me.family.id, { name: name.trim(), birthDate, color, sortOrder: me.children.length }, loginId, password);
      if (grade) await setChildClass(child.id, country, grade).catch(() => show(t('onboarding.children.classFailed'), 'error'));
      setCreated({ id: child.id, name: child.name, loginId: normalizeLoginId(loginId), password });
      setAdding(false);
      setName('');
      setBirthDate('');
      setLoginId('');
      setPassword('');
      setGrade(null);
      select(child.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.me, refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['child-accounts'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding }),
      ]);
    } catch (e) {
      setError(e instanceof ChildAccountError ? t(`childAccount.errors.${e.code}`, { min: CHILD_PASSWORD_MIN }) : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const another = () => {
    setCreated(null);
    setAdding(true);
    setColor(CHILD_PALETTE[(facts.children.length + 1) % CHILD_PALETTE.length] ?? CHILD_PALETTE[0]);
  };

  return (
    <WizardShell
      number={nav.number}
      total={nav.total}
      title={t('onboarding.children.wizardTitle')}
      subtitle={t('onboarding.children.wizardSubtitle')}
      onNext={nav.goNext}
      nextDisabled={facts.children.length === 0}
      onSkip={nav.skip ? () => void nav.skip?.() : undefined}
      skipLoading={nav.skipping}
      onBack={nav.goBack}
    >
      {facts.children.length > 0 ? (
        <Card>
          <Text accessibilityRole="header" style={styles.section}>{t('onboarding.children.added')}</Text>
          {facts.children.map((c) => (
            <Text key={c.id} accessibilityLabel={t('onboarding.children.addedA11y', { name: c.name })} style={styles.child}>{`✓ ${c.name}`}</Text>
          ))}
        </Card>
      ) : null}

      {created ? (
        <>
          <ChildLoginSheet childName={created.name} loginId={created.loginId} password={created.password} />
          <Button variant="secondary" label={t('onboarding.children.another')} onPress={another} />
        </>
      ) : null}

      {adding && !created ? (
        <Card>
          <ChildProfileFields name={name} onName={setName} birthDate={birthDate} onBirthDate={setBirthDate} color={color} onColor={setColor} today={today} />
          <Field
            label={t('childAccount.loginId')}
            value={loginId}
            onChangeText={(v) => setLoginId(v.replace(/\s/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={60}
            error={loginIdError ? t(`childAccount.loginIdErrors.${loginIdError}`) : taken ? t('childAccount.errors.identifier_taken') : null}
          />
          <Field
            label={t('childAccount.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            error={passwordError ? t('childAccount.errors.weak_password', { min: CHILD_PASSWORD_MIN }) : null}
          />
          <Text style={typography.secondary}>{t('catalog.country')}</Text>
          <View style={styles.wrap}>
            {COUNTRIES.map((c) => (
              <Chip key={c} label={t(`catalog.countries.${c}`)} selected={country === c} onPress={() => { setCountry(c); setGrade(null); }} />
            ))}
          </View>
          <Text style={typography.secondary}>{t('catalog.grade')}</Text>
          <View style={styles.wrap}>
            {gradesFor(country).map((g) => (
              <Chip key={g} label={gradeText(t, country, g)} selected={grade === g} onPress={() => setGrade(grade === g ? null : g)} />
            ))}
          </View>
          <Text style={typography.secondary}>{t('onboarding.children.classHint')}</Text>
          <ErrorText>{error}</ErrorText>
          <Button label={t('addChild.submit')} onPress={() => void submit()} loading={busy} disabled={!valid} />
        </Card>
      ) : null}

      {!adding && !created ? <Button variant="secondary" label={t('onboarding.children.another')} onPress={another} /> : null}
    </WizardShell>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.title, color: colors.text },
  child: { fontSize: 16, fontWeight: '600', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
