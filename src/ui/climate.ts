/**
 * TheSwitch — realistic climate layer (opt-in).
 *
 * A refined, nature-connected ambient that reflects the *weather*, not a toy
 * particle field: warm sun god-rays, rain drops + streaks, six-point snow
 * crystals, and drifting fog/mist. Tasteful and low-key by default — it enhances
 * the mood without fighting the content.
 *
 * Off unless a site opts into climate mode. Privacy/safety: no network, no input
 * capture (pointer-events: none), no innerHTML. Honours prefers-reduced-motion
 * (one calm static frame) and pauses while the tab is hidden. Inert (no crash)
 * where there is no 2D canvas (jsdom/SSR).
 */
export type ClimateScene = "clear" | "rays" | "rain" | "snow" | "fog" | "stars" | "waves";
export type ClimateIntensity = "subtle" | "normal" | "vivid";

export interface ClimateOptions {
  zIndex?: number;
  intensity?: ClimateIntensity;
  /** Tint colour for rays/fog (usually the theme accent). */
  accent?: string;
}

export interface ClimateHandle {
  setScene(scene: ClimateScene): void;
  setIntensity(intensity: ClimateIntensity): void;
  destroy(): void;
}

const HOST_ID = "the-switch-climate";

const INTENSITY: Record<ClimateIntensity, number> = {
  subtle: 0.6,
  normal: 1,
  vivid: 1.5,
};

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Pre-render a soft six-point snow crystal to an offscreen canvas (cheap to blit). */
function makeCrystal(size: number, color: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext ? c.getContext("2d") : null;
  if (!x) return null;
  const r = size / 2;
  x.translate(r, r);
  x.strokeStyle = color;
  x.lineCap = "round";
  x.lineWidth = Math.max(1, size * 0.05);
  for (let i = 0; i < 6; i++) {
    x.rotate(Math.PI / 3);
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(0, -r * 0.82);
    // two little branches
    x.moveTo(0, -r * 0.5);
    x.lineTo(r * 0.22, -r * 0.66);
    x.moveTo(0, -r * 0.5);
    x.lineTo(-r * 0.22, -r * 0.66);
    x.moveTo(0, -r * 0.7);
    x.lineTo(r * 0.16, -r * 0.82);
    x.moveTo(0, -r * 0.7);
    x.lineTo(-r * 0.16, -r * 0.82);
    x.stroke();
  }
  return c;
}

interface Drop { x: number; y: number; vy: number; len: number; w: number; }
interface Flake { x: number; y: number; vy: number; vx: number; rot: number; vr: number; s: number; sprite: number; }
interface Ripple { x: number; y: number; r: number; max: number; }

export function createClimate(
  scene: ClimateScene,
  opts: ClimateOptions = {},
): ClimateHandle {
  const noop: ClimateHandle = { setScene() {}, setIntensity() {}, destroy() {} };
  if (typeof document === "undefined") return noop;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    `position:fixed;inset:0;pointer-events:none;z-index:${opts.zIndex ?? 2147483000};` +
    `overflow:hidden;`;
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
    return {
      setScene() {},
      setIntensity() {},
      destroy() { host.remove(); },
    };
  }

  const c = ctx;
  const accent = opts.accent ?? "#9fb4ff";
  let mult = INTENSITY[opts.intensity ?? "normal"];
  let current = scene;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let t = 0;
  let destroyed = false;
  const still = reducedMotion();

  let drops: Drop[] = [];
  let flakes: Flake[] = [];
  let ripples: Ripple[] = [];
  let stars: { x: number; y: number; p: number; s: number }[] = [];
  const crystals = [
    makeCrystal(26, "rgba(255,255,255,0.9)"),
    makeCrystal(20, "rgba(235,245,255,0.85)"),
    makeCrystal(14, "rgba(255,255,255,0.8)"),
  ].filter(Boolean) as HTMLCanvasElement[];

  function resize(): void {
    dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    width = typeof window !== "undefined" ? window.innerWidth : 0;
    height = typeof window !== "undefined" ? window.innerHeight : 0;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed(): void {
    drops = [];
    flakes = [];
    ripples = [];
    stars = [];
    const area = (width * height) / (1280 * 720);
    if (current === "rain") {
      const n = Math.round(140 * area * mult);
      for (let i = 0; i < n; i++) {
        drops.push({ x: rand(0, width), y: rand(0, height), vy: rand(620, 920), len: rand(9, 18), w: rand(0.6, 1.3) });
      }
    } else if (current === "snow") {
      const n = Math.round(70 * area * mult);
      for (let i = 0; i < n; i++) {
        flakes.push({
          x: rand(0, width), y: rand(0, height), vy: rand(22, 55), vx: rand(-10, 10),
          rot: rand(0, Math.PI * 2), vr: rand(-0.5, 0.5), s: rand(0.4, 1), sprite: Math.floor(rand(0, crystals.length)),
        });
      }
    } else if (current === "stars") {
      const n = Math.round(90 * area * mult);
      for (let i = 0; i < n; i++) {
        stars.push({ x: rand(0, width), y: rand(0, height), p: rand(0, Math.PI * 2), s: rand(0.6, 1.9) });
      }
    }
  }

  function step(dt: number): void {
    t += dt;
    if (current === "rain") {
      for (const d of drops) {
        d.y += d.vy * dt;
        d.x += 22 * dt;
        if (d.y > height) {
          if (Math.random() < 0.5) ripples.push({ x: d.x, y: height - rand(2, 26), r: 0, max: rand(6, 14) });
          d.y = rand(-40, 0);
          d.x = rand(0, width);
        }
      }
      for (const rp of ripples) rp.r += dt * 26;
      ripples = ripples.filter((rp) => rp.r < rp.max);
    } else if (current === "snow") {
      for (const f of flakes) {
        f.y += f.vy * dt;
        f.x += (f.vx + Math.sin((t + f.x) * 0.5) * 10) * dt;
        f.rot += f.vr * dt;
        if (f.y - 20 > height) { f.y = -20; f.x = rand(0, width); }
      }
    } else if (current === "stars") {
      for (const s of stars) s.p += dt;
    }
  }

  function draw(): void {
    c.clearRect(0, 0, width, height);
    const o = mult;
    if (current === "rays") drawRays(o);
    else if (current === "rain") drawRain(o);
    else if (current === "snow") drawSnow(o);
    else if (current === "fog") drawFog(o);
    else if (current === "stars") drawStars(o);
    else if (current === "waves") drawWaves(o);
    // "clear" paints nothing.
  }

  function drawRays(o: number): void {
    // Warm light shafts from the top-right, slowly breathing.
    const ox = width * 0.86;
    const oy = -height * 0.12;
    const glow = c.createRadialGradient(ox, oy, 0, ox, oy, Math.max(width, height) * 0.9);
    glow.addColorStop(0, withA(accent, 0.16 * o));
    glow.addColorStop(0.4, withA(accent, 0.05 * o));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, width, height);
    c.save();
    c.globalCompositeOperation = "lighter";
    c.translate(ox, oy);
    const shafts = 7;
    for (let i = 0; i < shafts; i++) {
      const a = (i / shafts) * 0.9 + 0.6 + Math.sin(t * 0.15 + i) * 0.02;
      const w = (0.05 + (i % 2) * 0.03);
      c.save();
      c.rotate(a);
      const len = Math.max(width, height) * 1.2;
      const g = c.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, withA("#fff7e6", 0.10 * o));
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-len * w, len);
      c.lineTo(len * w, len);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();
  }

  function drawRain(o: number): void {
    c.strokeStyle = withA("#cfe0f5", 0.5 * o);
    c.lineCap = "round";
    for (const d of drops) {
      c.lineWidth = d.w;
      c.beginPath();
      c.moveTo(d.x, d.y);
      c.lineTo(d.x - 1.4, d.y + d.len);
      c.stroke();
    }
    c.strokeStyle = withA("#cfe0f5", 0.25 * o);
    c.lineWidth = 1;
    for (const rp of ripples) {
      const a = 1 - rp.r / rp.max;
      c.globalAlpha = a * 0.5;
      c.beginPath();
      c.ellipse(rp.x, rp.y, rp.r, rp.r * 0.4, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  function drawSnow(o: number): void {
    c.globalAlpha = Math.min(1, 0.9 * o);
    for (const f of flakes) {
      const sprite = crystals[f.sprite];
      if (!sprite) continue;
      const size = sprite.width * f.s;
      c.save();
      c.translate(f.x, f.y);
      c.rotate(f.rot);
      c.drawImage(sprite, -size / 2, -size / 2, size, size);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  function drawFog(o: number): void {
    const bands = 4;
    for (let i = 0; i < bands; i++) {
      const y = (height / bands) * i + Math.sin(t * 0.1 + i) * 18;
      const drift = ((t * (8 + i * 4)) % (width + 600)) - 300;
      const g = c.createRadialGradient(drift, y, 0, drift, y, 520);
      const a = (0.10 + i * 0.015) * o;
      g.addColorStop(0, withA("#dfe6ee", a));
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, width, height);
    }
  }

  function drawStars(o: number): void {
    c.fillStyle = "#dfe6ff";
    for (const s of stars) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(s.p * 1.6));
      c.globalAlpha = Math.min(1, tw * o);
      c.beginPath();
      c.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function drawWaves(o: number): void {
    const layers = 3;
    for (let l = 0; l < layers; l++) {
      const baseY = height * (0.72 + l * 0.085);
      const amp = 10 + l * 6;
      const phase = t * (30 + l * 18);
      c.beginPath();
      c.moveTo(0, height);
      c.lineTo(0, baseY);
      for (let x = 0; x <= width; x += 14) {
        const y = baseY + Math.sin((x + phase) * 0.012 + l) * amp;
        c.lineTo(x, y);
      }
      c.lineTo(width, height);
      c.closePath();
      const g = c.createLinearGradient(0, baseY - amp, 0, height);
      g.addColorStop(0, withA(accent, (0.12 + l * 0.05) * o));
      g.addColorStop(1, withA("#0a2230", (0.06 + l * 0.03) * o));
      c.fillStyle = g;
      c.fill();
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

  function startLoop(): void {
    if (destroyed || raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stopLoop(): void {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  const onResize = (): void => resize();
  const onVisibility = (): void => {
    if (document.hidden || still) stopLoop();
    else startLoop();
  };

  resize();
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  if (still) { step(0); draw(); } else startLoop();

  return {
    setScene(next: ClimateScene): void {
      if (destroyed) return;
      current = next;
      seed();
      if (still) { step(0); draw(); }
    },
    setIntensity(intensity: ClimateIntensity): void {
      if (destroyed) return;
      mult = INTENSITY[intensity];
      seed();
      if (still) { step(0); draw(); }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      host.remove();
    },
  };
}

function withA(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
