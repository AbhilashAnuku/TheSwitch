/**
 * TheSwitch — theme tokens & application.
 *
 * Each {@link Skin} maps to a coherent set of CSS custom properties. Applying a
 * skin writes those variables onto a host element (default `documentElement`)
 * plus a `data-atmos-skin` attribute, so consumers can style purely in CSS.
 *
 * No network, no innerHTML, no framework — just `setProperty` / `setAttribute`.
 */
import type { Skin } from "./atmosphere";
import type { SkinTokens } from "../types";

/** The CSS custom properties every skin defines. */
const TOKEN_KEYS = [
  "--ts-bg",
  "--ts-fg",
  "--ts-surface",
  "--ts-border",
  "--ts-accent",
  "--ts-muted",
  "--ts-overlay",
  "--ts-shadow",
] as const;

/**
 * Built-in token palettes for every skin. Hand-tuned for contrast and a
 * consistent visual language across moods.
 */
export const SKIN_PRESETS: Record<Skin, SkinTokens> = {
  light: {
    "--ts-bg": "#ffffff",
    "--ts-fg": "#1a1a1a",
    "--ts-surface": "#f5f5f7",
    "--ts-border": "#e2e2e6",
    "--ts-accent": "#2563eb",
    "--ts-muted": "#6b7280",
    "--ts-overlay": "rgba(0, 0, 0, 0.04)",
    "--ts-shadow": "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  dark: {
    "--ts-bg": "#0f1115",
    "--ts-fg": "#e8eaed",
    "--ts-surface": "#1a1d23",
    "--ts-border": "#2c2f36",
    "--ts-accent": "#60a5fa",
    "--ts-muted": "#9aa0a6",
    "--ts-overlay": "rgba(255, 255, 255, 0.06)",
    "--ts-shadow": "0 1px 3px rgba(0, 0, 0, 0.6)",
  },
  sunny: {
    "--ts-bg": "#fff9ec",
    "--ts-fg": "#3a2e16",
    "--ts-surface": "#fff2d1",
    "--ts-border": "#f3dca6",
    "--ts-accent": "#f59e0b",
    "--ts-muted": "#a17b3f",
    "--ts-overlay": "rgba(245, 158, 11, 0.08)",
    "--ts-shadow": "0 2px 8px rgba(245, 158, 11, 0.18)",
  },
  snow: {
    "--ts-bg": "#f7fbff",
    "--ts-fg": "#1f2a37",
    "--ts-surface": "#eaf3fb",
    "--ts-border": "#d4e6f4",
    "--ts-accent": "#3b82f6",
    "--ts-muted": "#64748b",
    "--ts-overlay": "rgba(59, 130, 246, 0.06)",
    "--ts-shadow": "0 2px 10px rgba(59, 130, 246, 0.15)",
  },
  windy: {
    "--ts-bg": "#f3f6f4",
    "--ts-fg": "#26302c",
    "--ts-surface": "#e6ece9",
    "--ts-border": "#cfdad5",
    "--ts-accent": "#14b8a6",
    "--ts-muted": "#5f6f69",
    "--ts-overlay": "rgba(20, 184, 166, 0.07)",
    "--ts-shadow": "0 2px 8px rgba(20, 184, 166, 0.14)",
  },
  watery: {
    "--ts-bg": "#eef4f8",
    "--ts-fg": "#1b2a33",
    "--ts-surface": "#dde9f1",
    "--ts-border": "#c2d6e2",
    "--ts-accent": "#0ea5e9",
    "--ts-muted": "#557082",
    "--ts-overlay": "rgba(14, 165, 233, 0.08)",
    "--ts-shadow": "0 2px 10px rgba(14, 165, 233, 0.18)",
  },
  foggy: {
    "--ts-bg": "#eceef0",
    "--ts-fg": "#33373b",
    "--ts-surface": "#e0e3e6",
    "--ts-border": "#cdd1d5",
    "--ts-accent": "#78909c",
    "--ts-muted": "#7a8084",
    "--ts-overlay": "rgba(120, 144, 156, 0.1)",
    "--ts-shadow": "0 1px 6px rgba(0, 0, 0, 0.08)",
  },
  stormy: {
    "--ts-bg": "#15171c",
    "--ts-fg": "#dfe3ea",
    "--ts-surface": "#1f232b",
    "--ts-border": "#343a44",
    "--ts-accent": "#818cf8",
    "--ts-muted": "#8b93a1",
    "--ts-overlay": "rgba(129, 140, 248, 0.1)",
    "--ts-shadow": "0 4px 16px rgba(0, 0, 0, 0.7)",
  },
  night: {
    "--ts-bg": "#0b0e17",
    "--ts-fg": "#dfe4f0",
    "--ts-surface": "#141a28",
    "--ts-border": "#27304a",
    "--ts-accent": "#a78bfa",
    "--ts-muted": "#7b87a3",
    "--ts-overlay": "rgba(167, 139, 250, 0.08)",
    "--ts-shadow": "0 2px 12px rgba(0, 0, 0, 0.65)",
  },
};

/** Stable id for the (optional) transition <style> element we manage. */
const TRANSITION_STYLE_ID = "the-switch-transition";

/** CSS applied while transitions are enabled. Kept minimal and scoped to tokens. */
const TRANSITION_CSS =
  ":root, [data-atmos-skin] {" +
  " transition: background-color 0.6s ease, color 0.6s ease," +
  " border-color 0.6s ease, box-shadow 0.6s ease; }";

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
  for (const key of TOKEN_KEYS) {
    el.style.removeProperty(key);
  }
  el.removeAttribute("data-atmos-skin");
  manageTransitionStyle(false);
}
