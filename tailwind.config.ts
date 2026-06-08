import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "./theme/**/*.{ts,tsx}",
  ],
  darkMode: ["class"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
