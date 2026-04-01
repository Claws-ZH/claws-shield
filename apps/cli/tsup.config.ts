import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  banner: ({ format }) => format === "esm" ? { js: "#!/usr/bin/env node" } : {},
})
