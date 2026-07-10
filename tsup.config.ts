import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["cjs"],
    target: "es2019",
    platform: "node",
    dts: true,
    splitting: false,
  },
  // standalone browser bundle, exposed as the `cardanoCodec` global
  {
    entry: { index: "src/browser.ts" },
    format: ["iife"],
    globalName: "cardanoCodec",
    target: "es2019",
    platform: "browser",
    minify: true,
    noExternal: [/.*/],
    outExtension: () => ({ js: ".min.js" }),
    esbuildOptions(options) {
      options.define = { ...options.define, global: "globalThis" };
    },
  },
]);
