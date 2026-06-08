/**
 * TheSwitch — theme tokens & application.
 *
 * Each {@link Skin} maps to a coherent, deliberately-distinct set of CSS custom
 * properties. Applying a skin writes those variables onto a host element
 * (default `documentElement`) plus a `data-atmos-skin` attribute, so consumers
 * can style purely in CSS — and the whole page re-skins from the root.
 *
 * No network, no innerHTML, no framework — just `setProperty` / `setAttribute`.
 */
import type { Skin } from "./atmosphere";
import type { SkinTokens } from "../types";
import { ALL_TOKEN_KEYS } from "./skins";

/** The CSS custom properties every skin defines. */
const TOKEN_KEYS = [
  "--ts-bg",
  "--ts-fg",
  "--ts-surface",
  "--ts-border",
  "--ts-accent",
  "--ts-accent-2",
  "--ts-muted",
  "--ts-overlay",
  "--ts-shadow",
  "--ts-glow",
  "--ts-gradient",
] as const;

/**
 * Built-in token palettes for every skin. Hand-tuned so each mood is clearly
 * different from the next — not just light vs dark, but warm sun, icy snow,
 * blue rain, grey fog, dramatic storm, and deep night.
 *
 * `--ts-gradient` is a ready-to-use page/hero background; `--ts-glow` is an
 * accent-coloured glow for focus rings, haloes, and the HUD.
 */
export const SKIN_PRESETS: Record<Skin, SkinTokens> = {
  light: {
    "--ts-bg": "#f7f9fc",
    "--ts-fg": "#131722",
    "--ts-surface": "#ffffff",
    "--ts-border": "#e3e8f0",
    "--ts-accent": "#2563eb",
    "--ts-accent-2": "#0ea5e9",
    "--ts-muted": "#5b6678",
    "--ts-overlay": "rgba(0, 0, 0, 0.04)",
    "--ts-shadow": "0 6px 20px rgba(20, 40, 80, 0.10)",
    "--ts-glow": "rgba(37, 99, 235, 0.25)",
    "--ts-gradient": "linear-gradient(160deg, #fdfeff 0%, #eef3fb 100%)",
  },
  dark: {
    "--ts-bg": "#0e1116",
    "--ts-fg": "#e8eaed",
    "--ts-surface": "#161a21",
    "--ts-border": "#2a2f3a",
    "--ts-accent": "#6aa6ff",
    "--ts-accent-2": "#8b5cf6",
    "--ts-muted": "#9aa3b2",
    "--ts-overlay": "rgba(255, 255, 255, 0.06)",
    "--ts-shadow": "0 10px 30px rgba(0, 0, 0, 0.6)",
    "--ts-glow": "rgba(106, 166, 255, 0.30)",
    "--ts-gradient": "linear-gradient(160deg, #11151c 0%, #0b0e13 100%)",
  },
  sunny: {
    "--ts-bg": "#fff7e8",
    "--ts-fg": "#3a2c12",
    "--ts-surface": "#fffdf6",
    "--ts-border": "#f3e0b5",
    "--ts-accent": "#f59e0b",
    "--ts-accent-2": "#fb923c",
    "--ts-muted": "#9a7b46",
    "--ts-overlay": "rgba(245, 158, 11, 0.08)",
    "--ts-shadow": "0 8px 26px rgba(245, 158, 11, 0.22)",
    "--ts-glow": "rgba(245, 158, 11, 0.35)",
    "--ts-gradient": "linear-gradient(160deg, #fff8ea 0%, #ffe9bf 100%)",
  },
  snow: {
    "--ts-bg": "#f1f8ff",
    "--ts-fg": "#16263a",
    "--ts-surface": "#ffffff",
    "--ts-border": "#cfe3f7",
    "--ts-accent": "#3b82f6",
    "--ts-accent-2": "#38bdf8",
    "--ts-muted": "#5a7088",
    "--ts-overlay": "rgba(59, 130, 246, 0.06)",
    "--ts-shadow": "0 8px 26px rgba(59, 130, 246, 0.18)",
    "--ts-glow": "rgba(59, 130, 246, 0.30)",
    "--ts-gradient": "linear-gradient(160deg, #f6fbff 0%, #d9ecfc 100%)",
  },
  windy: {
    "--ts-bg": "#eef4f1",
    "--ts-fg": "#1e2c27",
    "--ts-surface": "#f7faf8",
    "--ts-border": "#cdded7",
    "--ts-accent": "#14b8a6",
    "--ts-accent-2": "#5eead4",
    "--ts-muted": "#56685f",
    "--ts-overlay": "rgba(20, 184, 166, 0.07)",
    "--ts-shadow": "0 8px 24px rgba(20, 184, 166, 0.16)",
    "--ts-glow": "rgba(20, 184, 166, 0.28)",
    "--ts-gradient": "linear-gradient(120deg, #eff6f2 0%, #d7e9e2 100%)",
  },
  watery: {
    "--ts-bg": "#e9f1f8",
    "--ts-fg": "#142532",
    "--ts-surface": "#f4f9fd",
    "--ts-border": "#c0d8e8",
    "--ts-accent": "#0ea5e9",
    "--ts-accent-2": "#38bdf8",
    "--ts-muted": "#4f6a7d",
    "--ts-overlay": "rgba(14, 165, 233, 0.08)",
    "--ts-shadow": "0 8px 26px rgba(14, 165, 233, 0.20)",
    "--ts-glow": "rgba(14, 165, 233, 0.32)",
    "--ts-gradient": "linear-gradient(160deg, #eef5fb 0%, #cfe2f0 100%)",
  },
  foggy: {
    "--ts-bg": "#eceef1",
    "--ts-fg": "#2f343a",
    "--ts-surface": "#f4f6f8",
    "--ts-border": "#d6dadf",
    "--ts-accent": "#64748b",
    "--ts-accent-2": "#94a3b8",
    "--ts-muted": "#767d86",
    "--ts-overlay": "rgba(100, 116, 139, 0.08)",
    "--ts-shadow": "0 4px 18px rgba(0, 0, 0, 0.08)",
    "--ts-glow": "rgba(100, 116, 139, 0.22)",
    "--ts-gradient": "linear-gradient(180deg, #eef0f3 0%, #dfe3e7 100%)",
  },
  stormy: {
    "--ts-bg": "#0c0f17",
    "--ts-fg": "#dde2ec",
    "--ts-surface": "#141926",
    "--ts-border": "#2b3346",
    "--ts-accent": "#818cf8",
    "--ts-accent-2": "#a78bfa",
    "--ts-muted": "#8a93a8",
    "--ts-overlay": "rgba(129, 140, 248, 0.10)",
    "--ts-shadow": "0 14px 40px rgba(0, 0, 0, 0.7)",
    "--ts-glow": "rgba(129, 140, 248, 0.40)",
    "--ts-gradient": "linear-gradient(160deg, #121826 0%, #0a0d14 100%)",
  },
  night: {
    "--ts-bg": "#0a0d18",
    "--ts-fg": "#dfe4f2",
    "--ts-surface": "#121829",
    "--ts-border": "#283150",
    "--ts-accent": "#a78bfa",
    "--ts-accent-2": "#60a5fa",
    "--ts-muted": "#7c89a8",
    "--ts-overlay": "rgba(167, 139, 250, 0.09)",
    "--ts-shadow": "0 12px 36px rgba(0, 0, 0, 0.66)",
    "--ts-glow": "rgba(167, 139, 250, 0.36)",
    "--ts-gradient": "linear-gradient(160deg, #10162b 0%, #080b16 100%)",
  },
};

/** Stable id for the (optional) transition <style> element we manage. */
const TRANSITION_STYLE_ID = "the-switch-transition";

/**
 * CSS applied while transitions are enabled. Scoped to the token-driven
 * properties so a skin change cross-fades the whole page smoothly.
 */
const TRANSITION_CSS =
  ":root, [data-atmos-skin] {" +
  " transition: background-color 0.7s ease, color 0.7s ease," +
  " border-color 0.7s ease, box-shadow 0.7s ease, fill 0.7s ease; }";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Ensure (or remove) the single transition <style> element. We manage exactly
 * one element keyed by {@link TRANSITION_STYLE_ID} to avoid duplicates.
 */
function manageTransitionStyle(enable: boolean): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(TRANSITION_STYLE_ID);
  if (!enable) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  const style = document.createElement("style");
  style.id = TRANSITION_STYLE_ID;
  style.textContent = TRANSITION_CSS;
  document.head.appendChild(style);
}

/**
 * Apply a {@link Skin} to a host element by writing its CSS variables and the
 * `data-atmos-skin` attribute. User `presets` are merged over the built-ins.
 *
 * @param skin The skin to apply.
 * @param el   Host element. Defaults to `document.documentElement`.
 * @param opts `transition` enables smooth animation (unless prefers-reduced-motion);
 *             `presets` overrides individual tokens per skin.
 */
export function applyTheme(
  skin: Skin,
  el: HTMLElement = typeof document !== "undefined"
    ? document.documentElement
    : (undefined as unknown as HTMLElement),
  opts: {
    transition?: boolean;
    presets?: Partial<Record<Skin, SkinTokens>>;
  } = {},
): void {
  if (!el) return;

  const tokens: SkinTokens = {
    ...SKIN_PRESETS[skin],
    ...(opts.presets?.[skin] ?? {}),
  };

  manageTransitionStyle(opts.transition === true && !prefersReducedMotion());

  for (const [key, value] of Object.entries(tokens)) {
    el.style.setProperty(key, value);
  }
  el.setAttribute("data-atmos-skin", skin);
}

/**
 * Apply an arbitrary token map (e.g. a registered named skin) to a host element,
 * with the same transition handling as {@link applyTheme}.
 */
export function applyTokens(
  skinId: string,
  tokens: Record<string, string>,
  el: HTMLElement = typeof document !== "undefined"
    ? document.documentElement
    : (undefined as unknown as HTMLElement),
  opts: { transition?: boolean } = {},
): void {
  if (!el) return;
  manageTransitionStyle(opts.transition === true && !prefersReducedMotion());
  for (const [key, value] of Object.entries(tokens)) {
    el.style.setProperty(key, value);
  }
  el.setAttribute("data-atmos-skin", skinId);
}

/**
 * Remove all TheSwitch CSS variables, the `data-atmos-skin` attribute, and the
 * managed transition <style> element from an element.
 *
 * @param el Host element. Defaults to `document.documentElement`.
 */
export function clearTheme(
  el: HTMLElement = typeof document !== "undefined"
    ? document.documentElement
    : (undefined as unknown as HTMLElement),
): void {
  if (!el) return;
  for (const key of ALL_TOKEN_KEYS) {
    el.style.removeProperty(key);
  }
  el.removeAttribute("data-atmos-skin");
  manageTransitionStyle(false);
}
