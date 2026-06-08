/**
 * TheSwitch — adaptive atmosphere engine (core).
 *
 * Detects the visitor's mood-of-the-moment from time, season, and (only with
 * explicit opt-in) location + live weather. Privacy-first: with no opt-in it
 * makes ZERO network calls and uses only the local clock + hemisphere.
 *
 * (Recovered from the demo's Aura seed — this is now TheSwitch's core.)
 */
import { fetchWeather, mapWeatherCode } from "../providers/weather";

export type Daypart = "dawn" | "day" | "dusk" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "clear" | "clouds" | "rain" | "snow" | "storm" | "fog";

/**
 * The visual "skin" derived from an {@link Atmosphere}. A small, opinionated
 * set of mood states that map onto coherent token palettes (see theme.ts).
 */
export type Skin =
  | "light"
  | "dark"
  | "sunny"
  | "snow"
  | "windy"
  | "watery"
  | "foggy"
  | "stormy"
  | "night";

/** Alias of {@link Skin} — the canonical name of a visual skin. */
export type SkinName = Skin;

export interface Atmosphere {
  daypart: Daypart;
  season: Season;
  weather: Weather;
  isDay: boolean;
  tempC: number | null;
  /** Wind speed in km/h from live weather, or null when unavailable. */
  windKmh: number | null;
  /** Latitude this reading was taken at (drives hemisphere/polar fusion), or null. */
  latitude?: number | null;
  theme: "light" | "dark";
  /** The derived visual skin for this atmosphere. */
  skin: Skin;
  live: boolean; // true when derived from real location + weather
}

export interface AtmosphereOptions {
  latitude?: number;
  longitude?: number;
  /** Opt-in only. Default false => no geolocation, no network, fully private. */
  useGeolocation?: boolean;
  now?: Date;
}

function getGeo(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { timeout: 8000, maximumAge: 30 * 60_000 },
    );
  });
}

// Weather mapping and the (opt-in) network fetch now live in the dedicated
// provider module; re-export mapWeatherCode for convenience/back-compat.
export { mapWeatherCode };

function seasonFor(now: Date, lat: number): Season {
  const m = now.getMonth();
  const north: Season =
    m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
  if (lat >= 0) return north;
  const flip: Record<Season, Season> = {
    winter: "summer",
    spring: "autumn",
    summer: "winter",
    autumn: "spring",
  };
  return flip[north];
}

function daypartFor(now: Date, isDay: boolean): Daypart {
  const h = now.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 18 && h < 21) return "dusk";
  if (!isDay || h >= 21 || h < 5) return "night";
  return "day";
}

export async function detectAtmosphere(
  opts: AtmosphereOptions = {},
): Promise<Atmosphere> {
  const now = opts.now ?? new Date();
  let lat = opts.latitude;
  let lng = opts.longitude;
  let live = false;

  if ((lat == null || lng == null) && opts.useGeolocation === true) {
    try {
      const pos = await getGeo();
      lat = pos.lat;
      lng = pos.lng;
    } catch {
      /* denied — stay private, time/season only */
    }
  }

  let weather: Weather = "clear";
  let isDay = now.getHours() >= 7 && now.getHours() < 19;
  let tempC: number | null = null;
  let windKmh: number | null = null;

  if (lat != null && lng != null && opts.useGeolocation === true) {
    try {
      const w = await fetchWeather(lat, lng);
      weather = w.weather;
      isDay = w.isDay;
      tempC = w.tempC;
      windKmh = w.windKmh;
      live = true;
    } catch {
      /* weather unavailable — fall back */
    }
  }

  const season = seasonFor(now, lat ?? 48);
  const daypart = daypartFor(now, isDay);
  const theme: "light" | "dark" = daypart === "night" ? "dark" : "light";
  const atmos: Atmosphere = {
    daypart,
    season,
    weather,
    isDay,
    tempC,
    windKmh,
    latitude: lat ?? null,
    theme,
    skin: "light",
    live,
  };
  atmos.skin = deriveSkin(atmos);
  return atmos;
}

/** Wind threshold (km/h) above which the "windy" skin can be selected. */
const WINDY_THRESHOLD_KMH = 30;

/**
 * Derive a visual {@link Skin} from an {@link Atmosphere}, applying a fixed
 * precedence so the most consequential condition wins:
 *
 *   stormy -> snow -> watery (rain) -> foggy -> windy (high wind)
 *          -> sunny (clear & day) -> night -> theme fallback (dark|light).
 *
 * Night is treated as the canopy over the daytime weather skins: at night the
 * sky-mood skins (stormy/snow/watery/foggy/windy/sunny) give way to "night",
 * since their palettes are tuned for daylight. Weather still wins over a plain
 * light/dark fallback during the day.
 */
export function deriveSkin(a: Atmosphere): Skin {
  const isNight = a.daypart === "night" || !a.isDay;
  if (!isNight) {
    if (a.weather === "storm") return "stormy";
    if (a.weather === "snow") return "snow";
    if (a.weather === "rain") return "watery";
    if (a.weather === "fog") return "foggy";
    if (a.windKmh != null && a.windKmh >= WINDY_THRESHOLD_KMH) return "windy";
    if (a.weather === "clear") return "sunny";
  }
  if (isNight) return "night";
  return a.theme === "dark" ? "dark" : "light";
}

export function applyAtmosphere(
  atmos: Atmosphere,
  el: HTMLElement = document.documentElement,
): void {
  el.setAttribute("data-atmos-daypart", atmos.daypart);
  el.setAttribute("data-atmos-season", atmos.season);
  el.setAttribute("data-atmos-weather", atmos.weather);
  el.setAttribute("data-atmos-theme", atmos.theme);
  el.setAttribute("data-atmos-skin", atmos.skin);
}
