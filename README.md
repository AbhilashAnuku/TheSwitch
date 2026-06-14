# TheSwitch

Adaptive, privacy-first theming for modern web apps.

TheSwitch is a zero-dependency TypeScript library that changes a page's theme from real-world context: time of day, season, sky condition, weather, and optional location. It can run fully offline from the local clock, or use opt-in live weather through Open-Meteo.

## Why This Project Matters

Most theme systems stop at light and dark mode. TheSwitch explores a richer approach: a page can feel different at dawn, during a storm, on a snowy day, or at night without the application author wiring every state by hand.

For recruiters and reviewers, this project shows:

- TypeScript library design with a small public API
- Framework-agnostic core with React, Vue, and Svelte adapters
- Privacy-aware browser behavior with opt-in geolocation
- CSS custom property theming and Shadow DOM widget isolation
- Automated CI across Node 18, 20, and 22
- Build, test, typecheck, package, and release workflows

## Features

- Zero runtime dependencies
- Auto theme resolution from time, season, and optional weather
- Nine built-in skins: `light`, `dark`, `snow`, `windy`, `watery`, `sunny`, `foggy`, `stormy`, `night`
- CSS variables exposed as `--ts-*` design tokens
- `data-atmos-*` attributes for custom styling hooks
- Drop-in CDN script with `data-*` configuration
- Optional floating control for Auto / Light / Dark and live-weather opt-in
- React, Vue, and Svelte adapters over the same core engine
- Keyboard-accessible widget with reduced-motion support

## Tech Stack

- TypeScript
- tsup
- Vitest
- jsdom
- GitHub Actions
- Open-Meteo for optional weather data

## Quick Start

### CDN

```html
<script
  src="https://cdn.jsdelivr.net/npm/theswitch/dist/the-switch.global.js"
  data-the-switch
  data-mode="auto"
  data-position="bottom-right"
></script>
```

### npm

```bash
npm install theswitch
```

```ts
import { TheSwitch } from "theswitch";

const theme = new TheSwitch({
  mode: "auto",
  useGeolocation: false,
  widget: true,
});

theme.start();
```

## Styling With Tokens

TheSwitch writes theme tokens to the configured root element.

```css
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
```

You can also target specific atmosphere states:

```css
[data-atmos-skin="stormy"] .hero {
  filter: contrast(1.1);
}

[data-atmos-daypart="night"] .stars {
  opacity: 1;
}
```

## Architecture

The project is split into a framework-agnostic core and thin integration layers.

```text
src/
  core/          atmosphere detection, skin resolution, theme application
  providers/     optional weather/location providers
  widget/        Shadow DOM control
  react/         React adapter
  vue/           Vue adapter
  svelte/        Svelte adapter
```

The core path is offline by default. Live weather is enabled only when the user or integrator opts in.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run pack:dry
```

## Quality Signals

- CI verifies typecheck, test, build, and package dry-run
- Release workflow supports npm provenance
- No runtime dependency surface
- MIT licensed

## Related Project

TheSwitch pairs with [Mr.Latin](https://github.com/AbhilashAnuku/mr.latin), a drop-in translation library. Mr.Latin handles language; TheSwitch handles atmosphere-aware presentation.

## License

[MIT](./LICENSE) © Abhilash Anuku
