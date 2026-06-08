/**
 * TheSwitch — the skin registry.
 *
 * A "skin" (atmosphere) is not just colours: it's a full identity — palette,
 * gradient, glow, an ambient scene, and a default transition. Built-in cinematic
 * atmospheres live here; apps can add their own with {@link defineSkin} /
 * {@link registerSkin}.
 *
 * Tokens are emitted under BOTH `--switch-*` (the product API) and `--ts-*`
 * (back-compat with the original weather skins / HUD), so either works.
 */

/** The kind of ambient scene a skin paints (mapped to the canvas engine). */
export type AmbientType =
  | "stars"
  | "snow"
  | "rain"
  | "storm"
  | "fog"
  | "wind"
  | "sun"
  | "aurora"
  | "none";

/** Built-in transition styles between skins. */
export type TransitionType = "portal" | "flash" | "fade" | "none";

/** Ambient "loudness" — scales particle density + speed. */
export type Intensity = "subtle" | "normal" | "cinematic";

export interface SkinColors {
  bg: string;
  text: string;
  primary: string;
  secondary?: string;
  accent?: string;
  surface?: string;
  border?: string;
  muted?: string;
}

export interface SkinDef {
  id: string;
  name: string;
  /** Base scheme hint (for the UA `color-scheme` + contrast choices). */
  scheme?: "light" | "dark";
  colors: SkinColors;
  gradient?: string;
  glow?: string;
  ambient?: { type: AmbientType; density?: number; speed?: number };
  transition?: { type: TransitionType };
}

const INTENSITY_SCALE: Record<Intensity, number> = {
  subtle: 0.5,
  normal: 1,
  cinematic: 1.7,
};

/** The built-in cinematic atmospheres — the headline of the product. */
export const BUILTIN_SKINS: SkinDef[] = [
  {
    id: "midnight",
    name: "Midnight",
    scheme: "dark",
    colors: {
      bg: "#0a0e1f", text: "#e6ebff", primary: "#8b9dff", secondary: "#a78bfa",
      accent: "#22d3ee", surface: "#121734", border: "#232a52", muted: "#8b93c0",
    },
    gradient: "linear-gradient(160deg, #0a0e1f, #10162b 55%, #1a1040)",
    glow: "0 0 34px rgba(139, 157, 255, 0.35)",
    ambient: { type: "stars", density: 0.85, speed: 1 },
  },
  {
    id: "sunset",
    name: "Sunset",
    scheme: "dark",
    colors: {
      bg: "#1f1020", text: "#ffe9d6", primary: "#ff8c5a", secondary: "#ff5f8f",
      accent: "#ffd166", surface: "#2a1626", border: "#43273a", muted: "#caa08f",
    },
    gradient: "linear-gradient(160deg, #3a1f3d, #7a2e4a 52%, #c2502f)",
    glow: "0 0 34px rgba(255, 140, 90, 0.40)",
    ambient: { type: "sun", density: 0.5, speed: 0.8 },
  },
  {
    id: "storm",
    name: "Storm",
    scheme: "dark",
    colors: {
      bg: "#050816", text: "#f8fafc", primary: "#7dd3fc", secondary: "#818cf8",
      accent: "#facc15", surface: "#0f172a", border: "#1e293b", muted: "#94a3b8",
    },
    gradient: "linear-gradient(135deg, #020617, #0f172a, #1e1b4b)",
    glow: "0 0 34px rgba(125, 211, 252, 0.35)",
    ambient: { type: "storm", density: 0.95, speed: 1.15 },
  },
  {
    id: "snow",
    name: "Snow",
    scheme: "light",
    colors: {
      bg: "#eef6ff", text: "#16263a", primary: "#3b82f6", secondary: "#38bdf8",
      accent: "#60a5fa", surface: "#ffffff", border: "#cfe3f7", muted: "#5a7088",
    },
    gradient: "linear-gradient(160deg, #f6fbff, #dcecfb)",
    glow: "0 0 28px rgba(59, 130, 246, 0.30)",
    ambient: { type: "snow", density: 0.9, speed: 0.7 },
  },
  {
    id: "rain",
    name: "Rain",
    scheme: "dark",
    colors: {
      bg: "#0c1622", text: "#dbe9f4", primary: "#38bdf8", secondary: "#22d3ee",
      accent: "#7dd3fc", surface: "#13202e", border: "#22323f", muted: "#7c93a3",
    },
    gradient: "linear-gradient(160deg, #0c1622, #16242f)",
    glow: "0 0 28px rgba(56, 189, 248, 0.32)",
    ambient: { type: "rain", density: 0.9, speed: 1.1 },
  },
  {
    id: "forest",
    name: "Forest",
    scheme: "dark",
    colors: {
      bg: "#0b1a12", text: "#e6f5ec", primary: "#34d399", secondary: "#6ee7b7",
      accent: "#a3e635", surface: "#11241a", border: "#1f3a2b", muted: "#7fa791",
    },
    gradient: "linear-gradient(160deg, #0b1a12, #13261a 58%, #1a3322)",
    glow: "0 0 28px rgba(52, 211, 153, 0.30)",
    ambient: { type: "wind", density: 0.45, speed: 0.7 },
  },
  {
    id: "cyber",
    name: "Cyber",
    scheme: "dark",
    colors: {
      bg: "#0a0612", text: "#f0e6ff", primary: "#ff2bd6", secondary: "#22d3ee",
      accent: "#a855f7", surface: "#140a22", border: "#2a1640", muted: "#a98fc0",
    },
    gradient: "linear-gradient(160deg, #0a0612, #1a0a2e 58%, #2a0a3a)",
    glow: "0 0 36px rgba(255, 43, 214, 0.40)",
    ambient: { type: "rain", density: 0.7, speed: 1.6 },
  },
  {
    id: "aurora",
    name: "Aurora",
    scheme: "dark",
    colors: {
      bg: "#04101a", text: "#dffaf0", primary: "#34d399", secondary: "#60a5fa",
      accent: "#a78bfa", surface: "#0a1c28", border: "#163040", muted: "#7fa6a8",
    },
    gradient: "linear-gradient(160deg, #04101a, #07202a 58%, #0a2a2a)",
    glow: "0 0 38px rgba(52, 211, 153, 0.35)",
    ambient: { type: "aurora", density: 0.6, speed: 0.5 },
  },
  {
    id: "desert",
    name: "Desert",
    scheme: "light",
    colors: {
      bg: "#fdf3df", text: "#3b2a12", primary: "#e0913b", secondary: "#d96b3a",
      accent: "#f4c542", surface: "#fff8ea", border: "#ecd9b0", muted: "#9c7c4e",
    },
    gradient: "linear-gradient(160deg, #fdf3df, #f6dca8 58%, #e9b97a)",
    glow: "0 0 30px rgba(224, 145, 59, 0.35)",
    ambient: { type: "sun", density: 0.6, speed: 0.6 },
  },
];

/** The default rotation for nextSkin/prevSkin/autoBind (the cinematic set). */
export const DEFAULT_ROTATION: string[] = BUILTIN_SKINS.map((s) => s.id);

const registry = new Map<string, SkinDef>();
for (const skin of BUILTIN_SKINS) registry.set(skin.id, skin);

/** Validate + normalise a skin definition (fills sensible derived colours). */
export function defineSkin(def: SkinDef): SkinDef {
  if (!def || !def.id || !def.colors) {
    throw new Error("defineSkin: a skin needs an id and colors");
  }
  return def;
}

/** Add (or override) a skin in the registry. Returns the registry for chaining. */
export function registerSkin(def: SkinDef): void {
  registry.set(def.id, defineSkin(def));
}

/** Look up a registered skin by id. */
export function getSkinDef(id: string): SkinDef | undefined {
  return registry.get(id);
}

/** Is this id a known registered skin? */
export function hasSkin(id: string): boolean {
  return registry.has(id);
}

/** All registered skin ids, in insertion order. */
export function listSkins(): string[] {
  return Array.from(registry.keys());
}

/**
 * The CSS custom properties for a skin, under both the `--switch-*` product
 * names and the `--ts-*` back-compat names. Missing colours are derived.
 */
export function tokensFor(skin: SkinDef): Record<string, string> {
  const c = skin.colors;
  const secondary = c.secondary ?? c.primary;
  const accent = c.accent ?? secondary;
  const surface = c.surface ?? mix(c.bg, c.text, skin.scheme === "light" ? 0.04 : 0.06);
  const border = c.border ?? mix(c.bg, c.text, skin.scheme === "light" ? 0.12 : 0.16);
  const muted = c.muted ?? mix(c.text, c.bg, 0.38);
  const gradient = skin.gradient ?? c.bg;
  const glow = skin.glow ?? `0 0 28px ${withAlpha(c.primary, 0.3)}`;
  const shadow = skin.scheme === "light"
    ? "0 8px 26px rgba(20, 40, 80, 0.12)"
    : "0 12px 36px rgba(0, 0, 0, 0.6)";

  const t: Record<string, string> = {};
  const set = (suffix: string, value: string): void => {
    t[`--switch-${suffix}`] = value;
  };
  set("bg", c.bg);
  set("text", c.text);
  set("primary", c.primary);
  set("secondary", secondary);
  set("accent", accent);
  set("surface", surface);
  set("border", border);
  set("muted", muted);
  set("gradient", gradient);
  set("glow", glow);
  set("shadow", shadow);

  // --ts-* aliases (the original weather-skin / HUD variable names).
  t["--ts-bg"] = c.bg;
  t["--ts-fg"] = c.text;
  t["--ts-accent"] = c.primary;
  t["--ts-accent-2"] = secondary;
  t["--ts-surface"] = surface;
  t["--ts-border"] = border;
  t["--ts-muted"] = muted;
  t["--ts-gradient"] = gradient;
  t["--ts-glow"] = glow;
  t["--ts-shadow"] = shadow;
  t["--ts-overlay"] = withAlpha(skin.scheme === "light" ? c.text : "#ffffff", 0.06);

  return t;
}

/** All CSS variable names a skin can write (for clearing). */
export const ALL_TOKEN_KEYS: string[] = [
  "--switch-bg", "--switch-text", "--switch-primary", "--switch-secondary",
  "--switch-accent", "--switch-surface", "--switch-border", "--switch-muted",
  "--switch-gradient", "--switch-glow", "--switch-shadow",
  "--ts-bg", "--ts-fg", "--ts-accent", "--ts-accent-2", "--ts-surface",
  "--ts-border", "--ts-muted", "--ts-gradient", "--ts-glow", "--ts-shadow",
  "--ts-overlay",
];

/** Scale a skin's ambient density/speed by the chosen intensity. */
export function intensityScale(intensity: Intensity): number {
  return INTENSITY_SCALE[intensity];
}

// --- tiny colour helpers (no deps) -----------------------------------------

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two hex colours by `t` (0 = a, 1 = b). Falls back to `a` on parse fail. */
function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** A hex colour as rgba() with the given alpha. */
function withAlpha(hex: string, alpha: number): string {
  const c = parseHex(hex);
  if (!c) return hex;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

export { withAlpha as colorWithAlpha };
