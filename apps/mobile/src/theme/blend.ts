/** Couleur opaque « fg à `alpha` posée sur `base` » (hex #RRGGBB) : une teinte qui ne laisse pas voir le motif de fond des thèmes illustrés. */
export function solidTint(fg: string, alpha: number, base: string): string {
  const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [f, b] = [rgb(fg), rgb(base)];
  const mix = f.map((v, i) => Math.round(v * alpha + (b[i] as number) * (1 - alpha)));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
