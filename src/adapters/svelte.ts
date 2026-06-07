/**
 * TheSwitch — Svelte adapter.
 *
 * Provides the two idioms Svelte users reach for:
 *   1. `theSwitch` — a use:action that binds a headless engine to a node for
 *      that node's lifetime, with reactive option updates and auto-teardown.
 *   2. `createTheSwitch` — a Svelte-compatible readable store of engine state
 *      plus imperative setters, for app-wide use.
 *
 * The Svelte store contract is structural (an object exposing `subscribe`), so
 * this adapter implements it directly and pulls in NO `svelte` dependency,
 * keeping the library's runtime-dependency-free guarantee intact.
 */
import { TheSwitch } from "../core/the-switch";
import type {
  Mode,
  TheSwitchOptions,
  TheSwitchState,
} from "../core/the-switch";

/** Minimal Svelte store contract: a value subscription returning an unsubscribe. */
export type Subscriber<T> = (value: T) => void;
export type Unsubscriber = () => void;
export interface Readable<T> {
  subscribe(run: Subscriber<T>): Unsubscriber;
}

/** A reactive store of TheSwitch state with imperative controls attached. */
export interface TheSwitchStore extends Readable<TheSwitchState> {
  /** Override the mode preference. */
  setMode: (mode: Mode) => void;
  /** Opt in/out of live (location + weather) atmosphere at runtime. */
  setLiveWeather: (enabled: boolean) => void;
  /** Stop the engine and release all listeners/DOM/timers. */
  destroy: () => void;
}

/**
 * Create and start an engine, exposing its state as a Svelte readable store.
 * Callers are responsible for `destroy()` when the store is no longer needed
 * (e.g. in a component's `onDestroy`).
 */
export function createTheSwitch(options: TheSwitchOptions = {}): TheSwitchStore {
  const engine = new TheSwitch(options);
  engine.start();

  return {
    subscribe(run: Subscriber<TheSwitchState>): Unsubscriber {
      // Emit current state immediately, per Svelte store semantics.
      run(engine.getState());
      return engine.subscribe(run);
    },
    setMode: (mode) => engine.setMode(mode),
    setLiveWeather: (enabled) => engine.setLiveWeather(enabled),
    destroy: () => engine.destroy(),
  };
}

/**
 * Svelte action: `<div use:theSwitch={{ mode: "auto" }} />`.
 *
 * Binds a fresh engine to `node` (the theming root) for the node's lifetime.
 * Returns the Svelte action contract with `update` (re-apply changed options)
 * and `destroy` (full teardown) handlers.
 */
export function theSwitch(
  node: HTMLElement,
  options: TheSwitchOptions = {},
): { update: (options: TheSwitchOptions) => void; destroy: () => void } {
  let engine = new TheSwitch({ ...options, target: node });
  engine.start();

  return {
    update(next: TheSwitchOptions = {}): void {
      // Recreate to apply structural option changes cleanly; the engine owns
      // its own DOM cleanup on destroy.
      engine.destroy();
      engine = new TheSwitch({ ...next, target: node });
      engine.start();
    },
    destroy(): void {
      engine.destroy();
    },
  };
}

export default theSwitch;
