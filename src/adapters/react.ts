/**
 * TheSwitch — React adapter.
 *
 * A thin, declarative wrapper around the headless engine. The engine owns all
 * DOM/atmosphere/network work; this hook only mirrors its reactive state into
 * React and tears the engine down on unmount. `react` is an optional peer
 * dependency — importing this subpath requires it.
 *
 * Usage:
 *   const { skin, mode, setMode, setLiveWeather } = useTheSwitch({ mode: "auto" });
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { TheSwitch } from "../core/the-switch";
import type { Mode, TheSwitchOptions } from "../core/the-switch";
import type { Skin } from "../core/atmosphere";

export interface UseTheSwitch {
  /** The currently applied skin, or null before the first detection settles. */
  skin: Skin | null;
  /** The active mode preference: "auto" | "light" | "dark". */
  mode: Mode;
  /** Override the mode preference. */
  setMode: (mode: Mode) => void;
  /** Opt in/out of live (location + weather) atmosphere at runtime. */
  setLiveWeather: (enabled: boolean) => void;
}

/**
 * Mount a single TheSwitch engine for the lifetime of the component and expose
 * its reactive state. Options are read once on mount; change `mode` /
 * `liveWeather` through the returned setters rather than re-passing options.
 */
export function useTheSwitch(options: TheSwitchOptions = {}): UseTheSwitch {
  const engineRef = useRef<TheSwitch | null>(null);
  const optionsRef = useRef(options);

  // Lazily construct so the engine exists synchronously on first render.
  if (engineRef.current === null) {
    engineRef.current = new TheSwitch(optionsRef.current);
  }
  const engine = engineRef.current;

  const [skin, setSkin] = useState<Skin | null>(() => engine.skin);
  const [mode, setModeState] = useState<Mode>(() => engine.mode);

  useEffect(() => {
    const unsubscribe = engine.subscribe((state) => {
      setSkin(state.skin);
      setModeState(state.mode);
    });
    engine.start();
    return () => {
      unsubscribe();
      engine.destroy();
      engineRef.current = null;
    };
    // The engine instance is stable for the component's lifetime.
  }, [engine]);

  const setMode = useCallback(
    (next: Mode) => {
      engine.setMode(next);
    },
    [engine],
  );

  const setLiveWeather = useCallback(
    (enabled: boolean) => {
      engine.setLiveWeather(enabled);
    },
    [engine],
  );

  return { skin, mode, setMode, setLiveWeather };
}

export default useTheSwitch;
