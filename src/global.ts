/**
 * TheSwitch — standalone <script> entry.
 *
 * Bundled as a minified IIFE onto `window.TheSwitch` (see tsup config). It
 * auto-initialises from a single declarative trigger so a site can adopt
 * adaptive theming with zero JavaScript:
 *
 *   <html data-the-switch data-mode="auto" data-position="bottom-right">
 *
 * Recognised attributes (all optional except the trigger):
 *   data-the-switch        Presence enables auto-init. The element it sits on
 *                          is the theming root (defaults to <html>).
 *   data-mode              "auto" | "light" | "dark"  (default "auto")
 *   data-use-geolocation   Presence or "true" opts in to live weather via the
 *                          browser geolocation prompt. Off by default = private.
 *   data-latitude          Fixed latitude  (paired with longitude; no prompt).
 *   data-longitude         Fixed longitude (paired with latitude;  no prompt).
 *   data-refresh           Refresh interval in minutes.
 *   data-widget            "false" disables the floating control widget.
 *   data-ambient           "false" disables the ambient graphics layer.
 *   data-position          Widget corner, e.g. "bottom-right".
 *
 * Privacy: with no opt-in attributes this makes ZERO network calls and relies
 * only on the local clock + hemisphere.
 */
import { TheSwitch } from "./core/the-switch";
import type { Mode, Position, TheSwitchOptions } from "./core/the-switch";

function parseMode(raw: string | null): Mode | undefined {
  if (raw === "auto" || raw === "light" || raw === "dark") return raw;
  return undefined;
}

function parseBoolAttr(raw: string | null): boolean {
  // Presence ("") or an explicit truthy value enables the flag.
  return raw === "" || raw === "true";
}

function parseNumber(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parsePosition(raw: string | null): Position | undefined {
  if (
    raw === "top-left" ||
    raw === "top-right" ||
    raw === "bottom-left" ||
    raw === "bottom-right"
  ) {
    return raw;
  }
  return undefined;
}

function optionsFromElement(el: HTMLElement): TheSwitchOptions {
  const opts: TheSwitchOptions = { target: el };

  const mode = parseMode(el.getAttribute("data-mode"));
  if (mode) opts.mode = mode;

  const lat = parseNumber(el.getAttribute("data-latitude"));
  const lng = parseNumber(el.getAttribute("data-longitude"));
  const hasFixedCoords = lat != null && lng != null;
  if (hasFixedCoords) {
    opts.latitude = lat;
    opts.longitude = lng;
  }

  // Fixed coordinates imply live weather without a geolocation prompt; the
  // explicit attribute opts in to the prompt-based path.
  if (hasFixedCoords || parseBoolAttr(el.getAttribute("data-use-geolocation"))) {
    opts.useGeolocation = true;
  }

  const refresh = parseNumber(el.getAttribute("data-refresh"));
  if (refresh != null) opts.refreshMinutes = refresh;

  if (el.getAttribute("data-widget") === "false") opts.widget = false;
  if (el.getAttribute("data-ambient") === "false") opts.ambient = false;

  const position = parsePosition(el.getAttribute("data-position"));
  if (position) opts.position = position;

  const defaultSkin = el.getAttribute("data-default-skin");
  if (defaultSkin) opts.defaultSkin = defaultSkin;

  const intensity = el.getAttribute("data-intensity");
  if (intensity === "subtle" || intensity === "normal" || intensity === "cinematic") {
    opts.intensity = intensity;
  }

  const transition = el.getAttribute("data-transition");
  if (
    transition === "portal" || transition === "flash" ||
    transition === "fade" || transition === "none"
  ) {
    opts.transition = { type: transition };
  }

  // Auto-wire data-switch-* controls in the drop-in path (opt out with "false").
  if (el.getAttribute("data-autobind") !== "false") opts.autoBind = true;

  return opts;
}

function autoInit(): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>("[data-the-switch]");
  if (!el) return;
  new TheSwitch(optionsFromElement(el)).start();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }
}

export { TheSwitch };
export default TheSwitch;
