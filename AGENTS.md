# AGENTS.md — TheSwitch

Build &amp; verify (run in this folder):

- `npm install`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Ground rules:

- Zero runtime dependencies.
- TheSwitch is **theming only** — translation lives in the sibling library, Mr.Latin.
- The public API (`src/index.ts`, adapters, `data-switch-*`, CDN global) is a
  contract — keep it stable; all checks must pass before committing.
- No telemetry. Network (live weather) is opt-in only; default is fully offline.

See `README.md` for usage.
