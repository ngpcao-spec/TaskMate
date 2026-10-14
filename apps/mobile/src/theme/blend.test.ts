import { solidTint } from './blend';

describe('solidTint', () => {
  it('mélange la couleur à l’opacité donnée sur le fond, en hex opaque', () => {
    expect(solidTint('#000000', 0.5, '#FFFFFF')).toBe('#808080');
    expect(solidTint('#FF0000', 1, '#0000FF')).toBe('#FF0000');
    expect(solidTint('#FF0000', 0, '#0000FF')).toBe('#0000FF');
    expect(solidTint('#8FC4F0', 0.2, '#3B556E')).toMatch(/^#[0-9A-F]{6}$/);
  });
});
