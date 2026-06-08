/**
 * TheSwitch — the atmosphere engine.
 *
 * One config turns normal theme switching into a full visual system: named
 * cinematic skins (palette + gradient + glow + ambient), an optional weather
 * "auto" mode, cinematic transitions, intensity, persistence, and `autoBind`
 * for `data-switch-*` controls. Privacy-first: with no opt-in it makes ZERO
 * network calls. Framework adapters wrap this class.
 */
import {
  applyAtmosphere,
  detectAtmosphere,
  deriveSkin,
  type Atmosphere,
  type AtmosphereOptions,
  type Skin,
} from "./atmosphere";
import { applyTheme, applyTokens, clearTheme } from "./theme";
import {
  DEFAULT_ROTATION,
  getSkinDef,
  hasSkin,
  registerSkin,
  tokensFor,
  type AmbientType,
  type Intensity,
  type SkinDef,
  type TransitionType,
} from "./skins";
import { runTransition } from "./transitions";
import {
  createWidget,
  type AtmosphereInfo,
  type WidgetHandle,
} from "../ui/widget";
import {
  createClimate,
  type ClimateHandle,
  type ClimateIntensity,
  type ClimateScene,
} from "../ui/climate";
import type {
  Mode,
  SkinTokens,
  TheSwitchOptions as BaseOptions,
  WidgetOptions,
} from "../types";

export type { Mode } from "../types";

/** Where the floating widget anchors within the viewport. */
export type Position = NonNullable<WidgetOptions["position"]>;

export interface TheSwitchOptions extends BaseOptions {
  /** Alias of {@link BaseOptions.root} — the element to theme. */
  target?: HTMLElement;
  /** Widget corner; shorthand for `widget: { position }`. */
  position?: Position;
  /** Opt-in live weather as a nested config (alias of useGeolocation + location). */
  weather?: { enabled?: boolean; provider?: string; location?: { lat: number; lon: number } };
}

/** A snapshot of the engine's reactive state, broadcast to subscribers. */
export interface TheSwitchState {
  skin: string | null;
  mode: Mode;
  liveWeather: boolean;
  intensity: Intensity;
  atmosphere: Atmosphere | null;
}

export type Unsubscribe = () => void;

const DEFAULT_REFRESH_MINUTES = 15;
const STORAGE_KEY_MODE = "the-switch:mode";
const STORAGE_KEY_SKIN = "the-switch:skin";

const WEATHER_SKINS = new Set<string>([
  "light", "dark", "sunny", "snow", "windy", "watery", "foggy", "stormy", "night",
]);

/** Map a skin's ambient type to a realistic climate scene. */
const TYPE_TO_SCENE: Record<AmbientType, ClimateScene> = {
  sun: "rays", snow: "snow", rain: "rain", storm: "rain", fog: "fog",
  stars: "stars", waves: "waves", wind: "clear", aurora: "stars", none: "clear",
};
const AMBIENT_ICON: Record<AmbientType, string> = {
  stars: "🌌", snow: "❄️", rain: "🌧️", storm: "⛈️", fog: "🌫️",
  wind: "🌬️", sun: "☀️", aurora: "🌠", waves: "🌊", none: "🎨",
};
/** Map a weather/forced skin to a climate scene. */
const WEATHER_TO_SCENE: Record<string, ClimateScene> = {
  night: "stars", dark: "clear", light: "clear", sunny: "rays",
  snow: "snow", watery: "rain", windy: "clear", foggy: "fog", stormy: "rain",
};

function sceneForSkin(def: SkinDef): ClimateScene {
  return TYPE_TO_SCENE[def.ambient?.type ?? "none"];
}
function weatherToScene(skin: Skin): ClimateScene {
  return WEATHER_TO_SCENE[skin] ?? "clear";
}
function iconForAmbient(def: SkinDef): string {
  return AMBIENT_ICON[def.ambient?.type ?? "none"];
}
function mapIntensity(i: Intensity): ClimateIntensity {
  return i === "subtle" ? "subtle" : i === "cinematic" ? "vivid" : "normal";
}

function readStored(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* storage blocked — ignore */
  }
}

export class TheSwitch {
  static readonly version = "0.1.0";
  static readonly detectAtmosphere = detectAtmosphere;
  /** Factory: `TheSwitch.create({...})` === `createSwitch({...})`. */
  static readonly create = createSwitch;

  private readonly options: TheSwitchOptions;
  private readonly root: HTMLElement | null;
  private readonly transitionsEnabled: boolean;
  private readonly transitionType: TransitionType;
  private readonly transitionDuration: number;
  private readonly ambientEnabled: boolean;
  private readonly presets?: Partial<Record<Skin, SkinTokens>>;
  private readonly refreshMs: number;
  private readonly storageEnabled: boolean;
  private readonly rotation: string[];
  private readonly onChange?: (skin: SkinDef) => void;
  private readonly autoSource: "system" | "time" | "weather";
  private readonly lat?: number;
  private readonly lng?: number;

  private mode_: Mode;
  private useGeolocation_: boolean;
  private intensity_: Intensity;
  private skin_: string | null = null;
  /** The active forced/named skin id, or null when in weather-auto/forced mode. */
  private manualSkin_: string | null = null;
  private atmosphere_: Atmosphere | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  private widget: WidgetHandle | null = null;
  private climate: ClimateHandle | null = null;
  private abort: AbortController | null = null;
  private started = false;
  private destroyed = false;
  private refreshSeq = 0;
  private applySeq = 0;
  private unbindControls: (() => void) | null = null;
  private unwatchScheme: (() => void) | null = null;

  private readonly subscribers = new Set<(state: TheSwitchState) => void>();
  private readonly onVisibility = (): void => this.handleVisibility();

  constructor(options: TheSwitchOptions = {}) {
    this.options = options;
    this.root = options.root ?? options.target ?? null;
    this.presets = options.presets;
    this.storageEnabled = options.storage !== false;
    this.onChange = options.onChange;

    // Transition config (boolean | { type, duration }).
    const tr = options.transition;
    if (tr === false) {
      this.transitionsEnabled = false;
      this.transitionType = "none";
      this.transitionDuration = 0;
    } else if (tr === true || tr === undefined) {
      this.transitionsEnabled = true;
      this.transitionType = "fade";
      this.transitionDuration = 700;
    } else {
      this.transitionsEnabled = true;
      this.transitionType = tr.type ?? "fade";
      this.transitionDuration = tr.duration ?? 700;
    }

    // Ambient config (boolean | { enabled, intensity }).
    const amb = options.ambient;
    const ambObj = typeof amb === "object" && amb !== null ? amb : null;
    // Effects are OFF by default (professional). Opt in with ambient:true / { enabled:true }.
    this.ambientEnabled = amb === true ? true : ambObj ? ambObj.enabled === true : false;
    this.intensity_ = options.intensity ?? ambObj?.intensity ?? "normal";

    const minutes =
      typeof options.refreshMinutes === "number" && options.refreshMinutes > 0
        ? options.refreshMinutes
        : DEFAULT_REFRESH_MINUTES;
    this.refreshMs = minutes * 60_000;

    // Register any custom skins before resolving the rotation.
    if (options.customSkins) for (const s of options.customSkins) registerSkin(s);
    const wanted = options.skins ?? DEFAULT_ROTATION;
    const rotation = wanted.filter((id) => hasSkin(id));
    this.rotation = rotation.length ? rotation : DEFAULT_ROTATION;

    // Weather config (nested form maps onto useGeolocation + coords).
    const w = options.weather;
    this.useGeolocation_ = options.useGeolocation === true || w?.enabled === true;
    this.lat = options.latitude ?? w?.location?.lat;
    this.lng = options.longitude ?? w?.location?.lon;
    this.autoSource = options.auto ?? "time";

    this.mode_ = (this.storageEnabled ? (readStored(STORAGE_KEY_MODE) as Mode | null) : null) ?? options.mode ?? "auto";
    if (this.mode_ !== "auto" && this.mode_ !== "light" && this.mode_ !== "dark") {
      this.mode_ = "auto";
    }

    // Resolve the initial named skin: persisted > defaultSkin.
    const stored = this.storageEnabled ? readStored(STORAGE_KEY_SKIN) : null;
    const initialSkin = (stored && hasSkin(stored)) ? stored
      : (options.defaultSkin && hasSkin(options.defaultSkin)) ? options.defaultSkin
      : null;
    this.manualSkin_ = initialSkin;
  }

  // ---- Reactive state -------------------------------------------------------

  get skin(): string | null { return this.skin_; }
  get mode(): Mode { return this.mode_; }
  get liveWeather(): boolean { return this.useGeolocation_; }
  get intensity(): Intensity { return this.intensity_; }

  /** The active skin's definition, if it's a registered named skin. */
  getSkin(): SkinDef | null {
    return this.skin_ ? getSkinDef(this.skin_) ?? null : null;
  }

  getState(): TheSwitchState {
    return {
      skin: this.skin_,
      mode: this.mode_,
      liveWeather: this.useGeolocation_,
      intensity: this.intensity_,
      atmosphere: this.atmosphere_,
    };
  }

  subscribe(listener: (state: TheSwitchState) => void): Unsubscribe {
    this.subscribers.add(listener);
    return () => { this.subscribers.delete(listener); };
  }

  private emit(): void {
    if (this.subscribers.size === 0) return;
    const state = this.getState();
    for (const listener of this.subscribers) listener(state);
  }

  private notifyChange(): void {
    if (!this.onChange || !this.skin_) return;
    const def = getSkinDef(this.skin_);
    if (def) this.onChange(def);
  }

  // ---- Lifecycle ------------------------------------------------------------

  start(): this {
    if (this.destroyed || this.started) return this;
    this.started = true;

    if (this.manualSkin_) {
      this.applyNamedSkin(this.manualSkin_, false);
    } else {
      void this.refresh();
    }
    this.mountWidget();
    this.mountClimate();
    this.scheduleRefresh();
    if (this.options.autoBind) this.bindControls();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibility);
    }
    if (
      this.autoSource === "system" &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
    ) {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const onScheme = (): void => {
        if (this.mode_ === "auto" && !this.manualSkin_) {
          this.applyWeatherSkin(this.systemSkin(), null);
          this.emit();
        }
      };
      mql.addEventListener("change", onScheme);
      this.unwatchScheme = () => mql.removeEventListener("change", onScheme);
    }
    return this;
  }

  /** Force a named skin (e.g. "storm"). The headline API. */
  setSkin(id: string): void {
    if (this.destroyed) return;
    if (!hasSkin(id)) {
      // Allow "auto"/light/dark as conveniences that route through setMode.
      if (id === "auto" || id === "light" || id === "dark") { this.setMode(id); return; }
      return;
    }
    this.applyNamedSkin(id, true);
  }

  /** Advance to the next skin in the rotation. */
  nextSkin(): void { this.cycle(1); }
  /** Go to the previous skin in the rotation. */
  prevSkin(): void { this.cycle(-1); }

  private cycle(dir: number): void {
    if (this.rotation.length === 0) return;
    const current = this.manualSkin_ ?? this.skin_;
    let idx = current ? this.rotation.indexOf(current) : -1;
    if (idx === -1) idx = dir > 0 ? -1 : 0;
    const next = this.rotation[(idx + dir + this.rotation.length) % this.rotation.length];
    if (next) this.setSkin(next);
  }

  setMode(mode: Mode): void {
    if (this.destroyed) return;
    this.mode_ = mode;
    this.manualSkin_ = null; // a mode choice exits manual-skin mode
    if (this.storageEnabled) {
      writeStored(STORAGE_KEY_MODE, mode);
      try { localStorage.removeItem(STORAGE_KEY_SKIN); } catch { /* ignore */ }
    }
    this.widget?.setMode(mode);
    if (mode === "light" || mode === "dark") this.applyForcedMode(mode);
    else void this.refresh();
    this.emit();
  }

  /** Set ambient loudness (scales the ambient layer). */
  setIntensity(intensity: Intensity): void {
    if (this.destroyed) return;
    this.intensity_ = intensity;
    this.climate?.setIntensity(mapIntensity(intensity));
    this.emit();
  }

  setLiveWeather(on: boolean): void {
    if (this.destroyed) return;
    if (this.useGeolocation_ === on) return;
    this.useGeolocation_ = on;
    if (!on) this.cancelInflight();
    if (this.mode_ === "auto" && !this.manualSkin_) void this.refresh();
    this.emit();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.refreshSeq++;

    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.cancelInflight();
    this.unbindControls?.();
    this.unbindControls = null;
    this.unwatchScheme?.();
    this.unwatchScheme = null;

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
    }

    this.widget?.destroy();
    this.widget = null;
    this.climate?.destroy();
    this.climate = null;

    clearTheme(this.themingRoot());
    this.subscribers.clear();
  }

  // ---- Internals ------------------------------------------------------------

  private themingRoot(): HTMLElement {
    if (this.root) return this.root;
    return typeof document !== "undefined"
      ? document.documentElement
      : (undefined as unknown as HTMLElement);
  }

  /** Apply a registered named skin (tokens + ambient + transition), latest-wins. */
  private applyNamedSkin(id: string, withTransition: boolean): void {
    const def = getSkinDef(id);
    if (!def) return;
    this.manualSkin_ = id;
    this.atmosphere_ = null;
    const root = this.themingRoot();
    const seq = ++this.applySeq;

    const swap = (): void => {
      // A newer selection superseded this one mid-transition: drop it, so the
      // skin, tokens, glow and ambient never land out of sync or out of order.
      if (seq !== this.applySeq || this.destroyed) return;
      this.skin_ = id;
      applyTokens(id, tokensFor(def), root, { transition: this.transitionsEnabled });
      this.widget?.setSkin(id, def.name, iconForAmbient(def));
      this.widget?.setAtmosphere(null);
      this.climate?.setScene(sceneForSkin(def));
      if (this.storageEnabled) writeStored(STORAGE_KEY_SKIN, id);
      this.emit();
      this.notifyChange();
    };

    if (withTransition && this.transitionsEnabled && this.transitionType !== "none") {
      runTransition(swap, {
        type: def.transition?.type ?? this.transitionType,
        duration: this.transitionDuration,
        color: def.colors.bg,
      });
    } else {
      swap();
    }
  }

  private async refresh(): Promise<void> {
    if (this.destroyed || this.manualSkin_) return;

    if (this.mode_ === "light" || this.mode_ === "dark") {
      this.applyForcedMode(this.mode_);
      return;
    }

    // "auto" resolves by the configured source.
    if (this.autoSource === "system") {
      this.applyWeatherSkin(this.systemSkin(), null);
      this.emit();
      return;
    }
    if (this.autoSource === "time") {
      const opts: AtmosphereOptions = { useGeolocation: false };
      if (this.options.now) opts.now = this.options.now;
      let timeAtmos: Atmosphere | null = null;
      try {
        timeAtmos = await detectAtmosphere(opts);
      } catch {
        timeAtmos = null;
      }
      if (this.destroyed || this.manualSkin_) return;
      this.applyWeatherSkin(timeAtmos ? timeAtmos.theme : "light", null);
      this.emit();
      return;
    }

    // "weather": full location + weather detection (opt-in).
    const seq = ++this.refreshSeq;
    this.cancelInflight();
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    this.abort = controller;
    this.widget?.setBusy(this.useGeolocation_);

    const atmosOpts: AtmosphereOptions = { useGeolocation: this.useGeolocation_ };
    if (this.lat != null) atmosOpts.latitude = this.lat;
    if (this.lng != null) atmosOpts.longitude = this.lng;
    if (this.options.now) atmosOpts.now = this.options.now;

    let atmos: Atmosphere | null = null;
    try { atmos = await detectAtmosphere(atmosOpts); } catch { atmos = null; }

    if (seq !== this.refreshSeq || this.destroyed) return;
    this.abort = null;
    this.widget?.setBusy(false);
    if (!atmos) return;

    const skin = deriveSkin(atmos);
    this.atmosphere_ = atmos;
    this.applyWeatherSkin(skin, atmos);
    this.emit();
  }

  private applyForcedMode(mode: "light" | "dark"): void {
    this.cancelInflight();
    this.atmosphere_ = null;
    this.applyWeatherSkin(mode, null);
  }

  /** Apply a weather/forced skin (the original weather palette path). */
  private applyWeatherSkin(skin: Skin, atmos: Atmosphere | null): void {
    this.skin_ = skin;
    const root = this.themingRoot();
    if (atmos) applyAtmosphere(atmos, root);
    applyTheme(skin, root, {
      transition: this.transitionsEnabled,
      ...(this.presets ? { presets: this.presets } : {}),
    });
    this.widget?.setSkin(skin);
    this.widget?.setAtmosphere(toInfo(atmos));
    this.climate?.setScene(weatherToScene(skin));
  }

  private resolveWidgetOptions(): WidgetOptions | false {
    const w = this.options.widget;
    if (w === false) return false;
    const base: WidgetOptions = typeof w === "object" && w !== null ? { ...w } : {};
    if (base.position === undefined && this.options.position !== undefined) {
      base.position = this.options.position;
    }
    return base;
  }

  private mountWidget(): void {
    if (typeof document === "undefined") return;
    const widgetOpts = this.resolveWidgetOptions();
    if (widgetOpts === false) return;

    const named = this.skin_ ? getSkinDef(this.skin_) : undefined;
    try {
      this.widget = createWidget({
        currentSkin: this.skin_ ?? "light",
        currentLabel: named?.name,
        currentIcon: named ? iconForAmbient(named) : undefined,
        currentMode: this.mode_,
        liveWeather: this.useGeolocation_,
        currentAtmosphere: toInfo(this.atmosphere_),
        onMode: (mode) => this.setMode(mode),
        onLiveWeather: (enabled) => this.setLiveWeather(enabled),
        options: widgetOpts,
      });
    } catch {
      this.widget = null;
    }
  }

  private mountClimate(): void {
    if (!this.ambientEnabled || typeof document === "undefined") return;
    const named = this.skin_ ? getSkinDef(this.skin_) : undefined;
    const scene: ClimateScene = named
      ? sceneForSkin(named)
      : WEATHER_SKINS.has(this.skin_ ?? "")
        ? weatherToScene(this.skin_ as Skin)
        : "clear";
    const accent = named?.colors.primary ?? "#9fb4ff";
    try {
      this.climate = createClimate(scene, { accent, intensity: mapIntensity(this.intensity_) });
    } catch {
      this.climate = null;
    }
  }

  private scheduleRefresh(): void {
    if (typeof setInterval === "undefined") return;
    this.timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void this.refresh();
    }, this.refreshMs);
  }

  private handleVisibility(): void {
    if (typeof document === "undefined") return;
    if (!document.hidden) void this.refresh();
  }

  private systemSkin(): Skin {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }

  private cancelInflight(): void {
    if (this.abort) { this.abort.abort(); this.abort = null; }
  }

  /** Wire `data-switch-*` controls anywhere on the page (event-delegated). */
  private bindControls(): void {
    if (typeof document === "undefined" || this.unbindControls) return;
    const handler = (ev: Event): void => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const skinEl = t.closest<HTMLElement>("[data-switch-skin]");
      if (skinEl) { this.setSkin(skinEl.getAttribute("data-switch-skin") || ""); return; }
      if (t.closest("[data-switch-next]")) { this.nextSkin(); return; }
      if (t.closest("[data-switch-prev]")) { this.prevSkin(); return; }
      const intEl = t.closest<HTMLElement>("[data-switch-intensity]");
      if (intEl) {
        const v = intEl.getAttribute("data-switch-intensity");
        if (v === "subtle" || v === "normal" || v === "cinematic") this.setIntensity(v);
      }
    };
    document.addEventListener("click", handler);
    this.unbindControls = () => document.removeEventListener("click", handler);
  }
}

/** Create and start an atmosphere engine in one call. */
export function createSwitch(options: TheSwitchOptions = {}): TheSwitch {
  return new TheSwitch(options).start();
}

/** Map an atmosphere to the compact info the HUD readout renders. */
function toInfo(atmos: Atmosphere | null): AtmosphereInfo | null {
  if (!atmos) return null;
  return {
    tempC: atmos.tempC,
    weather: atmos.weather,
    daypart: atmos.daypart,
    live: atmos.live,
  };
}

export default TheSwitch;
