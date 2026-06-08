/**
 * Tests for the TheSwitch orchestrator.
 *
 * Verifies the headless controller without any real network or wall clock:
 * forcing a light/dark mode bypasses weather entirely, the auto refresh timer
 * is scheduled on `setInterval`, and `destroy` tears everything back down.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TheSwitch } from "./the-switch";

let root: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  // Pin the clock so any internal `new Date()` is deterministic (daytime).
  vi.setSystemTime(new Date(2026, 5, 7, 13, 0, 0));
  root = document.createElement("div");
  document.body.appendChild(root);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  root.remove();
});

describe("setMode — forced light/dark", () => {
  it("forces the dark skin without consulting weather (no network)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ts = new TheSwitch({ target: root, mode: "dark", widget: false });

    await ts.start();
    ts.setMode("dark");
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(root.getAttribute("data-atmos-skin")).toBe("dark");

    ts.destroy();
  });

  it("forces the light skin when mode is light", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ts = new TheSwitch({ target: root, widget: false });

    await ts.start();
    ts.setMode("light");
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(root.getAttribute("data-atmos-skin")).toBe("light");

    ts.destroy();
  });

  it("notifies subscribers of the forced mode", async () => {
    const ts = new TheSwitch({ target: root, widget: false });
    const seen: string[] = [];
    const unsub = ts.subscribe((state) => {
      seen.push(state.mode);
    });

    await ts.start();
    ts.setMode("dark");
    await vi.advanceTimersByTimeAsync(0);

    expect(seen).toContain("dark");
    unsub();
    ts.destroy();
  });
});

describe("refresh timer", () => {
  it("schedules a recurring refresh via setInterval", async () => {
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    const ts = new TheSwitch({
      target: root,
      mode: "auto",
      refreshMinutes: 5,
      widget: false,
    });

    await ts.start();

    expect(intervalSpy).toHaveBeenCalled();
    const intervalCalls = intervalSpy.mock.calls;
    const delayArg = intervalCalls[intervalCalls.length - 1]?.[1];
    expect(delayArg).toBe(5 * 60_000);

    ts.destroy();
  });
});

describe("destroy", () => {
  it("clears the refresh interval on destroy", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const ts = new TheSwitch({
      target: root,
      mode: "auto",
      refreshMinutes: 1,
      widget: false,
    });

    await ts.start();
    await vi.advanceTimersByTimeAsync(0);

    ts.destroy();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("stops firing the refresh callback after destroy", async () => {
    const ts = new TheSwitch({
      target: root,
      mode: "auto",
      refreshMinutes: 1,
      widget: false,
    });
    const listener = vi.fn();
    ts.subscribe(listener);

    await ts.start();
    await vi.advanceTimersByTimeAsync(0);

    ts.destroy();
    listener.mockClear();

    // Advancing well past the refresh interval must produce no more updates.
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("auto: sync — fuses time + season into one cinematic skin (no network)", () => {
  /** Start a sync-auto engine pinned to `now`, capturing each resolved skin id. */
  function syncAt(now: Date): { ts: TheSwitch; seen: string[] } {
    const seen: string[] = [];
    const ts = new TheSwitch({
      target: root,
      mode: "auto",
      widget: false,
      ambient: false,
      transition: false,
      storage: false, // isolate from mode/skin persisted by earlier tests
      now,
      onChange: (skin) => seen.push(skin.id),
    });
    return { ts, seen };
  }

  it("resolves a clear summer midday to the bright Desert skin", async () => {
    const { ts, seen } = syncAt(new Date(2026, 6, 7, 13, 0, 0)); // July, summer, day
    await ts.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toContain("desert");
    ts.destroy();
  });

  it("resolves a clear winter night to Midnight", async () => {
    const { ts, seen } = syncAt(new Date(2026, 0, 15, 23, 0, 0)); // Jan, winter, night
    await ts.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toContain("midnight");
    ts.destroy();
  });

  it("resolves dusk to the golden-hour Sunset skin", async () => {
    const { ts, seen } = syncAt(new Date(2026, 3, 15, 19, 0, 0)); // April, spring, dusk
    await ts.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toContain("sunset");
    ts.destroy();
  });

  it("stays fully private — no fetch without a geolocation opt-in", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { ts } = syncAt(new Date(2026, 6, 7, 13, 0, 0));
    await ts.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    ts.destroy();
  });
});
