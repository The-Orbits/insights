import { defineConfig } from "tsup";

// One build, so the components share index's module, and its state, rather than bundling a copy of it. Everything here
// runs in the browser: "use client", which bundling would drop, goes back on every file.
export default defineConfig({
  entry: { index: "src/index.ts", react: "src/react.tsx", next: "src/next.tsx" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react"],
  banner: { js: '"use client";' },
});
