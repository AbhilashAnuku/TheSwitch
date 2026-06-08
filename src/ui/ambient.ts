/**
 * TheSwitch — ambient graphics layer.
 *
 * A single fixed, full-viewport, pointer-events:none canvas mounted at the root
 * that paints a per-skin "weather mood": drifting stars at night, falling snow,
 * rain streaks, a warm sun glow, drifting fog, wind streaks, and lightning in a
 * storm. It is the visible motion behind the tokens — switch skin and the whole
 * page's atmosphere changes, not just its colours.
 *
 * Privacy & safety: no network, no input capture (pointer-events: none), no
 * innerHTML. Respects prefers-reduced-motion (paints one static frame, no
 * animation) and pauses entirely while the tab is hidden. If the environment
 * has no 2D canvas (e.g. jsdom/SSR), it mounts inertly and does nothing.
 */
import type { Skin } from "../core/atmosphere";

export interface AmbientOptions {
  /** Stacking order of the layer. Defaults below the HUD, above the page. */
  zIndex?: number;
  /** Overall layer opacity (0–1). Defaults to a tasteful 0.55. */
  opacity?: number;
}

export interface AmbientHandle {
  /** Cross-fade to a new skin's scene. */
  setSkin(skin: Skin): void;
  /** Remove the layer and stop all animation. */
  destroy(): void;
}

type ParticleKind = "stars" | "dust" | "snow" | "rain" | "streak" | "fog" | "none";

interface Scene {
  kind: ParticleKind;
  count: number;
  color: string;
  /** A soft CSS gradient painted under the particles (cross-fades on change). */
  backdrop: string;
  /** Horizontal drift, px/sec. */
  wind: number;
  /** Occasional full-screen lightning flashes. */
  lightning: boolean;
  blend: "screen" | "normal";
}

const HOST_ID = "the-switch-ambient";

const SCENES: Record<Skin, Scene> = {
  light: {
    kind: "dust",
    count: 16,
    color: "rgba(90,110,140,0.30)",
    backdrop: "radial-gradient(1100px 600px at 80% -10%, rgba(255,236,190,0.18), transparent 60%)",
    wind: 6,
    lightning: false,
    blend: "normal",
  },
  dark: {
    kind: "stars",
    count: 46,
    color: "rgba(200,212,240,0.55)",
    backdrop: "radial-gradient(900px 520px at 50% 120%, rgba(96,165,250,0.10), transparent 60%)",
    wind: 3,
    lightning: false,
    blend: "screen",
  },
  sunny: {
    kind: "dust",
    count: 26,
    color: "rgba(255,205,120,0.5)",
    backdrop: "radial-gradient(1200px 640px at 82% -12%, rgba(255,196,84,0.30), transparent 58%)",
    wind: 10,
    lightning: false,
    blend: "screen",
  },
  snow: {
    kind: "snow",
    count: 130,
    color: "rgba(255,255,255,0.92)",
    backdrop: "linear-gradient(180deg, rgba(193,221,250,0.22), transparent 42%)",
    wind: 14,
    lightning: false,
    blend: "normal",
  },
  windy: {
    kind: "streak",
    count: 64,
    color: "rgba(150,180,168,0.5)",
    backdrop: "linear-gradient(110deg, rgba(20,184,166,0.08), transparent 40%)",
    wind: 240,
    lightning: false,
    blend: "screen",
  },
  watery: {
    kind: "rain",
    count: 220,
    color: "rgba(150,196,236,0.5)",
    backdrop: "linear-gradient(180deg, rgba(20,70,110,0.16), transparent 55%)",
    wind: 40,
    lightning: false,
    blend: "screen",
  },
  foggy: {
    kind: "fog",
    count: 7,
    color: "rgba(208,213,219,0.12)",
    backdrop: "linear-gradient(180deg, rgba(206,210,214,0.16), rgba(206,210,214,0.04) 60%, transparent)",
    wind: 18,
    lightning: false,
    blend: "normal",
  },
  stormy: {
    kind: "rain",
    count: 300,
    color: "rgba(176,196,232,0.55)",
    backdrop: "linear-gradient(180deg, rgba(10,14,22,0.30), transparent 60%)",
    wind: 130,
    lightning: true,
    blend: "screen",
  },
  night: {
    kind: "stars",
    count: 80,
    color: "rgba(222,226,255,0.62)",
    backdrop: "radial-gradient(900px 520px at 85% 8%, rgba(167,139,250,0.20), transparent 60%)",
    wind: 4,
    lightning: false,
    blend: "screen",
  },
};

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  /** Phase for twinkle/sway. */
  p: number;
  /** Length for line particles (rain/streak). */
  len: number;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function createAmbient(skin: Skin, opts: AmbientOptions = {}): AmbientHandle {
  const noop: AmbientHandle = { setSkin() {}, destroy() {} };
  if (typeof document === "undefined") return noop;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("aria-hidden", "true");
  const z = opts.zIndex ?? 2147483000;
  const opacity = opts.opacity ?? 0.55;
  host.style.cssText =
    `position:fixed;inset:0;pointer-events:none;z-index:${z};` +
    `opacity:${opacity};overflow:hidden;` +
    `transition:background 900ms ease,opacity 600ms ease;`;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
  host.appendChild(canvas);
  document.body.appendChild(host);

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext ? canvas.getContext("2d") : null;
  } catch {
    ctx = null;
  }
  if (!ctx) {
    // No 2D canvas (jsdom/SSR): keep the backdrop tint only, stay inert.
    host.style.background = SCENES[skin].backdrop;
    host.style.mixBlendMode = SCENES[skin].blend;
    return {
      setSkin(next) {
        host.style.background = SCENES[next].backdrop;
        host.style.mixBlendMode = SCENES[next].blend;
      },
      destroy() {
        host.remove();
      },
    };
  }

  let scene = SCENES[skin];
  let particles: Particle[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let flash = 0; // 0..1 lightning intensity
  let nextBolt = 2 + rand(0, 4);
  let destroyed = false;
  const still = reducedMotion();

  host.style.background = scene.backdrop;
  host.style.mixBlendMode = scene.blend;

  function resize(): void {
    dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    width = host.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0);
    height = host.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 0);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed(): void {
    const n = width < 560 ? Math.round(scene.count * 0.55) : scene.count;
    particles = [];
    for (let i = 0; i < n; i++) particles.push(spawn(true));
  }

  function spawn(initial: boolean): Particle {
    const kind = scene.kind;
    const y = initial ? rand(0, height) : -10;
    if (kind === "rain") {
      return {
        x: rand(0, width + 120),
        y: initial ? rand(0, height) : -20,
        r: rand(0.6, 1.2),
        vx: scene.wind,
        vy: rand(620, 920),
        p: 0,
        len: rand(10, 20),
      };
    }
    if (kind === "streak") {
      return {
        x: initial ? rand(0, width) : -40,
        y: rand(0, height),
        r: rand(0.5, 1.4),
        vx: scene.wind + rand(-40, 60),
        vy: rand(-8, 8),
        p: 0,
        len: rand(18, 46),
      };
    }
    if (kind === "snow") {
      return {
        x: rand(0, width),
        y,
        r: rand(1.2, 3.4),
        vx: scene.wind,
        vy: rand(28, 70),
        p: rand(0, Math.PI * 2),
        len: 0,
      };
    }
    if (kind === "fog") {
      return {
        x: rand(-0.2 * width, width),
        y: rand(0, height),
        r: rand(140, 320),
        vx: scene.wind + rand(-6, 10),
        vy: rand(-4, 4),
        p: rand(0, Math.PI * 2),
        len: 0,
      };
    }
    // stars / dust
    return {
      x: rand(0, width),
      y: rand(0, height),
      r: kind === "stars" ? rand(0.6, 1.8) : rand(0.6, 2.4),
      vx: scene.wind + rand(-4, 6),
      vy: rand(-6, 8),
      p: rand(0, Math.PI * 2),
      len: 0,
    };
  }

  function step(dt: number): void {
    const k = scene.kind;
    for (const pt of particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.p += dt;
      if (k === "snow") pt.x += Math.sin(pt.p * 1.4) * 14 * dt;
      // recycle when out of bounds
      if (pt.y - pt.r > height + 24 || pt.x - pt.r > width + 60 || pt.x + pt.r < -60) {
        Object.assign(pt, spawn(false));
        if (k === "stars" || k === "dust" || k === "fog") {
          pt.x = rand(0, width);
          pt.y = rand(0, height);
        }
      }
    }
    if (scene.lightning) {
      nextBolt -= dt;
      if (nextBolt <= 0) {
        flash = 1;
        nextBolt = 2.5 + rand(0, 5);
      }
      if (flash > 0) flash = Math.max(0, flash - dt * 3.2);
    }
  }

  function draw(): void {
    ctx!.clearRect(0, 0, width, height);
    const k = scene.kind;
    ctx!.fillStyle = scene.color;
    ctx!.strokeStyle = scene.color;

    if (k === "rain" || k === "streak") {
      ctx!.lineCap = "round";
      for (const pt of particles) {
        const horizontal = k === "streak";
        ctx!.lineWidth = pt.r;
        ctx!.beginPath();
        ctx!.moveTo(pt.x, pt.y);
        if (horizontal) ctx!.lineTo(pt.x - pt.len, pt.y);
        else ctx!.lineTo(pt.x - pt.vx * 0.02, pt.y + pt.len);
        ctx!.stroke();
      }
    } else if (k === "fog") {
      for (const pt of particles) {
        const g = ctx!.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.r);
        g.addColorStop(0, scene.color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    } else if (k !== "none") {
      for (const pt of particles) {
        const tw = k === "stars" ? 0.55 + 0.45 * Math.sin(pt.p * 2.2) : 1;
        ctx!.globalAlpha = tw;
        ctx!.beginPath();
        ctx!.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    if (flash > 0) {
      ctx!.fillStyle = `rgba(255,255,255,${0.5 * flash})`;
      ctx!.fillRect(0, 0, width, height);
    }
  }

  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start(): void {
    if (destroyed || raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop(): void {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  const onResize = (): void => resize();
  const onVisibility = (): void => {
    if (document.hidden || still) stop();
    else start();
  };

  resize();
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  if (still) {
    // One static frame, no animation.
    step(0);
    draw();
  } else {
    start();
  }

  return {
    setSkin(next: Skin): void {
      if (destroyed) return;
      scene = SCENES[next];
      host.style.background = scene.backdrop;
      host.style.mixBlendMode = scene.blend;
      nextBolt = 2 + rand(0, 4);
      flash = 0;
      seed();
      if (still) {
        step(0);
        draw();
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      stop();
      if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      host.remove();
    },
  };
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
