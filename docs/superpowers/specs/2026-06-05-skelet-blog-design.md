# Скелет блог-платформы под несколько ниш — Дизайн-документ

**Дата:** 2026-06-05
**Статус:** Дизайн утверждён, готовится план реализации
**Автор:** обсуждение совместно с пользователем

---

## 0. Содержание

1. [Контекст и цель](#1-контекст-и-цель)
2. [Ключевые решения (decision log)](#2-ключевые-решения-decision-log)
3. [Архитектура](#3-архитектура)
4. [Структура репозитория](#4-структура-репозитория)
5. [Дизайн-система и токены](#5-дизайн-система-и-токены)
6. [Модель данных](#6-модель-данных)
7. [Аутентификация](#7-аутентификация)
8. [Жизненный цикл поста](#8-жизненный-цикл-поста)
9. [SEO и индексация](#9-seo-и-индексация)
10. [Workflow форка под новую нишу](#10-workflow-форка-под-новую-нишу)
11. [Деплой](#11-деплой)
12. [Roadmap фаз 2-3](#12-roadmap-фаз-2-3)
13. [Справочник ENV-переменных](#13-справочник-env-переменных)
14. [Открытые вопросы и риски](#14-открытые-вопросы-и-риски)
15. [Адаптив: web + mobile](#15-адаптив-web--mobile)

---

## 1. Контекст и цель

### 1.1. Идея

Создать **переиспользуемый скелет** блог/форум-платформы (в духе vc.ru / drive2.ru), чтобы за 2-3 часа поднимать новую вертикаль под другую нишу: владельцы ПК, владельцы 3D-принтеров, аквариумисты, котоводы и т.д. Главное требование — менять *внешний вид и тексты* в одном месте без правок кода продукта.

### 1.2. Метрика успеха для скелета

- **Время до запуска новой ниши** ≤ 3 часов (из них 80% — творческая работа: подбор цветов, текстов).
- **Время апдейта всех ниш** при багфиксе в скелете ≤ 1 час (merge upstream).
- **Lighthouse score** на странице поста ≥ 90 (mobile) сразу после форка.
- **Время до индексации поста в Google и Yandex** ≤ 24 часа после публикации.

### 1.3. Что НЕ делаем в V1

- Email-провайдер и email-логин — деферим, в V1 только OAuth.
- Мобильное приложение — PWA достаточно.
- Multi-tenant архитектура — каждая ниша = отдельный репо + VPS + БД.
- Платные подписки, DM, видеохостинг.

---

## 2. Ключевые решения (decision log)

| # | Решение | Альтернативы | Обоснование |
|---|---|---|---|
| 1 | **Template/Fork**: одна ниша = одно git-репо, одна VPS, одна БД | Multi-tenant, ENV-driven multi-instance | Тестировать ниши быстро, полная изоляция, простая разработка |
| 2 | **Next.js** (App Router, Server Components) | Remix, Astro, Nuxt | Знаком пользователю, лучший SSR/ISR для SEO |
| 3 | **Drizzle ORM + Postgres 16** | Prisma, Supabase, raw SQL | Type-safe SQL, миграции прозрачны, без vendor lock-in |
| 4 | **Auth.js v5** (NextAuth), OAuth-only | Clerk, Lucia, custom | OAuth без email-провайдера = «не больно»; Auth.js + Drizzle-adapter — стандарт |
| 5 | OAuth-провайдеры: **Google, Yandex, VK, GitHub** | + Apple, Facebook | Покрытие RU- и tech-аудитории |
| 6 | **Cloudflare R2** для картинок и бэкапов | Yandex Object Storage, S3, MinIO | 0 egress, S3-совместимый → легко съехать |
| 7 | **Tailwind CSS + CSS-переменные (shadcn/ui-стиль)** | Panda CSS, JSON-токены через Style Dictionary | De-facto стандарт, ~50 готовых компонентов, light/dark из коробки |
| 8 | **Editor.js** для постов | TipTap, Lexical, Markdown | Сделан командой vc.ru, ровно тот UX, который нужен |
| 9 | **Caddy** как reverse-proxy | Nginx, Traefik | Сам выпускает Let's Encrypt сертификаты, один Caddyfile |
| 10 | **Docker Compose** на одной VPS на нишу (Hetzner CX22) | Vercel, K8s | Полный контроль, фиксированный ценник ~€4/мес/ниша |
| 11 | **Postgres self-hosted в compose** + ежедневный pg_dump в R2 | Neon, Railway managed | Простота, дешевле, бэкапы под контролем |
| 12 | **DB-стратегия сессий** в Auth.js (не JWT) | JWT | Мгновенный revoke при бане |
| 13 | **Я.Метрика** для аналитики | Plausible, PostHog | Пользователь выбрал; даёт вебвизор/тепловые карты для RU-аудитории |
| 14 | **RU-only** строки в V1 | i18n-ready через next-intl | Скорость; рефакторинг возможен позже |
| 15 | **IndexNow** + sitemap + Search Console + Я.Вебмастер | только sitemap | Bing/Yandex индексируют за часы, не дни |

---

## 3. Архитектура

### 3.1. Высокоуровневая схема

```
┌──────────────────────────────────────────────────────────────────┐
│                        VPS (Hetzner CX22)                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  docker-compose (один на нишу)                             │  │
│  │                                                            │  │
│  │  ┌────────────┐  ┌──────────┐  ┌─────────────────────┐     │  │
│  │  │  Caddy     │  │ Next.js  │  │ Postgres 16         │     │  │
│  │  │  (HTTPS,   │──┤ (app)    │──┤ + persistent volume │     │  │
│  │  │   proxy)   │  │ :3000    │  │                     │     │  │
│  │  └────────────┘  └────┬─────┘  └─────────────────────┘     │  │
│  │                       │                                    │  │
│  │  ┌────────────┐       │ S3 API                             │  │
│  │  │ pg-backup  │       │                                    │  │
│  │  │ (cron)     │       │                                    │  │
│  │  └────────────┘       │                                    │  │
│  └───────────────────────┼────────────────────────────────────┘  │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Cloudflare R2  │  (картинки + ночные бэкапы БД)
                  └─────────────────┘
                           │
                  ┌────────▼────────┐
                  │  OAuth IdPs:    │  (Google, Yandex, VK, GitHub)
                  │  внешние        │
                  └─────────────────┘
```

### 3.2. Принципы

- **Один docker-compose = одна ниша.** Развернуть = `git clone` → правка `theme/` + `.env` → `docker compose up`.
- **Без отдельного API-сервиса.** Бэкенд = Server Actions + route handlers внутри Next.js. Меньше движущихся частей.
- **Без shared infrastructure между нишами на старте.** Каждая ниша автономна (своя БД, свой R2 bucket).
- **Кастомизация → только в [theme/](theme/) и `.env`.** Код в [src/](src/) одинаков во всех нишах. Это контракт.

---

## 4. Структура репозитория

```
skelet/
├── .env.example                         # все ENV-переменные с пояснениями
├── docker-compose.yml                   # caddy + app + postgres + backup
├── Caddyfile                            # один домен → app:3000
├── Dockerfile                           # multi-stage Next.js standalone
├── README.md                            # как развернуть нишу с нуля
├── next.config.ts                       # output: "standalone"
├── tailwind.config.ts                   # маппинг утилит на CSS-переменные
├── drizzle.config.ts                    # настройка миграций
│
├── theme/                               # ★ ВСЁ, ЧТО МЕНЯЕТСЯ ПОД НИШУ ★
│   ├── tokens.css                       # CSS-переменные (light + dark)
│   ├── typography.css                   # @font-face + var(--font-*)
│   ├── content.ts                       # тексты: «Сайт о ПК», слоганы, нав
│   ├── seo.ts                           # title-шаблон, описание, OG-defaults
│   ├── tokens.schema.md                 # документация обязательных переменных
│   └── assets/
│       ├── favicon.svg
│       ├── og-default.png
│       └── logo.svg
│
├── drizzle/
│   ├── schema.ts                        # одна точка правды для БД
│   └── migrations/                      # сгенерированные SQL миграции
│
├── src/
│   ├── app/                             # Next.js App Router
│   │   ├── (public)/
│   │   │   ├── page.tsx                 # главная (лента)
│   │   │   ├── p/[slug]/page.tsx        # страница поста
│   │   │   ├── u/[username]/page.tsx    # профиль автора
│   │   │   ├── t/[tag]/page.tsx         # страница тега
│   │   │   ├── tags/page.tsx            # список всех тегов
│   │   │   ├── sitemap.ts               # динамический sitemap
│   │   │   ├── robots.ts                # robots.txt
│   │   │   └── opengraph-image.tsx      # дефолтная OG
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx           # OAuth-кнопки
│   │   │   ├── welcome/page.tsx         # ввод username после первого OAuth
│   │   │   └── api/auth/[...nextauth]/  # Auth.js handler
│   │   ├── (app)/
│   │   │   ├── new/page.tsx             # создать пост (Editor.js)
│   │   │   ├── edit/[id]/page.tsx       # редактировать
│   │   │   ├── drafts/page.tsx          # мои черновики
│   │   │   └── settings/page.tsx        # профиль (bio, аватар)
│   │   ├── (admin)/
│   │   │   ├── admin/page.tsx           # модерация (role-gated)
│   │   │   └── admin/users/page.tsx
│   │   ├── api/
│   │   │   ├── health/route.ts          # healthcheck
│   │   │   ├── upload/route.ts          # presigned URL → R2
│   │   │   └── indexnow/route.ts        # serve INDEXNOW_KEY (для верификации)
│   │   ├── layout.tsx                   # корневой layout, импорт theme/tokens.css
│   │   └── globals.css                  # Tailwind base + primitives
│   │
│   ├── components/
│   │   ├── ui/                          # shadcn/ui: button, dialog, input...
│   │   ├── editor/
│   │   │   ├── EditorClient.tsx         # клиентский монтаж Editor.js
│   │   │   ├── renderBlock.ts           # JSON → React/HTML для SSR
│   │   │   ├── sanitize.ts              # очистка HTML перед сохранением
│   │   │   └── blocks/                  # кастомные блоки (если будут)
│   │   ├── post/                        # PostCard, PostMeta, PostBody, PostList
│   │   ├── comments/                    # CommentList, CommentForm
│   │   ├── layout/                      # Header, Footer, Sidebar, CookieConsent
│   │   └── analytics/YandexMetrika.tsx
│   │
│   ├── lib/
│   │   ├── db.ts                        # Drizzle client
│   │   ├── auth.ts                      # Auth.js конфиг (4 провайдера + adapter)
│   │   ├── auth/providers/vk.ts         # кастомный VK provider
│   │   ├── storage.ts                   # S3 client (R2) + presigned helpers
│   │   ├── slugify.ts                   # заголовок → URL (с транслитом RU→latin)
│   │   ├── seo.ts                       # хелперы для generateMetadata
│   │   └── seo/indexnow.ts              # уведомление поисковиков
│   │
│   └── server/                          # server actions
│       ├── posts.ts                     # createDraft, savePost, publishPost, ...
│       ├── comments.ts
│       ├── reactions.ts                 # фаза 2 (заглушка в V1)
│       └── users.ts
│
├── scripts/
│   ├── backup.sh                        # pg_dump → R2 (вызывается из backup-контейнера)
│   ├── seed.ts                          # тестовые данные для dev
│   ├── new-niche.ts                     # CLI-визард для форка
│   └── check-theme.ts                   # CI-проверка обязательных токенов
│
└── docs/
    ├── doc.md                           # краткая дока, точка входа
    └── superpowers/specs/
        └── 2026-06-05-skelet-blog-design.md   # этот документ
```

**Контракт переиспользования:** код в [src/](src/) **не знает** о конкретной нише. Все строки берутся из `theme/content.ts`, все цвета — из CSS-переменных, заданных в `theme/tokens.css`. CI-чек `scripts/check-theme.ts` ловит регрессии этого контракта.

---

## 5. Дизайн-система и токены

### 5.1. Иерархия токенов (3 уровня)

```
┌───────────────────────────────────────────────────────────────────┐
│ Уровень 1: PRIMITIVES (общие, не меняются между нишами)           │
│   --space-1..12 (4px шаг), --duration-fast/normal/slow            │
│   --easing-standard/in/out, --shadow-1..5                         │
│   → src/app/globals.css                                           │
└───────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────────────────────────────────────────┐
│ Уровень 2: NICHE TOKENS (меняются на нишу)                        │
│   Цвета:    --color-background, --color-foreground,               │
│             --color-card, --color-card-fg,                        │
│             --color-primary, --color-primary-fg,                  │
│             --color-accent, --color-muted, --color-muted-fg,      │
│             --color-border, --color-ring, --color-danger          │
│   Радиусы:  --radius-sm, --radius-md, --radius-lg, --radius-pill  │
│   Шрифты:   --font-display, --font-text                           │
│   → theme/tokens.css + theme/typography.css                       │
└───────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────────────────────────────────────────┐
│ Уровень 3: SEMANTIC (как компоненты используют)                   │
│   bg-background, text-foreground, border-border, ring-ring,       │
│   bg-primary, text-primary-foreground, rounded-md, font-display   │
│   → Tailwind утилиты, замаплены в tailwind.config.ts              │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2. `theme/tokens.css` — пример

```css
:root {
  --color-background: #FFFFFF;
  --color-foreground: #17171C;
  --color-card:       #F6F6F8;
  --color-card-fg:    #17171C;
  --color-primary:    #2970FF;
  --color-primary-fg: #FFFFFF;
  --color-accent:     #2970FF;
  --color-muted:      #F1F1F3;
  --color-muted-fg:   #71717A;
  --color-border:     #E3E3E7;
  --color-ring:       #2970FF;
  --color-danger:     #EF4444;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-pill: 9999px;
}

.dark {
  --color-background: #101013;
  --color-foreground: #E8E8EB;
  --color-card:       #1A1A1E;
  --color-card-fg:    #E8E8EB;
  --color-primary:    #3D7EFF;
  --color-primary-fg: #FFFFFF;
  --color-accent:     #3D7EFF;
  --color-muted:      #222225;
  --color-muted-fg:   #94949B;
  --color-border:     #26262B;
  --color-ring:       #3D7EFF;
  --color-danger:     #DD4242;
}
```

Цвета — обычный hex (`#RRGGBB`), IDE сразу подсвечивает превью. Альфа применяется через `color-mix(...)` в [tailwind.config.ts](../../../tailwind.config.ts), а не в самих токенах. Это даёт `bg-primary/20`, `bg-background/95` и т.п.

Когда-то здесь был «HSL-без-обёртки» формат (`220 100% 58%`) ради `<alpha-value>`-плейсхолдера Tailwind. Отказались: VSCode такие триплеты не подсвечивает, читать сложнее. `color-mix(in srgb, ...)` стабилен во всех современных браузерах и решает обе проблемы.

### 5.3. `tailwind.config.ts` — маппинг утилит на токены

```ts
import type { Config } from "tailwindcss";

// Цвета лежат в --color-* как чистый hex (IDE подсвечивает превью).
// Альфу подмешиваем через color-mix — Tailwind подставит <alpha-value> в момент сборки.
const c = (name: string) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: ["./src/**/*.{ts,tsx}", "./theme/**/*.{ts,css}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: c("--color-background"),
        foreground: c("--color-foreground"),
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
    },
  },
} satisfies Config;
```

Результирующий CSS для `bg-primary/50`:
```css
background-color: color-mix(in srgb, var(--color-primary) calc(.5 * 100%), transparent);
```

### 5.4. Контракт обязательных токенов

В `theme/tokens.schema.md` — фиксированный список переменных, которые должны быть определены в light и dark вариантах. CI-скрипт `scripts/check-theme.ts` парсит `theme/tokens.css` и падает, если что-то пропущено. Это страховка от ситуации «новая ниша рендерится без цвета».

### 5.5. Подключение в `layout.tsx`

```tsx
import "./globals.css";
import "@/theme/tokens.css";
import "@/theme/typography.css";
import { ThemeProvider } from "next-themes";   // light/dark переключение

export const metadata = { /* из theme/seo.ts */ };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`next-themes` ставит класс `.dark` на `<html>` — именно его читает `theme/tokens.css` для тёмной палитры.

### 5.6. Шрифты

`theme/typography.css` подключает шрифты через `@font-face` или импортирует через `next/font` (в отдельном `theme/fonts.ts`). Переменные `--font-display` и `--font-text` указывают на выбранные семейства.

```ts
// theme/fonts.ts
import { Manrope, Inter } from "next/font/google";

export const fontDisplay = Manrope({ subsets: ["cyrillic"], variable: "--font-display" });
export const fontText = Inter({ subsets: ["cyrillic"], variable: "--font-text" });
```

Подключаются классами в `<html>`/`<body>` для `next/font`.

---

## 6. Модель данных

### 6.1. ER-диаграмма

```
┌───────────┐                                   ┌─────────────┐
│  users    │                                   │  accounts   │ (Auth.js)
│───────────│ 1                              N  │─────────────│
│ id PK     │◄─────────────────────────────────►│ user_id FK  │
│ email     │                                   │ provider    │
│ username  │                                   │ provider_id │
│ name      │                                   └─────────────┘
│ image     │
│ bio       │                                   ┌─────────────┐
│ role      │ 1                              N  │  sessions   │ (Auth.js)
│ created_at│◄─────────────────────────────────►│ user_id FK  │
│ banned_at │                                   └─────────────┘
└─────┬─────┘
      │ 1
      │ N
┌─────▼──────┐         ┌──────────────┐       ┌──────────────┐
│   posts    │ N     N │  post_tags   │ N   1 │    tags      │
│────────────│◄───────►│──────────────│◄─────►│──────────────│
│ id PK      │         │ post_id FK   │       │ id PK        │
│ author_id  │         │ tag_id FK    │       │ slug UNIQUE  │
│ slug UNIQUE│         └──────────────┘       │ name         │
│ title      │                                │ description  │
│ excerpt    │                                └──────────────┘
│ content    │  ← Editor.js JSON (jsonb)
│ content_html  ← кэш отрендеренного HTML (text)
│ cover_url  │
│ status     │  ← draft|published|archived (enum)
│ deleted_at │  ← soft-delete для модерации
│ pub_at     │
│ created_at │
│ updated_at │
│ views      │
└─────┬──────┘
      │ 1
      │ N
┌─────▼────────┐   (флэт в фазе 1; parent_id уже есть под треды фазы 2)
│  comments    │
│──────────────│
│ id PK        │
│ post_id FK   │
│ author_id FK │
│ parent_id    │ ← self-ref, null = верхний уровень
│ body         │
│ deleted_at   │
│ created_at   │
└──────────────┘

┌──────────────┐
│  uploads     │  (трекинг картинок для cleanup orphan'ов)
│──────────────│
│ id PK        │
│ user_id FK   │
│ post_id FK?  │ ← null до публикации поста
│ key          │ ← путь в R2
│ public_url   │
│ mime         │
│ size         │
│ width        │
│ height       │
│ created_at   │
└──────────────┘

── фаза 2 (схема готова, UI потом) ───────────────────────────────
┌──────────────┐         ┌──────────────┐  (фаза 3)
│  reactions   │         │subscriptions │
│──────────────│         │──────────────│
│ user_id FK   │         │ user_id FK   │
│ target_type  │         │ target_type  │ ← user | tag
│ target_id    │         │ target_id    │
│ kind         │ ← like, fire ...
│ created_at   │         │ created_at   │
└──────────────┘         └──────────────┘
```

### 6.2. Drizzle schema (полностью — `drizzle/schema.ts`)

```ts
import {
  pgTable, text, varchar, integer, bigint, timestamp, boolean,
  jsonb, pgEnum, uniqueIndex, index, primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRole = pgEnum("user_role", ["user", "moderator", "admin"]);
export const postStatus = pgEnum("post_status", ["draft", "published", "archived"]);
export const targetType = pgEnum("target_type", ["post", "comment", "user", "tag"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),                        // ULID/UUIDv7 генерим на app
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified"),         // Auth.js, для нас всегда null (OAuth)
  username: varchar("username", { length: 20 }).unique(),
  name: varchar("name", { length: 100 }),
  image: text("image"),
  bio: text("bio"),
  role: userRole("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  bannedAt: timestamp("banned_at"),
}, (t) => ({
  usernameIdx: index().on(t.username),
}));

// Auth.js таблицы
export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }));

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }));

// Контент
export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => users.id),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  excerpt: varchar("excerpt", { length: 280 }),
  content: jsonb("content").notNull(),                // Editor.js doc
  contentHtml: text("content_html"),                  // кэш для SSR
  coverUrl: text("cover_url"),
  status: postStatus("status").notNull().default("draft"),
  pubAt: timestamp("pub_at"),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  feedIdx: index("posts_feed_idx").on(t.status, t.pubAt),
  authorIdx: index().on(t.authorId),
}));

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 60 }).notNull(),
  description: text("description"),
});

export const postTags = pgTable("post_tags", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.tagId] }),
  tagIdx: index().on(t.tagId, t.postId),
}));

export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id),
  parentId: text("parent_id"),                        // self-ref, без FK для простоты (или: .references(() => comments.id)
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  postIdx: index().on(t.postId, t.createdAt),
}));

export const uploads = pgTable("uploads", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  postId: text("post_id").references(() => posts.id, { onDelete: "set null" }),
  key: text("key").notNull().unique(),
  publicUrl: text("public_url").notNull(),
  mime: varchar("mime", { length: 60 }).notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Фаза 2 (схема готова сейчас)
export const reactions = pgTable("reactions", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: targetType("target_type").notNull(),    // 'post' | 'comment'
  targetId: text("target_id").notNull(),
  kind: varchar("kind", { length: 20 }).notNull().default("like"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.targetType, t.targetId, t.kind] }),
  targetIdx: index().on(t.targetType, t.targetId),
}));

// Фаза 3 (схема готова сейчас)
export const subscriptions = pgTable("subscriptions", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: targetType("target_type").notNull(),    // 'user' | 'tag'
  targetId: text("target_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.targetType, t.targetId] }) }));
```

### 6.3. Ключевые решения по данным

- **ID = ULID** (текстовые), генерим на стороне приложения. Не serial — чтобы можно было сливать БД и не плодить коллизии.
- **`content` в jsonb** — нативно индексируется, фильтруется. Для фазы 2 поиска по полям блоков.
- **`content_html`** — материализованный кэш. Пересоздаётся при каждом `publishPost` / `editPost`. SSR не дёргает renderBlock, просто вставляет HTML.
- **`slug` уникальный**, длина до 80. Генерация: `slugify(title)` + транслит RU→latin + проверка коллизий с суффиксом `-2`, `-3`.
- **Soft-delete** через `deleted_at`. На страницах поста/коммента проверка `deleted_at IS NULL`. Это позволяет восстановить и сохраняет аудит.
- **`reactions` и `subscriptions`** — generic полиморфные таблицы. `target_type` — enum. На SQL-уровне FK нет (так как target_id может указывать в разные таблицы), валидируется в app.
- **Индексы:** `posts(status, pub_at desc)` для ленты, `posts(slug)` unique, `post_tags(tag_id, post_id)`, `comments(post_id, created_at)`.

---

## 7. Аутентификация

### 7.1. Флоу OAuth-логина

```
1. Юзер на /login → видит 4 кнопки: Google / Yandex / VK / GitHub
2. Клик → Auth.js redirect на provider
3. Provider → callback /api/auth/callback/<provider>?code=...
4. Auth.js обменивает code на профиль (email, name, image, provider_id)
5. Поиск accounts(provider, provider_account_id):
   ├─ найден → login существующего user_id
   └─ не найден → поиск users по email:
      ├─ найден → link account к user (multi-provider)
      └─ не найден → создать users + accounts (role='user')
6. Создать sessions запись (DB strategy), вернуть cookie
7. Если users.username = null → redirect /welcome (выбор username)
8. Иначе → redirect на ?callbackUrl или /
```

### 7.2. `/welcome` — ввод username после первого OAuth

Без username нельзя писать посты, комментить, иметь публичный профиль. Валидация:
- regex `^[a-z0-9_-]{3,20}$`
- проверка уникальности
- запрещённые слова (admin, root, api, login, ...)

### 7.3. Кастомный VK provider

Auth.js v5 не имеет builtin VK. Делаем кастомный (~30 строк):

```ts
// lib/auth/providers/vk.ts
import type { OAuthConfig, OAuthUserConfig } from "@auth/core/providers";

interface VKProfile {
  user_id: string;
  email?: string;
  first_name: string;
  last_name: string;
  avatar?: string;
}

export default function VK<P extends VKProfile>(options: OAuthUserConfig<P>): OAuthConfig<P> {
  return {
    id: "vk",
    name: "VK",
    type: "oauth",
    authorization: {
      url: "https://id.vk.com/authorize",
      params: { scope: "email", response_type: "code" },
    },
    token: "https://id.vk.com/oauth2/auth",
    userinfo: "https://id.vk.com/oauth2/user_info",
    profile(profile) {
      return {
        id: profile.user_id,
        name: `${profile.first_name} ${profile.last_name}`,
        email: profile.email ?? null,
        image: profile.avatar ?? null,
      };
    },
    options,
  };
}
```

### 7.4. Сессии

- **DB-стратегия** в Auth.js (`adapter: DrizzleAdapter(db)`).
- TTL = 30 дней, продлевается при активности.
- Cookie: `httpOnly`, `Secure`, `SameSite=Lax`.
- При бане (`users.banned_at IS NOT NULL`) — все сессии удаляются программно при следующем запросе через middleware.

### 7.5. Роли и авторизация

- `user` (дефолт) — писать, комментить.
- `moderator` — удалять чужие посты/комменты, выдавать баны.
- `admin` — то же + назначать роли + доступ к `/admin`.

Защита роутов:
```tsx
// app/(admin)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");
  return <>{children}</>;
}
```

В Server Actions — проверка `session.user.role` в начале функции.

### 7.6. Безопасность

- **CSRF** — Auth.js закрывает на OAuth-флоу; Server Actions Next.js имеют встроенный origin-check.
- **Rate limit** на `/api/auth/callback/*` через middleware (in-memory счётчик по IP; в фазе 3 — Redis).
- **OAuth secrets** только в `.env`, никогда в репо. `.env.example` — с пустыми ключами.
- **`NEXTAUTH_SECRET`** генерится при setup ниши (`openssl rand -base64 32`).

---

## 8. Жизненный цикл поста

### 8.1. Создание и автосейв черновика

```
Юзер на /new → EditorClient.tsx монтирует Editor.js
  ├─ Подключённые блоки: Header, Paragraph, Image, List, Quote,
  │  Code, Embed (YouTube/Twitter/VK), Delimiter, Checklist
  ├─ onChange (debounce 2 сек) → server action saveDraft()
  └─ ctrl+Enter → publishPost()

Server Action saveDraft(postId?, blocks, title)
  ├─ Если postId не передан: INSERT posts (status='draft')
  ├─ Иначе: UPDATE posts SET content=blocks, title, updated_at=now()
  ├─ НЕ генерит content_html (это только при публикации)
  └─ Возвращает {postId} → клиент его помнит
```

### 8.2. Загрузка картинок (через presigned URL)

```
1. Юзер дропает картинку в Editor.js Image-блок
2. Клиент: probe size через FileReader → получает width/height
3. onUpload(file, width, height) → POST /api/upload { filename, mime, size, width, height }
4. /api/upload (route handler):
   ├─ Проверяет session (401 если нет)
   ├─ Валидирует: mime ∈ {jpeg, png, webp, gif}, size ≤ 10MB
   ├─ Валидирует: width/height > 0 и < 10000 (защита от вранья клиента)
   ├─ Генерит key: uploads/<userId>/<ulid>.<ext>
   ├─ Создаёт presigned PUT URL для R2 (TTL 5 мин)
   ├─ INSERT uploads (user_id, key, post_id=null, mime, size, width, height)
   └─ Возвращает { uploadUrl, publicUrl, uploadId }
5. Клиент: PUT файл по uploadUrl напрямую в R2
6. Editor.js вставляет блок с publicUrl
```

**Где берутся `width`/`height`:** на клиенте через `new Image()` + `naturalWidth/Height` (или `<img>` декодинг). Значения передаются в `/api/upload`, валидируются. Это нужно для `next/image` SSR (без них CLS). В фазе 2 — заменим на server-side probe через Sharp (надёжнее), но в V1 client-probe достаточно.

**Линкование к посту** — при `publishPost`: парсим блоки, извлекаем `publicUrl` из image-блоков, делаем `UPDATE uploads SET post_id=... WHERE public_url IN (...)`.

**Orphan cleanup** — отдельный cron-job раз в неделю: `DELETE FROM uploads WHERE post_id IS NULL AND created_at < now() - interval '7 days'` + удаление ключей из R2.

### 8.3. Публикация

```
Server Action publishPost(postId)
  ├─ Авторизация: session.user.id === post.author_id OR role='admin'
  ├─ Валидация:
  │   ├─ title не пустой
  │   ├─ content содержит хотя бы 1 текстовый блок
  │   ├─ хотя бы 1 тег выбран
  │   └─ status ∈ {draft, archived}
  ├─ slug = slugify(title) + транслит + уникализация
  ├─ excerpt = первые 200 символов plain-text из блоков
  ├─ content_html = renderBlock(content) через sanitize-html
  ├─ UPDATE posts SET status='published', pub_at=now(),
  │      slug, excerpt, content_html
  ├─ Линкуем uploads к посту
  ├─ revalidatePath('/'), revalidatePath(`/t/${tag.slug}`), revalidatePath(`/u/${author.username}`)
  ├─ Триггерим IndexNow для нового URL
  └─ Редирект на /p/<slug>
```

### 8.4. Чтение поста (`/p/[slug]`)

```ts
// app/(public)/p/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.slug, params.slug), eq(posts.status, "published"), isNull(posts.deletedAt)),
    with: { author: true, tags: true },
  });
  if (!post) return {};
  return buildPostMetadata(post);          // см. §9.2
}

export default async function PostPage({ params }) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  return (
    <>
      <PostHero post={post} />
      <PostBody html={post.contentHtml!} />
      <PostTags tags={post.tags} />
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentsList postId={post.id} />
      </Suspense>
      <ViewTracker postId={post.id} />     {/* см. §8.7 */}
      <JsonLdArticle post={post} />        {/* см. §9.4 */}
    </>
  );
}
```

`content_html` уже санитизирован при сохранении, поэтому `dangerouslySetInnerHTML` безопасен.

### 8.5. Комментарии (фаза 1 — flat)

- GET — первые 20 комментов в Server Component, дальше «Загрузить ещё» через Server Action.
- Создание — Server Action `createComment(postId, body)`. Валидация: 1..1000 символов, session обязательна.
- Тело коммента: **хранится как plain-text**. Рендер — автолинкификация URL'ов (`linkify-react` или собственный простой regex для `http(s)://...`), переносы строк → `<br>`. Полученный HTML санитизируется через `sanitize-html` (whitelist: только `<a>` с `rel="nofollow noopener"` и `<br>`).
- В фазе 2 добавим UI для `parent_id` (треды до 3 уровней).

### 8.7. Подсчёт просмотров (V1 — наивный)

Клиентский `<ViewTracker postId>` после монтирования (debounce 3 сек, чтобы исключить случайные открытия и refresh) дёргает Server Action `incrementViews(postId)` → `UPDATE posts SET views = views + 1 WHERE id = ?`. Без rate-limit по IP в V1 (риск накруток принимаем — на трафике <1k/день это не проблема). В фазе 2 — батчинг: писать в Redis, раз в минуту flush в БД одним UPDATE.

### 8.6. Модерация и удаление

- **Автор архивирует свой пост** → `status='archived'`. Исчезает из ленты и сайтмапа; прямая ссылка доступна только автору.
- **Модератор/админ удаляет** → `deleted_at=now()`, `content_html=null`. Страница возвращает 410 Gone. Запись остаётся для аудита.
- **Юзер удаляет свой коммент** → `deleted_at=now()`, тело отображается как «удалено пользователем».
- **Бан юзера** → `banned_at=now()`. Все его посты и комменты остаются (можно скрыть через флаг — на фазе 3).

---

## 9. SEO и индексация

### 9.1. URL-структура

```
/                  — главная (лента)
/p/<slug>          — пост (slug до 60 символов)
/u/<username>      — профиль автора
/t/<tag-slug>      — страница тега
/tags              — список всех тегов
/sitemap.xml       — карта сайта (динамическая)
/robots.txt        — динамический
```

Плоско, без даты/категории в URL. Категории = теги (один пост в нескольких).

### 9.2. Метатеги через `generateMetadata`

Для поста:

```ts
function buildPostMetadata(post): Metadata {
  return {
    title: `${post.title} — ${themeSeo.siteName}`,
    description: post.excerpt,
    alternates: { canonical: `${BASE}/p/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.pubAt,
      modifiedTime: post.updatedAt,
      authors: [`${BASE}/u/${post.author.username}`],
      images: [{
        url: post.coverUrl ?? `${BASE}/p/${post.slug}/opengraph-image`,
        width: 1200, height: 630,
      }],
      locale: "ru_RU",
      siteName: themeSeo.siteName,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}
```

### 9.3. Динамические OG-картинки

Если `coverUrl` есть — используем. Если нет — `app/(public)/p/[slug]/opengraph-image.tsx` генерит на лету через `next/og`: заголовок поста + лого ниши + цвет-акцент. Кэшируется CDN.

### 9.4. JSON-LD структурированная разметка

В страницу поста инжектим:

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": post.title,
  "image": [post.coverUrl ?? defaultOG],
  "datePublished": post.pubAt,
  "dateModified": post.updatedAt,
  "author": { "@type": "Person", "name": post.author.name, "url": `${BASE}/u/${post.author.username}` },
  "publisher": { "@type": "Organization", "name": themeSeo.siteName, "logo": { "@type": "ImageObject", "url": `${BASE}/logo.png` } },
  "mainEntityOfPage": `${BASE}/p/${post.slug}`,
})}} />
```

И отдельно — `BreadcrumbList`: Главная → Тег → Пост.

### 9.5. Динамический sitemap

```ts
// app/(public)/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [postRows, tagRows, userRows] = await Promise.all([
    db.select({ slug: posts.slug, updatedAt: posts.updatedAt }).from(posts)
      .where(and(eq(posts.status, "published"), isNull(posts.deletedAt))),
    db.select({ slug: tags.slug }).from(tags),
    db.select({ username: users.username }).from(users).where(isNotNull(users.username)),
  ]);
  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    ...postRows.map(p => ({ url: `${BASE}/p/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
    ...tagRows.map(t => ({ url: `${BASE}/t/${t.slug}`, changeFrequency: "daily", priority: 0.6 })),
    ...userRows.map(u => ({ url: `${BASE}/u/${u.username}`, changeFrequency: "weekly", priority: 0.4 })),
  ];
}
```

Кэш — 1 час (`revalidate = 3600`). Когда >50k постов — разбиваем на индексный + чанки.

### 9.6. robots.txt

```ts
// app/(public)/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/new", "/edit/", "/drafts", "/settings", "/welcome"],
    }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
```

### 9.7. IndexNow — автоматическое уведомление поисковиков

Bing и Yandex поддерживают IndexNow. При публикации/изменении поста fire-and-forget:

```ts
// lib/seo/indexnow.ts
export async function notifyIndexNow(urls: string[]) {
  if (!process.env.INDEXNOW_ENABLED) return;
  await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: DOMAIN,
      key: process.env.INDEXNOW_KEY,
      keyLocation: `${BASE}/${process.env.INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  }).catch(console.error);
}
```

Ключ `INDEXNOW_KEY` генерируется один раз при первом запуске и доступен по `https://<domain>/<key>.txt` (route handler возвращает сам ключ — это проверка владения).

**Google** не использует IndexNow. Полагаемся на:
- быстрый sitemap (Google периодически дёргает);
- ручную подачу sitemap в Search Console при запуске (один раз).

### 9.8. Внутренние ссылки

- Подвал поста: «Другие посты автора» (в фазе 2 — «Похожие по тегам» через Jaccard).
- Профиль: «Теги, по которым пишет».
- Тег: «Связанные теги» (фаза 2).
- Все ссылки — обычные `<a>` (через `<Link>` Next.js), краулеры видят.

### 9.9. Производительность (Core Web Vitals)

- `next/image` для всех картинок — WebP/AVIF, lazy-load, `width`/`height` из uploads (берём при upload через probe).
- `next/font` — preload, `font-display: swap`.
- Tailwind purge в проде.
- Suspense для тяжёлых блоков (комменты, related).
- Бюджет: LCP < 2.5s mobile, CLS < 0.1.

### 9.10. Yandex Metrika + cookie consent

Скрипт Метрики подгружается **только после согласия**. Минимальный баннер `<CookieConsent>` стилизован через токены.

```tsx
<CookieConsent>
  <p>Сайт использует cookies для аналитики. {themeContent.consent.text}</p>
  <Button onClick={accept}>Принять</Button>
  <Button variant="ghost" onClick={decline}>Только необходимые</Button>
</CookieConsent>
```

После `accept` — `<YandexMetrika id={YANDEX_METRIKA_ID} />` монтируется.

### 9.11. Чек-лист при запуске нишы (SEO)

- [ ] Sitemap подан в Google Search Console
- [ ] Sitemap подан в Yandex Webmaster
- [ ] IndexNow key опубликован и доступен по `https://<domain>/<key>.txt`
- [ ] Я.Метрика установлена и счётчик подключён
- [ ] OG-картинки рендерятся (проверка на opengraph.dev)
- [ ] JSON-LD валиден (Google Rich Results Test)
- [ ] robots.txt отдаётся корректно
- [ ] Lighthouse mobile ≥ 90

---

## 10. Workflow форка под новую нишу

### 10.1. Чек-лист «новая ниша от нуля до production» (~2-3 часа)

```
[ ] 1. Создать новый репо из скелета (5 мин)
       git clone --depth 1 https://github.com/you/skelet.git aquarium-blog
       cd aquarium-blog && rm -rf .git && git init
       git remote add origin <your-new-repo>
       git remote add upstream https://github.com/you/skelet.git

[ ] 2. Зарегистрировать домен и направить A-запись на VPS (15 мин)

[ ] 3. OAuth credentials (30 мин — параллельно):
       - Google Cloud Console → OAuth 2.0 Client ID
       - Yandex OAuth → app
       - VK ID → app
       - GitHub OAuth → app
       Redirect URI везде: https://<domain>/api/auth/callback/<provider>

[ ] 4. Cloudflare R2 — создать bucket, S3-ключи (5 мин)

[ ] 5. Я.Метрика — счётчик, ID (5 мин)

[ ] 6. Заполнить .env (10 мин)

[ ] 7. Подобрать тему (45-60 мин — творческая часть):
       theme/tokens.css     — цвета (light + dark), радиусы
       theme/typography.css — выбрать пару шрифтов из Google Fonts
       theme/content.ts     — все тексты
       theme/seo.ts         — title-шаблон, дефолтное описание
       theme/assets/        — favicon, og-default, logo

[ ] 8. Локально проверить (5 мин):
       docker compose up -d
       Зайти на localhost, залогиниться, написать тестовый пост

[ ] 9. Задеплоить (10 мин):
       git push, ssh на VPS, git clone, .env, docker compose up -d

[ ] 10. Я.Вебмастер + Google Search Console (10 мин):
        Подать sitemap, добавить indexnow-key
```

### 10.2. CLI-визард `scripts/new-niche.ts`

Минимизирует рутину шагов 1, 6, 7:

```bash
$ pnpm new-niche
? Имя ниши (slug): aquarium
? Название сайта: Аквариумисты
? Слоган: Сообщество владельцев аквариумов
? Основной цвет (hex): #14b8a6
? Домен: aqua-blog.ru
? Шрифт заголовков (Google Fonts): Manrope
? Шрифт текста (Google Fonts): Inter
? Радиусы: 1) острые (4/6/10)  2) умеренные (8/12/16)  3) мягкие (12/20/28)
> 3

Создаю ../aquarium-blog/:
  ✓ скелет склонирован
  ✓ theme/tokens.css сгенерирован (палитра построена от #14b8a6)
  ✓ theme/typography.css подключены Manrope + Inter
  ✓ theme/content.ts заполнен (имя/слоган)
  ✓ theme/seo.ts заполнен
  ✓ .env создан (пустые ключи + комментарии где брать)
  ✓ README.md персонализирован

Дальше: cd ../aquarium-blog && заполни .env && docker compose up -d
```

Палитра строится через [chroma-js](https://www.npmjs.com/package/chroma-js): от основного цвета подбираются accent (~120° hue rotation), muted (lightness +85%), border, ring; light и dark варианты.

### 10.3. Перенос изменений между нишами (upstream ⇄ downstream)

```
skelet (upstream)                    aquarium-blog (downstream)
  └─ багфикс в src/lib/auth.ts
                                     git fetch upstream
                                     git merge upstream/main
                                     # конфликты ожидаются только в theme/
                                     # src/ — мердж чистый
                                     git push origin main
                                     # на VPS: git pull && docker compose up -d --build
```

**Жёсткое правило:** в downstream-репо ниши **запрещены правки `src/`**. Все правки кода идут в upstream-репо скелета. Это критично — иначе скелет перестаёт быть скелетом, ниши расходятся.

Если для конкретной ниши нужна уникальная фича в `src/` — она добавляется в upstream под флагом в `theme/features.ts`:

```ts
// theme/features.ts (ниша «ПК-сборщики»)
export const features = {
  partsCalculator: true,    // нишевая фича — калькулятор сборки
  videoEmbeds: true,
};
```

Код в `src/` проверяет флаг. Если `false` — UI элемента нет, route 404, ничего не подключается.

### 10.4. Палитра по нишам (референс)

| Ниша | Базовый цвет | Радиусы | Шрифт заголовка | Tone of voice |
|---|---|---|---|---|
| ПК-сборщики | `#2563eb` (синий) | 4 / 6 / 10 (острые) | JetBrains Mono / Inter | инженерный, точный |
| 3D-печать | `#f97316` (оранжевый) | 6 / 10 / 16 | Manrope | technical-friendly |
| Аквариумы | `#14b8a6` (тил) | 12 / 20 / 28 (мягкие) | Lora / Source Serif | уютный, природный |
| Котоводы | `#f43f5e` (розовый) | 16 / 24 / 32 | Nunito | тёплый, домашний |

**Deliverables по доке для V1:**
- `README.md` — quick start, ENV, как развернуть нишу (создаётся в фазе 1)
- `docs/doc.md` — точка входа, ссылка на спеку (уже есть)
- `docs/themes-cookbook.md` — расширенный референс палитр и шрифтов (создаётся как часть V1, после первой ниши, когда станут понятны паттерны)

---

## 11. Деплой

### 11.1. `docker-compose.yml`

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
      db: { condition: service_healthy }

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
    entrypoint: ["sh", "-c", "while true; do sleep 86400; /backup.sh; done"]
    depends_on: [db]

volumes:
  caddy_data:
  caddy_config:
  pg_data:
```

### 11.2. `Caddyfile`

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

### 11.3. `Dockerfile` (multi-stage)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && pnpm build
# Компилируем migrate-скрипт в отдельный файл (no CLI deps в рантайме)
RUN pnpm tsx --version >/dev/null && \
    npx esbuild scripts/migrate.ts --bundle --platform=node --outfile=migrate.js

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/drizzle ./drizzle
COPY --from=builder --chown=app:app /app/migrate.js ./migrate.js
COPY --from=builder --chown=app:app /app/scripts/entrypoint.sh ./entrypoint.sh
USER app
EXPOSE 3000
CMD ["sh", "./entrypoint.sh"]
```

**Почему отдельный migrate.js:** `drizzle-kit` (CLI) — dev-dependency, в стандартном `.next/standalone` его нет. Решение — на этапе билда собираем самостоятельный `migrate.js` через esbuild, который использует только `drizzle-orm/migrator` (это уже runtime-зависимость через `node_modules` в standalone). Файл `scripts/migrate.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
await migrate(db, { migrationsFolder: "./drizzle/migrations" });
await pool.end();
console.log("Migrations applied");
```

`entrypoint.sh`:

```sh
#!/bin/sh
set -e
node migrate.js
exec node server.js
```

В `next.config.ts`:
```ts
export default { output: "standalone" } satisfies NextConfig;
```

### 11.4. Бэкап `scripts/backup.sh`

```sh
#!/bin/sh
set -e
DATE=$(date +%Y-%m-%d-%H%M)
FILE="backup-${DATE}.sql.gz"
PGPASSWORD=${DB_PASSWORD} pg_dump -h db -U app app | gzip > /tmp/${FILE}
aws --endpoint-url=${BACKUP_S3_ENDPOINT} s3 cp /tmp/${FILE} s3://${BACKUP_S3_BUCKET}/db/${FILE}
rm /tmp/${FILE}
echo "Backup ${FILE} uploaded"
```

R2 bucket настраиваем с lifecycle policy: автоудаление после 30 дней.

### 11.5. Деплой нишы (краткий командный workflow)

```bash
# Первый раз:
ssh user@vps
git clone <repo>; cd <repo>
cp .env.example .env && vim .env
docker compose up -d
# Caddy получит сертификат за ~30 сек

# Обновление:
git pull
docker compose build app
docker compose up -d app    # zero-downtime для app, db не трогаем
```

### 11.6. Мониторинг (минимум)

- `/api/health` route handler — возвращает 200 + `SELECT 1` к БД.
- Внешний UptimeRobot (или Uptime Kuma в отдельном compose) дёргает каждую минуту.
- Логи через `docker compose logs -f app`. На фазе 3 — Grafana Loki.
- Алёрты в Telegram через UptimeRobot webhook.

### 11.7. Несколько ниш на одной VPS (опционально)

Если ниши маленькие, можно держать на одной машине:

```
/srv/pc-blog/    (compose: app + db + caddy?)
/srv/aqua-blog/  (compose: app + db)
```

Один Caddy на всех с несколькими блоками в `Caddyfile`. На старте — отдельная VPS на нишу проще (€4 — не больно), сводить вместе будем когда понадобится.

---

## 12. Roadmap фаз 2-3

### 12.1. Фаза 2 — «Есть ли движ?»

Делается после того, как фаза 1 показала живую нишу (≥30 постов, ≥10 активных пользователей).

| Фича | Что делать | Что уже готово |
|---|---|---|
| Лайки / реакции на пост | UI кнопок, server actions `react()`/`unreact()`, счётчик | `reactions` таблица в схеме |
| Реакции на коммент | UI, переиспользуем server actions с `targetType='comment'` | то же |
| Треды в комментах | UI «ответить», рендер дерева до 3 уровней | `comments.parent_id` есть |
| Поиск по постам | `/search`, форма в хедере, query через Postgres `tsvector` GIN | новая миграция: tsvector колонка + триггер update |
| Похожие посты | Алгоритм Jaccard по тегам | `post_tags` готов |
| RSS feed | `app/feed.xml/route.ts` | `posts` готов |
| Email-логин (опц.) | Добавить EmailProvider в Auth.js + Resend | Auth.js настроен расширяемо |

**Ожидаемое время:** 2-3 недели.

### 12.2. Фаза 3 — «Удержание»

Делается когда есть >300 активных пользователей.

| Фича | Что делать | Что уже готово |
|---|---|---|
| Подписки на авторов / теги | UI «подписаться», server actions | `subscriptions` таблица в схеме |
| Персональная лента «Для тебя» | Раздел: посты от подписок + по тегам, отсортированы | запрос на готовую схему |
| Email-уведомления / дайджесты | Daily/weekly digest job (cron-контейнер), шаблоны | Resend подключим в фазе 2 |
| Полнотекстовый поиск | Опционально замена tsvector на Meilisearch контейнер | API в `lib/search/` за интерфейсом |
| Расширенная модерация | Жалобы, очередь, баны с причиной, аудит | новые таблицы `reports`, `mod_actions` |
| Notifications в UI | Колокольчик, dropdown, прочитанное/непрочитанное | новая таблица `notifications` |
| Achievements (опц.) | За первый пост, 10 лайков и т.д. | `users.badges jsonb` колонка добавим |

**Ожидаемое время:** 1-2 месяца, дозируемо.

### 12.3. Что НЕ закладываем даже в схему

- Личные сообщения (DM) — отдельный продукт.
- Платные подписки — Stripe, возвраты, налоги; ждём прибыльности.
- Видеохостинг — embed YouTube/VK/Rutube хватит.
- Нативное приложение — PWA достаточно.

---

## 13. Справочник ENV-переменных

```env
# === Домен ===
DOMAIN=example.ru
NEXTAUTH_URL=https://example.ru
NEXTAUTH_SECRET=                     # openssl rand -base64 32

# === БД (Postgres in compose) ===
DB_PASSWORD=                         # openssl rand -hex 16
DATABASE_URL=postgres://app:${DB_PASSWORD}@db:5432/app

# === OAuth ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YANDEX_CLIENT_ID=
YANDEX_CLIENT_SECRET=
VK_CLIENT_ID=
VK_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# === Хранилище (Cloudflare R2) ===
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE=https://images.example.ru  # public bucket / custom domain

# === Бэкапы (отдельный R2 bucket или префикс) ===
BACKUP_S3_ENDPOINT=
BACKUP_S3_BUCKET=
BACKUP_S3_KEY=
BACKUP_S3_SECRET=

# === SEO ===
INDEXNOW_ENABLED=true
INDEXNOW_KEY=                        # auto-generated, see scripts/setup.ts

# === Аналитика ===
YANDEX_METRIKA_ID=

# === Опц. (фаза 2+) ===
RESEND_API_KEY=                      # для email-логина и уведомлений
```

---

## 14. Открытые вопросы и риски

### 14.1. Что отложено и почему

- **Email-логин** — нет в V1, потому что нет email-провайдера. Если ниша требует — добавляем Resend (фаза 2).
- **Капча на регистрацию/коммент** — для V1 полагаемся на friction OAuth. Если будет спам — добавляем Cloudflare Turnstile.
- **Подсчёт `views`** наивный (атомарный update при показе) — на трафике >1000/мин полезет в БД. План: rate-limit по IP через Caddy log → batch update раз в минуту (фаза 2).
- **Сжатие/ресайз картинок при upload** — сейчас юзер льёт «как есть» (до 10MB). План: добавить лямбду (или Sharp в Next.js route) для генерации миниатюр (фаза 2).

### 14.2. Известные риски

| Риск | Митигация |
|---|---|
| OAuth-провайдер меняет API (VK особенно) | Кастомный VK provider изолирован в одном файле; в случае поломки — фикс в одном месте + merge во все ниши |
| Postgres растёт в большой объём, бэкапы дороги | После 10GB включаем lifecycle и сжимаем долгие бэкапы; rotate keep=daily7+weekly4+monthly12 |
| Cloudflare R2 перестаёт быть бесплатным или поднимает цены | Код общается через S3 API → миграция на Yandex Object Storage / Selectel минимальна (смена endpoint в `.env`) |
| Спам-регистрации через OAuth (мульти-аккаунты) | Лимит создания постов для new users (первые 24ч — max 3 поста); ручная модерация в админке |
| Скелет начинает «развиваться по нишам», расходясь | Жёсткое правило: правки `src/` только в upstream; feature flags в `theme/features.ts` |
| Editor.js блок-формат меняется major-версией | Версионируем `content_schema_version` в `posts`; при апгрейде — migration script для блоков |

### 14.3. Что нужно проверить на этапе реализации

- Производительность Editor.js на длинных постах (>200 блоков) — может тормозить mobile.
- Совместимость VK ID OAuth с Auth.js v5 (свежий API, могут быть нюансы).
- Размер Docker-образа Next.js standalone (~150-200MB) — приемлемо.
- Время холодного билда `pnpm build` на CX22 (2 vCPU, 4GB) — возможно нужно билдить локально и пушить образ в registry, если медленно.

---

## 15. Адаптив: web + mobile

Сайт должен **одинаково хорошо работать на смартфонах и десктопах** (с учётом того, что большинство трафика придёт с мобильных). Mobile-first подход на всех экранах.

### 15.1. Брейкпоинты

Используем дефолтные Tailwind:

| Брейкпоинт | Ширина | Целевое устройство |
|---|---|---|
| (base) | < 640px | Мобильный (портрет) |
| `sm:` | ≥ 640px | Мобильный (ландшафт), малые планшеты |
| `md:` | ≥ 768px | Планшет |
| `lg:` | ≥ 1024px | Маленький ноутбук |
| `xl:` | ≥ 1280px | Десктоп |

Дизайн пишется **mobile-first**: базовые классы — для мобильного, `md:`/`lg:` — оверрайды для широкого экрана. Никогда наоборот.

### 15.2. Контейнер и сетка

- Главный контейнер: `max-w-[680px]` на странице поста (читабельность), `max-w-[1200px]` на ленте и страницах списков.
- Боковой padding: `px-4 md:px-6 lg:px-8`.
- Лента постов: **1 колонка на мобильном, 2 колонки на `md`+**. Карточки полной ширины внутри своей колонки.

### 15.3. Тач-таргеты

Все кликабельные элементы (кнопки, ссылки, иконки в хедере, чекбоксы) — **минимум 44×44 px** (Apple HIG / WCAG). В Tailwind: `min-h-11 min-w-11` или явные `h-11 w-11`. Это особенно касается:

- Иконок в хедере (меню, поиск, профиль)
- Кнопки реакций (фаза 2)
- Чекбоксов в Editor.js Checklist-блоке
- Ссылок в навигации

### 15.4. Header / навигация

- **Mobile (`<md`):** хедер с лого слева + кнопкой меню (☰) справа. Тап по меню → выезжающая панель (Sheet из shadcn/ui) со ссылками. Аватар/login справа от лого, если есть место.
- **Desktop (`md+`):** хедер с лого, нав-ссылками («Лента», «Темы», «Написать»), правый блок: поиск (фаза 2), уведомления (фаза 3), аватар/dropdown.
- **Hide on scroll** на мобильном (через IntersectionObserver или CSS sticky-trick), чтобы освободить пространство при чтении длинных постов. На десктопе хедер всегда виден.

### 15.5. Типографика

Размеры через `clamp()` для плавного масштаба:

```css
:root {
  --text-base: clamp(16px, 1rem + 0.25vw, 17px);   /* основной текст */
  --text-lg:   clamp(18px, 1.05rem + 0.4vw, 20px);
  --text-xl:   clamp(20px, 1.2rem + 0.6vw, 24px);
  --text-2xl:  clamp(24px, 1.4rem + 0.9vw, 32px);  /* h2 в посте */
  --text-3xl:  clamp(28px, 1.6rem + 1.2vw, 40px);  /* h1 поста на desktop */
  --line-height-body: 1.6;
  --line-height-tight: 1.25;
}
```

Это убирает «лестницу» брейкпоинтов — текст плавно увеличивается с экраном.

### 15.6. Изображения

- `next/image` с `sizes` атрибутом обязательно: `sizes="(max-width: 768px) 100vw, 680px"` на странице поста, `sizes="(max-width: 768px) 100vw, 50vw"` в ленте.
- Cover-картинки постов — соотношение 16:9 (или 3:2 для драйв2-стиля), `object-cover`.
- Inline-картинки в Editor.js — full-width родителя (max ширина 680px), без обтекания.

### 15.7. Editor.js на мобильном

Editor.js имеет приличный mobile UX, но требует доработок:

- **Тулбар плагинов**: дефолтный «+» / settings слева/справа от блока на мобильном перекрывается контентом — кастомизируем через `EditorConfig.toolbar` или `tunes`, чтобы тулбары были сверху/снизу блока.
- **Slash-меню**: на мобильном вызывается длинным тапом или через явную кнопку «+» — настраиваем.
- **Загрузка картинок**: на мобильном open file picker через `<input type="file" accept="image/*" capture>` — `capture` даёт прямой доступ к камере (опционально).
- **Sticky save-bar** внизу экрана на мобильном (кнопка «Опубликовать» / «Сохранить») — чтобы не скроллить искать.

### 15.8. Карточка поста (PostCard)

Одна разметка, два режима:

- Mobile: cover сверху (`aspect-video`), заголовок ниже, мета снизу (автор + дата + теги). Полная ширина колонки.
- Desktop (md+): то же, но карточки в 2 колонки grid.

### 15.9. Страница поста

- На мобильном: cover на всю ширину, дальше контент в `px-4`, max-width `680px`.
- На десктопе: cover ограничивается контейнером 1200px (либо растягивается на ширину viewport с edge-to-edge — оба варианта норм, выберем при дизайн-проходе ниши).
- Якорные ссылки на заголовки (для длинных постов) — иконка `#` появляется при hover на десктопе, всегда видна на мобильном.
- Кнопка «наверх» появляется после прокрутки 50% — `fixed bottom-4 right-4` на мобильном.

### 15.10. Комментарии

- Форма коммента на мобильном: занимает полную ширину, кнопка «Отправить» — block, sticky bottom при фокусе на textarea.
- Список комментов: `divide-y` (тонкая линия между), avatar 32×32 на мобильном, 40×40 на десктопе.

### 15.11. Тестирование адаптива

**Чек-лист перед релизом ниши:**

- [ ] Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] Chrome DevTools — пройти на устройствах: iPhone 13 (390×844), Pixel 7 (412×915), iPad mini (744×1133), 1280×800
- [ ] Скриншоты главной, поста и /new на трёх размерах — приложить к PR
- [ ] Тач-таргеты ≥ 44px проверены через DevTools (Inspect → щелчок по элементу → размеры)
- [ ] Editor.js: написать пост с телефона целиком, без зажимов и обрезок UI
- [ ] Реальное устройство (свой смартфон) — обязательная финальная проверка

### 15.12. Без отдельного мобильного приложения

Скелет не предполагает нативное мобильное приложение. PWA-манифест добавляется в V1 (минимальный — иконки + theme_color + name), чтобы юзер мог «добавить на главный экран». Service Worker для офлайн — фаза 3 (опционально).

`app/manifest.ts`:

```ts
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: themeContent.site.name,
    short_name: themeContent.site.shortName ?? themeContent.site.name,
    description: themeContent.site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",                      // придёт из токенов через build
    theme_color: themeSeo.themeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

---

## Конец документа

Этот документ — спецификация уровня дизайна. Следующий шаг — **implementation plan**: пошаговые планы реализации фазы 1 (6 планов по милстоунам), которые пишутся отдельно через skill `superpowers:writing-plans`.

### Разбивка 6 планов фазы 1 (MVP)

| № | План | Что входит | Ссылка |
|---|------|-----------|--------|
| 1 | **Bootstrap** | Каркас Next.js 15, дизайн-токены + Tailwind, light/dark, responsive header/footer, docker-compose (Caddy + app + Postgres), `/api/health`, pwa-manifest. Без auth, без таблиц контента. | [plan-01](../plans/2026-06-05-plan-01-bootstrap.md) |
| 2 | **Auth** | Auth.js v5, OAuth-провайдеры (Google, Yandex, VK, GitHub), таблицы `users` / `accounts` / `sessions` / `verification_tokens`, базовый профиль (`/u/[username]`), middleware для protected routes. | plan-02 (TBD) |
| 3 | **Storage + Images** | Cloudflare R2 клиент, presigned-upload роут, `images`-таблица, ресайз через `sharp` (или равноценный путь), Editor.js image-блок (заглушка интеграции). | plan-03 (TBD) |
| 4 | **Posts + Editor** | Таблицы `posts` / `tags` / `post_tags`, интеграция Editor.js, server-side рендер `content_json → content_html`, страница поста с SSR + draft/publish flow, CRUD автора. | plan-04 (TBD) |
| 5 | **Feed + Comments + Tags + Moderation** | Главная лента (новое/популярное), страницы тегов, плоские комменты с `parent_id` в схеме (треды в фазе 2), soft-delete, минимальная модерация (admin-флаг, hide/restore). | plan-05 (TBD) |
| 6 | **SEO + Deploy + Backups + Metrika** | Динамический sitemap, robots, JSON-LD (BlogPosting + BreadcrumbList), OG-картинки через `next/og`, IndexNow, Yandex.Metrika с cookie-consent, prod-деплой на Hetzner, backup-контейнер с дампом в R2. | plan-06 (TBD) |

**Правило перехода:** каждый план пишется и ревьюится только когда предыдущий выполнен и зелёный (`pnpm test` + DoD-чеклист плана). Это защищает от написания планов «впрок», которые устаревают к моменту выполнения.

**Фазы 2 и 3** (см. §12) — отдельные roadmap-итерации после MVP, планы для них не пишутся пока не закрыта фаза 1.
