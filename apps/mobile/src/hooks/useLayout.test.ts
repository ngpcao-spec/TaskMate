import { isWideWidth, WIDE_BREAKPOINT } from './useLayout';

describe('mise en page responsive', () => {
  it('bascule en mise en page bureau à partir de 900 px', () => {
    expect(WIDE_BREAKPOINT).toBe(900);
    expect(isWideWidth(899)).toBe(false);
    expect(isWideWidth(900)).toBe(true);
    expect(isWideWidth(1440)).toBe(true);
  });
});
