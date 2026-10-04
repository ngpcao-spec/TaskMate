import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addChildWithAccount, ChildAccountError } from '@/api/childAccounts';
import { queryKeys } from '@/api/keys';
import { ChildCredentialsCard } from '@/components/ChildCredentialsCard';
import { CHILD_PALETTE, ChildProfileFields, isChildProfileValid } from '@/components/ChildProfileFields';
import { Button, Card, ErrorText, Field, Screen, ScreenHeader } from '@/components/ui';
import { CHILD_PASSWORD_MIN, validateChildPassword, validateLoginId } from '@/domain/child-account';
import { todayInTz } from '@/domain/family-time';
import { useMe } from '@/hooks/useMe';
import { useSessionStore } from '@/store/session';

type Created = { id: string; name: string; loginId: string; password: string };

/** Ajouter un enfant après l'onboarding : PARENT uniquement (route protégée comme task/new), profil + compte de connexion. */
export default function AddChildScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const select = useSessionStore((s) => s.setDisplayedChildId);
  const me = useMe().data;
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [color, setColor] = useState<string>(CHILD_PALETTE[0]);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  if (!me) return null;
  if (me.member.role !== 'parent') return <Redirect href="/" />;

  const today = todayInTz(new Date(), me.family.timezone);
  const loginIdError = loginId === '' ? null : validateLoginId(loginId);
  const passwordError = password === '' ? null : validateChildPassword(password);
  const valid = isChildProfileValid(name, birthDate, today) && loginId !== '' && loginIdError === null && password !== '' && passwordError === null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const child = await addChildWithAccount(me.family.id, { name: name.trim(), birthDate, color, sortOrder: me.children.length }, loginId, password);
      setCreated({ id: child.id, name: child.name, loginId: loginId.trim().toLowerCase(), password });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.me, refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['child-accounts'] }),
      ]);
    } catch (e) {
      setError(e instanceof ChildAccountError ? t(`childAccount.errors.${e.code}`, { min: CHILD_PASSWORD_MIN }) : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <Screen>
        <ScreenHeader title={t('addChild.createdTitle', { name: created.name })} hideBack />
        <ChildCredentialsCard childName={created.name} loginId={created.loginId} password={created.password} />
        <Button
          label={t('common.done')}
          onPress={() => {
            select(created.id);
            router.replace('/more');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('addChild.title')} onBack={() => router.back()} />
      <Card>
        <ChildProfileFields name={name} onName={setName} birthDate={birthDate} onBirthDate={setBirthDate} color={color} onColor={setColor} today={today} />
        <Field
          label={t('childAccount.loginId')}
          value={loginId}
          onChangeText={setLoginId}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={60}
          error={loginIdError ? t(`childAccount.loginIdErrors.${loginIdError}`) : null}
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
        <ErrorText>{error}</ErrorText>
        <Button label={t('addChild.submit')} onPress={() => void submit()} loading={busy} disabled={!valid} />
      </Card>
    </Screen>
  );
}
