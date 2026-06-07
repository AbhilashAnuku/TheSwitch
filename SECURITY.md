# Security Policy

## Reporting a vulnerability
Please report security issues **privately** — do not open a public issue. Use
GitHub's **"Report a vulnerability"** (Security → Advisories) on this repository,
or contact the maintainer directly. We'll acknowledge within a reasonable time
and keep you updated on the fix.

## What TheSwitch guarantees
- **Zero runtime dependencies** — minimal supply-chain surface.
- **No network by default.** With no opt-in, TheSwitch uses only the local clock
  and hemisphere — zero network calls.
- **Location & weather are explicit opt-in.** Live weather uses coarse
  coordinates against a single hardcoded host (Open-Meteo), only after the user
  opts in; it degrades gracefully when denied.
- **No telemetry, no phone-home, no API keys.**
- **DOM-safe.** Styling is applied via CSS custom properties / `setAttribute`,
  never `innerHTML`; the widget is Shadow-DOM isolated.

## Supported versions
The latest published minor (`0.1.x`) receives security fixes.
