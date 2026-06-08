/**
 * TheSwitch — skin transition engine.
 *
 * Plays a brief cinematic transition while the skin swaps underneath:
 *  - "portal" — a coloured circle wipes out from a point, then reveals.
 *  - "flash"  — a quick white flash.
 *  - "fade"   — a colour crossfade.
 *
 * Uses the Web Animations API and removes its overlay when done. Degrades to an
 * instant swap under prefers-reduced-motion, when the WAA is unavailable
 * (e.g. jsdom/SSR), or for type "none" — so it never blocks the theme change.
 */
import type { TransitionType } from "./skins";

export interface RunTransitionOptions {
  type?: TransitionType;
  /** Total duration in ms (split cover/reveal). Default 700. */
  duration?: number;
  /** Overlay colour (usually the target skin's primary/bg). */
  color?: string;
  /** Portal origin in viewport px. Defaults to the centre. */
  origin?: { x: number; y: number };
  reducedMotion?: boolean;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const OVERLAY_Z = 2147483002; // above the ambient layer and the HUD

/**
 * Run a transition. `swap` is invoked exactly once at the peak (covered) point;
 * if the transition can't run, `swap` is called immediately instead.
 */
export function runTransition(
  swap: () => void,
  opts: RunTransitionOptions = {},
): void {
  const type = opts.type ?? "fade";
  const reduced = opts.reducedMotion ?? prefersReducedMotion();

  if (typeof document === "undefined" || type === "none" || reduced) {
    swap();
    return;
  }

  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  const color = opts.color || "#000";
  overlay.style.cssText =
    `position:fixed;inset:0;pointer-events:none;z-index:${OVERLAY_Z};` +
    `background:${type === "flash" ? "#fff" : color};opacity:0;will-change:opacity,clip-path;`;
  document.body.appendChild(overlay);

  // No Web Animations API (jsdom / very old browsers): swap instantly.
  if (typeof overlay.animate !== "function") {
    swap();
    overlay.remove();
    return;
  }

  const total = Math.max(160, opts.duration ?? 700);
  const half = Math.round(total / 2);
  const w = typeof window !== "undefined" ? window.innerWidth : 0;
  const h = typeof window !== "undefined" ? window.innerHeight : 0;
  const ox = opts.origin?.x ?? w / 2;
  const oy = opts.origin?.y ?? h / 2;

  const cleanup = (): void => overlay.remove();
  const reveal = (): void => {
    try {
      const r = overlay.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: half, easing: "ease-in", fill: "forwards" },
      );
      r.onfinish = cleanup;
      r.oncancel = cleanup;
    } catch {
      cleanup();
    }
  };

  try {
    let coverFrames: Keyframe[];
    if (type === "portal") {
      const from = `circle(0% at ${ox}px ${oy}px)`;
      const to = `circle(150% at ${ox}px ${oy}px)`;
      coverFrames = [
        { opacity: 1, clipPath: from, offset: 0 },
        { opacity: 1, clipPath: to, offset: 1 },
      ];
    } else if (type === "flash") {
      coverFrames = [{ opacity: 0 }, { opacity: 0.92 }];
    } else {
      coverFrames = [{ opacity: 0 }, { opacity: 1 }];
    }
    const cover = overlay.animate(coverFrames, {
      duration: half,
      easing: "ease-out",
      fill: "forwards",
    });
    cover.onfinish = (): void => {
      swap();
      reveal();
    };
    cover.oncancel = (): void => {
      swap();
      cleanup();
    };
  } catch {
    swap();
    cleanup();
  }
}
