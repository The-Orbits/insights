import { defineConfig } from "tsup";

// Classic scripts, not modules: document.currentScript, which carries the loader's settings, is null in a module.
export default defineConfig({
  entry: { analytics: "src/entries/analytics.ts", "speed-insights": "src/entries/speed-insights.ts" },
  format: ["iife"],
  outExtension: () => ({ js: ".js" }),
  minify: true,
  clean: true,
  target: "es2020",
  noExternal: [/.*/],
});
