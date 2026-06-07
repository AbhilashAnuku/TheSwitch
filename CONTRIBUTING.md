# Contributing to TheSwitch

**Contributors welcome!** 🎉 TheSwitch is a from-scratch, zero-dependency,
privacy-first library, and we keep it that way on purpose. Issues, ideas, docs,
and PRs are all valued — beginners included.

## Ground rules
- **Zero runtime dependencies.** `dependencies` in `package.json` stays empty.
  (React/Vue are *optional* peer deps for the adapters only.)
- **Theming only.** Time/season/weather-adaptive skins and tokens. Translation
  lives in the sibling library, [Mr.Latin](https://github.com/AbhilashAnuku/mr.latin).
- **Privacy-first.** No network by default. Location and live weather are
  **explicit opt-in**; with no opt-in the library uses only the local clock and
  hemisphere. See [SECURITY.md](./SECURITY.md).
- **Public API is a contract.** Add before you change; deprecate before you
  remove. Breaking changes are a major version bump.

## Getting started
```bash
npm install
npm run dev        # watch build
npm run typecheck
npm test
npm run build
```
Then serve the folder and open `demo/index.html` over http to try it live
(e.g. `npx http-server . -p 5002` → http://localhost:5002/demo/).

## Definition of done
A change is done only when **typecheck, test, and build all pass**. CI runs these
on Node 18/20/22 for every PR.

## Submitting a PR
1. Fork & branch from `main`.
2. Make the change *with tests* (keep the no-network-by-default guarantee tested).
3. Run the full check suite above.
4. Open a PR using the template — be clear and kind.

By contributing, you agree your work is licensed under the project's
[MIT License](./LICENSE), and to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).
