/**
 * Skin legibility guard.
 *
 * Switching atmospheres must never harm readability, so every registered skin
 * is held to WCAG AA (4.5:1) on the pairs that carry text: body on background,
 * text and muted text on surfaces, and the computed on-primary / on-accent
 * foregrounds over their fills. If a new skin (or a palette tweak) drops below
 * AA, this fails — the colour is fixed, not the test.
 */
import { describe, expect, it } from "vitest";
import { BUILTIN_SKINS, tokensFor } from "./skins";
import { contrastRatio } from "./color";

const AA = 4.5;

describe("skin palettes — WCAG AA legibility on every atmosphere", () => {
  for (const skin of BUILTIN_SKINS) {
    const t = tokensFor(skin);
    const text = t["--switch-text"]!;
    const bg = t["--switch-bg"]!;
    const surface = t["--switch-surface"]!;
    const muted = t["--switch-muted"]!;
    const primary = t["--switch-primary"]!;
    const secondary = t["--switch-secondary"]!;
    const accent = t["--switch-accent"]!;
    const onPrimary = t["--switch-on-primary"]!;
    const onAccent = t["--switch-on-accent"]!;

    describe(skin.name, () => {
      it("body text on background is AA", () => {
        expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(AA);
      });
      it("text on surface is AA", () => {
        expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(AA);
      });
      it("muted text on surface is AA", () => {
        expect(contrastRatio(muted, surface)).toBeGreaterThanOrEqual(AA);
      });
      it("on-primary text reads over the whole primary→secondary gradient", () => {
        expect(contrastRatio(onPrimary, primary)).toBeGreaterThanOrEqual(AA);
        expect(contrastRatio(onPrimary, secondary)).toBeGreaterThanOrEqual(AA);
      });
      it("on-accent text reads over the accent", () => {
        expect(contrastRatio(onAccent, accent)).toBeGreaterThanOrEqual(AA);
      });
    });
  }
});
