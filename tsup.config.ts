import { defineConfig } from "tsup";

/**
 * Two build passes:
 *  A — the npm package: ESM + CJS, with .d.ts, for the main entry and each
 *      framework adapter. Output extensions are mapped so the emitted files
 *      line up exactly with package.json's "exports" map.
 *  B — the standalone <script> bundle: a minified IIFE that puts the class on
 *      window.TheSwitch for drop-in, no-build usage via a CDN.
 */
export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      react: "src/adapters/react.ts",
      vue: "src/adapters/vue.ts",
      svelte: "src/adapters/svelte.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    treeshake: true,
    sourcemap: false,
    target: "es2021",
    external: ["react", "vue"],
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".js" };
    },
  },
  {
    entry: {
      "the-switch": "src/global.ts",
    },
    format: ["iife"],
    globalName: "TheSwitch",
    dts: false,
    minify: true,
    sourcemap: false,
    platform: "browser",
    target: "es2019",
    footer: {
      js: "TheSwitch = TheSwitch.default;",
    },
  },
]);
