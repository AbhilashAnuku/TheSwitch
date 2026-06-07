/**
 * TheSwitch — Vue 3 adapter.
 *
 * The composable equivalent of the React hook: it mounts a single headless
 * engine, mirrors its reactive state into refs, and tears the engine down on
 * scope dispose. `vue` is an optional peer dependency — importing this subpath
 * requires it.
 *
 * Usage:
 *   const { skin, mode, setMode, setLiveWeather } = useTheSwitch({ mode: "auto" });
 */
import { ref, shallowRef, onScopeDispose } from "vue";
import type { Ref } from "vue";
import { TheSwitch } from "../core/the-switch";
import type { Mode, TheSwitchOptions } from "../core/the-switch";
import type { Skin } from "../core/atmosphere";

export interface UseTheSwitch {
  /** The currently applied skin, or null before the first detection settles. */
  skin: Ref<Skin | null>;
  /** The active mode preference: "auto" | "light" | "dark". */
  mode: Ref<Mode>;
  /** Override the mode preference. */
  setMode: (mode: Mode) => void;
  /** Opt in/out of live (location + weather) atmosphere at runtime. */
  setLiveWeather: (enabled: boolean) => void;
}

/**
 * Create and start a TheSwitch engine bound to the current effect scope. The
 * returned refs stay in sync with the engine; the engine is destroyed
 * automatically when the scope is disposed.
 */
export function useTheSwitch(options: TheSwitchOptions = {}): UseTheSwitch {
  const engine = new TheSwitch(options);

  const skin = shallowRef<Skin | null>(engine.skin);
  const mode = ref<Mode>(engine.mode) as Ref<Mode>;

  const unsubscribe = engine.subscribe((state) => {
    skin.value = state.skin;
    mode.value = state.mode;
  });
  engine.start();

  onScopeDispose(() => {
    unsubscribe();
    engine.destroy();
  });

  const setMode = (next: Mode): void => {
    engine.setMode(next);
  };

  const setLiveWeather = (enabled: boolean): void => {
    engine.setLiveWeather(enabled);
  };

  return { skin, mode, setMode, setLiveWeather };
}

export default useTheSwitch;
