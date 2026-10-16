import { INTERNAL_CHILD_EMAIL_DOMAIN, parentLoginEmail } from '@/domain/login-info';

describe('e-mail de connexion montré au parent', () => {
  it('l\'e-mail de la session, rogné', () => {
    expect(parentLoginEmail(' ba@example.com ')).toBe('ba@example.com');
  });
  it('absent : rien', () => {
    expect(parentLoginEmail(null)).toBeNull();
    expect(parentLoginEmail(undefined)).toBeNull();
    expect(parentLoginEmail('   ')).toBeNull();
  });
  it('adresse interne d\'un compte enfant : JAMAIS montrée (casse ignorée)', () => {
    expect(INTERNAL_CHILD_EMAIL_DOMAIN).toBe('@child.taskmate.invalid');
    expect(parentLoginEmail('0e4b-uuid@child.taskmate.invalid')).toBeNull();
    expect(parentLoginEmail('X@CHILD.TASKMATE.INVALID')).toBeNull();
  });
});
