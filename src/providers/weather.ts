/**
 * TheSwitch — weather provider (Open-Meteo).
 *
 * Free, no API key, CORS-enabled. This is the ONLY module that performs a
 * network request, and it is invoked solely when the visitor has explicitly
 * opted into geolocation/live weather. Privacy-first by construction: if you
 * never call this, TheSwitch never touches the network.
 *
 * @see https://open-meteo.com/
 */
import type { Weather } from "../core/atmosphere";

/** Result of a single live-weather lookup. */
export interface WeatherResult {
  weather: Weather;
  isDay: boolean;
  tempC: number;
  windKmh: number;
}

/** Shape of the slice of Open-Meteo's response that we consume. */
interface OpenMeteoCurrent {
  temperature_2m?: number;
  weather_code?: number;
  is_day?: number;
  wind_speed_10m?: number;
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
}

/**
 * Map a WMO weather interpretation code (as returned by Open-Meteo) to one of
 * TheSwitch's coarse {@link Weather} buckets.
 *
 * @see https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
export function mapWeatherCode(code: number): Weather {
  if (code === 0) return "clear";
  if (code <= 3) return "clouds";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  return "clouds";
}

/**
 * Fetch the current conditions for a coordinate from Open-Meteo.
 *
 * @param lat    Latitude in decimal degrees.
 * @param lng    Longitude in decimal degrees.
 * @param signal Optional AbortSignal to cancel an in-flight request.
 * @returns The mapped weather bucket plus day flag, temperature, and wind.
 * @throws  If the request fails or the response is malformed.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<WeatherResult> {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    throw new Error("weather: invalid coordinates");
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lngNum}` +
    `&current=temperature_2m,weather_code,is_day,wind_speed_10m`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`weather ${res.status}`);

  const data = (await res.json()) as OpenMeteoResponse;
  const current = data.current;
  if (!current) throw new Error("weather: missing current conditions");

  return {
    weather: mapWeatherCode(Number(current.weather_code ?? 0)),
    isDay: current.is_day === 1,
    tempC: Number(current.temperature_2m ?? 0),
    windKmh: Number(current.wind_speed_10m ?? 0),
  };
}
