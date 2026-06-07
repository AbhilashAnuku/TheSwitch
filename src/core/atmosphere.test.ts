/**
 * Tests for the headless atmosphere engine.
 *
 * These are deterministic and offline: a fixed `now` is supplied everywhere a
 * clock is read, and `fetch` is spied on to prove the privacy contract — with
 * `useGeolocation` left off, TheSwitch must NEVER touch the network.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveSkin,
  detectAtmosphere,
  mapWeatherCode,
  type Atmosphere,
} from "./atmosphere";

/** Build a Date for a given local wall-clock moment (deterministic input). */
function at(
  year: number,
  month1: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  return new Date(year, month1 - 1, day, hour, minute, 0, 0);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("detectAtmosphere — privacy (no opt-in => no network)", () => {
  it("makes NO network call and returns a time/season-only atmosphere", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const now = at(2026, 6, 7, 13, 0); // northern summer, midday
    const atmos = await detectAtmosphere({ now, useGeolocation: false });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(atmos.live).toBe(false);
    // With no live weather, conditions default to clear sky and unknown temp.
    expect(atmos.weather).toBe("clear");
    expect(atmos.tempC).toBeNull();
    expect(atmos.windKmh).toBeNull();
    // Time/season are still derived purely from the local clock + hemisphere.
    expect(atmos.daypart).toBe("day");
    expect(atmos.season).toBe("summer");
  });

  it("does not call fetch even when coords are given but geolocation is off", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const now = at(2026, 6, 7, 13, 0);
    const atmos = await detectAtmosphere({
      now,
      latitude: 40,
      longitude: -3,
      useGeolocation: false,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(atmos.live).toBe(false);
  });
});

describe("detectAtmosphere — season flips by hemisphere", () => {
  it("returns summer in June for the northern hemisphere", async () => {
    const atmos = await detectAtmosphere({
      now: at(2026, 6, 15, 12, 0),
      latitude: 51, // London-ish, north
    });
    expect(atmos.season).toBe("summer");
  });

  it("returns winter in June for the southern hemisphere", async () => {
    const atmos = await detectAtmosphere({
      now: at(2026, 6, 15, 12, 0),
      latitude: -33, // Sydney-ish, south
    });
    expect(atmos.season).toBe("winter");
  });

  it("flips a northern winter to a southern summer in December", async () => {
    const north = await detectAtmosphere({
      now: at(2026, 12, 15, 12, 0),
      latitude: 51,
    });
    const south = await detectAtmosphere({
      now: at(2026, 12, 15, 12, 0),
      latitude: -33,
    });
    expect(north.season).toBe("winter");
    expect(south.season).toBe("summer");
  });

  it("treats the equator (latitude 0) as northern", async () => {
    const atmos = await detectAtmosphere({
      now: at(2026, 6, 15, 12, 0),
      latitude: 0,
    });
    expect(atmos.season).toBe("summer");
  });
});

describe("detectAtmosphere — daypart boundaries", () => {
  const cases: ReadonlyArray<[hour: number, expected: Atmosphere["daypart"]]> = [
    [4, "night"], // just before dawn
    [5, "dawn"], // dawn opens at 05:00
    [7, "dawn"], // still dawn
    [8, "day"], // dawn closes, day opens at 08:00
    [12, "day"], // midday
    [17, "day"], // just before dusk
    [18, "dusk"], // dusk opens at 18:00
    [20, "dusk"], // still dusk
    [21, "night"], // dusk closes, night opens at 21:00
    [23, "night"], // late night
    [0, "night"], // midnight
  ];

  for (const [hour, expected] of cases) {
    it(`maps ${String(hour).padStart(2, "0")}:00 to "${expected}"`, async () => {
      const atmos = await detectAtmosphere({
        now: at(2026, 6, 15, hour, 0),
        latitude: 48,
      });
      expect(atmos.daypart).toBe(expected);
    });
  }

  it("derives a dark theme at night and a light theme by day", async () => {
    const night = await detectAtmosphere({ now: at(2026, 6, 15, 23, 0) });
    const day = await detectAtmosphere({ now: at(2026, 6, 15, 12, 0) });
    expect(night.theme).toBe("dark");
    expect(day.theme).toBe("light");
  });
});

describe("mapWeatherCode — WMO code buckets", () => {
  const cases: ReadonlyArray<[code: number, expected: Atmosphere["weather"]]> = [
    [0, "clear"],
    [1, "clouds"],
    [3, "clouds"],
    [45, "fog"],
    [48, "fog"],
    [51, "rain"],
    [67, "rain"],
    [71, "snow"],
    [77, "snow"],
    [80, "rain"],
    [82, "rain"],
    [85, "snow"],
    [86, "snow"],
    [95, "storm"],
    [99, "storm"],
    [4, "clouds"], // unmapped gap falls back to clouds
  ];

  for (const [code, expected] of cases) {
    it(`maps code ${code} to "${expected}"`, () => {
      expect(mapWeatherCode(code)).toBe(expected);
    });
  }
});

describe("deriveSkin — precedence", () => {
  /** A baseline daytime, clear, summer atmosphere we mutate per assertion. */
  function base(overrides: Partial<Atmosphere> = {}): Atmosphere {
    return {
      daypart: "day",
      season: "summer",
      weather: "clear",
      isDay: true,
      tempC: null,
      windKmh: null,
      theme: "light",
      skin: "light",
      live: false,
      ...overrides,
    };
  }

  it("returns night when it is night, regardless of weather", () => {
    expect(
      deriveSkin(base({ daypart: "night", theme: "dark", weather: "storm" })),
    ).toBe("night");
  });

  it("prioritises stormy weather over a plain daytime light skin", () => {
    expect(deriveSkin(base({ weather: "storm" }))).toBe("stormy");
  });

  it("maps each weather bucket to its matching daytime skin", () => {
    expect(deriveSkin(base({ weather: "snow" }))).toBe("snow");
    expect(deriveSkin(base({ weather: "rain" }))).toBe("watery");
    expect(deriveSkin(base({ weather: "fog" }))).toBe("foggy");
  });

  it("falls back to a clear-sky / light skin when no weather drama applies", () => {
    const skin = deriveSkin(base({ weather: "clear" }));
    expect(["sunny", "light"]).toContain(skin);
  });

  it("never reports a weather skin at night (night wins)", () => {
    for (const weather of ["clear", "clouds", "rain", "snow", "fog", "storm"] as const) {
      expect(deriveSkin(base({ daypart: "night", theme: "dark", weather }))).toBe(
        "night",
      );
    }
  });
});
