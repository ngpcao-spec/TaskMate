import {
  LOGIN_ID_REGEX,
  normalizeLoginId,
  toChildAccountError,
  validateChildPassword,
  validateLoginId,
  validateParentPassword,
  isValidEmail,
} from '@/domain/child-account';
import * as server from '../../../supabase/functions/_shared/child-accounts';

describe('identifiant enfant', () => {
  it('normalise : minuscules, sans accents ni đ, sans espaces autour', () => {
    expect(normalizeLoginId('  Minh.Nguyễn ')).toBe('minh.nguyen');
    expect(normalizeLoginId('ĐỨC')).toBe('duc');
    expect(normalizeLoginId('Lan_2012')).toBe('lan_2012');
  });
  it('valide longueur, caractères et début', () => {
    expect(validateLoginId('minh')).toBeNull();
    expect(validateLoginId('  Lan.Hà  ')).toBeNull();
    expect(validateLoginId('')).toBe('required');
    expect(validateLoginId('ab')).toBe('tooShort');
    expect(validateLoginId('a'.repeat(31))).toBe('tooLong');
    expect(validateLoginId('minh nguyen')).toBe('invalidChars');
    expect(validateLoginId('minh@mail')).toBe('invalidChars');
    expect(validateLoginId('.minh')).toBe('invalidStart');
    expect(validateLoginId('-minh')).toBe('invalidStart');
  });
});

describe('mots de passe', () => {
  it('parent : 8 caractères minimum ; enfant : 6', () => {
    expect(validateParentPassword('1234567')).toBe('tooShort');
    expect(validateParentPassword('12345678')).toBeNull();
    expect(validateChildPassword('12345')).toBe('tooShort');
    expect(validateChildPassword('123456')).toBeNull();
    expect(validateChildPassword('')).toBe('required');
  });
  it('refuse plus de 72 octets (limite bcrypt)', () => {
    expect(validateParentPassword('a'.repeat(72))).toBeNull();
    expect(validateParentPassword('a'.repeat(73))).toBe('tooLong');
    expect(validateParentPassword('é'.repeat(37))).toBe('tooLong'); // 74 octets
  });
  it('e-mail du parent', () => {
    expect(isValidEmail(' ba@example.com ')).toBe(true);
    expect(isValidEmail('ba@example')).toBe(false);
  });
});

describe('parité client ↔ Edge Functions ↔ SQL', () => {
  const samples = ['minh', ' Lan.Hà ', 'ĐỨC', 'a', 'ab', 'abc', 'a'.repeat(30), 'a'.repeat(31), 'x y', 'x@y', '.abc', 'a-b_c.d', '--x', ''];
  it.each(samples)('même verdict pour « %s »', (raw) => {
    const clientOk = validateLoginId(raw) === null;
    const serverOk = server.isValidLoginId(server.normalizeLoginId(raw));
    expect(serverOk).toBe(clientOk);
    expect(server.normalizeLoginId(raw)).toBe(normalizeLoginId(raw));
  });
  it('mêmes constantes', () => {
    expect(server.LOGIN_ID_REGEX.source).toBe(LOGIN_ID_REGEX.source);
    expect(server.CHILD_PASSWORD_MIN).toBe(6);
    expect(server.PASSWORD_MAX).toBe(72);
  });
});

describe('codes d\'erreur', () => {
  it('inconnu = server_error', () => {
    expect(toChildAccountError('identifier_taken')).toBe('identifier_taken');
    expect(toChildAccountError('boom')).toBe('server_error');
    expect(toChildAccountError(undefined)).toBe('server_error');
  });
});
