# TheSwitch

> TheSwitch flips your theme to match the moment.

**Zero-config, zero-dependency, drop-in adaptive theming for any web page.** Add
one `<script>` tag (or one npm import) and your site's look adapts itself to the
**time of day, the season, the sky, and the weather** — and, only if the visitor
opts in, their **location** for live conditions. No design tokens to hand-author,
no dark-mode toggle to wire up, no build step.

TheSwitch resolves the moment into one of nine coherent **skins**:

`light` · `dark` · `snow` · `windy` · `watery` · `sunny` · `foggy` · `stormy` · `night`

Each skin ships with a built-in token preset, so the page restyles itself the
instant the atmosphere changes — at dawn it warms, at dusk it cools, in the rain
it turns `watery`, under a clear midday sky it goes `sunny`, and after dark it
settles into `night`.

TheSwitch is a **theming-only** library. It changes how the page *looks*; it never
touches the words. Want the page to speak the visitor's language too? That's the
sibling library — see [Pairs with Mr.Latin](#pairs-with-mrlatin).

Built **entirely from scratch**: the atmosphere engine, the skin/token presets,
the orchestrator, the Shadow-DOM widget, the drop-in IIFE and the framework
adapters are all hand-written. **The shipped package has no runtime dependencies.**

---

## Why

Adaptive theming usually means a pile of media queries, a hand-rolled dark-mode
toggle, and a `localStorage` dance — and even then the page looks the same at 3pm
on a clear day as it does at midnight in a storm. TheSwitch reads the *moment*
instead: what time it is, what season it is, and (with opt-in) what the sky is
actually doing — and maps that onto a coherent palette automatically.

## Zero-config and privacy-first

Drop it in and you're done. With no configuration, TheSwitch derives the
atmosphere from the **local clock and the hemisphere alone** — time of day and
season — and picks `light`, `dark` or `night` accordingly. This path is fully
**offline**: it makes **zero network calls**, asks for no permissions, and sends
nothing anywhere.

```html
<script
  src="https://cdn.jsdelivr.net/npm/theswitch/dist/the-switch.global.js"
  data-the-switch
></script>
```

That's the whole integration. A small floating control appears (Auto / Light /
Dark, plus an opt-in for live weather), and the page themes itself.

Live weather is **strictly opt-in**. Until the visitor turns it on — or you set
fixed coordinates — TheSwitch never asks for geolocation and never hits the
network.

## How the atmosphere resolves

TheSwitch derives an `Atmosphere` (daypart, season, sky, temperature, wind) and
maps it to a single **skin** by a fixed precedence so the most consequential
condition wins:

```
stormy → snow → watery (rain) → foggy → windy (high wind)
       → sunny (clear & day) → night → light / dark (time + season)
```

| Signal | Source | Network? |
| --- | --- | --- |
| Time of day (dawn / day / dusk / night) | local clock | no |
| Season (hemisphere-aware) | local clock + latitude | no |
| Sky & weather (clear / clouds / rain / snow / storm / fog) | live, opt-in | yes (opt-in) |
| Temperature & wind | live, opt-in | yes (opt-in) |

When weather is opted in, conditions come from **[Open-Meteo](https://open-meteo.com/)**
— free, no API key, CORS-enabled. It is the *only* module that ever touches the
network, and only when you ask it to. TheSwitch **never bakes in an API key** and
**never calls a vendor unless you opt in**.

## Styling: `--ts-*` variables and `[data-atmos-skin]`

TheSwitch writes its state to the theming root (`<html>` by default) as data
attributes, and exposes a palette of **`--ts-*` CSS custom properties** that
change with the active skin. Style your page against those — no per-skin CSS
required, but every skin is overridable.

```css
/* Consume the tokens — they restyle themselves as the atmosphere changes. */
body {
  background: var(--ts-bg);
  color: var(--ts-text);
}
.card {
  background: var(--ts-surface);
  border: 1px solid var(--ts-border);
  border-radius: var(--ts-radius);
  box-shadow: var(--ts-shadow);
}
a { color: var(--ts-accent); }
```

The core tokens every skin preset defines:

| Token | Meaning |
| --- | --- |
| `--ts-bg` | Page background |
| `--ts-surface` | Raised surfaces (cards, panels) |
| `--ts-text` | Primary text |
| `--ts-muted` | Secondary / muted text |
| `--ts-accent` | Accent / link / focus colour |
| `--ts-border` | Hairline borders |
| `--ts-shadow` | Elevation shadow |
| `--ts-radius` | Corner radius |

Want to retheme just one skin, or react to the raw signals? Every state is also a
selectable attribute on the root:

```css
[data-atmos-skin="stormy"] .hero { filter: contrast(1.1); }
[data-atmos-skin="sunny"]  { --ts-accent: #f59e0b; }   /* override one token */
[data-atmos-weather="rain"] .raindrops { display: block; }
[data-atmos-daypart="night"] .stars { opacity: 1; }
```

| Attribute | Values |
| --- | --- |
| `data-atmos-skin` | `light` `dark` `sunny` `snow` `windy` `watery` `foggy` `stormy` `night` |
| `data-atmos-theme` | `light` `dark` |
| `data-atmos-daypart` | `dawn` `day` `dusk` `night` |
| `data-atmos-season` | `spring` `summer` `autumn` `winter` |
| `data-atmos-weather` | `clear` `clouds` `rain` `snow` `storm` `fog` |

Built-in presets ship for all nine skins, so the page looks coherent out of the
box; your overrides win wherever you set them. Transitions respect
`prefers-reduced-motion`.

## Install

### npm

```bash
npm install theswitch
```

```ts
import { TheSwitch } from "theswitch";

const ts = new TheSwitch({
  mode: "auto",          // "auto" | "light" | "dark"
  useGeolocation: false, // opt-in live weather (default: private, offline)
  widget: true,          // floating control (false, or { position })
});

ts.start();

// Drive it from your own UI if you prefer:
ts.setMode("dark");
ts.setLiveWeather(true); // opts into geolocation, then themes by the sky
```

Reach for the headless helpers directly when you want the signals without the
orchestrator:

```ts
import { detectAtmosphere, deriveSkin, applyTheme } from "theswitch";

const atmos = await detectAtmosphere();   // offline unless useGeolocation: true
const skin = deriveSkin(atmos);           // e.g. "night"
applyTheme(skin);                         // writes the --ts-* tokens
```

### CDN script tag

No build step at all — drop in the global build and configure it with `data-*`
attributes. It auto-initializes on load and exposes `window.TheSwitch`.

```html
<script
  src="https://cdn.jsdelivr.net/npm/theswitch/dist/the-switch.global.js"
  data-the-switch
  data-mode="auto"
  data-position="bottom-right"
></script>
```

Prefer to wire it up by hand? The global also exposes the class:

```html
<script src="https://cdn.jsdelivr.net/npm/theswitch/dist/the-switch.global.js"></script>
<script>
  new TheSwitch({ mode: "auto", widget: true }).start();
</script>
```

### data-* attributes

| Attribute | Maps to | Example |
| --- | --- | --- |
| `data-the-switch` | enables auto-init (theming root = the element it sits on, default `<html>`) | (flag, no value) |
| `data-mode` | `mode` | `"auto"`, `"light"`, `"dark"` |
| `data-use-geolocation` | `useGeolocation` (opt-in live weather, prompts) | (flag) or `"true"` |
| `data-latitude` | `latitude` (fixed coords → live weather, no prompt) | `48.85` |
| `data-longitude` | `longitude` (pair with latitude) | `2.35` |
| `data-refresh` | `refreshMinutes` | `30` |
| `data-widget` | `widget` (`"false"` hides the control) | `"false"` |
| `data-position` | `position` | `"bottom-right"` |

## Mode override and live-weather opt-in

**Mode** decides the light/dark axis:

- `auto` *(default)* — TheSwitch picks from the atmosphere (time, season and, if
  opted in, the sky). At night it goes dark; under a clear midday sky it goes
  `sunny`; in the rain, `watery`; and so on.
- `light` / `dark` — pin the light/dark axis. Weather-driven skins still layer on
  top when live weather is enabled, but the base never flips automatically.

**Live weather** is the only thing that ever uses the network, and it is
off by default:

```ts
ts.setLiveWeather(true);  // opts into geolocation, then fetches from Open-Meteo
ts.setLiveWeather(false); // back to offline time + season only
```

Or pin a location with no prompt at all (`data-latitude` / `data-longitude`, or
the `latitude` / `longitude` options) — useful for a venue, a shopfront, or a
weather-aware landing page.

## Framework adapters

The core is framework-agnostic vanilla TypeScript; framework code lives only in
the adapters, which are thin wrappers over the same engine. React and Vue are
**optional peer dependencies** — the main bundle never pulls them in.

```tsx
// React
import { useTheSwitch } from "theswitch/react";

function ThemeToggle() {
  const { skin, mode, setMode } = useTheSwitch({ mode: "auto" });
  return (
    <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
      {skin}
    </button>
  );
}
```

```vue
<!-- Vue -->
<script setup lang="ts">
import { useTheSwitch } from "theswitch/vue";
const { skin, setMode } = useTheSwitch({ mode: "auto" });
</script>
```

```ts
// Svelte
import { theSwitch } from "theswitch/svelte";
const ts = theSwitch({ mode: "auto" });
// $ts.skin, ts.setMode("dark")
```

## Zero dependencies

The published package has **no runtime dependencies**. `react` and `vue` are
**optional peer dependencies** used solely by their adapters; the core,
providers, intl and UI are framework-agnostic vanilla TypeScript with no JSX. The
widget is isolated in a **Shadow DOM** so the host site's CSS can never clash with
it (and vice-versa), it's fully keyboard-navigable with proper ARIA roles, and it
respects `prefers-reduced-motion`.

## Pairs with Mr.Latin

TheSwitch is intentionally theming-only. For translating the page into the
visitor's language — a zero-config, drop-in flag-tile picker that re-speaks the
copy live and RTL-aware — use the sibling library
**[Mr.Latin](../mr.latin)**. The two are designed to sit side by side:
Mr.Latin handles the words, TheSwitch handles the light.

## License

[MIT](./LICENSE) © Abhilash
