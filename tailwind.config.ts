import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

// Цвета лежат в --color-* как чистый hex (IDE подсвечивает превью).
// Альфу подмешиваем через color-mix — Tailwind подставит <alpha-value> в момент сборки.
const c = (name: string) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: ["./src/**/*.{ts,tsx}", "./theme/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: c("--color-background"),
        foreground: c("--color-foreground"),
        header: c("--color-header"),
        primary: {
          DEFAULT:    c("--color-primary"),
          foreground: c("--color-primary-fg"),
        },
        accent: c("--color-accent"),
        card: {
          DEFAULT:    c("--color-card"),
          foreground: c("--color-card-fg"),
        },
        muted: {
          DEFAULT:    c("--color-muted"),
          foreground: c("--color-muted-fg"),
        },
        border: c("--color-border"),
        ring:   c("--color-ring"),
        destructive: c("--color-danger"),
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-text)",
      },
      fontSize: {
        xs:   "var(--text-xs)",
        sm:   "var(--text-sm)",
        base: "var(--text-base)",
        lg:   "var(--text-lg)",
        xl:   "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
      },
      lineHeight: {
        tight: "var(--leading-tight)",
        body:  "var(--leading-body)",
      },
    },
  },
  plugins: [animate, typography],
} satisfies Config;
