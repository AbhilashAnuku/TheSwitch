/**
 * Tests for the Open-Meteo weather provider.
 *
 * `fetch` is fully mocked — no real network is ever touched. We assert the WMO
 * code mapping and that `fetchWeather` projects the API payload onto our
 * compact {@link WeatherResult} shape.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWeather, mapWeatherCode } from "./weather";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a minimal `fetch` Response stand-in carrying an Open-Meteo body. */
function meteoResponse(current: Record<string, number>, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ current }),
  } as unknown as Response;
}

describe("mapWeatherCode", () => {
  it("maps clear, cloud, fog, rain, snow and storm codes", () => {
    expect(mapWeatherCode(0)).toBe("clear");
    expect(mapWeatherCode(2)).toBe("clouds");
    expect(mapWeatherCode(45)).toBe("fog");
    expect(mapWeatherCode(61)).toBe("rain");
    expect(mapWeatherCode(75)).toBe("snow");
    expect(mapWeatherCode(81)).toBe("rain");
    expect(mapWeatherCode(86)).toBe("snow");
    expect(mapWeatherCode(95)).toBe("storm");
  });

  it("falls back to clouds for unmapped codes", () => {
    expect(mapWeatherCode(4)).toBe("clouds");
  });
});

describe("fetchWeather", () => {
  it("requests Open-Meteo and returns the mapped fields", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      meteoResponse({
        temperature_2m: 18.5,
        weather_code: 61,
        is_day: 1,
        wind_speed_10m: 12.3,
      }),
    );

    const result = await fetchWeather(40.4, -3.7);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain("api.open-meteo.com");
    expect(url).toContain("latitude=40.4");
    expect(url).toContain("longitude=-3.7");

    expect(result).toEqual({
      weather: "rain",
      isDay: true,
      tempC: 18.5,
      windKmh: 12.3,
    });
  });

  it("reports isDay false when the API flags night", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      meteoResponse({
        temperature_2m: 4,
        weather_code: 0,
        is_day: 0,
        wind_speed_10m: 2,
      }),
    );

    const result = await fetchWeather(51.5, -0.1);
    expect(result.isDay).toBe(false);
    expect(result.weather).toBe("clear");
  });

  it("forwards an AbortSignal to fetch when provided", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        meteoResponse({ temperature_2m: 10, weather_code: 0, is_day: 1, wind_speed_10m: 0 }),
      );

    const controller = new AbortController();
    await fetchWeather(0, 0, controller.signal);

    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      signal: controller.signal,
    });
  });

  it("throws when the response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      meteoResponse({ weather_code: 0 }, false),
    );
    await expect(fetchWeather(0, 0)).rejects.toThrow();
  });

  it("throws when current conditions are missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response);

    await expect(fetchWeather(0, 0)).rejects.toThrow();
  });
});
