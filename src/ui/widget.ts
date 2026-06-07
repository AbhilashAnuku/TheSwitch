/**
 * TheSwitch — the on-page control widget (UI).
 *
 * A self-contained, Shadow-DOM-isolated control that shows the current skin
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
 *  - Everything is styled via CSS custom properties prefixed with --ts-*, so a
 *    host can re-skin the widget without reaching into the shadow tree.
 *  - Fully keyboard-operable with a roving radiogroup + ARIA, and honours
 *    prefers-reduced-motion.
 */
import type { Mode, Skin, WidgetOptions } from "../types";

/**
 * Human-readable label for each {@link Skin}. `Skin` is a string union, so the
 * widget derives its display text from this exhaustive map (a missing skin is a
 * compile error) rather than probing an object that doesn't exist.
 */
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

export interface WidgetDeps {
  /** The skin to show on first paint. */
  currentSkin: Skin;
  /** The theme mode to show as selected on first paint. */
  currentMode: Mode;
  /** Whether the live-weather toggle starts on. Opt-in: should be false. */
  liveWeather: boolean;
  /** Called when the visitor picks a theme mode. */
  onMode: (mode: Mode) => void;
  /** Called when the visitor flips the live-weather opt-in. */
  onLiveWeather: (enabled: boolean) => void;
  /** Optional presentation tweaks. */
  options?: WidgetOptions;
}

export interface WidgetHandle {
  /** Update the displayed skin (icon + label). */
  setSkin(skin: Skin): void;
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

/**
 * Scoped styles. All visual surface is driven by --ts-* custom properties with
 * sensible fallbacks so the widget looks right out of the box yet stays fully
 * re-skinnable from the host. prefers-reduced-motion disables transitions.
 */
const STYLES = `
:host {
  --ts-bg: var(--ts-surface, rgba(20, 22, 28, 0.72));
  --ts-fg: var(--ts-text, #f4f5f7);
  --ts-muted: var(--ts-text-muted, rgba(244, 245, 247, 0.66));
  --ts-accent-color: var(--ts-accent, #6aa6ff);
  --ts-border-color: var(--ts-border, rgba(255, 255, 255, 0.14));
  --ts-selected-bg: var(--ts-segment-selected, rgba(255, 255, 255, 0.16));
  --ts-radius-outer: var(--ts-radius, 14px);
  --ts-radius-inner: var(--ts-radius-control, 10px);
  --ts-pad: var(--ts-padding, 10px);
  --ts-gap-size: var(--ts-gap, 10px);
  --ts-font:
    var(--ts-font-family, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  --ts-motion: 160ms;

  display: inline-block;
  box-sizing: border-box;
  color: var(--ts-fg);
  font-family: var(--ts-font);
  font-size: 13px;
  line-height: 1.2;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}

.panel {
  display: flex;
  align-items: center;
  gap: var(--ts-gap-size);
  padding: var(--ts-pad);
  background: var(--ts-bg);
  color: var(--ts-fg);
  border: 1px solid var(--ts-border-color);
  border-radius: var(--ts-radius-outer);
  backdrop-filter: var(--ts-backdrop, blur(12px) saturate(1.2));
  box-shadow: var(--ts-shadow, 0 6px 24px rgba(0, 0, 0, 0.28));
}

.panel[data-busy="true"] {
  cursor: progress;
}

.skin {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.skin-icon {
  font-size: 18px;
  line-height: 1;
  flex: none;
}

.skin-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.skin-label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spinner {
  width: 12px;
  height: 12px;
  flex: none;
  border: 2px solid var(--ts-border-color);
  border-top-color: var(--ts-accent-color);
  border-radius: 50%;
  opacity: 0;
  animation: ts-spin 720ms linear infinite;
  transition: opacity var(--ts-motion) ease;
}

.panel[data-busy="true"] .spinner {
  opacity: 1;
}

@keyframes ts-spin {
  to {
    transform: rotate(360deg);
  }
}

.divider {
  width: 1px;
  align-self: stretch;
  background: var(--ts-border-color);
  flex: none;
}

.segment {
  display: inline-flex;
  padding: 2px;
  background: var(--ts-border-color);
  border-radius: var(--ts-radius-inner);
  gap: 2px;
}

.segment-btn {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  padding: 5px 11px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--ts-muted);
  background: transparent;
  border: 0;
  border-radius: calc(var(--ts-radius-inner) - 2px);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--ts-motion) ease,
    color var(--ts-motion) ease;
}

.segment-btn:hover:not([aria-checked="true"]) {
  color: var(--ts-fg);
}

.segment-btn[aria-checked="true"] {
  color: var(--ts-fg);
  background: var(--ts-selected-bg);
  box-shadow: var(--ts-segment-shadow, 0 1px 2px rgba(0, 0, 0, 0.25));
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  user-select: none;
}

.toggle-label {
  color: var(--ts-muted);
  white-space: nowrap;
}

.switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex: none;
  background: var(--ts-border-color);
  border: 0;
  border-radius: 999px;
  padding: 0;
  cursor: pointer;
  transition: background var(--ts-motion) ease;
}

.switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: var(--ts-fg);
  border-radius: 50%;
  transition: transform var(--ts-motion) ease;
}

.switch[aria-checked="true"] {
  background: var(--ts-accent-color);
}

.switch[aria-checked="true"]::after {
  transform: translateX(14px);
}

:where(.segment-btn, .switch, .toggle):focus-visible {
  outline: 2px solid var(--ts-accent-color);
  outline-offset: 2px;
}

button:focus:not(:focus-visible) {
  outline: none;
}

.panel[data-busy="true"] .segment-btn,
.panel[data-busy="true"] .switch {
  opacity: 0.6;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
  .segment-btn,
  .switch,
  .switch::after {
    transition: none;
  }
}
`;

/** Resolve the visible label for a skin from the exhaustive label map. */
function skinLabel(skin: Skin): string {
  return SKIN_LABELS[skin];
}

/** Resolve the small leading glyph/icon for a skin from the icon map. */
function skinIcon(skin: Skin): string {
  return SKIN_ICONS[skin];
}

export function createWidget(deps: WidgetDeps): WidgetHandle {
  if (typeof document === "undefined") {
    throw new Error("createWidget requires a DOM environment");
  }

  const liveWeatherLabel = "Live weather";

  let currentMode: Mode = deps.currentMode;
  let liveWeather = deps.liveWeather === true;
  let destroyed = false;

  // ---- Host + shadow root ---------------------------------------------------
  const host = document.createElement(HOST_TAG);
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;
  root.appendChild(style);

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Theme controls");
  panel.setAttribute("data-busy", "false");

  // ---- Skin display ---------------------------------------------------------
  const skinEl = document.createElement("div");
  skinEl.className = "skin";

  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.setAttribute("aria-hidden", "true");

  const iconEl = document.createElement("span");
  iconEl.className = "skin-icon";
  iconEl.setAttribute("aria-hidden", "true");

  const textEl = document.createElement("span");
  textEl.className = "skin-text";

  const labelEl = document.createElement("span");
  labelEl.className = "skin-label";

  textEl.appendChild(labelEl);
  skinEl.appendChild(spinner);
  skinEl.appendChild(iconEl);
  skinEl.appendChild(textEl);

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
      // Roving tabindex: only the selected option is in the tab order.
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
  panel.appendChild(skinEl);
  panel.appendChild(dividerA);
  panel.appendChild(segment);
  panel.appendChild(dividerB);
  panel.appendChild(toggle);
  root.appendChild(panel);

  // ---- Initial state --------------------------------------------------------
  function renderSkin(skin: Skin): void {
    const icon = skinIcon(skin);
    iconEl.textContent = icon;
    iconEl.style.display = icon ? "" : "none";
    labelEl.textContent = skinLabel(skin);
  }

  renderSkin(deps.currentSkin);
  selectMode(currentMode, false);
  reflectLiveWeather(liveWeather);

  document.body.appendChild(host);

  // ---- Public handle --------------------------------------------------------
  return {
    setSkin(skin: Skin): void {
      if (destroyed) return;
      renderSkin(skin);
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
