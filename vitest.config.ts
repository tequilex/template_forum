import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@/theme": resolve(__dirname, "theme"),
      "@db": resolve(__dirname, "drizzle"),
    },
  },
  // Next/React 19 — JSX automatic runtime; в tsconfig стоит "preserve" (для Next).
  // Vitest идёт через esbuild и игнорирует tsconfig.jsx — задаём явно.
  esbuild: { jsx: "automatic" },
});
