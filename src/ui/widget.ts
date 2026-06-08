/**
 * TheSwitch — the on-page control HUD (UI).
 *
 * A self-contained, Shadow-DOM-isolated glass panel that floats in a corner of
 * the viewport. It shows the current atmosphere (skin + weather + temperature)
 * and lets the visitor pick a theme mode (Auto / Light / Dark) and — strictly
 * opt-in, OFF by default — turn on live weather.
 *
 * Privacy & safety:
 *  - No network here; the widget only renders state and reports intent via the
 *    supplied callbacks. Live weather is a clearly-labelled opt-in toggle.
 *  - DOM is written with textContent / setAttribute only (never innerHTML with
 *    dynamic data), and the whole UI lives inside a Shadow root so host page
 *    styles can't leak in and the widget's styles can't leak out.
 *
 * Theming & a11y:
 *  - Everything is styled via the --ts-* custom properties, so it always matches
 *    the active skin and a host can re-skin it without reaching into the shadow.
 *  - Fully keyboard-operable with a roving radiogroup + ARIA, and honours
 *    prefers-reduced-motion.
 */
import type { Mode, Skin, WidgetOptions } from "../types";

/** Where the panel anchors in the viewport. */
type Position = NonNullable<WidgetOptions["position"]>;

/** A compact, framework-free snapshot the HUD renders in its readout. */
export interface AtmosphereInfo {
  tempC: number | null;
  weather: string | null;
  daypart: string | null;
  live: boolean;
}

const SKIN_LABELS: Record<Skin, string> = {
  light: "Light",
  dark: "Dark",
  sunny: "Sunny",
  snow: "Snow",
  windy: "Windy",
  watery: "Rain",
  foggy: "Fog",
  stormy: "Storm",
  night: "Night",
};

/** A small leading glyph for each {@link Skin}, used purely decoratively. */
const SKIN_ICONS: Record<Skin, string> = {
  light: "☀️",
  dark: "🌙",
  sunny: "☀️",
  snow: "❄️",
  windy: "🌬️",
  watery: "🌧️",
  foggy: "🌫️",
  stormy: "⛈️",
  night: "🌌",
};

const WEATHER_LABELS: Record<string, string> = {
  clear: "Clear",
  clouds: "Cloudy",
  rain: "Rain",
  snow: "Snow",
  storm: "Storm",
  fog: "Fog",
};

const DAYPART_LABELS: Record<string, string> = {
  dawn: "Dawn",
  day: "Day",
  dusk: "Dusk",
  night: "Night",
};

export interface WidgetDeps {
  /** The skin id to show on first paint. */
  currentSkin: string;
  /** Optional display label/icon for the initial skin (used by named skins). */
  currentLabel?: string;
  currentIcon?: string;
  /** The theme mode to show as selected on first paint. */
  currentMode: Mode;
  /** Whether the live-weather toggle starts on. Opt-in: should be false. */
  liveWeather: boolean;
  /** Optional atmosphere snapshot for the readout. */
  currentAtmosphere?: AtmosphereInfo | null;
  /** Called when the visitor picks a theme mode. */
  onMode: (mode: Mode) => void;
  /** Called when the visitor flips the live-weather opt-in. */
  onLiveWeather: (enabled: boolean) => void;
  /** Optional presentation tweaks. */
  options?: WidgetOptions;
}

export interface WidgetHandle {
  /** Update the displayed skin (icon + label). Pass label/icon for named skins. */
  setSkin(skin: string, label?: string, icon?: string): void;
  /** Update the atmosphere readout (weather + temperature). */
  setAtmosphere(info: AtmosphereInfo | null): void;
  /** Update which theme mode is shown as selected. */
  setMode(mode: Mode): void;
  /** Toggle the busy state (e.g. while live weather is being fetched). */
  setBusy(b: boolean): void;
  /** Remove the widget from the page and release listeners. */
  destroy(): void;
}

const HOST_TAG = "the-switch-widget";

/** The selectable modes, in display order. */
const MODES: readonly Mode[] = ["auto", "light", "dark"] as const;

const MODE_LABELS: Record<Mode, string> = {
  auto: "Auto",
  light: "Light",
  dark: "Dark",
};

const POSITIONS: Record<Position, string> = {
  "bottom-right": "bottom:18px;right:18px;",
  "bottom-left": "bottom:18px;left:18px;",
  "top-right": "top:18px;right:18px;",
  "top-left": "top:18px;left:18px;",
};

/**
 * Scoped styles. All visual surface is driven by --ts-* custom properties with
 * sensible fallbacks, so the HUD always matches the active skin yet stays fully
 * re-skinnable. prefers-reduced-motion disables transitions.
 */
const STYLES = `
:host {
  --bg: var(--ts-surface, rgba(20, 22, 28, 0.72));
  --fg: var(--ts-fg, #f4f5f7);
  --muted: var(--ts-muted, rgba(244, 245, 247, 0.66));
  --accent: var(--ts-accent, #6aa6ff);
  --accent-2: var(--ts-accent-2, var(--accent));
  --bd: var(--ts-border, rgba(255, 255, 255, 0.14));
  --glow: var(--ts-glow, rgba(106, 166, 255, 0.30));
  --sel: var(--ts-overlay, rgba(255, 255, 255, 0.10));
  --radius: 16px;
  --motion: 200ms;

  display: block;
  box-sizing: border-box;
  color: var(--fg);
  font-family: var(--ts-font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  font-size: 13px;
  line-height: 1.2;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

.panel {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background:
    linear-gradient(var(--ts-overlay, rgba(255,255,255,0.05)), var(--ts-overlay, rgba(255,255,255,0.05))),
    var(--bg);
  color: var(--fg);
  border: 1px solid var(--bd);
  border-radius: var(--radius);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  box-shadow:
    var(--ts-shadow, 0 10px 30px rgba(0, 0, 0, 0.35)),
    0 0 0 1px var(--ts-overlay, transparent),
    0 0 36px -10px var(--glow);
  transition: box-shadow var(--motion) ease, border-color var(--motion) ease;
}

.panel[data-busy="true"] { cursor: progress; }

.read {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.icon {
  position: relative;
  font-size: 20px;
  line-height: 1;
  flex: none;
  filter: drop-shadow(0 0 8px var(--glow));
}

.text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }

.label {
  font-weight: 650;
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.sub:empty { display: none; }

.temp {
  flex: none;
  font-size: 12px;
  font-weight: 650;
  padding: 3px 8px;
  border-radius: 999px;
  color: var(--fg);
  background: var(--sel);
  border: 1px solid var(--bd);
}
.temp:empty { display: none; }

.spinner {
  width: 12px; height: 12px; flex: none;
  border: 2px solid var(--bd);
  border-top-color: var(--accent);
  border-radius: 50%;
  opacity: 0;
  animation: ts-spin 720ms linear infinite;
  transition: opacity var(--motion) ease;
}
.panel[data-busy="true"] .spinner { opacity: 1; }
@keyframes ts-spin { to { transform: rotate(360deg); } }

.divider { width: 1px; align-self: stretch; background: var(--bd); flex: none; }

.segment {
  display: inline-flex;
  padding: 3px;
  background: var(--ts-overlay, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--bd);
  border-radius: 12px;
  gap: 2px;
}

.segment-btn {
  appearance: none; -webkit-appearance: none; margin: 0;
  padding: 5px 11px;
  font: inherit; font-size: 12px; font-weight: 550;
  color: var(--muted);
  background: transparent; border: 0;
  border-radius: 9px;
  cursor: pointer; white-space: nowrap;
  transition: background var(--motion) ease, color var(--motion) ease, box-shadow var(--motion) ease;
}
.segment-btn:hover:not([aria-checked="true"]) { color: var(--fg); }
.segment-btn[aria-checked="true"] {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 2px 10px -2px var(--glow);
}

.toggle { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.toggle-label { color: var(--muted); white-space: nowrap; }

.switch {
  position: relative; display: inline-block;
  width: 34px; height: 19px; flex: none;
  background: var(--bd); border: 0; border-radius: 999px; padding: 0; cursor: pointer;
  transition: background var(--motion) ease;
}
.switch::after {
  content: ""; position: absolute; top: 2px; left: 2px;
  width: 15px; height: 15px; background: var(--fg); border-radius: 50%;
  transition: transform var(--motion) ease;
}
.switch[aria-checked="true"] { background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
.switch[aria-checked="true"]::after { transform: translateX(15px); background: #fff; }

:where(.segment-btn, .switch, .toggle):focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
button:focus:not(:focus-visible) { outline: none; }

.panel[data-busy="true"] .segment-btn,
.panel[data-busy="true"] .switch { opacity: 0.6; pointer-events: none; }

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
  .segment-btn, .switch, .switch::after, .panel { transition: none; }
}
`;

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
function skinLabel(skin: string, label?: string): string {
  return label ?? SKIN_LABELS[skin as Skin] ?? cap(skin);
}
function skinIcon(skin: string, icon?: string): string {
  return icon ?? SKIN_ICONS[skin as Skin] ?? "🎨";
}

function subtitleFor(info: AtmosphereInfo | null): string {
  if (!info) return "";
  const parts: string[] = [];
  if (info.daypart && DAYPART_LABELS[info.daypart]) {
    parts.push(DAYPART_LABELS[info.daypart]!);
  }
  if (info.live && info.weather && WEATHER_LABELS[info.weather]) {
    parts.push(WEATHER_LABELS[info.weather]!);
  }
  return parts.join(" · ");
}

function tempFor(info: AtmosphereInfo | null): string {
  if (!info || !info.live || info.tempC == null || !Number.isFinite(info.tempC)) {
    return "";
  }
  return `${Math.round(info.tempC)}°`;
}

export function createWidget(deps: WidgetDeps): WidgetHandle {
  if (typeof document === "undefined") {
    throw new Error("createWidget requires a DOM environment");
  }

  const liveWeatherLabel = "Live weather";
  const position: Position = deps.options?.position ?? "bottom-right";

  let currentMode: Mode = deps.currentMode;
  let liveWeather = deps.liveWeather === true;
  let destroyed = false;

  // ---- Host + shadow root ---------------------------------------------------
  const host = document.createElement(HOST_TAG);
  host.style.cssText = `position:fixed;z-index:2147483001;${POSITIONS[position]}`;
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;
  root.appendChild(style);

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Theme controls");
  panel.setAttribute("data-busy", "false");

  // ---- Atmosphere readout ---------------------------------------------------
  const read = document.createElement("div");
  read.className = "read";

  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.setAttribute("aria-hidden", "true");

  const iconEl = document.createElement("span");
  iconEl.className = "icon";
  iconEl.setAttribute("aria-hidden", "true");

  const textEl = document.createElement("span");
  textEl.className = "text";

  const labelEl = document.createElement("span");
  labelEl.className = "label";

  const subEl = document.createElement("span");
  subEl.className = "sub";

  textEl.appendChild(labelEl);
  textEl.appendChild(subEl);

  const tempEl = document.createElement("span");
  tempEl.className = "temp";

  read.appendChild(spinner);
  read.appendChild(iconEl);
  read.appendChild(textEl);
  read.appendChild(tempEl);

  const dividerA = document.createElement("span");
  dividerA.className = "divider";
  dividerA.setAttribute("aria-hidden", "true");

  // ---- Segmented Auto / Light / Dark control --------------------------------
  const segment = document.createElement("div");
  segment.className = "segment";
  segment.setAttribute("role", "radiogroup");
  segment.setAttribute("aria-label", "Theme mode");

  const segButtons = new Map<Mode, HTMLButtonElement>();

  function selectMode(mode: Mode, notify: boolean): void {
    currentMode = mode;
    for (const m of MODES) {
      const btn = segButtons.get(m);
      if (!btn) continue;
      const isSel = m === mode;
      btn.setAttribute("aria-checked", isSel ? "true" : "false");
      btn.tabIndex = isSel ? 0 : -1;
    }
    if (notify) deps.onMode(mode);
  }

  function focusMode(mode: Mode): void {
    const btn = segButtons.get(mode);
    if (btn) btn.focus();
  }

  function onSegmentKeydown(ev: KeyboardEvent): void {
    const idx = MODES.indexOf(currentMode);
    let next = -1;
    switch (ev.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (idx + 1) % MODES.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (idx - 1 + MODES.length) % MODES.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = MODES.length - 1;
        break;
      default:
        return;
    }
    ev.preventDefault();
    const target = MODES[next];
    if (target === undefined) return;
    selectMode(target, true);
    focusMode(target);
  }

  for (const mode of MODES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "segment-btn";
    btn.setAttribute("role", "radio");
    btn.textContent = MODE_LABELS[mode];
    btn.setAttribute("aria-label", `${MODE_LABELS[mode]} theme`);
    btn.addEventListener("click", () => {
      if (destroyed) return;
      selectMode(mode, true);
    });
    btn.addEventListener("keydown", onSegmentKeydown);
    segButtons.set(mode, btn);
    segment.appendChild(btn);
  }

  const dividerB = document.createElement("span");
  dividerB.className = "divider";
  dividerB.setAttribute("aria-hidden", "true");

  // ---- Live-weather opt-in toggle -------------------------------------------
  const toggle = document.createElement("label");
  toggle.className = "toggle";

  const toggleText = document.createElement("span");
  toggleText.className = "toggle-label";
  toggleText.textContent = liveWeatherLabel;
  const toggleTextId = "ts-lw-label";
  toggleText.id = toggleTextId;

  const switchEl = document.createElement("button");
  switchEl.type = "button";
  switchEl.className = "switch";
  switchEl.setAttribute("role", "switch");
  switchEl.setAttribute("aria-labelledby", toggleTextId);

  function reflectLiveWeather(on: boolean): void {
    liveWeather = on;
    switchEl.setAttribute("aria-checked", on ? "true" : "false");
  }

  function toggleLiveWeather(): void {
    if (destroyed) return;
    const next = !liveWeather;
    reflectLiveWeather(next);
    deps.onLiveWeather(next);
  }

  switchEl.addEventListener("click", toggleLiveWeather);
  switchEl.addEventListener("keydown", (ev) => {
    if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      toggleLiveWeather();
    }
  });

  toggle.appendChild(toggleText);
  toggle.appendChild(switchEl);

  // ---- Assemble -------------------------------------------------------------
  panel.appendChild(read);
  panel.appendChild(dividerA);
  panel.appendChild(segment);
  panel.appendChild(dividerB);
  panel.appendChild(toggle);
  root.appendChild(panel);

  // ---- Render helpers -------------------------------------------------------
  function renderSkin(skin: string, label?: string, icon?: string): void {
    const ic = skinIcon(skin, icon);
    iconEl.textContent = ic;
    iconEl.style.display = ic ? "" : "none";
    labelEl.textContent = skinLabel(skin, label);
  }

  function renderAtmosphere(info: AtmosphereInfo | null): void {
    subEl.textContent = subtitleFor(info);
    tempEl.textContent = tempFor(info);
  }

  renderSkin(deps.currentSkin, deps.currentLabel, deps.currentIcon);
  renderAtmosphere(deps.currentAtmosphere ?? null);
  selectMode(currentMode, false);
  reflectLiveWeather(liveWeather);

  document.body.appendChild(host);

  // ---- Public handle --------------------------------------------------------
  return {
    setSkin(skin: string, label?: string, icon?: string): void {
      if (destroyed) return;
      renderSkin(skin, label, icon);
    },
    setAtmosphere(info: AtmosphereInfo | null): void {
      if (destroyed) return;
      renderAtmosphere(info);
    },
    setMode(mode: Mode): void {
      if (destroyed) return;
      selectMode(mode, false);
    },
    setBusy(b: boolean): void {
      if (destroyed) return;
      panel.setAttribute("data-busy", b ? "true" : "false");
      panel.setAttribute("aria-busy", b ? "true" : "false");
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      host.remove();
    },
  };
}
