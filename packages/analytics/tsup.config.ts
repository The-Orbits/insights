import { readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";

// One build, so the components share index's module, and its state, rather than bundling a copy of it. Bundling drops
// "use client", so it goes back on the React components afterwards, and only there: Vite warns about it anywhere else.
export default defineConfig({
  entry: { index: "src/index.ts", react: "src/react.tsx", next: "src/next.tsx", vue: "src/vue.ts", sveltekit: "src/sveltekit.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "next", "next/navigation", "vue", /^\$app\//],
  async onSuccess() {
    for (const file of ["react.js", "react.cjs", "next.js", "next.cjs"]) {
      const path = `dist/${file}`;
      await writeFile(path, `"use client";\n${await readFile(path, "utf8")}`);
    }
  },
});
