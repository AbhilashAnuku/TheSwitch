import { afterEach, describe, expect, it } from "vitest";
import { createAmbient } from "./ambient";

function ambientHost(): HTMLElement | null {
  return document.getElementById("the-switch-ambient");
}

afterEach(() => {
  // Belt-and-braces cleanup in case a test forgot to destroy.
  ambientHost()?.remove();
});

describe("ambient layer", () => {
  it("mounts a fixed, non-interactive host at the root", () => {
    const handle = createAmbient("night");
    const host = ambientHost();
    expect(host).not.toBeNull();
    expect(host?.style.position).toBe("fixed");
    expect(host?.style.pointerEvents).toBe("none");
    handle.destroy();
  });

  it("changes the backdrop when the skin changes", () => {
    const handle = createAmbient("snow");
    const host = ambientHost();
    const before = host?.style.background ?? "";
    handle.setSkin("stormy");
    expect(host?.style.background).not.toBe(before);
    expect(host?.style.background).not.toBe("");
    handle.destroy();
  });

  it("removes itself on destroy (idempotent)", () => {
    const handle = createAmbient("sunny");
    expect(ambientHost()).not.toBeNull();
    handle.destroy();
    expect(ambientHost()).toBeNull();
    // Second destroy must not throw.
    expect(() => handle.destroy()).not.toThrow();
  });
});
