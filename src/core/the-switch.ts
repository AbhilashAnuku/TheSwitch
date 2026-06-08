/**
 * TheSwitch — the headless engine.
 *
 * Orchestrates detection (time / season / opt-in weather), skin derivation,
 * theming, the optional on-page widget, and periodic refresh. Privacy-first:
 * with no opt-in it makes ZERO network calls. Framework adapters wrap this
 * class; it owns all DOM, timer, and network lifecycle.
 */
import {
  applyAtmosphere,
  detectAtmosphere,
  deriveSkin,
  type Atmosphere,
  type AtmosphereOptions,
  type Skin,
} from "./atmosphere";
import { applyTheme, clearTheme } from "./theme";
import {
  createWidget,
  type AtmosphereInfo,
  type WidgetHandle,
} from "../ui/widget";
import { createAmbient, type AmbientHandle } from "../ui/ambient";
import type {
  Mode,
  SkinTokens,
  TheSwitchOptions as BaseOptions,
  WidgetOptions,
} from "../types";

export type { Mode } from "../types";

/** Where the floating widget anchors within the viewport. */
export type Position = NonNullable<WidgetOptions["position"]>;

/**
 * Options accepted by {@link TheSwitch}. Extends the public option surface with
 * a couple of ergonomic aliases used by the standalone/Svelte entry points:
 * `target` (alias of `root`) and `position` (top-level widget position).
 */
export interface TheSwitchOptions extends BaseOptions {
  /** Alias of {@link BaseOptions.root} — the element to theme. */
  target?: HTMLElement;
  /** Widget corner; shorthand for `widget: { position }`. */
  position?: Position;
}

/** A snapshot of the engine's reactive state, broadcast to subscribers. */
export interface TheSwitchState {
  /** The currently applied skin, or null before the first detection settles. */
  skin: Skin | null;
  /** The active mode preference. */
  mode: Mode;
  /** Whether live (location + weather) atmosphere is opted in. */
  liveWeather: boolean;
  /** The full atmosphere snapshot, or null before the first detection. */
  atmosphere: Atmosphere | null;
}

/** A function returned by {@link TheSwitch.subscribe} that detaches the listener. */
export type Unsubscribe = () => void;

/** Default minutes between automatic refreshes. */
const DEFAULT_REFRESH_MINUTES = 15;

const STORAGE_KEY = "the-switch:mode";

function readStoredMode(): Mode | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "auto" || raw === "light" || raw === "dark") return raw;
  } catch {
    /* storage blocked (private mode / SSR) — ignore */
  }
  return null;
}

function writeStoredMode(mode: Mode): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage blocked — ignore */
  }
}

/**
 * The headless adaptive-theming engine.
 *
 * @example
 * const ts = new TheSwitch({ mode: "auto" }).start();
 * ts.setMode("dark");
 * // ...later
 * ts.destroy();
 */
export class TheSwitch {
  /** Library version, surfaced for diagnostics. */
  static readonly version = "0.1.0";

  /** Re-exported for convenience: detect an atmosphere without an engine. */
  static readonly detectAtmosphere = detectAtmosphere;

  private readonly options: TheSwitchOptions;
  private readonly root: HTMLElement | null;
  private readonly transition: boolean;
  private readonly ambientEnabled: boolean;
  private readonly presets?: Partial<Record<Skin, SkinTokens>>;
  private readonly refreshMs: number;

  private mode_: Mode;
  private useGeolocation_: boolean;
  private skin_: Skin | null = null;
  private atmosphere_: Atmosphere | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  private widget: WidgetHandle | null = null;
  private ambient: AmbientHandle | null = null;
  private abort: AbortController | null = null;
  private started = false;
  private destroyed = false;
  private refreshSeq = 0;

  private readonly subscribers = new Set<(state: TheSwitchState) => void>();
  private readonly onVisibility = (): void => this.handleVisibility();

  constructor(options: TheSwitchOptions = {}) {
    this.options = options;
    this.root = options.root ?? options.target ?? null;
    this.transition = options.transition !== false;
    this.ambientEnabled = options.ambient !== false;
    this.presets = options.presets;
    const minutes =
      typeof options.refreshMinutes === "number" && options.refreshMinutes > 0
        ? options.refreshMinutes
        : DEFAULT_REFRESH_MINUTES;
    this.refreshMs = minutes * 60_000;

    this.mode_ = readStoredMode() ?? options.mode ?? "auto";
    this.useGeolocation_ = options.useGeolocation === true;
  }

  // ---- Reactive state -------------------------------------------------------

  /** The currently applied skin, or null before the first detection settles. */
  get skin(): Skin | null {
    return this.skin_;
  }

  /** The active mode preference: "auto" | "light" | "dark". */
  get mode(): Mode {
    return this.mode_;
  }

  /** Whether live (location + weather) atmosphere is opted in. */
  get liveWeather(): boolean {
    return this.useGeolocation_;
  }

  /** A snapshot of the engine's current state. */
  getState(): TheSwitchState {
    return {
      skin: this.skin_,
      mode: this.mode_,
      liveWeather: this.useGeolocation_,
      atmosphere: this.atmosphere_,
    };
  }

  /**
   * Subscribe to state changes. The listener is invoked on every skin/mode/
   * live-weather change (not immediately). Returns an unsubscribe function.
   */
  subscribe(listener: (state: TheSwitchState) => void): Unsubscribe {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private emit(): void {
    if (this.subscribers.size === 0) return;
    const state = this.getState();
    for (const listener of this.subscribers) listener(state);
  }

  // ---- Lifecycle ------------------------------------------------------------

  /**
   * Start the engine: run the first detection, apply the theme, mount the
   * widget (unless disabled), and schedule periodic refresh. Idempotent.
   */
  start(): this {
    if (this.destroyed || this.started) return this;
    this.started = true;

    void this.refresh();
    this.mountWidget();
    this.mountAmbient();
    this.scheduleRefresh();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibility);
    }
    return this;
  }

  /**
   * Set the theme mode. `light`/`dark` force the matching skin with no weather
   * and no network; `auto` resumes time/season/(opt-in)weather detection. The
   * choice is persisted.
   */
  setMode(mode: Mode): void {
    if (this.destroyed) return;
    this.mode_ = mode;
    writeStoredMode(mode);
    this.widget?.setMode(mode);
    if (mode === "light" || mode === "dark") {
      this.applyForcedMode(mode);
    } else {
      void this.refresh();
    }
    this.emit();
  }

  /**
   * Force a specific skin directly (e.g. a manual theme picker). Overrides
   * detection until the next {@link setMode}. Updates the tokens, the ambient
   * graphics, and the HUD together.
   */
  setSkin(skin: Skin): void {
    if (this.destroyed) return;
    this.cancelInflight();
    this.atmosphere_ = null;
    this.applySkin(skin, null);
    this.emit();
  }

  /**
   * Toggle live weather. Turning it on opts into geolocation/weather (a network
   * request will be made on the next detection); turning it off returns to a
   * fully private, time/season-only atmosphere with no network.
   */
  setLiveWeather(on: boolean): void {
    if (this.destroyed) return;
    if (this.useGeolocation_ === on) return;
    this.useGeolocation_ = on;
    if (!on) this.cancelInflight();
    if (this.mode_ === "auto") {
      void this.refresh();
    }
    this.emit();
  }

  /**
   * Stop the engine: cancel timers and in-flight requests, remove the widget,
   * detach listeners, and clear the applied theme. Safe to call more than once.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.refreshSeq++;

    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.cancelInflight();

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
    }

    this.widget?.destroy();
    this.widget = null;
    this.ambient?.destroy();
    this.ambient = null;

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

  /** Run a detection cycle and apply the result. No-op for forced modes. */
  private async refresh(): Promise<void> {
    if (this.destroyed) return;

    // Forced light/dark never detect (and never touch the network).
    if (this.mode_ === "light" || this.mode_ === "dark") {
      this.applyForcedMode(this.mode_);
      return;
    }

    const seq = ++this.refreshSeq;
    this.cancelInflight();
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    this.abort = controller;
    this.widget?.setBusy(this.useGeolocation_);

    const atmosOpts: AtmosphereOptions = {
      useGeolocation: this.useGeolocation_,
    };
    if (this.options.latitude != null) atmosOpts.latitude = this.options.latitude;
    if (this.options.longitude != null) {
      atmosOpts.longitude = this.options.longitude;
    }
    if (this.options.now) atmosOpts.now = this.options.now;

    let atmos: Atmosphere | null = null;
    try {
      atmos = await detectAtmosphere(atmosOpts);
    } catch {
      atmos = null;
    }

    // A newer refresh (or destroy) superseded this one — drop the result.
    if (seq !== this.refreshSeq || this.destroyed) return;
    this.abort = null;
    this.widget?.setBusy(false);
    if (!atmos) return;

    const skin = deriveSkin(atmos);
    this.atmosphere_ = atmos;
    this.applySkin(skin, atmos);
    this.emit();
  }

  /** Apply a forced light/dark skin without any detection or network. */
  private applyForcedMode(mode: "light" | "dark"): void {
    this.cancelInflight();
    this.atmosphere_ = null;
    this.applySkin(mode, null);
  }

  private applySkin(skin: Skin, atmos: Atmosphere | null): void {
    this.skin_ = skin;
    const root = this.themingRoot();
    if (atmos) applyAtmosphere(atmos, root);
    applyTheme(skin, root, {
      transition: this.transition,
      ...(this.presets ? { presets: this.presets } : {}),
    });
    this.widget?.setSkin(skin);
    this.widget?.setAtmosphere(toInfo(atmos));
    this.ambient?.setSkin(skin);
  }

  private resolveWidgetOptions(): WidgetOptions | false {
    const w = this.options.widget;
    if (w === false) return false;
    const base: WidgetOptions =
      typeof w === "object" && w !== null ? { ...w } : {};
    if (base.position === undefined && this.options.position !== undefined) {
      base.position = this.options.position;
    }
    return base;
  }

  private mountWidget(): void {
    if (typeof document === "undefined") return;
    const widgetOpts = this.resolveWidgetOptions();
    if (widgetOpts === false) return;

    try {
      this.widget = createWidget({
        currentSkin: this.skin_ ?? "light",
        currentMode: this.mode_,
        liveWeather: this.useGeolocation_,
        currentAtmosphere: toInfo(this.atmosphere_),
        onMode: (mode) => this.setMode(mode),
        onLiveWeather: (enabled) => this.setLiveWeather(enabled),
        options: widgetOpts,
      });
    } catch {
      // Widget is best-effort; the engine still themes the page without it.
      this.widget = null;
    }
  }

  /** Mount the ambient graphics layer (unless disabled). Best-effort. */
  private mountAmbient(): void {
    if (!this.ambientEnabled || typeof document === "undefined") return;
    try {
      this.ambient = createAmbient(this.skin_ ?? "light");
    } catch {
      this.ambient = null;
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
    // Catch up immediately when the tab becomes visible again.
    if (!document.hidden) void this.refresh();
  }

  private cancelInflight(): void {
    if (this.abort) {
      this.abort.abort();
      this.abort = null;
    }
  }
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
