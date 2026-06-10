/**
 * TheSwitch — tiny colour math (no dependencies).
 *
 * Used to keep skins legible: compute WCAG contrast ratios and pick a readable
 * foreground for a given background. Shared by the skin token builder (for the
 * `--switch-on-*` tokens) and the contrast test that guards every skin.
 */

export type RGB = [number, number, number];

/** Parse `#rgb`, `#rrggbb`, or `rgb()/rgba()` into [r,g,b] (0–255), or null. */
export function parseColor(input: string): RGB | null {
  const s = input.trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex && hex[1]) {
    let h = hex[1];
    if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i.exec(s);
  if (rgb && rgb[1] && rgb[2] && rgb[3]) {
    return [Math.round(+rgb[1]), Math.round(+rgb[2]), Math.round(+rgb[3])];
  }
  return null;
}

/** Relative luminance per WCAG 2.x (sRGB). */
export function relativeLuminance(rgb: RGB): number {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/**
 * WCAG contrast ratio between two colours (1–21). Unparseable inputs yield 1
 * (worst case), so a bad value can never silently "pass" the guard.
 */
export function contrastRatio(a: string, b: string): number {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return 1;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const NEAR_BLACK = "#0b1020";
const WHITE = "#ffffff";

/**
 * The most readable foreground (near-black or white) over one or more
 * background colours — maximising the *worst* contrast, so text laid over a
 * gradient (e.g. primary→secondary) stays legible across the whole sweep.
 */
export function bestForeground(...backgrounds: string[]): string {
  const worst = (fg: string): number =>
    Math.min(...backgrounds.map((bg) => contrastRatio(fg, bg)));
  return worst(NEAR_BLACK) >= worst(WHITE) ? NEAR_BLACK : WHITE;
}
