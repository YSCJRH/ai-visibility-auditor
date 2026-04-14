import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  noExternal: [/.*/]
});
