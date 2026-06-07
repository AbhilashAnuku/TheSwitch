/**
 * Tests for the token-applying theme layer.
 *
 * `applyTheme` paints a small set of `--ts-*` CSS custom properties onto a
 * target element and tags it with `data-atmos-skin`. It honours
 * `prefers-reduced-motion` (no transition) and lets a caller override the
 * built-in presets. `clearTheme` reverses everything it set.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { applyTheme, clearTheme, SKIN_PRESETS } from "./theme";
import type { Skin } from "./atmosphere";

/** Stub `matchMedia` so we can flip the reduced-motion preference per test. */
function mockReducedMotion(reduced: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

let el: HTMLElement;

beforeEach(() => {
  mockReducedMotion(false);
  el = document.createElement("div");
  document.body.appendChild(el);
});

afterEach(() => {
  el.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SKINS: readonly Skin[] = [
  "light",
  "dark",
  "sunny",
  "snow",
  "windy",
  "watery",
  "foggy",
  "stormy",
  "night",
];

describe("SKIN_PRESETS", () => {
  it("provides a preset for every skin", () => {
    for (const skin of SKINS) {
      expect(SKIN_PRESETS[skin]).toBeDefined();
    }
  });
});

describe("applyTheme", () => {
  it("sets --ts-* custom properties and the data-atmos-skin attribute", () => {
    applyTheme("sunny", el);

    expect(el.getAttribute("data-atmos-skin")).toBe("sunny");

    // The element must carry at least one --ts-* token mirroring the preset.
    const preset = SKIN_PRESETS.sunny;
    const keys = Object.keys(preset);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const prop = key.startsWith("--ts-") ? key : `--ts-${key}`;
      expect(el.style.getPropertyValue(prop).trim()).not.toBe("");
    }
  });

  it("writes a transition when motion is allowed", () => {
    mockReducedMotion(false);
    applyTheme("dark", el, { transition: true });
    const style = document.getElementById("the-switch-transition");
    expect(style).not.toBeNull();
    expect(style?.textContent ?? "").toContain("transition");
  });

  it("writes NO transition under prefers-reduced-motion", () => {
    mockReducedMotion(true);
    applyTheme("dark", el, { transition: true });
    expect(document.getElementById("the-switch-transition")).toBeNull();
  });

  it("lets a user preset override the built-in default token", () => {
    const sentinel = "rgb(1, 2, 3)";

    // The 3rd arg is { transition?, presets? }; overrides go in the presets
    // envelope keyed by skin, merged over the built-in tokens.
    applyTheme("sunny", el, { presets: { sunny: { "--ts-bg": sentinel } } });

    expect(el.style.getPropertyValue("--ts-bg").trim()).toBe(sentinel);
  });

  it("defaults its target to the document root", () => {
    applyTheme("night");
    expect(document.documentElement.getAttribute("data-atmos-skin")).toBe(
      "night",
    );
    clearTheme();
  });
});

describe("clearTheme", () => {
  it("removes the --ts-* properties and the data-atmos-skin attribute", () => {
    applyTheme("stormy", el);
    expect(el.getAttribute("data-atmos-skin")).toBe("stormy");

    clearTheme(el);

    expect(el.hasAttribute("data-atmos-skin")).toBe(false);
    for (const key of Object.keys(SKIN_PRESETS.stormy)) {
      const prop = key.startsWith("--ts-") ? key : `--ts-${key}`;
      expect(el.style.getPropertyValue(prop)).toBe("");
    }
  });
});
