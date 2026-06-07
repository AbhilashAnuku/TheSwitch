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
