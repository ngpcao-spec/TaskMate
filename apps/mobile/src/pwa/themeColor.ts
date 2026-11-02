/** Couleur du navigateur / de la PWA (`<meta name="theme-color">`), web seulement ; sans effet ailleurs. */
export function setThemeColor(color: string): void {
  if (typeof document === 'undefined') return;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}
