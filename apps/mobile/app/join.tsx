import { Redirect, useLocalSearchParams } from 'expo-router';

/** Lien profond `taskmate://join?code=…` → écran de jointure. */
export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <Redirect href={{ pathname: '/onboarding/join', params: code ? { code } : {} }} />;
}
