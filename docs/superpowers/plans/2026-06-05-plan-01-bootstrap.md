# План 1 — Bootstrap

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For tasks marked **(TDD)** — use `superpowers:test-driven-development`.

**Goal:** Поднять рабочий каркас Next.js-приложения с дизайн-токенами, Docker-окружением и пустой главной страницей, которая корректно отображает тему ниши и адаптирована под мобильный/десктоп.

**Architecture:** Next.js 15 App Router в standalone-режиме, Tailwind v3.4 + CSS-переменные (shadcn/ui-стиль), Drizzle ORM с пустой схемой (заполнится в следующих планах), Postgres 16 в docker-compose, light/dark через `next-themes`. Mobile-first responsive layout с базовым header + footer.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind v3.4, Drizzle ORM, Postgres 16, pnpm, Vitest, next-themes, shadcn/ui (button, sheet, dropdown), zod (env validation), Caddy 2, Docker.

**Спецификация:** [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](../specs/2026-06-05-skelet-blog-design.md) (особенно §3, §4, §5, §11, §15).

**Definition of Done (что считается завершением плана 1):**
- `docker compose up -d` поднимает Caddy + Next.js + Postgres + backup-контейнер без ошибок
- Главная страница на http://localhost (или https://localhost при наличии cert) отдаёт пустой layout с применённой темой
- На мобильной ширине (390×844) виден гамбургер-меню, на десктопе (≥768px) — нав-ссылки в строку
- Light/dark переключение работает и сохраняется между перезагрузками
- `pnpm test` зелёный (тесты тем-контракта, env-валидации, health-endpoint)
- `pnpm check-theme` валидирует [theme/tokens.css](theme/tokens.css) — все обязательные переменные есть
- `curl http://localhost/api/health` → `{"status":"ok","db":"ok"}`

---

## Repo layout, который создаём в этом плане

```
skelet/
├── .env.example                # все ENV-переменные с пояснениями
├── .gitignore
├── .nvmrc                      # 20
├── README.md
├── package.json
├── pnpm-lock.yaml              # auto
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── drizzle.config.ts
├── vitest.config.ts
├── docker-compose.yml
├── Dockerfile
├── Caddyfile
│
├── theme/
│   ├── tokens.css              # цвета light/dark + радиусы
│   ├── typography.css          # font variables
│   ├── fonts.ts                # next/font configuration
│   ├── content.ts              # все строки сайта
│   ├── seo.ts                  # SEO defaults, theme_color
│   ├── tokens.schema.md        # контракт обязательных токенов
│   └── assets/
│       ├── favicon.svg
│       ├── og-default.png
│       └── logo.svg
│
├── drizzle/
│   ├── schema.ts               # пустой экспорт пока
│   └── migrations/             # пустая папка
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # пустая главная
│   │   ├── globals.css         # Tailwind base
│   │   ├── manifest.ts         # PWA manifest
│   │   └── api/
│   │       └── health/route.ts
│   ├── components/
│   │   ├── ui/                 # shadcn-компоненты
│   │   │   ├── button.tsx
│   │   │   ├── sheet.tsx
│   │   │   └── dropdown-menu.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   └── providers/
│   │       ├── ThemeProvider.tsx
│   │       └── ThemeToggle.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   ├── env.ts              # zod-валидация ENV
│   │   └── utils.ts            # cn() helper
│   └── server/                 # пусто пока
│
├── scripts/
│   ├── check-theme.ts          # CI-валидатор обязательных токенов
│   ├── migrate.ts              # запуск миграций в проде
│   └── entrypoint.sh           # docker entrypoint
│
└── tests/
    ├── theme.test.ts
    ├── env.test.ts
    └── health.test.ts
```

---

## Task 1: Инициализация репозитория и базового tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.nvmrc`, `pnpm-workspace.yaml` (если будут monorepo, иначе пропускаем)
- Create: `vitest.config.ts`

- [ ] **Step 1.1: Проверить, что pnpm и Node 20+ доступны**

```bash
node --version    # ожидание: v20.x
pnpm --version    # ожидание: 9.x или выше; если нет — corepack enable
```

Если pnpm нет: `corepack enable && corepack prepare pnpm@latest --activate`.

- [ ] **Step 1.2: Создать `.nvmrc` и `.gitignore`**

```bash
echo "20" > .nvmrc
```

`.gitignore`:
```
# deps
node_modules/
.pnpm-store/

# next
.next/
out/
next-env.d.ts

# env
.env
.env.local
.env.*.local

# build artifacts
*.tsbuildinfo
dist/

# misc
.DS_Store
*.log

# brainstorm
.superpowers/

# data
pg_data/
caddy_data/
caddy_config/
```

- [ ] **Step 1.3: Создать `package.json`**

```json
{
  "name": "skelet",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "check-theme": "tsx scripts/check-theme.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-themes": "^0.4.0",
    "drizzle-orm": "^0.36.0",
    "pg": "^8.13.0",
    "zod": "^3.23.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.460.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.19.0",
    "esbuild": "^0.24.0",
    "vitest": "^2.1.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0"
  },
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 1.4: Создать `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@/theme/*": ["./theme/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.5: Создать `vitest.config.ts`**

```ts
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
    },
  },
});
```

- [ ] **Step 1.5a: Создать `tests/setup.ts`** — seed `process.env` стабами, чтобы модули с eager-валидацией (например `src/lib/env.ts` после Task 8) не падали при импорте в Vitest. Реальные тесты валидации передают свой `input` в `parseEnv` напрямую, не полагаясь на `process.env`.

```ts
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://app:test@localhost:5432/app";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "x".repeat(32);
```

```bash
mkdir -p tests
# затем сохрани файл выше как tests/setup.ts
```

- [ ] **Step 1.6: Установить зависимости**

```bash
pnpm install
```

Ожидание: создаётся `pnpm-lock.yaml`, `node_modules/`, без ошибок.

- [ ] **Step 1.7: Init git и первый коммит**

```bash
git init -b main
git add .gitignore .nvmrc package.json pnpm-lock.yaml tsconfig.json vitest.config.ts tests/setup.ts
git commit -m "chore: initial repo setup with pnpm + Next.js 15 + TS deps"
```

---

## Task 2: Next.js минимальный booted-проект

**Files:**
- Create: `next.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 2.1: `next.config.ts`**

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

export default config;
```

- [ ] **Step 2.2: Минимальный `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skelet",
  description: "Skeleton",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2.3: Минимальный `src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="p-4">
      <h1>Hello, skelet</h1>
    </main>
  );
}
```

- [ ] **Step 2.4: Стартовый `src/app/globals.css`**

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; }
```

- [ ] **Step 2.5: Запустить dev-сервер и проверить**

```bash
pnpm dev
```

В новом терминале:
```bash
curl -s http://localhost:3000 | head -20
```

Ожидание: HTML с "Hello, skelet" в `<h1>`. Останови сервер (Ctrl+C).

- [ ] **Step 2.6: Коммит**

```bash
git add next.config.ts src/app/
git commit -m "feat: minimal Next.js 15 app router skeleton"
```

---

## Task 3: Tailwind v3.4 + базовая интеграция

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Modify: `src/app/globals.css`

- [ ] **Step 3.1: `postcss.config.mjs`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 3.2: Минимальный `tailwind.config.ts`** (без токенов пока — добавим в задаче 4)

```ts
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
```

- [ ] **Step 3.3: Обновить `src/app/globals.css`** — Tailwind directives

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
}
```

- [ ] **Step 3.4: Применить Tailwind в `src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="p-4 text-2xl font-bold">
      <h1>Hello, skelet</h1>
    </main>
  );
}
```

- [ ] **Step 3.5: Запустить dev и убедиться, что классы применяются**

```bash
pnpm dev
```

Открыть http://localhost:3000 в браузере, убедиться, что текст крупный и жирный (Tailwind применился). Остановить сервер.

- [ ] **Step 3.6: Коммит**

```bash
git add tailwind.config.ts postcss.config.mjs src/app/
git commit -m "feat: integrate Tailwind v3.4"
```

---

## Task 4: Дизайн-токены (theme/) — структура и контракт **(TDD)**

Эта таска — про создание контракта дизайн-токенов и валидатор, который страхует от пропущенных переменных. Используем TDD: сначала тест, что валидатор ловит отсутствующие токены.

**Files:**
- Create: `theme/tokens.css`
- Create: `theme/typography.css`
- Create: `theme/tokens.schema.md`
- Create: `scripts/check-theme.ts`
- Test: `tests/theme.test.ts`

- [ ] **Step 4.1: Описать обязательные токены в `theme/tokens.schema.md`**

```markdown
# Theme tokens contract

В [theme/tokens.css](tokens.css) ОБЯЗАТЕЛЬНО должны быть определены следующие CSS-переменные внутри блоков `:root` (light) и `.dark` (dark).

## Цвета (HSL без обёртки hsl(), пробел-разделённый формат)
- --color-background
- --color-foreground
- --color-primary
- --color-primary-fg
- --color-accent
- --color-muted
- --color-muted-fg
- --color-border
- --color-ring
- --color-danger

## Радиусы (в px)
- --radius-sm
- --radius-md
- --radius-lg

## Шрифты (имена next/font CSS-переменных или font-family)
- --font-display
- --font-text

## Принципы значений
- Цвета: формат `H S% L%`, например `217 91% 60%`.
- Радиусы: целое значение с `px`, например `6px`.
- Шрифты: `var(--font-...)` от next/font.
```

- [ ] **Step 4.2: (TDD) Написать тест `tests/theme.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateTokensCss, REQUIRED_TOKENS } from "../scripts/check-theme";

describe("theme tokens contract", () => {
  it("detects missing tokens in :root and .dark blocks", () => {
    const css = `:root { --color-background: 0 0% 100%; }`;
    const result = validateTokensCss(css);
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("accepts a complete tokens.css", () => {
    const fullCss = buildFullCss();
    const result = validateTokensCss(fullCss);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("validates actual theme/tokens.css from the repo", () => {
    const css = readFileSync(join(__dirname, "..", "theme", "tokens.css"), "utf8");
    const result = validateTokensCss(css);
    expect(result.ok, `missing tokens: ${result.missing.join(", ")}`).toBe(true);
  });
});

function buildFullCss() {
  const lightVars = REQUIRED_TOKENS.map(t => `  ${t}: 0 0% 0%;`).join("\n");
  const darkVars = lightVars;
  return `:root {\n${lightVars}\n}\n.dark {\n${darkVars}\n}`;
}
```

- [ ] **Step 4.3: Запустить тест — он должен упасть (нет файлов check-theme.ts и tokens.css)**

```bash
pnpm test tests/theme.test.ts
```

Ожидание: FAIL, ошибка импорта `../scripts/check-theme` или `theme/tokens.css`.

- [ ] **Step 4.4: Минимальная имплементация `scripts/check-theme.ts`**

```ts
export const REQUIRED_TOKENS = [
  "--color-background",
  "--color-foreground",
  "--color-primary",
  "--color-primary-fg",
  "--color-accent",
  "--color-muted",
  "--color-muted-fg",
  "--color-border",
  "--color-ring",
  "--color-danger",
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--font-display",
  "--font-text",
] as const;

const COLOR_TOKENS = REQUIRED_TOKENS.filter(t => t.startsWith("--color-"));

export interface ValidationResult {
  ok: boolean;
  missing: string[];
}

export function validateTokensCss(css: string): ValidationResult {
  const rootBlock = extractBlock(css, ":root");
  const darkBlock = extractBlock(css, ".dark");
  const missing: string[] = [];
  for (const token of REQUIRED_TOKENS) {
    if (!rootBlock.includes(token)) missing.push(`:root → ${token}`);
  }
  // dark должен переопределять как минимум цвета
  for (const token of COLOR_TOKENS) {
    if (!darkBlock.includes(token)) missing.push(`.dark → ${token}`);
  }
  return { ok: missing.length === 0, missing };
}

function extractBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m");
  const m = css.match(re);
  return m ? m[1] : "";
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const css = fs.readFileSync(path.join(process.cwd(), "theme", "tokens.css"), "utf8");
  const result = validateTokensCss(css);
  if (result.ok) {
    console.log("✓ theme/tokens.css: all required tokens present");
    process.exit(0);
  } else {
    console.error("✗ theme/tokens.css: missing tokens");
    result.missing.forEach(m => console.error("  - " + m));
    process.exit(1);
  }
}
```

- [ ] **Step 4.5: Создать `theme/tokens.css` с дефолтной палитрой (нейтральный синий)**

```css
:root {
  --color-background: 0 0% 100%;
  --color-foreground: 222 47% 11%;
  --color-primary: 217 91% 60%;
  --color-primary-fg: 0 0% 100%;
  --color-accent: 280 70% 55%;
  --color-muted: 220 14% 96%;
  --color-muted-fg: 220 9% 46%;
  --color-border: 220 13% 91%;
  --color-ring: 217 91% 60%;
  --color-danger: 0 84% 60%;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  --font-display: var(--font-display-var, system-ui), sans-serif;
  --font-text: var(--font-text-var, system-ui), sans-serif;
}

.dark {
  --color-background: 222 47% 6%;
  --color-foreground: 0 0% 98%;
  --color-primary: 217 91% 65%;
  --color-primary-fg: 222 47% 6%;
  --color-accent: 280 70% 65%;
  --color-muted: 220 14% 14%;
  --color-muted-fg: 220 9% 60%;
  --color-border: 220 13% 18%;
  --color-ring: 217 91% 65%;
  --color-danger: 0 70% 55%;
}
```

- [ ] **Step 4.6: Создать `theme/typography.css`** (типографика с clamp() per §15.5)

```css
:root {
  --text-xs:   clamp(12px, 0.75rem + 0.05vw, 13px);
  --text-sm:   clamp(14px, 0.875rem + 0.1vw, 15px);
  --text-base: clamp(16px, 1rem + 0.25vw, 17px);
  --text-lg:   clamp(18px, 1.05rem + 0.4vw, 20px);
  --text-xl:   clamp(20px, 1.2rem + 0.6vw, 24px);
  --text-2xl:  clamp(24px, 1.4rem + 0.9vw, 32px);
  --text-3xl:  clamp(28px, 1.6rem + 1.2vw, 40px);

  --leading-tight: 1.25;
  --leading-body:  1.6;
}
```

- [ ] **Step 4.7: Запустить тест — должен пройти**

```bash
pnpm test tests/theme.test.ts
```

Ожидание: PASS, 3 теста зелёные.

- [ ] **Step 4.8: Запустить CLI-валидатор**

```bash
pnpm check-theme
```

Ожидание: `✓ theme/tokens.css: all required tokens present`.

- [ ] **Step 4.9: Коммит**

```bash
git add theme/ scripts/check-theme.ts tests/theme.test.ts
git commit -m "feat(theme): tokens contract + validator (light/dark colors, radii, fonts)"
```

---

## Task 5: Маппинг токенов в Tailwind + content/seo файлы темы

**Files:**
- Modify: `tailwind.config.ts`
- Create: `theme/content.ts`
- Create: `theme/seo.ts`
- Create: `theme/fonts.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 5.1: Обновить `tailwind.config.ts` с маппингом**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}", "./theme/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--color-background) / <alpha-value>)",
        foreground: "hsl(var(--color-foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--color-primary) / <alpha-value>)",
          foreground: "hsl(var(--color-primary-fg) / <alpha-value>)",
        },
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        muted: {
          DEFAULT: "hsl(var(--color-muted) / <alpha-value>)",
          foreground: "hsl(var(--color-muted-fg) / <alpha-value>)",
        },
        border: "hsl(var(--color-border) / <alpha-value>)",
        ring: "hsl(var(--color-ring) / <alpha-value>)",
        destructive: "hsl(var(--color-danger) / <alpha-value>)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
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
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5.2: Создать `theme/fonts.ts`** (next/font)

```ts
import { Manrope, Inter } from "next/font/google";

export const fontDisplay = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display-var",
  display: "swap",
});

export const fontText = Inter({
  subsets: ["cyrillic", "latin"],
  variable: "--font-text-var",
  display: "swap",
});
```

- [ ] **Step 5.3: Создать `theme/content.ts`** (дефолтные строки)

```ts
export const content = {
  site: {
    name: "Skelet",
    shortName: "Skelet",
    tagline: "Сообщество (тестовая ниша)",
    description: "Тестовый инстанс скелета. Замените текстами своей ниши в theme/content.ts.",
  },
  nav: {
    home: "Лента",
    new: "Написать пост",
    tags: "Темы",
    login: "Войти",
  },
  empty: {
    feed: "Пока нет постов. Будьте первым!",
    drafts: "У вас нет черновиков",
    tag: "Постов по этой теме пока нет",
  },
  footer: {
    about: "О проекте",
    rules: "Правила",
    contacts: "Контакты",
  },
  consent: {
    text: "Сайт использует cookies для аналитики.",
    accept: "Принять",
    decline: "Только необходимые",
  },
  copyright: `© ${new Date().getFullYear()} Skelet`,
} as const;

export type ContentSchema = typeof content;
```

- [ ] **Step 5.4: Создать `theme/seo.ts`**

```ts
export const seo = {
  siteName: "Skelet",
  titleTemplate: (postTitle: string) => `${postTitle} — Skelet`,
  defaultTitle: "Skelet — сообщество",
  defaultDescription: "Тестовый инстанс блог-скелета.",
  themeColor: "#ffffff",
  locale: "ru_RU",
  ogDefault: "/og-default.png",
} as const;
```

- [ ] **Step 5.5: Обновить `src/app/layout.tsx`** — импорт темы и шрифтов

```tsx
import type { Metadata } from "next";
import { fontDisplay, fontText } from "@/theme/fonts";
import { seo } from "@/theme/seo";
import "./globals.css";
import "@/theme/tokens.css";
import "@/theme/typography.css";

export const metadata: Metadata = {
  title: { default: seo.defaultTitle, template: `%s — ${seo.siteName}` },
  description: seo.defaultDescription,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontText.variable}`}
    >
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5.6: Минимальная главная с применённой темой**

```tsx
// src/app/page.tsx
import { content } from "@/theme/content";

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-[1200px]">
      <h1 className="font-display text-3xl text-foreground">{content.site.name}</h1>
      <p className="text-muted-foreground mt-2">{content.site.tagline}</p>
    </main>
  );
}
```

- [ ] **Step 5.7: Запустить dev, проверить тему применилась**

```bash
pnpm dev
```

Открыть http://localhost:3000 — увидеть:
- Текст в шрифте Manrope (заголовок) и Inter (параграф)
- Заголовок голубого цвета бэкграунда (light theme default)
- Сабтекст muted-серый

В DevTools убедиться, что на `<html>` есть классы переменных шрифтов. Остановить сервер.

- [ ] **Step 5.8: Коммит**

```bash
git add tailwind.config.ts theme/ src/app/
git commit -m "feat(theme): Tailwind token mapping + content/seo/fonts in theme/"
```

---

## Task 6: Light/dark переключение через next-themes

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/components/providers/ThemeProvider.tsx`
- Create: `src/components/providers/ThemeToggle.tsx`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 6.1: `src/lib/utils.ts`** (cn helper для shadcn)

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6.2: `src/components/ui/button.tsx`** (минимальный shadcn-style Button)

```tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-background hover:bg-muted hover:text-foreground",
        ghost: "hover:bg-muted hover:text-foreground",
      },
      size: {
        default: "h-11 px-4 py-2 min-w-11",   // 44px height для tap-target
        sm: "h-9 px-3 min-w-9",
        icon: "h-11 w-11",                     // 44×44 tap-target
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";
```

- [ ] **Step 6.3: `src/components/ui/dropdown-menu.tsx`** (минимальный shadcn wrapper)

Скопировать из официального shadcn registry — стандартный код. Минимально:

```tsx
"use client";
import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-background p-1 text-foreground shadow-md",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors focus:bg-muted focus:text-foreground",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";
```

- [ ] **Step 6.4: `src/components/providers/ThemeProvider.tsx`**

```tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 6.5: `src/components/providers/ThemeToggle.tsx`**

```tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Сменить тему">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Светлая</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Тёмная</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>Системная</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 6.6: Обернуть layout в ThemeProvider**

```tsx
// src/app/layout.tsx — обновить
import { ThemeProvider } from "@/components/providers/ThemeProvider";
// ... остальное как было

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${fontDisplay.variable} ${fontText.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6.7: Положить ThemeToggle на главной для проверки**

```tsx
// src/app/page.tsx
import { content } from "@/theme/content";
import { ThemeToggle } from "@/components/providers/ThemeToggle";

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">{content.site.name}</h1>
        <ThemeToggle />
      </div>
      <p className="text-muted-foreground mt-2">{content.site.tagline}</p>
    </main>
  );
}
```

- [ ] **Step 6.8: Запустить dev и проверить переключение**

```bash
pnpm dev
```

В браузере на http://localhost:3000:
- Нажать иконку темы → выпадает меню «Светлая/Тёмная/Системная»
- Переключить «Тёмная» → bg меняется на тёмный, текст светлеет
- Перезагрузить страницу → выбор сохраняется (localStorage)

Остановить сервер.

- [ ] **Step 6.9: Коммит**

```bash
git add src/lib/ src/components/ src/app/
git commit -m "feat: light/dark theme toggle via next-themes + base Button/DropdownMenu"
```

---

## Task 7: Header + Footer + мобильное меню (Sheet)

**Files:**
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/Footer.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 7.1: `src/components/ui/sheet.tsx`** (shadcn Sheet через Radix Dialog)

Стандартный shadcn-Sheet (Radix Dialog). Сократил:

```tsx
"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm", className)}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "left" | "right" | "top" | "bottom" }
>(({ className, side = "right", children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 gap-4 bg-background p-6 shadow-lg",
        side === "right" && "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm",
        side === "left"  && "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm",
        className
      )}
      {...props}
    >
      {children}
      <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
        <X className="h-5 w-5" />
        <span className="sr-only">Закрыть</span>
      </SheetClose>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";
```

- [ ] **Step 7.2: `src/components/layout/Header.tsx`**

```tsx
import Link from "next/link";
import { Menu } from "lucide-react";
import { content } from "@/theme/content";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/providers/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
  const navLinks = [
    { href: "/", label: content.nav.home },
    { href: "/tags", label: content.nav.tags },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-[1200px]">
        <Link href="/" className="font-display text-lg font-semibold text-foreground">
          {content.site.name}
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="default" size="sm" className="hidden md:inline-flex">
            <Link href="/login">{content.nav.login}</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Меню">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="flex flex-col gap-4 mt-8">
                {navLinks.map(l => (
                  <Link key={l.href} href={l.href} className="text-base text-foreground">
                    {l.label}
                  </Link>
                ))}
                <Link href="/login" className="text-base text-foreground">{content.nav.login}</Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 7.3: `src/components/layout/Footer.tsx`**

```tsx
import Link from "next/link";
import { content } from "@/theme/content";

export function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="container mx-auto px-4 py-8 max-w-[1200px] flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground">
        <div>{content.copyright}</div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/about" className="hover:text-foreground">{content.footer.about}</Link>
          <Link href="/rules" className="hover:text-foreground">{content.footer.rules}</Link>
          <Link href="/contacts" className="hover:text-foreground">{content.footer.contacts}</Link>
        </nav>
      </div>
    </footer>
  );
}
```

- [ ] **Step 7.4: Положить Header/Footer в layout.tsx**

```tsx
// src/app/layout.tsx — обновить body
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
// ... остальное как было

  <body className="bg-background text-foreground font-sans antialiased min-h-screen flex flex-col">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </ThemeProvider>
  </body>
```

- [ ] **Step 7.5: Упростить главную (header уже в layout)**

```tsx
// src/app/page.tsx
import { content } from "@/theme/content";

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-[1200px]">
      <h1 className="font-display text-3xl text-foreground">{content.site.name}</h1>
      <p className="text-muted-foreground mt-2 text-base leading-body">{content.site.tagline}</p>
      <p className="mt-8 text-muted-foreground">{content.empty.feed}</p>
    </main>
  );
}
```

- [ ] **Step 7.6: Запустить dev, проверить mobile + desktop**

```bash
pnpm dev
```

В Chrome DevTools (Cmd+Shift+M → переключить на iPhone 13 — 390×844):
- Видны: лого слева, кнопки темы и hamburger справа
- Нав-ссылок «Лента»/«Темы» нет (скрыты до md)
- Тап на hamburger → выезжает Sheet с нав-ссылками + login

В desktop-режиме (≥768px):
- Лого + нав-ссылки в строку + theme toggle + кнопка «Войти»
- Hamburger скрыт

Останови сервер.

- [ ] **Step 7.7: Коммит**

```bash
git add src/components/ src/app/
git commit -m "feat: responsive header/footer with mobile sheet menu"
```

---

## Task 8: Env validation **(TDD)**

**Files:**
- Create: `src/lib/env.ts`
- Test: `tests/env.test.ts`
- Create: `.env.example`

- [ ] **Step 8.1: (TDD) Тест `tests/env.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "../src/lib/env";

describe("env validation", () => {
  it("accepts a complete dev env", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://app:pwd@localhost:5432/app",
      NEXTAUTH_SECRET: "x".repeat(32),
      NEXTAUTH_URL: "http://localhost:3000",
      NODE_ENV: "development",
    });
    expect(env.DATABASE_URL).toContain("postgres://");
  });

  it("rejects missing DATABASE_URL", () => {
    expect(() => parseEnv({
      NEXTAUTH_SECRET: "x".repeat(32),
      NEXTAUTH_URL: "http://localhost:3000",
      NODE_ENV: "development",
    } as never)).toThrow();
  });

  it("rejects short NEXTAUTH_SECRET", () => {
    expect(() => parseEnv({
      DATABASE_URL: "postgres://x:y@z/db",
      NEXTAUTH_SECRET: "short",
      NEXTAUTH_URL: "http://x",
      NODE_ENV: "development",
    })).toThrow(/NEXTAUTH_SECRET/);
  });
});
```

- [ ] **Step 8.2: Запустить тест — должен упасть (нет parseEnv)**

```bash
pnpm test tests/env.test.ts
```

Ожидание: FAIL.

- [ ] **Step 8.3: Имплементация `src/lib/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().refine(s => s.startsWith("postgres://") || s.startsWith("postgresql://"), {
    message: "DATABASE_URL must be a Postgres connection string",
  }),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be ≥32 chars"),
  // OAuth и R2 добавим в следующих планах — здесь только то, что нужно сейчас
});

export type Env = z.infer<typeof schema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error("Invalid env: " + result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);
```

- [ ] **Step 8.4: Прогнать тесты**

```bash
pnpm test
```

Ожидание: все зелёные (theme + env).

- [ ] **Step 8.5: `.env.example`** — закладываем структуру всех нужных переменных проекта

```env
# === Node ===
NODE_ENV=development

# === Домен / URL ===
DOMAIN=localhost
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                     # openssl rand -base64 32

# === БД (используется в docker-compose и приложением) ===
DB_PASSWORD=devpassword
DATABASE_URL=postgres://app:devpassword@localhost:5432/app

# === OAuth (заполнить в плане 2) ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
VK_CLIENT_ID=
VK_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# === Хранилище (Cloudflare R2) — план 3 ===
R2_ENDPOINT=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE=

# === Бэкапы (план 6) ===
BACKUP_S3_ENDPOINT=
BACKUP_S3_BUCKET=
BACKUP_S3_KEY=
BACKUP_S3_SECRET=

# === SEO (план 5) ===
INDEXNOW_ENABLED=false
INDEXNOW_KEY=

# === Аналитика (план 5) ===
YANDEX_METRIKA_ID=
```

- [ ] **Step 8.6: Создать локальный `.env`** (gitignored)

```bash
cp .env.example .env
# отредактировать NEXTAUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# вставить значение в .env вручную (или sed)
```

- [ ] **Step 8.7: Коммит**

```bash
git add src/lib/env.ts tests/env.test.ts .env.example
git commit -m "feat: zod-validated env + .env.example"
```

---

## Task 9: Drizzle + Postgres (пустая схема, инфраструктура миграций)

**Files:**
- Create: `drizzle.config.ts`
- Create: `drizzle/schema.ts`
- Create: `src/lib/db.ts`
- Create: `scripts/migrate.ts`

- [ ] **Step 9.1: `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://app:devpassword@localhost:5432/app",
  },
});
```

- [ ] **Step 9.2: Пустой `drizzle/schema.ts`** (заполнится планами 2-5)

```ts
// Schema will be populated in subsequent plans:
//   plan 2 — users, accounts, sessions, verificationTokens
//   plan 3 — posts, tags, post_tags, uploads, comments
//   plan 5 — moderation tables; reactions/subscriptions stubs

export {};
```

- [ ] **Step 9.3: `src/lib/db.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool);
export { pool };
```

- [ ] **Step 9.4: `scripts/migrate.ts`** (используется и для dev, и в Docker entrypoint)

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: "./drizzle/migrations" });
await pool.end();
console.log("Migrations applied");
```

- [ ] **Step 9.5: Коммит инфраструктуры (без первой миграции — нечего мигрировать пока)**

```bash
git add drizzle.config.ts drizzle/ src/lib/db.ts scripts/migrate.ts
git commit -m "feat: Drizzle + Postgres setup (empty schema for now)"
```

---

## Task 10: Health endpoint **(TDD)**

**Files:**
- Create: `src/app/api/health/route.ts`
- Test: `tests/health.test.ts`

- [ ] **Step 10.1: (TDD) Тест `tests/health.test.ts`**

Поскольку Route Handlers сложно юнит-тестить отдельно от Next, тестируем чистую функцию `checkHealth()` отдельно от route.

```ts
import { describe, it, expect, vi } from "vitest";
import { checkHealth } from "../src/app/api/health/check";

describe("health check", () => {
  it("returns ok when db query succeeds", async () => {
    const fakeDb = { execute: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) };
    const result = await checkHealth(fakeDb as never);
    expect(result.status).toBe("ok");
    expect(result.db).toBe("ok");
  });

  it("returns degraded when db query fails", async () => {
    const fakeDb = { execute: vi.fn().mockRejectedValue(new Error("conn refused")) };
    const result = await checkHealth(fakeDb as never);
    expect(result.status).toBe("degraded");
    expect(result.db).toBe("error");
  });
});
```

- [ ] **Step 10.2: Прогнать тест — должен упасть**

```bash
pnpm test tests/health.test.ts
```

Ожидание: FAIL (модуль `src/app/api/health/check` не существует).

- [ ] **Step 10.3: Имплементация `src/app/api/health/check.ts`**

```ts
import { sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";

export interface HealthResult {
  status: "ok" | "degraded";
  db: "ok" | "error";
}

export async function checkHealth(db: typeof Db): Promise<HealthResult> {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "ok", db: "ok" };
  } catch {
    return { status: "degraded", db: "error" };
  }
}
```

- [ ] **Step 10.4: Route Handler `src/app/api/health/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkHealth } from "./check";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkHealth(db);
  const status = result.status === "ok" ? 200 : 503;
  return NextResponse.json(result, { status });
}
```

- [ ] **Step 10.5: Прогнать тесты**

```bash
pnpm test
```

Ожидание: все зелёные.

- [ ] **Step 10.6: Коммит**

```bash
git add src/app/api/health/ tests/health.test.ts
git commit -m "feat: /api/health endpoint with db ping (TDD)"
```

---

## Task 11: PWA manifest

**Files:**
- Create: `src/app/manifest.ts`
- Create: `public/icons/icon-192.png` (placeholder)
- Create: `public/icons/icon-512.png` (placeholder)
- Modify: `src/app/layout.tsx` — добавить metadata.manifest

- [ ] **Step 11.1: `src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";
import { content } from "@/theme/content";
import { seo } from "@/theme/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: content.site.name,
    short_name: content.site.shortName ?? content.site.name,
    description: content.site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: seo.themeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 11.2: Положить placeholder-иконки в `public/icons/`**

Для V1 любые квадратные PNG. Можно сгенерировать через placeholder.com или взять временные:

```bash
mkdir -p public/icons
# placeholder из ImageMagick (если установлен):
magick -size 192x192 xc:'#2563eb' public/icons/icon-192.png
magick -size 512x512 xc:'#2563eb' public/icons/icon-512.png
# Если нет ImageMagick, скачать любые PNG нужного размера или закоммитить TODO-комментарий
```

В реальной нише эти файлы заменятся в `theme/assets/`. Сейчас держим в `public/icons/` чтобы ссылка из manifest работала. В плане 6 — перенесём генерацию из `theme/assets/`.

- [ ] **Step 11.3: Запустить dev, проверить manifest**

```bash
pnpm dev
```

```bash
curl -s http://localhost:3000/manifest.webmanifest
```

Ожидание: JSON с правильными name, theme_color, icons.

- [ ] **Step 11.4: Коммит**

```bash
git add src/app/manifest.ts public/icons/
git commit -m "feat: PWA manifest with theme color and basic icons"
```

---

## Task 12: docker-compose + Dockerfile + Caddyfile + entrypoint

**Files:**
- Create: `docker-compose.yml`
- Create: `Dockerfile`
- Create: `Caddyfile`
- Create: `scripts/entrypoint.sh`
- Create: `scripts/backup.sh` (заглушка, будет дописана в плане 6)

- [ ] **Step 12.1: `Caddyfile`**

```
{$DOMAIN} {
  encode gzip zstd
  reverse_proxy app:3000

  @static {
    path /_next/static/*
    path /favicon.ico
    path /icons/*
  }
  header @static Cache-Control "public, max-age=31536000, immutable"

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
    Permissions-Policy "interest-cohort=()"
  }
}
```

Для локального dev: `DOMAIN=localhost` в `.env` → Caddy на localhost не получит Let's Encrypt cert, но сделает локальный self-signed (или fallback в HTTP — настраивается ниже).

Для production: `DOMAIN=example.ru` → Caddy получит реальный cert.

- [ ] **Step 12.2: `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
# Собираем самостоятельный migrate.js — drizzle-kit (dev-dep) не нужен в рантайме
RUN pnpm exec esbuild scripts/migrate.ts \
    --bundle --platform=node --target=node20 \
    --format=esm --outfile=migrate.mjs \
    --packages=external

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/drizzle ./drizzle
COPY --from=builder --chown=app:app /app/migrate.mjs ./migrate.mjs
COPY --chown=app:app scripts/entrypoint.sh ./entrypoint.sh
USER app
EXPOSE 3000
CMD ["sh", "./entrypoint.sh"]
```

- [ ] **Step 12.3: `scripts/entrypoint.sh`**

```sh
#!/bin/sh
set -e
echo "Running migrations..."
node migrate.mjs
echo "Starting Next.js..."
exec node server.js
```

```bash
chmod +x scripts/entrypoint.sh
```

- [ ] **Step 12.4: `scripts/backup.sh`** (заглушка)

```sh
#!/bin/sh
# Будет реализовано в плане 6 (niche-fork tooling).
# В V1 контейнер просто спит и не делает бэкапов локально.
echo "backup.sh: placeholder, will be implemented in plan 6"
sleep infinity
```

```bash
chmod +x scripts/backup.sh
```

- [ ] **Step 12.5: `docker-compose.yml`**

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    environment:
      - DOMAIN=${DOMAIN}
    depends_on: [app]

  app:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgres://app:${DB_PASSWORD}@db:5432/app
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: app
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 10

  backup:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./scripts/backup.sh:/backup.sh:ro
    entrypoint: ["sh", "/backup.sh"]
    depends_on: [db]

volumes:
  caddy_data:
  caddy_config:
  pg_data:
```

- [ ] **Step 12.6: Поднять стек локально**

```bash
docker compose build app
docker compose up -d
```

Ожидание: 4 контейнера в статусе `running` или `healthy`.

```bash
docker compose ps
```

- [ ] **Step 12.7: Проверить app через Caddy**

```bash
# Caddy на localhost самосигнирует cert; -k игнорирует валидацию
curl -kI https://localhost
```

Ожидание: HTTP/2 200, заголовки content-type text/html.

```bash
curl -ks https://localhost/api/health
```

Ожидание: `{"status":"ok","db":"ok"}`.

- [ ] **Step 12.8: Остановить стек, проверить что pg_data сохраняется**

```bash
docker compose down              # без -v чтобы volume остались
docker compose up -d
docker compose ps                # все должны снова стартовать
```

- [ ] **Step 12.9: Коммит**

```bash
git add docker-compose.yml Dockerfile Caddyfile scripts/entrypoint.sh scripts/backup.sh
git commit -m "feat: docker-compose + Dockerfile (standalone build) + Caddy + entrypoint"
```

---

## Task 13: README и финальная верификация

**Files:**
- Create: `README.md`

- [ ] **Step 13.1: `README.md`**

````markdown
# Skelet — переиспользуемый блог-скелет

Скелет для быстрого создания тематических блогов / форумов (стиль vc.ru / drive2.ru). Каждая ниша = отдельный git-репо + VPS.

См. полную спеку: [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](docs/superpowers/specs/2026-06-05-skelet-blog-design.md).

## Стек

Next.js 15 · React 19 · TypeScript · Tailwind v3 · Drizzle ORM · Postgres 16 · Auth.js (план 2) · Editor.js (план 3) · Cloudflare R2 (план 3) · Caddy 2 · Docker.

## Быстрый старт (локальная разработка)

Требования: Node 20+, pnpm 9+, Docker.

```bash
# 1. Установить зависимости
pnpm install

# 2. Создать .env из шаблона
cp .env.example .env
# Сгенерировать NEXTAUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Вставить в .env

# 3. Поднять Postgres
docker compose up -d db

# 4. Применить миграции (после плана 2, сейчас миграций нет)
# pnpm db:migrate

# 5. Запустить dev-сервер
pnpm dev
```

Сайт доступен на http://localhost:3000.

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | Dev-сервер Next.js |
| `pnpm build` | Production-сборка |
| `pnpm test` | Vitest |
| `pnpm check-theme` | Проверка обязательных дизайн-токенов |
| `pnpm db:generate` | Drizzle: генерация миграции из schema.ts |
| `pnpm db:migrate` | Drizzle: применить миграции |
| `pnpm db:studio` | Drizzle Studio (GUI для БД) |

## Полный стек локально (Docker)

```bash
docker compose up -d
# https://localhost (Caddy self-signed cert)
```

## Структура

См. [docs/superpowers/specs/2026-06-05-skelet-blog-design.md#4-структура-репозитория](docs/superpowers/specs/2026-06-05-skelet-blog-design.md#4-структура-репозитория).

## Кастомизация под нишу

Всё, что меняется на нишу, — в папке [theme/](theme/):
- `tokens.css` — цвета, радиусы (light + dark)
- `typography.css` — типографика
- `fonts.ts` — выбор шрифтов
- `content.ts` — тексты сайта
- `seo.ts` — SEO-defaults
- `assets/` — favicon, лого, OG

CLI-визард для форка: `pnpm new-niche` (план 6).

## Деплой

См. [docs/superpowers/specs/2026-06-05-skelet-blog-design.md#11-деплой](docs/superpowers/specs/2026-06-05-skelet-blog-design.md#11-деплой).
````

- [ ] **Step 13.2: Финальная верификация DoD**

```bash
# 1. Тесты
pnpm test
# Ожидание: все PASS (theme, env, health)

# 2. Проверка темы
pnpm check-theme
# Ожидание: ✓ all required tokens present

# 3. Build (production-сборка должна проходить)
pnpm build
# Ожидание: успешный build, выводится список роутов

# 4. Стек целиком
docker compose down
docker compose up -d --build
sleep 5
curl -ks https://localhost/api/health
# Ожидание: {"status":"ok","db":"ok"}

curl -ks https://localhost | grep -q "Skelet"
echo $?
# Ожидание: 0 (найдено)
```

- [ ] **Step 13.3: Mobile визуальный тест**

```bash
docker compose up -d  # если не запущено
```

В браузере: открыть https://localhost (игнорировать self-signed предупреждение).

Открыть Chrome DevTools (Cmd+Option+I) → toggle device toolbar (Cmd+Shift+M):
- Выбрать iPhone 13 (390×844)
- Видеть: лого + hamburger + theme toggle
- Тап на hamburger → выезжает Sheet с навигацией
- Темы переключаются

Затем:
- Выбрать iPad mini (744×1133) → нав-ссылки в строку, hamburger исчез
- Выбрать Laptop (1280×800) → footer в строку, контент по центру в max-w 1200px

- [ ] **Step 13.4: Коммит и тег**

```bash
git add README.md
git commit -m "docs: README with quick-start, commands, customization pointers"
git tag -a plan-01-bootstrap-done -m "Plan 1 (Bootstrap) complete"
```

---

## Сводка артефактов плана 1

После завершения плана в репо есть:

| Артефакт | Назначение |
|---|---|
| `package.json` + `pnpm-lock.yaml` | Зависимости и скрипты |
| `tsconfig.json` | Strict TypeScript + path aliases |
| `next.config.ts` | Next.js standalone build |
| `tailwind.config.ts` + `postcss.config.mjs` | Tailwind v3 + маппинг токенов |
| `theme/*` | Дизайн-токены, типографика, шрифты, контент, SEO |
| `scripts/check-theme.ts` | CI-валидатор контракта токенов |
| `drizzle.config.ts` + `drizzle/schema.ts` (пустой) + `scripts/migrate.ts` | Инфраструктура миграций |
| `src/lib/{db,env,utils}.ts` | DB client, env validation, cn helper |
| `src/components/{ui,layout,providers}` | Button, DropdownMenu, Sheet, Header, Footer, ThemeProvider, ThemeToggle |
| `src/app/{layout,page}.tsx` | Базовый layout + пустая главная |
| `src/app/api/health/*` | /api/health endpoint |
| `src/app/manifest.ts` + `public/icons/` | PWA manifest |
| `docker-compose.yml` + `Dockerfile` + `Caddyfile` + `scripts/entrypoint.sh` | Прод-окружение |
| `.env.example` | Шаблон переменных |
| `tests/{theme,env,health}.test.ts` | Vitest |
| `README.md` | Quick start + структура |

**Что готово к плану 2 (Auth):**
- Postgres работает, миграции применяются
- Тема применена, layout responsive, header с местом для login-кнопки
- `env.ts` — точка добавления OAuth ENV-переменных

---

## Реализация: расхождения с планом

В ходе исполнения плана пришлось отклониться от исходных шагов. Контракты спеки (`docs/superpowers/specs/2026-06-05-skelet-blog-design.md`) не нарушены — изменения на уровне реализации.

| План говорил | Реализация | Причина |
|---|---|---|
| `export const env = parseEnv(process.env)` (eager) | `export function getEnv(): Env` (lazy + cached) | `next build` импортирует все route-модули на стадии «Collecting page data» → eager-парс падает без env-переменных в build-окружении |
| `export const db = drizzle(pool)` (eager) | `export function getDb(): NodePgDatabase` + `getPool()` | Та же причина: `db.ts` импортит `env`, eager-Pool тригерит парс env при сборке |
| `--format=esm --outfile=migrate.mjs --packages=external` | `--format=cjs --outfile=migrate.cjs --external:pg-native` | ESM external не находит deps в standalone-runner (там нет node_modules). CJS-bundle самодостаточен. |
| `scripts/migrate.ts` с top-level `await` | `async function main()` + `main().catch(...)` | CJS-формат esbuild не поддерживает top-level await |
| `<Link href="/about\|/rules\|/contacts">` в Footer<br/>`<Link href="/tags\|/login">` в Header | `<a href="...">` + комментарии `// TODO(plan-N)` | `typedRoutes: true` валит build на ссылках на ещё не существующие роуты |

**Что добавили помимо плана** (без этого Docker-сборка не работает):

- `.dockerignore` — исключает локальный `node_modules` с macOS pnpm-store симлинками, который через `COPY . .` ломал deps stage
- `package.json` → `"pnpm": { "onlyBuiltDependencies": ["esbuild", "sharp", "@tailwindcss/oxide"] }` — pnpm 10 блокирует postinstall по умолчанию, esbuild не скачивает musl-бинарь под Alpine
- `drizzle/migrations/meta/_journal.json` (stub с `entries: []`) — drizzle migrator падает на пустой папке миграций
- `tests/setup.ts` — `process.env as Record<string, string | undefined>` обходит read-only-маркер на `NODE_ENV` (TS 5.5+)

**Маркеры для следующих планов** (находятся через `git grep "TODO(plan-N)"`):

- `TODO(plan-2)` в `src/components/layout/Header.tsx` — вернуть `<Link>` для `/login` когда появится auth-роут
- `TODO(plan-4)` в `src/components/layout/Header.tsx` — `<Link>` для `/tags` когда появится список тегов
- `TODO(plan-5)` в `src/components/layout/Footer.tsx` — `<Link>` для `/about`, `/rules`, `/contacts` когда появятся стат-страницы

**Импликации для плана 2 (Auth):**

- Auth.js callbacks/config: использовать `getEnv().NEXTAUTH_SECRET` (не `env.NEXTAUTH_SECRET`)
- DB-запросы: `await getDb().select()...` (не `db.select()...`)
- Любая новая lib, которая держит ресурс на основе env (R2-client в плане 3, sitemap-config в плане 5) — должна быть lazy по тому же паттерну `getX()`
- `drizzle/schema.ts` — пустой, ждёт Auth.js-таблицы
