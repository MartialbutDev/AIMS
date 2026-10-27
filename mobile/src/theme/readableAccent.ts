/** Preserve category colors while lifting dark icons to a readable contrast. */
export function readableAccent(color: string, background: string): string {
  const rgb = (hex: string) => /^#[\da-f]{6}$/i.test(hex)
    ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : null;
  const source = rgb(color), surface = rgb(background);
  if (!source || !surface) return '#BCC5DA';
  const luminance = (values: number[]) => values.map(v => {
    const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const base = luminance(surface);
  for (let step = 0; step <= 20; step++) {
    const lifted = source.map(v => Math.round(v + (255 - v) * step / 20));
    const value = luminance(lifted);
    if ((Math.max(value, base) + .05) / (Math.min(value, base) + .05) >= 4.5)
      return '#' + lifted.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  return '#FFFFFF';
}
