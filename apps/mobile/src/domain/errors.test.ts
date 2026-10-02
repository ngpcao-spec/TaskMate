import { isTransientError } from './errors';

describe('isTransientError', () => {
  it.each([
    [{ message: 'Network request failed' }],
    [{ message: 'TypeError: Failed to fetch' }],
    [{ message: 'request timed out' }],
    [{ message: 'oops', status: 503 }],
    [{ message: 'slow down', status: 429 }],
  ])('réseau / serveur : %j → rejouer', (e) => expect(isTransientError(e)).toBe(true));

  it.each([
    [{ message: 'task_not_found', code: 'P0002' }],
    [{ message: 'insufficient_balance' }],
    [{ message: 'forbidden', status: 403 }],
    ['chaîne'],
    [null],
  ])('erreur métier : %j → définitive', (e) => expect(isTransientError(e)).toBe(false));
});
