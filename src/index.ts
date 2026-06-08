/**
 * TheSwitch — public package entry.
 *
 * Re-exports the headless engine, its types, and the framework-agnostic
 * helpers from core/providers. Framework adapters live in their own
 * subpath entries (`theswitch/react`, `/vue`, `/svelte`) and are not
 * pulled in here so the main bundle stays free of peer deps.
 */
import { TheSwitch, createSwitch } from "./core/the-switch";

export { TheSwitch, createSwitch };
export default TheSwitch;

export type {
  TheSwitchOptions,
  Mode,
  Position,
  TheSwitchState,
  Unsubscribe,
} from "./core/the-switch";

export type {
  Atmosphere,
  AtmosphereOptions,
  Daypart,
  Season,
  Weather,
  Skin,
  SkinName,
} from "./core/atmosphere";

export { detectAtmosphere, applyAtmosphere, deriveSkin } from "./core/atmosphere";

export { applyTheme, clearTheme, SKIN_PRESETS } from "./core/theme";

export { fetchWeather } from "./providers/weather";

export { applyTokens } from "./core/theme";
export { runTransition } from "./core/transitions";

export {
  defineSkin,
  registerSkin,
  getSkinDef,
  hasSkin,
  listSkins,
  tokensFor,
  BUILTIN_SKINS,
  DEFAULT_ROTATION,
} from "./core/skins";

export type {
  SkinDef,
  SkinColors,
  AmbientType,
  TransitionType,
  Intensity,
} from "./core/skins";
