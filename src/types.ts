/**
 * TheSwitch — public type surface.
 *
 * Central, framework-agnostic types shared by the core engine, providers, and
 * (optional) framework adapters. Re-exports the atmosphere types so consumers
 * can import everything from a single entry point.
 */
export type {
  Atmosphere,
  AtmosphereOptions,
  Daypart,
  Season,
  Weather,
  Skin,
} from "./core/atmosphere";

import type { Skin } from "./core/atmosphere";

/**
 * How TheSwitch chooses a theme:
 * - `auto`  — derive from time / season / (opt-in) weather.
 * - `light` — force the light skin, no weather, no network.
 * - `dark`  — force the dark skin, no weather, no network.
 */
export type Mode = "auto" | "light" | "dark";

/** A bag of CSS custom-property values (e.g. `{ "--ts-bg": "#fff" }`). */
export type SkinTokens = Record<string, string>;

/** Floating widget configuration. */
export interface WidgetOptions {
  /** Where the widget anchors within the viewport. Default `bottom-right`. */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** When true, the widget reflects live weather (requires opt-in geolocation). */
  liveWeather?: boolean;
}

/** Options accepted by {@link TheSwitch}. */
export interface TheSwitchOptions {
  /** Theme mode. Default `auto`. */
  mode?: Mode;
  /** Explicit latitude (skips geolocation prompt when paired with longitude). */
  latitude?: number;
  /** Explicit longitude (skips geolocation prompt when paired with latitude). */
  longitude?: number;
  /** Opt-in to browser geolocation + live weather. Default false (fully private). */
  useGeolocation?: boolean;
  /** Minutes between automatic refreshes. Default 15. */
  refreshMinutes?: number;
  /** Fixed clock to use instead of `new Date()` (testing / SSR). */
  now?: Date;
  /** Element to apply CSS variables + data attributes to. Default documentElement. */
  root?: HTMLElement;
  /** Mount the floating widget. `false` to disable, or pass {@link WidgetOptions}. */
  widget?: boolean | WidgetOptions;
  /** Per-skin token overrides merged over the built-in presets. */
  presets?: Partial<Record<Skin, SkinTokens>>;
  /** Animate transitions between skins (respects prefers-reduced-motion). Default true. */
  transition?: boolean;
}
