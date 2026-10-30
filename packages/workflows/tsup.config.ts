import { defineConfig } from "tsup";

// Server code: no "use client", nothing bundled from outside.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
});
