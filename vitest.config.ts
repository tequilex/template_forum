import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@theme": resolve(__dirname, "theme"),
      "@db": resolve(__dirname, "drizzle"),
      "@": resolve(__dirname, "src"),
    },
  },
  // Next/React 19 — JSX automatic runtime; в tsconfig стоит "preserve" (для Next).
  // Vitest идёт через esbuild и игнорирует tsconfig.jsx — задаём явно.
  esbuild: { jsx: "automatic" },
});
