import { useScreenFocused } from '@/hooks/useScreenFocused';
import { Field, type FieldProps } from '@/components/ui';

type Props = Omit<FieldProps, 'secureTextEntry' | 'autoComplete'> & {
  /** `current-password` : connexion ; `new-password` : création ou réinitialisation (jamais une proposition de mot de passe déjà enregistré). */
  autoComplete: 'current-password' | 'new-password';
};

/**
 * Seul champ mot de passe de l'application. Il n'existe dans le DOM que pendant que son écran est AFFICHÉ : un écran resté monté sous un autre (pile de navigation,
 * onglet masqué) n'en garde aucun. Sinon iOS (PWA Safari) propose « Remplir le mot de passe de … » en pleine utilisation, sur un écran sans mot de passe (D-093).
 * La saisie vit dans l'écran parent : elle survit au démontage.
 */
export function PasswordField({ autoComplete, ...props }: Props) {
  const focused = useScreenFocused();
  if (!focused) return null;
  return <Field {...props} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={autoComplete} />;
}

/** Identifiant de connexion d'un compte enfant (création) : jamais `username` — il ne doit pas être associé à un mot de passe enregistré, ni à l'e-mail du parent. */
export const CHILD_LOGIN_ID_AUTOCOMPLETE = 'off' as const;
