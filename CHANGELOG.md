# Changelog

All notable changes to **TheSwitch** are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## [Unreleased]

### Changed

- **`auto` now resolves one *fused* atmosphere instead of separate modes.** Time
  of day, season, location and live weather no longer compete — they combine
  through a single resolver, so a rainy dusk, a clear winter night and a hot
  clear noon each land on their own cinematic skin (with the matching ambient).
  - `auto: "sync"` is the new adaptive default (was `"time"`). With no
    geolocation opt-in it stays fully offline (clock + hemisphere only) yet still
    resolves a cinematic skin from the hour and season.
  - `auto: "system"` is unchanged — follow only the OS light/dark setting.
  - `auto: "time"` and `auto: "weather"` are kept as **deprecated aliases** of
    `"sync"` (`time` = without geolocation, `weather` = with it). No breaking
    change to existing configs.
- **Adaptive mode now uses the cinematic named skins** (the same vocabulary as a
  manual pick), not the legacy mood palettes — so `auto` and manual selection
  look like one system.

### Added

- **Adaptive-only atmospheres** `daylight`, `overcast`, `mist` — registered for
  the `sync` resolver to cover a bright clear day, an overcast sky and fog, each
  with the correct ambient. They are intentionally **not** in the manual
  next/prev rotation (the nine headline skins are unchanged).

## [0.1.0]

Initial release.

### Added

- **Adaptive atmosphere engine** — derives the moment from the local clock and
  hemisphere (time of day → `dawn` / `day` / `dusk` / `night`, hemisphere-aware
  season) and, only with explicit opt-in, from location + live weather. The
  zero-config path is fully offline and makes no network calls.
- **Opt-in location & live weather** via [Open-Meteo](https://open-meteo.com/) —
  free, no API key, CORS-enabled. The weather provider is the only module that
  ever touches the network, and only when the visitor opts in (geolocation prompt)
  or fixed coordinates are supplied.
- **Nine skins** — `light`, `dark`, `sunny`, `snow`, `windy`, `watery`, `foggy`,
  `stormy`, `night` — each with a built-in token preset, selected from the
  atmosphere by a fixed precedence (stormy → snow → watery → foggy → windy →
  sunny → night → light/dark).
- **`--ts-*` token presets** applied to the theming root, plus `[data-atmos-*]`
  state attributes (`skin`, `theme`, `daypart`, `season`, `weather`) for CSS
  targeting and per-skin overrides.
- **The `TheSwitch` orchestrator** — headless class that detects the atmosphere,
  applies the theme, exposes mode override (`auto` / `light` / `dark`) and the
  live-weather opt-in, supports periodic refresh, and emits state changes to
  subscribers.
- **Shadow-DOM widget** — a floating control (Auto / Light / Dark + live-weather
  opt-in), CSS-isolated in a shadow root, keyboard-navigable, ARIA-labelled, and
  respecting `prefers-reduced-motion`.
- **Drop-in IIFE** (`the-switch.global.js`) exposing `window.TheSwitch`, with
  `data-*` auto-initialization (`data-the-switch`, `data-mode`,
  `data-use-geolocation`, `data-latitude`, `data-longitude`, `data-refresh`,
  `data-widget`, `data-position`).
- **Framework adapters** for React, Vue and Svelte (thin wrappers over the same
  engine), shipped as separate subpath entries so the main bundle stays free of
  peer dependencies.
- **Zero runtime dependencies.** `react` and `vue` are optional peer dependencies
  used solely by their adapters.

[0.1.0]: https://github.com/abhilash/theswitch/releases/tag/v0.1.0
