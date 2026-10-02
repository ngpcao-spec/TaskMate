import { COMMON_TIMEZONES, isValidTimeZone } from './timezone';

describe('isValidTimeZone', () => {
  it('accepte les fuseaux IANA', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    for (const tz of COMMON_TIMEZONES) expect(isValidTimeZone(tz)).toBe(true);
  });
  it('refuse le reste', () => {
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone(' UTC')).toBe(false);
  });
});
