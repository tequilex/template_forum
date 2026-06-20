# План 5a — Discovery (Feed + Tags + Profile + 3-col shell)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For tasks marked **(TDD)** — use `superpowers:test-driven-development`.

**Goal:** Закрыть discovery-поверхность: посторонний посетитель видит главную ленту `/`, страницу тэга `/t/[slug]`, индекс `/tags`, профиль автора `/u/[username]`. Всё обёрнуто в 3-колоночный layout (left nav + центр + right sidebar), который собирает discovery + drafts под одним shell. Sitemap + `generateMetadata` подключены.

**Architecture:** Два route group'а — `(public)/(feed)/` (без auth, главная/тэги/профили) и `(app)/(feed)/` (drafts, требует auth inline в page-компонентах). Оба `layout.tsx` рендерят общий `<FeedShell>` (3-col CSS-grid с sticky left/right + `BottomNav` на mobile). Все страницы — RSC, никаких client-компонентов в основном потоке; пагинация через `<Link href="?page=N">` (server-rendered, indexable). Чтение поделено на четыре независимых запроса (`/`, `/t`, `/tags`, `/u`) — без CTE/array_agg, тэги для PostCard'ов набираем вторым SQL `WHERE post_id IN (...)`. Sitemap собирается из трёх `SELECT`'ов в `app/sitemap.ts`.

**Tech Stack:** Next.js 15 App Router (RSC + Route Groups), Drizzle ORM (read-only feed queries: `desc(pubAt)`, `count(*)::int`, `inArray`), Tailwind (`lg:grid-cols-[200px_1fr_280px]` + `lg:hidden` bottom-bar), `next/link` (RSC-friendly pagination), Vitest + `@testing-library/react` (PostCard / Paginator / LeftNav). **Новые dev-deps:** `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `jsdom` — текущий `vitest.config.ts` использует `environment: "node"` и `include: ["tests/**/*.test.ts"]` (без `.tsx`), без DOM-testing-стека рендерные тесты не запустятся. Все четыре — лёгкие, без рантайма в продакшен-бандл.

**Спецификация:** [docs/superpowers/specs/2026-06-20-plan-05a-discovery-design.md](../specs/2026-06-20-plan-05a-discovery-design.md) — целиком (§3 routes, §4 components, §5 queries, §6 SEO — особенно важны).
**Канон высшего уровня:** [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](../specs/2026-06-05-skelet-blog-design.md) §6 (схема users/posts/tags), §8.4 (чтение поста), §9 (SEO), §12.1/§12.2 (что НЕ в фазе 1), §15 (адаптив), §16 (разбивка фаз — plan-05 разделён на 5a/5b).

**Definition of Done (что считается завершением плана 5a):**
- `pnpm test` зелёный — минимум +20 новых кейсов (`readingTime`:4, `PostCard`:4, `Paginator`:4, `LeftNav` active-state:4, feed-queries:12+, sitemap shape:5). Все ранее проходившие тесты продолжают проходить (включая после смены vitest `environment` с `node` на `jsdom` в Task 1).
- `pnpm tsc --noEmit` чисто.
- `pnpm build` зелёный И с пустыми R2-env, И с заполненными (Yandex storage).
- Никаких миграций в этом плане; Drizzle schema не меняется.
- Manual e2e на dev-сервере (анонимный браузер): `/` показывает PostCard'ы → клик в PostCard → `/p/[slug]` (plan-04) → назад → клик в TagBadge → `/t/[slug]` → клик в авторе → `/u/[username]` → клик в LeftNav `Темы` → `/tags`. Полный чеклист — §DoD ниже.
- Mobile DoD §15.11: Chrome DevTools iPhone 13 / Pixel 7 / iPad mini полный цикл, Lighthouse mobile ≥90 по всем 4 метрикам на `/`, `/t/<seeded-slug>`, `/u/<username>`.
- `view-source:/sitemap.xml` содержит все новые URL'ы (`/`, `/tags`, `/t/*`, `/u/*`, `/p/*`).
- Retro-секция в конце этого файла заполнена расхождениями с планом.

**Сознательно отложено (с маркерами в коде / эпилоге):**
- **Комментарии + модерация** — plan-5b. Никакого UI комментов на `/p/[slug]`.
- **Лайки, реакции, ViewTracker** — фаза 2 (§12.1). `posts.views` не добавляется.
- **Поиск по постам, RSS, похожие посты** — фаза 2.
- **Подписки на авторов/тэги, персональная лента «Для тебя»** — фаза 3 (§12.2).
- **Виджеты в правом sidebar** — пустой `<aside>` слот в plan-5a. Наполнение — отдельный mini-chore после plan-5b.
- **Сортировка `popular`** — фаза 2 (когда появятся лайки). Главная лента — только «новое».
- **Cursor-pagination** — когда нишa перевалит 1000 постов. URL `?page=N` совместим с future-cursor (миграция без ломки внешних ссылок).
- **Tabs `Posts | Tags` на профиле** — V1 минимум, без табов.
- **Admin-CRUD для тэгов + `tags.description` editing UI** — plan-5b/5c. В V1 description редактируется через миграцию/`db:studio`.
- **Tag-cloud-вёрстка `/tags`** — отвергнута на брейне (бедно при <20 тэгах).
- **IndexNow / `revalidatePath` уведомления** — plan-06 (SEO-проход).
- **JSON-LD `BlogPosting`/`Person`** для tag/profile — phase 2 polish. `Article` JSON-LD для `/p/[slug]` — отдельный mini-chore (если ещё не было в plan-04).
- **`unstable_cache` для feed-queries** — phase 2 (когда упрёмся в реальный трафик). В plan-5a свежесть важнее latency.
- **Split sitemap.xml на multiple файлов** — plan-06. При V1-объёмах один файл ≤100 URL'ов.

---

## Repo layout, который добавляем/меняем в этом плане

```
skelet/
├── README.md                                       # ← короткая заметка про новые роуты (Task 14)
├── package.json                                    # ← +dev-deps: @testing-library/react + dom + jest-dom + jsdom (Task 1)
├── vitest.config.ts                                # ← environment: "node" → "jsdom"; include +.test.tsx (Task 1)
├── tests/
│   └── setup.ts                                    # ← +import "@testing-library/jest-dom/vitest" (Task 1)
│
├── src/
│   ├── lib/
│   │   └── site-config.ts                          # ← NEW: { name, url } — реэкспорт из theme/seo.ts + url из NEXTAUTH_URL
│   │
│   ├── components/
│   │   ├── feed/
│   │   │   ├── PostCard.tsx                        # ← NEW: vertical card (cover/tags/title/excerpt/meta)
│   │   │   ├── PostList.tsx                        # ← NEW: PostCard[] + Paginator
│   │   │   ├── Paginator.tsx                       # ← NEW: RSC, <Link prev/next>
│   │   │   ├── EmptyFeed.tsx                       # ← NEW: «постов пока нет»
│   │   │   └── readingTime.ts                      # ← NEW: util — оценка по word-count
│   │   ├── tags/
│   │   │   ├── TagListRow.tsx                      # ← NEW: строка name + desc + count
│   │   │   └── TagBadge.tsx                        # ← NEW: inline chip <Link href="/t/{slug}">#name</Link>
│   │   ├── profile/
│   │   │   ├── UserProfileHeader.tsx               # ← NEW: avatar + username + bio + stats-row
│   │   │   └── UserStatsRow.tsx                    # ← NEW: «X постов · с {month year} · #tag1 #tag2 #tag3»
│   │   └── layout/
│   │       ├── FeedShell.tsx                       # ← NEW: 3-col grid + BottomNav
│   │       ├── LeftNav.tsx                         # ← NEW: 4 ссылки (Лента / Темы / Драфты / Профиль)
│   │       ├── BottomNav.tsx                       # ← NEW: mobile sticky 4 пункта
│   │       └── RightSidebar.tsx                    # ← NEW: пустой <aside> с placeholder-комментом
│   │
│   ├── server/
│   │   └── feed.ts                                 # ← NEW: getFeedPage / getTagFeedPage / getUserFeedPage / getTagsIndex / getUserProfile (RSC-only read queries)
│   │
│   └── app/
│       ├── sitemap.ts                              # ← NEW: создаём с нуля (plan-01 пропустил)
│       ├── page.tsx                                # ← DELETE (переезжает в (public)/(feed)/page.tsx)
│       ├── u/[username]/page.tsx                   # ← DELETE (переезжает в (public)/(feed)/u/[username])
│       │
│       ├── (public)/
│       │   └── (feed)/                             # ← NEW route group: 3-col shell для публичных discovery
│       │       ├── layout.tsx                      # ← NEW: <FeedShell>{children}</FeedShell>
│       │       ├── page.tsx                        # ← NEW: главная лента «/»
│       │       ├── t/[slug]/page.tsx               # ← NEW: лента по тэгу
│       │       ├── u/[username]/page.tsx           # ← NEW: профиль автора
│       │       └── tags/page.tsx                   # ← NEW: индекс тэгов
│       │
│       └── (app)/
│           └── (feed)/                             # ← NEW route group: 3-col shell для auth-only feed-инструментов
│               ├── layout.tsx                      # ← NEW: <FeedShell>{children}</FeedShell>
│               └── drafts/                         # ← MOVE из (app)/drafts/
│                   └── page.tsx                    # requireAuthState() остаётся inline
│
└── tests/
    └── feed/
        ├── reading-time.test.ts                    # 4 кейса: 0 слов / 1 / 200 / 1000
        ├── post-card.test.tsx                      # 4 кейса: с обложкой / без / без тэгов / клик
        ├── paginator.test.tsx                      # 4 кейса: page 1 (no prev) / middle / last (no next) / no pages
        ├── left-nav.test.tsx                       # 3 кейса: active-state по pathname / no session / banned-username fallback
        ├── feed-queries.test.ts                    # integration (real DB): getFeedPage(1/2/999) + getTagFeedPage + getUserProfile
        └── sitemap.test.ts                         # shape: правильные URL'ы для seed-постов/тэгов/users
```

**Что удаляется/перемещается:**

| Старый путь | Новый путь | Action |
|---|---|---|
| `src/app/page.tsx` (auth-gated stub) | `src/app/(public)/(feed)/page.tsx` | DELETE + CREATE |
| `src/app/u/[username]/page.tsx` (auth-gated, минимум) | `src/app/(public)/(feed)/u/[username]/page.tsx` | DELETE + CREATE (расширенный) |
| `src/app/(app)/drafts/page.tsx` | `src/app/(app)/(feed)/drafts/page.tsx` | MOVE |

---

## Task 1: Testing-deps (RTL + jsdom) + `vitest.config.ts` под `.test.tsx` + `siteConfig` + content-keys

**Files:**
- Modify: `package.json` (новые dev-deps)
- Modify: `vitest.config.ts` (jsdom env, `.test.tsx` include)
- Modify: `tests/setup.ts` (регистрация `@testing-library/jest-dom`-matchers)
- Create: `src/lib/site-config.ts`
- Modify: `theme/content.ts` (добавляем недостающие keys: `nav.feed/drafts/profile`, блок `feed`, расширяем `tags`, добавляем `profile`)

Текущий `vitest.config.ts` (`environment: "node"`, `include: ["tests/**/*.test.ts"]`) и отсутствие `@testing-library/*`/`jsdom` в `package.json` означают, что `.test.tsx`-файлы из Task 2/5/6 не будут найдены и упадут до запуска. Лечим прежде всего.

Файл `src/lib/site-config.ts` в plan-01 не создавался — заводим минимально, потом расширяем. `theme/seo.ts` остаётся (используется в `src/app/layout.tsx`), мы только добавляем `url` через новый `siteConfig` модуль.

- [ ] **Step 1.0a: Установить testing-deps**

```bash
pnpm add -D @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom
```

Ожидание: `package.json` `devDependencies` пополнен этими 4 ключами; `pnpm-lock.yaml` обновлён. React 19 уже стоит в `dependencies` (plan-01), отдельно ставить не нужно.

- [ ] **Step 1.0b: Расширить `vitest.config.ts`**

Открой `vitest.config.ts`. Меняем `environment` на `jsdom`, расширяем `include` под `.test.tsx`:

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",                                 // ← было "node"
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], // ← добавили .tsx
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@/theme": resolve(__dirname, "theme"),
      "@db": resolve(__dirname, "drizzle"),
    },
  },
  esbuild: { jsx: "automatic" },
});
```

`jsdom` нужен для рендера React-компонентов (PostCard / LeftNav / Paginator). Существующие `.test.ts` файлы (plan-01..04 — slugify, sanitize, server-actions, p-slug-route и т.д.) работают и в jsdom без изменений (jsdom — суперсет node-env по API).

- [ ] **Step 1.0c: Расширить `tests/setup.ts`**

Открой `tests/setup.ts`. В существующий контент (env-fallbacks) добавь в самом верху:

```ts
import "@testing-library/jest-dom/vitest";
```

Это регистрирует matchers (`toBeInTheDocument`, `toHaveAttribute` и т.д.) для всех тестов.

- [ ] **Step 1.0d: Smoke — все ранее проходившие тесты должны продолжать проходить**

```bash
pnpm test
```

Ожидание: то же число green-тестов, что и до изменений (plan-04 retro: 142/143). Если что-то ломается на jsdom (например, тест ходил в `fetch` через node-only fetch) — добавь fix в этом же task'е, не оставляй регрессию на потом.

- [ ] **Step 1.0e: Промежуточный коммит**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/setup.ts
git commit -m "chore(plan-5a): add @testing-library/react + jsdom; vitest jsdom env + .tsx include"
```

- [ ] **Step 1.1: Создать `src/lib/site-config.ts`**

```ts
// src/lib/site-config.ts
import { seo } from "@theme/seo";

// Минимальный фасад для plan-5a — siteConfig.name + siteConfig.url.
// Использовать ТОЛЬКО в коде, которому нужен абсолютный URL (sitemap, generateMetadata
// для OG-канонических). Внутри JSX берите `seo.siteName`/`content.site.name` —
// двойного источника правды не плодим, siteConfig только проксирует.
export const siteConfig = {
  name: seo.siteName,
  url: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
} as const;
```

`NEXTAUTH_URL` валидируется как `z.string().url()` в `src/lib/env.ts` (plan-01) — то есть на prod build'е он гарантированно есть и валиден. Дефолт `http://localhost:3000` страхует unit-тесты, которые не ходят через `env.ts`.

- [ ] **Step 1.2: Расширить `theme/content.ts`**

Открой `theme/content.ts`. **Текущая форма** (на момент plan-5a, проверь сам — если разошлось, ориентируйся на актуальное):

```ts
nav: {
  home: "Лента",
  new:  "Написать пост",
  tags: "Темы",
  login: "Войти",
},
empty: {
  feed: "Пока нет постов. Будьте первым!",
  drafts: "У вас нет черновиков",
  tag: "Постов по этой теме пока нет",
},
```

`nav.home` и `nav.tags` уже на месте — Header использует именно их (`content.nav.home`, `content.nav.tags`). LeftNav будет использовать те же ключи (визуальная консистенция; «Главная» в Header'е → «Лента» в боковухе была бы запутанной). **Добавляем недостающие keys в `nav`:**

```ts
nav: {
  home: "Лента",       // (без изменений — LeftNav «Лента» = Header «Лента»)
  new:  "Написать пост",
  tags: "Темы",        // (без изменений — LeftNav «Темы» = Header «Темы»)
  drafts: "Драфты",    // ← NEW: LeftNav/BottomNav пункт «Драфты»
  profile: "Профиль",  // ← NEW: LeftNav/BottomNav пункт «Профиль»
  login: "Войти",
},
```

**Добавляем новый блок `feed`** (рядом с `empty`/`footer`):

```ts
feed: {
  prev: "← Назад",
  next: "Вперёд →",
  page: (n: number) => `Страница ${n}`,
  readingTime: (min: number) => `${min} мин чтения`,
},
```

Empty-сообщения **переиспользуем существующие** `empty.feed` и `empty.tag` (не дублируем). Добавляем единственный недостающий:

```ts
empty: {
  feed: "Пока нет постов. Будьте первым!",
  drafts: "У вас нет черновиков",
  tag:  "Постов по этой теме пока нет",
  userFeed: "У автора пока нет публикаций.",  // ← NEW: для /u/[username] EmptyFeed
},
```

**Добавляем новые блоки `tags` (расширенный) и `profile`:**

```ts
tags: {
  indexTitle: "Все темы",
  indexEmpty: "Темы ещё не созданы.",
  postCount: (n: number) => `${n} постов`,
},
profile: {
  registeredSince: (monthYear: string) => `с ${monthYear}`,
  postsCount: (n: number) => `${n} постов`,
},
```

Если в репозитории используется любая i18n-обёртка — следуй её паттерну. Если просто литералы (как сейчас) — добавь как выше.

**Когда будешь использовать в компонентах:** PostCard reading-time → `content.feed.readingTime(min)`. Paginator → `content.feed.prev/next/page(n)`. EmptyFeed на `/` → `content.empty.feed`. EmptyFeed на `/t/[slug]` → `content.empty.tag`. EmptyFeed на `/u/[username]` → `content.empty.userFeed`. /tags заголовок → `content.tags.indexTitle`. UserStatsRow → `content.profile.postsCount` + `content.profile.registeredSince`.

- [ ] **Step 1.3: Smoke-проверка типов + тестов**

```bash
pnpm tsc --noEmit
pnpm test
```

Ожидание: TS-чисто; все ранее проходившие тесты по-прежнему зелёные.

- [ ] **Step 1.4: Коммит**

```bash
git add src/lib/site-config.ts theme/content.ts
git commit -m "feat(plan-5a): siteConfig + content keys for feed/tags/profile copy"
```

---

## Task 2: Layout primitives — `<RightSidebar>`, `<BottomNav>`, `<LeftNav>` **(TDD на LeftNav)**

**Files:**
- Create: `src/components/layout/RightSidebar.tsx`
- Create: `src/components/layout/BottomNav.tsx`
- Create: `src/components/layout/LeftNav.tsx`
- Create: `tests/feed/left-nav.test.tsx`

LeftNav — единственный layout-компонент с нетривиальной логикой (active-state по `pathname`, fallback ссылок при null `username`). Остальные — stateless.

- [ ] **Step 2.1: `RightSidebar.tsx`**

```tsx
// src/components/layout/RightSidebar.tsx
// Пустой <aside> слот. В plan-5a виджетов нет (см. spec §2 решение #3).
// TODO(post-plan-5b): топ-тэги / случайный пост / about-блок.

export function RightSidebar({ className }: { className?: string }) {
  return (
    <aside className={className} aria-label="Дополнительно">
      {/* Намеренно пусто. Структуру layout зафиксировали в plan-5a, наполнение — отдельная итерация. */}
    </aside>
  );
}
```

- [ ] **Step 2.2: `BottomNav.tsx`**

```tsx
// src/components/layout/BottomNav.tsx
import Link from "next/link";
import { Home, Hash, FileText, User } from "lucide-react";
import { content } from "@theme/content";

interface BottomNavProps {
  profileHref: string;  // вычисляется в FeedShell на основе session
  className?: string;
}

export function BottomNav({ profileHref, className = "" }: BottomNavProps) {
  // Тач-таргет 48×48px (§15.7 mobile DoD).
  return (
    <nav
      aria-label="Главная навигация"
      className={`flex justify-around items-stretch border-t border-border bg-background ${className}`}
    >
      <Link href="/" className="flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground">
        <Home className="h-5 w-5 mb-1" />
        {content.nav.home}
      </Link>
      <Link href="/tags" className="flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground">
        <Hash className="h-5 w-5 mb-1" />
        {content.nav.tags}
      </Link>
      <Link href="/drafts" className="flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground">
        <FileText className="h-5 w-5 mb-1" />
        {content.nav.drafts}
      </Link>
      <Link href={profileHref} className="flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground">
        <User className="h-5 w-5 mb-1" />
        {content.nav.profile}
      </Link>
    </nav>
  );
}
```

Active-state на BottomNav не подсвечиваем — `pathname` пробрасывать через client-границу для одного визуального бонуса избыточно. LeftNav (desktop) подсвечивает — там это полезнее.

- [ ] **Step 2.3: (TDD RED) Тест `LeftNav.tsx`**

LeftNav читает `auth()` (server-side) и `usePathname()`... постой — `usePathname()` это client-only hook. Чтобы держать RSC, прокинем `pathname` пропом из layout, а layout получит его через `headers().get("x-pathname")` — но это тоже клиент. Чище: LeftNav — Client Component (`"use client"`), читает `usePathname()` сам, а `profileHref` принимает пропом (его вычисляет server-context в layout).

```tsx
// tests/feed/left-nav.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeftNav } from "@/components/layout/LeftNav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

describe("LeftNav", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReset();
  });

  it("отмечает «Лента» active на /", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<LeftNav profileHref="/u/alice" />);
    const feedLink = screen.getByRole("link", { name: /Лента/ });
    expect(feedLink.getAttribute("aria-current")).toBe("page");
  });

  it("отмечает «Темы» active на /tags и /t/[slug]", () => {
    vi.mocked(usePathname).mockReturnValue("/t/design");
    render(<LeftNav profileHref="/u/alice" />);
    const tagsLink = screen.getByRole("link", { name: /Темы/ });
    expect(tagsLink.getAttribute("aria-current")).toBe("page");
  });

  it("отмечает «Драфты» active на /drafts", () => {
    vi.mocked(usePathname).mockReturnValue("/drafts");
    render(<LeftNav profileHref="/u/alice" />);
    const draftsLink = screen.getByRole("link", { name: /Драфты/ });
    expect(draftsLink.getAttribute("aria-current")).toBe("page");
  });

  it("при profileHref=/welcome ведёт на welcome (юзер без username)", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<LeftNav profileHref="/welcome" />);
    const profileLink = screen.getByRole("link", { name: /Профиль/ });
    expect(profileLink.getAttribute("href")).toBe("/welcome");
  });
});
```

- [ ] **Step 2.4: Прогнать тест — FAIL**

```bash
pnpm test tests/feed/left-nav.test.tsx
```

Ожидание: 4× FAIL «Cannot find module '@/components/layout/LeftNav'».

- [ ] **Step 2.5: (TDD GREEN) Реализовать `LeftNav.tsx`**

```tsx
// src/components/layout/LeftNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Hash, FileText, User } from "lucide-react";
import { content } from "@theme/content";

interface LeftNavProps {
  profileHref: string;
  className?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
}

export function LeftNav({ profileHref, className = "" }: LeftNavProps) {
  const pathname = usePathname() ?? "/";

  const items: NavItem[] = [
    { href: "/",       label: content.nav.home,    icon: Home,     isActive: p => p === "/" },
    { href: "/tags",   label: content.nav.tags,    icon: Hash,     isActive: p => p === "/tags" || p.startsWith("/t/") },
    { href: "/drafts", label: content.nav.drafts,  icon: FileText, isActive: p => p.startsWith("/drafts") },
    { href: profileHref, label: content.nav.profile, icon: User,   isActive: p => p.startsWith("/u/") || p === "/welcome" },
  ];

  return (
    <nav className={`flex flex-col gap-1 text-sm ${className}`} aria-label="Главная навигация">
      {items.map(item => {
        const active = item.isActive(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-md transition-colors " +
              (active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
            }
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2.6: Прогнать тест — PASS**

```bash
pnpm test tests/feed/left-nav.test.tsx
```

Ожидание: 4/4 зелёные.

- [ ] **Step 2.7: Коммит**

```bash
git add src/components/layout/RightSidebar.tsx src/components/layout/BottomNav.tsx src/components/layout/LeftNav.tsx tests/feed/left-nav.test.tsx
git commit -m "feat(plan-5a): layout primitives — LeftNav (with TDD active-state) + BottomNav + RightSidebar"
```

---

## Task 3: `<FeedShell>` + route groups `(public)/(feed)/layout.tsx` + `(app)/(feed)/layout.tsx`

**Files:**
- Create: `src/components/layout/FeedShell.tsx`
- Create: `src/app/(public)/(feed)/layout.tsx`
- Create: `src/app/(app)/(feed)/layout.tsx`

`FeedShell` — серверный компонент: читает session через `auth()`, считает `profileHref` (логика повторяется в обоих route group'ах — внутри shell, не в layout). Передаёт `profileHref` в `LeftNav` (client) и `BottomNav` (server).

- [ ] **Step 3.1: `FeedShell.tsx`**

```tsx
// src/components/layout/FeedShell.tsx
import { auth } from "@/lib/auth";
import { LeftNav } from "./LeftNav";
import { BottomNav } from "./BottomNav";
import { RightSidebar } from "./RightSidebar";

export async function FeedShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Профиль для авторизованных c username → /u/{username}.
  // Для авторизованных без username (не прошёл /welcome) → /welcome (forced onboarding).
  // Для анонимов → /login (после логина юзер попадёт на welcome или сразу на свой профиль).
  const profileHref =
    session?.user?.username
      ? `/u/${session.user.username}`
      : session?.user
        ? "/welcome"
        : "/login";

  return (
    <div className="mx-auto max-w-[1200px] w-full">
      {/* 3-col на desktop, single-col на mobile. Промежуток pb-20 на mobile — иначе BottomNav перекроет последнюю карточку. */}
      <div className="lg:grid lg:grid-cols-[200px_1fr_280px] lg:gap-8 lg:px-6">
        <LeftNav
          profileHref={profileHref}
          className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:py-6"
        />
        <main className="px-4 lg:px-0 py-6 pb-24 lg:pb-12 min-w-0">
          {children}
        </main>
        <RightSidebar className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:py-6" />
      </div>

      {/* mobile/tablet — sticky bottom-bar, всегда виден */}
      <BottomNav
        profileHref={profileHref}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30"
      />
    </div>
  );
}
```

`min-w-0` на `<main>` критично — без него grid-track распирается по самой широкой ячейке (длинный URL в excerpt → горизонтальный scroll).

- [ ] **Step 3.2: `(public)/(feed)/layout.tsx`**

Создай папку `src/app/(public)/(feed)/` и в ней `layout.tsx`:

```tsx
// src/app/(public)/(feed)/layout.tsx
import { FeedShell } from "@/components/layout/FeedShell";

export default function PublicFeedLayout({ children }: { children: React.ReactNode }) {
  return <FeedShell>{children}</FeedShell>;
}
```

- [ ] **Step 3.3: `(app)/(feed)/layout.tsx`**

Создай папку `src/app/(app)/(feed)/` и в ней `layout.tsx`:

```tsx
// src/app/(app)/(feed)/layout.tsx
import { FeedShell } from "@/components/layout/FeedShell";

export default function AppFeedLayout({ children }: { children: React.ReactNode }) {
  return <FeedShell>{children}</FeedShell>;
}
```

(Идентичен публичному — auth-проверки живут на page-level, см. spec §3 «Auth boundary».)

- [ ] **Step 3.4: Smoke-проверка типов**

```bash
pnpm tsc --noEmit
```

Ожидание: чисто.

- [ ] **Step 3.5: Коммит**

```bash
git add src/components/layout/FeedShell.tsx 'src/app/(public)/(feed)/layout.tsx' 'src/app/(app)/(feed)/layout.tsx'
git commit -m "feat(plan-5a): FeedShell + (public)/(feed) and (app)/(feed) route groups"
```

---

## Task 4: `readingTime` + `<TagBadge>` **(TDD)**

**Files:**
- Create: `src/components/feed/readingTime.ts`
- Create: `src/components/tags/TagBadge.tsx`
- Create: `tests/feed/reading-time.test.ts`

- [ ] **Step 4.1: (TDD RED) `tests/feed/reading-time.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readingTimeMinutes } from "@/components/feed/readingTime";

describe("readingTimeMinutes", () => {
  it("пустая строка → 1 (минимум)", () => {
    expect(readingTimeMinutes("")).toBe(1);
  });

  it("одно слово → 1", () => {
    expect(readingTimeMinutes("Привет")).toBe(1);
  });

  it("200 слов ≈ 1 минута (читаем 200 wpm)", () => {
    const text = Array.from({ length: 200 }, () => "слово").join(" ");
    expect(readingTimeMinutes(text)).toBe(1);
  });

  it("1000 слов → 5 минут", () => {
    const text = Array.from({ length: 1000 }, () => "слово").join(" ");
    expect(readingTimeMinutes(text)).toBe(5);
  });
});
```

- [ ] **Step 4.2: Прогнать — FAIL**

```bash
pnpm test tests/feed/reading-time.test.ts
```

Ожидание: 4× FAIL.

- [ ] **Step 4.3: (TDD GREEN) Реализовать `readingTime.ts`**

```ts
// src/components/feed/readingTime.ts
// Оценка времени чтения по word-count. 200 wpm — среднее для русскоязычной
// non-fiction (Medium использует 265 wpm для англ, ниже для русского). Минимум — 1 мин,
// чтобы не показывать «0 мин чтения» для коротких заметок.

const WORDS_PER_MINUTE = 200;

export function readingTimeMinutes(plainText: string): number {
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
```

- [ ] **Step 4.4: Прогнать — PASS**

```bash
pnpm test tests/feed/reading-time.test.ts
```

Ожидание: 4/4 зелёные.

- [ ] **Step 4.5: `<TagBadge>` (без TDD — просто `<Link>`)**

```tsx
// src/components/tags/TagBadge.tsx
import Link from "next/link";

interface TagBadgeProps {
  slug: string;
  name: string;
  className?: string;
}

export function TagBadge({ slug, name, className = "" }: TagBadgeProps) {
  return (
    <Link
      href={`/t/${slug}`}
      onClick={(e) => e.stopPropagation()}
      className={
        "inline-flex items-center px-2 py-0.5 text-xs rounded-full " +
        "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors " +
        className
      }
    >
      #{name}
    </Link>
  );
}
```

`onClick={stopPropagation}` — TagBadge живёт внутри PostCard, который сам обёрнут в `<Link>` (Task 5). Без `stopPropagation` клик по тэгу уйдёт обоим Link'ам, и React-router отработает только outer (последний `<Link>`-родитель). Обычный `event.stopPropagation()` корректно перенаправляет.

- [ ] **Step 4.6: Smoke-проверка типов**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4.7: Коммит**

```bash
git add src/components/feed/readingTime.ts src/components/tags/TagBadge.tsx tests/feed/reading-time.test.ts
git commit -m "feat(plan-5a): readingTime util (TDD) + TagBadge link"
```

---

## Task 5: `<PostCard>` **(TDD)**

**Files:**
- Create: `src/components/feed/PostCard.tsx`
- Create: `tests/feed/post-card.test.tsx`

`PostCard` — vertical full-width: cover 16:9 → tags → title → excerpt → meta (author + date + reading-time). Cover опционален. Tags опциональны.

- [ ] **Step 5.1: (TDD RED) `tests/feed/post-card.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "@/components/feed/PostCard";

const baseProps = {
  post: {
    id: "p1",
    slug: "opyt-raboty",
    title: "Опыт работы",
    excerpt: "Краткое описание поста",
    coverUrl: "https://example.test/cover.webp",
    pubAt: new Date("2026-06-15T10:00:00Z"),
    readingMinutes: 3,
  },
  author: {
    id: "u1",
    username: "alice",
    name: "Alice",
    image: "https://example.test/alice.webp",
  },
  tags: [
    { id: "t1", slug: "experience", name: "Опыт" },
    { id: "t2", slug: "lifehack",   name: "Лайфхаки" },
  ],
};

describe("PostCard", () => {
  it("рендерит заголовок, excerpt и автора", () => {
    render(<PostCard {...baseProps} />);
    expect(screen.getByText("Опыт работы")).toBeInTheDocument();
    expect(screen.getByText("Краткое описание поста")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("ведёт на /p/[slug] при клике в карточку", () => {
    render(<PostCard {...baseProps} />);
    const cardLink = screen.getByRole("link", { name: /Опыт работы/ });
    expect(cardLink.getAttribute("href")).toBe("/p/opyt-raboty");
  });

  it("без обложки не рендерит <img>", () => {
    const noCover = { ...baseProps, post: { ...baseProps.post, coverUrl: null } };
    render(<PostCard {...noCover} />);
    expect(screen.queryByRole("img", { name: /cover/i })).toBeNull();
  });

  it("без тэгов не рендерит TagBadge'ы", () => {
    const noTags = { ...baseProps, tags: [] };
    render(<PostCard {...noTags} />);
    expect(screen.queryByText("#Опыт")).toBeNull();
  });
});
```

- [ ] **Step 5.2: Прогнать — FAIL**

```bash
pnpm test tests/feed/post-card.test.tsx
```

Ожидание: 4× FAIL.

- [ ] **Step 5.3: (TDD GREEN) Реализовать `PostCard.tsx`**

```tsx
// src/components/feed/PostCard.tsx
import Link from "next/link";
import Image from "next/image";
import { content } from "@theme/content";
import { TagBadge } from "@/components/tags/TagBadge";

export interface PostCardData {
  post: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    coverUrl: string | null;
    pubAt: Date | null;
    readingMinutes: number;
  };
  author: {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
  };
  tags: { id: string; slug: string; name: string }[];
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export function PostCard({ post, author, tags }: PostCardData) {
  const href = `/p/${post.slug}`;
  const authorName = author.name ?? author.username ?? "Аноним";
  const dateLabel = post.pubAt ? dateFmt.format(post.pubAt) : "";

  return (
    <article className="rounded-lg border border-border bg-card overflow-hidden hover:border-foreground/20 transition-colors">
      <Link href={href} aria-label={post.title} className="block">
        {post.coverUrl && (
          <div className="relative aspect-[16/9] w-full bg-muted">
            <Image
              src={post.coverUrl}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 640px"
              className="object-cover"
            />
          </div>
        )}
        <div className="p-4 lg:p-5">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(t => (
                <TagBadge key={t.id} slug={t.slug} name={t.name} />
              ))}
            </div>
          )}
          <h3 className="text-lg font-semibold leading-tight mb-2 line-clamp-2">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {post.excerpt}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {author.image && (
              <Image
                src={author.image}
                alt=""
                width={20}
                height={20}
                className="rounded-full"
              />
            )}
            <span>{authorName}</span>
            {dateLabel && <><span>·</span><span>{dateLabel}</span></>}
            <span>·</span>
            <span>{content.feed.readingTime(post.readingMinutes)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
```

- [ ] **Step 5.4: Настроить `next.config.ts` для image host'ов**

Открой `next.config.ts` (или `.js`). Если `images.remotePatterns` уже расширен в plan-03 (Yandex storage public-base) — оставь как есть. Иначе добавь:

```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "**" }, // permissive для V1; restrict — в plan-06
  ],
},
```

(`example.test` в тестах не ходит в network — Next 15 testing mode мокит `next/image`. Если по факту не мокит — добавь `<Image>`-stub в `vitest.config.ts`.)

- [ ] **Step 5.5: Прогнать тесты — PASS**

```bash
pnpm test tests/feed/post-card.test.tsx
```

Ожидание: 4/4. Если тест «без обложки» падает на сборке next/image — добавь в `tests/setup.ts` (наш setup-файл, см. `vitest.config.ts` → `setupFiles`):

```ts
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));
```

- [ ] **Step 5.6: Коммит**

```bash
git add src/components/feed/PostCard.tsx tests/feed/post-card.test.tsx next.config.ts
git commit -m "feat(plan-5a): PostCard (vertical layout, TDD on render/click/no-cover/no-tags)"
```

---

## Task 6: `<Paginator>` + `<PostList>` + `<EmptyFeed>` **(TDD Paginator)**

**Files:**
- Create: `src/components/feed/Paginator.tsx`
- Create: `src/components/feed/PostList.tsx`
- Create: `src/components/feed/EmptyFeed.tsx`
- Create: `tests/feed/paginator.test.tsx`

- [ ] **Step 6.1: (TDD RED) `tests/feed/paginator.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Paginator } from "@/components/feed/Paginator";

describe("Paginator", () => {
  it("на первой странице кнопка «Назад» disabled (отсутствует)", () => {
    render(<Paginator basePath="/" currentPage={1} totalPages={5} />);
    expect(screen.queryByRole("link", { name: /Назад/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Вперёд/ })).toBeInTheDocument();
  });

  it("на средней странице видны обе кнопки", () => {
    render(<Paginator basePath="/" currentPage={3} totalPages={5} />);
    expect(screen.getByRole("link", { name: /Назад/ })).toHaveAttribute("href", "/?page=2");
    expect(screen.getByRole("link", { name: /Вперёд/ })).toHaveAttribute("href", "/?page=4");
  });

  it("на последней странице кнопка «Вперёд» disabled (отсутствует)", () => {
    render(<Paginator basePath="/" currentPage={5} totalPages={5} />);
    expect(screen.getByRole("link", { name: /Назад/ })).toHaveAttribute("href", "/?page=4");
    expect(screen.queryByRole("link", { name: /Вперёд/ })).toBeNull();
  });

  it("при totalPages=1 ничего не рендерит", () => {
    const { container } = render(<Paginator basePath="/" currentPage={1} totalPages={1} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 6.2: Прогнать — FAIL**

```bash
pnpm test tests/feed/paginator.test.tsx
```

- [ ] **Step 6.3: (TDD GREEN) `Paginator.tsx`**

```tsx
// src/components/feed/Paginator.tsx
import Link from "next/link";
import { content } from "@theme/content";

interface PaginatorProps {
  basePath: string;       // "/", "/t/design", "/u/alice"
  currentPage: number;    // 1-indexed
  totalPages: number;
}

function pageUrl(basePath: string, page: number): string {
  // Page=1 — без query, чтобы канонический URL не дублировался "/" vs "/?page=1".
  if (page === 1) return basePath;
  const sep = basePath.includes("?") ? "&" : "?";
  return `${basePath}${sep}page=${page}`;
}

export function Paginator({ basePath, currentPage, totalPages }: PaginatorProps) {
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Пагинация"
      className="flex items-center justify-between mt-8 pt-6 border-t border-border"
    >
      <div>
        {hasPrev && (
          <Link
            href={pageUrl(basePath, currentPage - 1)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {content.feed.prev}
          </Link>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {content.feed.page(currentPage)} / {totalPages}
      </div>
      <div>
        {hasNext && (
          <Link
            href={pageUrl(basePath, currentPage + 1)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {content.feed.next}
          </Link>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 6.4: Прогнать — PASS**

```bash
pnpm test tests/feed/paginator.test.tsx
```

Ожидание: 4/4 зелёные.

- [ ] **Step 6.5: `<EmptyFeed>` + `<PostList>`**

```tsx
// src/components/feed/EmptyFeed.tsx
interface EmptyFeedProps {
  message: string;
}

export function EmptyFeed({ message }: EmptyFeedProps) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}
```

```tsx
// src/components/feed/PostList.tsx
import { PostCard, type PostCardData } from "./PostCard";
import { Paginator } from "./Paginator";
import { EmptyFeed } from "./EmptyFeed";

interface PostListProps {
  items: PostCardData[];
  basePath: string;
  currentPage: number;
  totalPages: number;
  emptyMessage: string;
}

export function PostList({ items, basePath, currentPage, totalPages, emptyMessage }: PostListProps) {
  if (items.length === 0) {
    return <EmptyFeed message={emptyMessage} />;
  }
  return (
    <>
      <div className="flex flex-col gap-4">
        {items.map(item => (
          <PostCard key={item.post.id} {...item} />
        ))}
      </div>
      <Paginator basePath={basePath} currentPage={currentPage} totalPages={totalPages} />
    </>
  );
}
```

- [ ] **Step 6.6: Smoke-проверка типов**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 6.7: Коммит**

```bash
git add src/components/feed/Paginator.tsx src/components/feed/EmptyFeed.tsx src/components/feed/PostList.tsx tests/feed/paginator.test.tsx
git commit -m "feat(plan-5a): Paginator (TDD) + EmptyFeed + PostList"
```

---

## Task 7: Серверные запросы `src/server/feed.ts` **(TDD integration на реальной БД)**

**Files:**
- Create: `src/server/feed.ts`
- Create: `tests/feed/feed-queries.test.ts`

Все запросы в одном файле — мало кода, общие импорты, проще читать. Это **не** `"use server"` — никаких мутаций, только селекты для RSC.

- [ ] **Step 7.1: `src/server/feed.ts`**

```ts
// src/server/feed.ts
// Read-only-запросы для discovery-страниц (RSC). Никаких мутаций — поэтому НЕ "use server".
// "Server Components only" — нет client-импортов; вызывать из page.tsx и generateMetadata.

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { posts, postTags, tags, users } from "@db/schema";
import { extractPlainText } from "@/components/editor/extractPlainText";
import { readingTimeMinutes } from "@/components/feed/readingTime";
import type { PostCardData } from "@/components/feed/PostCard";

export const FEED_PAGE_SIZE = 20;

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  pubAt: Date | null;
  content: unknown;
  authorId: string;
  authorUsername: string | null;
  authorName: string | null;
  authorImage: string | null;
}

interface TagPair {
  postId: string;
  tag: { id: string; slug: string; name: string };
}

async function hydrateCards(rows: PostRow[]): Promise<PostCardData[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map(r => r.id);

  // Один доп. запрос на тэги. На V1 (≤20 постов × ≤5 тэгов) — десятки строк.
  // Альтернатива LATERAL/array_agg — over-engineering для V1.
  const rawTags = await getDb()
    .select({
      postId: postTags.postId,
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
    })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(inArray(postTags.postId, postIds));

  const tagsByPost = new Map<string, TagPair["tag"][]>();
  for (const t of rawTags) {
    const arr = tagsByPost.get(t.postId) ?? [];
    arr.push({ id: t.id, slug: t.slug, name: t.name });
    tagsByPost.set(t.postId, arr);
  }

  return rows.map(r => {
    const plain = extractPlainText(r.content);
    return {
      post: {
        id: r.id,
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        coverUrl: r.coverUrl,
        pubAt: r.pubAt,
        readingMinutes: readingTimeMinutes(plain),
      },
      author: {
        id: r.authorId,
        username: r.authorUsername,
        name: r.authorName,
        image: r.authorImage,
      },
      tags: tagsByPost.get(r.id) ?? [],
    };
  });
}

const PUBLISHED_PUBLIC = and(eq(posts.status, "published"), isNull(posts.deletedAt));

// ─── /  главная лента ──────────────────────────────────────────────────────

export async function getFeedPage(page: number): Promise<{
  items: PostCardData[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}> {
  const db = getDb();
  const safePage = Math.max(1, Math.floor(page));

  const rows = await db
    .select({
      id: posts.id, slug: posts.slug, title: posts.title,
      excerpt: posts.excerpt, coverUrl: posts.coverUrl, pubAt: posts.pubAt,
      content: posts.content,
      authorId: posts.authorId,
      authorUsername: users.username, authorName: users.name, authorImage: users.image,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(PUBLISHED_PUBLIC)
    .orderBy(desc(posts.pubAt))
    .limit(FEED_PAGE_SIZE)
    .offset((safePage - 1) * FEED_PAGE_SIZE);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(PUBLISHED_PUBLIC);

  const totalPages = Math.max(1, Math.ceil(count / FEED_PAGE_SIZE));
  const items = await hydrateCards(rows);
  return { items, currentPage: safePage, totalPages, totalCount: count };
}

// ─── /t/[slug]  лента тэга ────────────────────────────────────────────────

export async function getTagBySlug(slug: string) {
  const [t] = await getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return t ?? null;
}

export async function getTagFeedPage(tagId: string, page: number) {
  const db = getDb();
  const safePage = Math.max(1, Math.floor(page));

  const rows = await db
    .select({
      id: posts.id, slug: posts.slug, title: posts.title,
      excerpt: posts.excerpt, coverUrl: posts.coverUrl, pubAt: posts.pubAt,
      content: posts.content,
      authorId: posts.authorId,
      authorUsername: users.username, authorName: users.name, authorImage: users.image,
    })
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(postTags.tagId, tagId), PUBLISHED_PUBLIC))
    .orderBy(desc(posts.pubAt))
    .limit(FEED_PAGE_SIZE)
    .offset((safePage - 1) * FEED_PAGE_SIZE);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .where(and(eq(postTags.tagId, tagId), PUBLISHED_PUBLIC));

  const totalPages = Math.max(1, Math.ceil(count / FEED_PAGE_SIZE));
  const items = await hydrateCards(rows);
  return { items, currentPage: safePage, totalPages, totalCount: count };
}

// ─── /tags  индекс ────────────────────────────────────────────────────────

export async function getTagsIndex() {
  const db = getDb();
  return db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      postCount: sql<number>`count(${posts.id})::int`,
    })
    .from(tags)
    .leftJoin(postTags, eq(postTags.tagId, tags.id))
    .leftJoin(posts, and(eq(posts.id, postTags.postId), PUBLISHED_PUBLIC))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${posts.id})`), tags.name);
}

// ─── /u/[username]  профиль ──────────────────────────────────────────────

export async function getUserByUsername(username: string) {
  const [u] = await getDb()
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return u ?? null;
}

export async function getUserProfile(userId: string) {
  const db = getDb();

  const [{ count: postsCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), PUBLISHED_PUBLIC));

  const topTags = await db
    .select({
      slug: tags.slug,
      name: tags.name,
      count: sql<number>`count(*)::int`,
    })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(and(eq(posts.authorId, userId), PUBLISHED_PUBLIC))
    .groupBy(tags.id, tags.slug, tags.name)
    .orderBy(desc(sql`count(*)`))
    .limit(3);

  return { postsCount, topTags };
}

export async function getUserFeedPage(userId: string, page: number) {
  const db = getDb();
  const safePage = Math.max(1, Math.floor(page));

  const rows = await db
    .select({
      id: posts.id, slug: posts.slug, title: posts.title,
      excerpt: posts.excerpt, coverUrl: posts.coverUrl, pubAt: posts.pubAt,
      content: posts.content,
      authorId: posts.authorId,
      authorUsername: users.username, authorName: users.name, authorImage: users.image,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.authorId, userId), PUBLISHED_PUBLIC))
    .orderBy(desc(posts.pubAt))
    .limit(FEED_PAGE_SIZE)
    .offset((safePage - 1) * FEED_PAGE_SIZE);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), PUBLISHED_PUBLIC));

  const totalPages = Math.max(1, Math.ceil(count / FEED_PAGE_SIZE));
  const items = await hydrateCards(rows);
  return { items, currentPage: safePage, totalPages, totalCount: count };
}
```

- [ ] **Step 7.2: (TDD GREEN — query тесты) `tests/feed/feed-queries.test.ts`**

Реальная БД (как `tests/posts/schema.test.ts` в plan-04). Сидим один тест-пост, проверяем структуру ответа.

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db";
import { posts, postTags, users } from "@db/schema";
import { newId } from "@/lib/auth/id";
import {
  getFeedPage, getTagBySlug, getTagFeedPage, getTagsIndex,
  getUserByUsername, getUserProfile, getUserFeedPage, FEED_PAGE_SIZE,
} from "@/server/feed";

const db = getDb();
const TEST_USER_ID = "01J0FEED0000000000000USER01";
const TEST_USERNAME = "feedtester";
const TEST_POST_ID = "01J0FEED0000000000000POST01";

beforeAll(async () => {
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: `feed-test-${Date.now()}@example.test`,
    username: TEST_USERNAME,
    name: "Feed Tester",
  }).onConflictDoNothing();

  await db.insert(posts).values({
    id: TEST_POST_ID,
    authorId: TEST_USER_ID,
    slug: `feed-test-${TEST_POST_ID}`,
    title: "Feed Test Post",
    excerpt: "Test excerpt",
    content: { blocks: [{ type: "paragraph", data: { text: "hello world" } }] },
    status: "published",
    pubAt: new Date(),
  });

  // Привяжем seed-тэг experience (из миграции 0002).
  await db.insert(postTags).values({
    postId: TEST_POST_ID,
    tagId: "01J0SEED000000000000TAGEXP",
  }).onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(posts).where(eq(posts.id, TEST_POST_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
  await getPool().end();
});

describe("getFeedPage", () => {
  it("первая страница содержит наш тестовый пост", async () => {
    const { items, currentPage, totalPages } = await getFeedPage(1);
    expect(currentPage).toBe(1);
    expect(totalPages).toBeGreaterThanOrEqual(1);
    expect(items.some(c => c.post.id === TEST_POST_ID)).toBe(true);
  });

  it("hydrate включает тэги для PostCard", async () => {
    const { items } = await getFeedPage(1);
    const card = items.find(c => c.post.id === TEST_POST_ID);
    expect(card?.tags.map(t => t.slug)).toContain("experience");
  });

  it("страница за пределами totalPages даёт пустой items", async () => {
    const { items } = await getFeedPage(999);
    expect(items).toHaveLength(0);
  });

  it("PAGE_SIZE = 20", () => {
    expect(FEED_PAGE_SIZE).toBe(20);
  });
});

describe("getTagBySlug + getTagFeedPage", () => {
  it("seed-тэг experience найден", async () => {
    const tag = await getTagBySlug("experience");
    expect(tag).not.toBeNull();
    expect(tag?.name).toBe("Опыт");
  });

  it("несуществующий тэг → null", async () => {
    expect(await getTagBySlug("nonexistent")).toBeNull();
  });

  it("getTagFeedPage возвращает наш пост по seed-тэгу", async () => {
    const tag = await getTagBySlug("experience");
    const { items } = await getTagFeedPage(tag!.id, 1);
    expect(items.some(c => c.post.id === TEST_POST_ID)).toBe(true);
  });
});

describe("getTagsIndex", () => {
  it("содержит все 6 seed-тэгов", async () => {
    const rows = await getTagsIndex();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.map(r => r.slug)).toEqual(
      expect.arrayContaining(["experience", "lifehack", "news", "opinion", "question", "review"]),
    );
  });

  it("отсортирован по count DESC", async () => {
    const rows = await getTagsIndex();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].postCount).toBeGreaterThanOrEqual(rows[i].postCount);
    }
  });
});

describe("getUserByUsername + getUserProfile + getUserFeedPage", () => {
  it("username case-insensitive: '${TEST_USERNAME.toUpperCase()}' резолвится", async () => {
    const u = await getUserByUsername(TEST_USERNAME.toUpperCase());
    expect(u?.id).toBe(TEST_USER_ID);
  });

  it("несуществующий username → null", async () => {
    expect(await getUserByUsername("noone")).toBeNull();
  });

  it("getUserProfile считает postsCount ≥1 (наш тест-пост)", async () => {
    const profile = await getUserProfile(TEST_USER_ID);
    expect(profile.postsCount).toBeGreaterThanOrEqual(1);
  });

  it("getUserProfile топ-тэги содержат experience", async () => {
    const profile = await getUserProfile(TEST_USER_ID);
    expect(profile.topTags.map(t => t.slug)).toContain("experience");
  });

  it("getUserFeedPage возвращает только посты этого автора", async () => {
    const { items } = await getUserFeedPage(TEST_USER_ID, 1);
    items.forEach(c => expect(c.author.id).toBe(TEST_USER_ID));
  });
});
```

- [ ] **Step 7.3: Прогнать — PASS**

```bash
pnpm test tests/feed/feed-queries.test.ts
```

Ожидание: все 12+ кейсов зелёные. Если падает на «getDb is not a function» — проверь, что test-DB поднят (`docker compose ps`).

- [ ] **Step 7.4: Прогнать весь test-suite**

```bash
pnpm test
```

Ожидание: все ранее проходившие тесты + новые feed-тесты — зелёные.

- [ ] **Step 7.5: Коммит**

```bash
git add src/server/feed.ts tests/feed/feed-queries.test.ts
git commit -m "feat(plan-5a): server/feed.ts — getFeedPage / getTagFeedPage / getTagsIndex / getUserProfile (integration tests)"
```

---

## Task 8: Главная лента `/` — `(public)/(feed)/page.tsx` + удаление старой `src/app/page.tsx`

**Files:**
- Create: `src/app/(public)/(feed)/page.tsx`
- Delete: `src/app/page.tsx`

Старая `src/app/page.tsx` была auth-gated stub'ом (см. spec §3). Удаляем атомарно с созданием новой.

- [ ] **Step 8.1: Создать `(public)/(feed)/page.tsx`**

```tsx
// src/app/(public)/(feed)/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content } from "@theme/content";
import { seo } from "@theme/seo";
import { PostList } from "@/components/feed/PostList";
import { getFeedPage } from "@/server/feed";

export const metadata: Metadata = {
  title: seo.defaultTitle,
  description: seo.defaultDescription,
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const { items, currentPage, totalPages } = await getFeedPage(page);

  // ?page=N за пределами реального диапазона (kроме page=1 на пустой ленте) → 404
  if (page > totalPages && items.length === 0 && totalPages > 0) {
    notFound();
  }

  return (
    <PostList
      items={items}
      basePath="/"
      currentPage={currentPage}
      totalPages={totalPages}
      emptyMessage={content.empty.feed}
    />
  );
}
```

Note про 404-условие: если `totalPages = 1` и `items = []` (вообще нет постов) — это валидная пустая лента, показываем `EmptyFeed`, НЕ 404. 404 только если юзер явно навигировал на `?page=N`, где N > реального максимума при наличии постов.

- [ ] **Step 8.2: Удалить старый `src/app/page.tsx`**

```bash
rm src/app/page.tsx
```

- [ ] **Step 8.3: Запустить dev и smoke-проверить**

```bash
pnpm dev
```

В браузере: `http://localhost:3000/` → должна показаться главная лента в 3-col layout. Если постов нет — увидеть EmptyFeed. Header (top bar) остаётся (root layout не трогали).

Остановить dev: `Ctrl+C`.

- [ ] **Step 8.4: Smoke-проверка build**

```bash
pnpm build
```

Ожидание: build зелёный. Если падает «Page conflicts in route '/'» — значит старый `src/app/page.tsx` не удалился (репозиторий «помнит» через `.next`). `rm -rf .next` и повтори.

- [ ] **Step 8.5: Коммит**

```bash
git add 'src/app/(public)/(feed)/page.tsx'
git rm src/app/page.tsx
git commit -m "feat(plan-5a): public main feed at (public)/(feed)/page.tsx (replaces auth-gated stub)"
```

---

## Task 9: Tag-страница `/t/[slug]` — `(public)/(feed)/t/[slug]/page.tsx`

**Files:**
- Create: `src/app/(public)/(feed)/t/[slug]/page.tsx`

- [ ] **Step 9.1: Реализовать страницу**

```tsx
// src/app/(public)/(feed)/t/[slug]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content } from "@theme/content";
import { siteConfig } from "@/lib/site-config";
import { PostList } from "@/components/feed/PostList";
import { getTagBySlug, getTagFeedPage } from "@/server/feed";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return {};
  return {
    title: `#${tag.name} — ${siteConfig.name}`,
    description: tag.description ?? `Посты по тэгу ${tag.name}`,
  };
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const { items, currentPage, totalPages, totalCount } = await getTagFeedPage(tag.id, page);

  if (page > totalPages && items.length === 0 && totalPages > 0) {
    notFound();
  }

  return (
    <>
      <header className="mb-6 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold mb-1">#{tag.name}</h1>
        <p className="text-sm text-muted-foreground">{content.tags.postCount(totalCount)}</p>
      </header>
      <PostList
        items={items}
        basePath={`/t/${tag.slug}`}
        currentPage={currentPage}
        totalPages={totalPages}
        emptyMessage={content.empty.tag}
      />
    </>
  );
}
```

Description тэга **не** показываем в header'е (spec §2 решение #7: минимум до admin-UI).

- [ ] **Step 9.2: Smoke в dev**

```bash
pnpm dev
```

Открой `http://localhost:3000/t/experience` (любой seed-тэг из миграции 0002). Должна показаться страница: `#Опыт` + count + лента постов или EmptyFeed.

Проверь `http://localhost:3000/t/nonexistent` → 404 (стандартный Next 404).

- [ ] **Step 9.3: Коммит**

```bash
git add 'src/app/(public)/(feed)/t'
git commit -m "feat(plan-5a): /t/[slug] tag feed page with generateMetadata"
```

---

## Task 10: Tags index `/tags` — `(public)/(feed)/tags/page.tsx` + `<TagListRow>`

**Files:**
- Create: `src/components/tags/TagListRow.tsx`
- Create: `src/app/(public)/(feed)/tags/page.tsx`

- [ ] **Step 10.1: `<TagListRow>`**

```tsx
// src/components/tags/TagListRow.tsx
import Link from "next/link";
import { content } from "@theme/content";

interface TagListRowProps {
  slug: string;
  name: string;
  description: string | null;
  postCount: number;
}

export function TagListRow({ slug, name, description, postCount }: TagListRowProps) {
  return (
    <Link
      href={`/t/${slug}`}
      className="flex items-baseline justify-between gap-4 py-3 border-b border-border last:border-b-0 hover:bg-accent/30 -mx-2 px-2 rounded-md transition-colors"
    >
      <div className="min-w-0">
        <h3 className="font-semibold text-base mb-0.5">#{name}</h3>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {content.tags.postCount(postCount)}
      </span>
    </Link>
  );
}
```

- [ ] **Step 10.2: `/tags/page.tsx`**

```tsx
// src/app/(public)/(feed)/tags/page.tsx
import type { Metadata } from "next";
import { content } from "@theme/content";
import { siteConfig } from "@/lib/site-config";
import { TagListRow } from "@/components/tags/TagListRow";
import { getTagsIndex } from "@/server/feed";

export const metadata: Metadata = {
  title: `${content.tags.indexTitle} — ${siteConfig.name}`,
  description: "Список всех тэгов на сайте",
};

export default async function TagsIndexPage() {
  const rows = await getTagsIndex();

  return (
    <>
      <header className="mb-6 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold">{content.tags.indexTitle}</h1>
      </header>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">{content.tags.indexEmpty}</p>
      ) : (
        <div>
          {rows.map(t => (
            <TagListRow
              key={t.id}
              slug={t.slug}
              name={t.name}
              description={t.description}
              postCount={t.postCount}
            />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 10.3: Smoke в dev**

```bash
pnpm dev
```

`http://localhost:3000/tags` → должна показаться list-страница с 6 seed-тэгами, отсортированными по count DESC (большинство с 0 → secondary sort by name ASC).

- [ ] **Step 10.4: Коммит**

```bash
git add src/components/tags/TagListRow.tsx 'src/app/(public)/(feed)/tags'
git commit -m "feat(plan-5a): /tags index with TagListRow"
```

---

## Task 11: Профиль `/u/[username]` — `<UserProfileHeader>` + `<UserStatsRow>` + удаление старой `src/app/u/[username]/page.tsx`

**Files:**
- Create: `src/components/profile/UserStatsRow.tsx`
- Create: `src/components/profile/UserProfileHeader.tsx`
- Create: `src/app/(public)/(feed)/u/[username]/page.tsx`
- Delete: `src/app/u/[username]/page.tsx`

- [ ] **Step 11.1: `<UserStatsRow>`**

```tsx
// src/components/profile/UserStatsRow.tsx
import { content } from "@theme/content";
import { TagBadge } from "@/components/tags/TagBadge";

interface UserStatsRowProps {
  postsCount: number;
  registeredAt: Date;
  topTags: { slug: string; name: string }[];
}

const monthYearFmt = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

export function UserStatsRow({ postsCount, registeredAt, topTags }: UserStatsRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-2">
      <span>{content.profile.postsCount(postsCount)}</span>
      <span>·</span>
      <span>{content.profile.registeredSince(monthYearFmt.format(registeredAt))}</span>
      {topTags.length > 0 && (
        <>
          <span>·</span>
          <div className="flex flex-wrap gap-1">
            {topTags.map(t => (
              <TagBadge key={t.slug} slug={t.slug} name={t.name} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 11.2: `<UserProfileHeader>`**

```tsx
// src/components/profile/UserProfileHeader.tsx
import Image from "next/image";
import { UserStatsRow } from "./UserStatsRow";

interface UserProfileHeaderProps {
  username: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  postsCount: number;
  registeredAt: Date;
  topTags: { slug: string; name: string }[];
}

export function UserProfileHeader(props: UserProfileHeaderProps) {
  const { username, name, image, bio, postsCount, registeredAt, topTags } = props;
  const displayName = name ?? username;

  return (
    <header className="flex items-start gap-4 mb-6 pb-4 border-b border-border">
      {image ? (
        <Image
          src={image}
          alt=""
          width={72}
          height={72}
          className="rounded-full shrink-0"
        />
      ) : (
        <div className="w-[72px] h-[72px] rounded-full bg-muted shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold leading-tight">{displayName}</h1>
        <p className="text-sm text-muted-foreground">@{username}</p>
        {bio && <p className="text-sm mt-2 leading-relaxed">{bio}</p>}
        <UserStatsRow postsCount={postsCount} registeredAt={registeredAt} topTags={topTags} />
      </div>
    </header>
  );
}
```

- [ ] **Step 11.3: `/u/[username]/page.tsx`**

```tsx
// src/app/(public)/(feed)/u/[username]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content } from "@theme/content";
import { siteConfig } from "@/lib/site-config";
import { PostList } from "@/components/feed/PostList";
import { UserProfileHeader } from "@/components/profile/UserProfileHeader";
import {
  getUserByUsername, getUserProfile, getUserFeedPage,
} from "@/server/feed";

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return {};
  return {
    title: `${user.name ?? user.username} — ${siteConfig.name}`,
    description: user.bio ?? `Посты автора @${user.username}`,
  };
}

export default async function UserProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const user = await getUserByUsername(username);
  if (!user || !user.username) notFound();

  const [{ postsCount, topTags }, { items, currentPage, totalPages }] = await Promise.all([
    getUserProfile(user.id),
    getUserFeedPage(user.id, page),
  ]);

  if (page > totalPages && items.length === 0 && totalPages > 0) {
    notFound();
  }

  return (
    <>
      <UserProfileHeader
        username={user.username}
        name={user.name}
        image={user.image}
        bio={user.bio}
        postsCount={postsCount}
        registeredAt={user.createdAt}
        topTags={topTags}
      />
      <PostList
        items={items}
        basePath={`/u/${user.username}`}
        currentPage={currentPage}
        totalPages={totalPages}
        emptyMessage={content.empty.userFeed}
      />
    </>
  );
}
```

- [ ] **Step 11.4: Удалить старый `src/app/u/[username]/page.tsx`**

```bash
rm -r src/app/u
```

(Удаляем всю папку `src/app/u/`; новые маршруты живут в `(public)/(feed)/u/`.)

- [ ] **Step 11.5: Smoke в dev**

```bash
pnpm dev
```

`http://localhost:3000/u/<your-username>` (любой пользователь с username из БД) → должен показаться профиль с шапкой + лентой постов. Если у юзера нет публикаций — EmptyFeed.

Проверь `http://localhost:3000/u/nonexistent` → 404.

- [ ] **Step 11.6: Build smoke**

```bash
pnpm build
```

Ожидание: build зелёный. Никаких «route conflicts» (старый `/u/[username]` удалён).

- [ ] **Step 11.7: Коммит**

```bash
git add 'src/app/(public)/(feed)/u' src/components/profile/UserProfileHeader.tsx src/components/profile/UserStatsRow.tsx
git rm -r src/app/u
git commit -m "feat(plan-5a): public user profile /u/[username] with stats + feed (replaces auth-gated stub)"
```

---

## Task 12: Перенос `/drafts` в `(app)/(feed)/drafts/`

**Files:**
- Move: `src/app/(app)/drafts/` → `src/app/(app)/(feed)/drafts/`

Drafts должны жить под shell'ом (LeftNav + BottomNav рядом). Auth-проверка остаётся inline в `page.tsx`.

- [ ] **Step 12.1: Переместить папку**

```bash
mkdir -p 'src/app/(app)/(feed)'
git mv 'src/app/(app)/drafts' 'src/app/(app)/(feed)/drafts'
```

- [ ] **Step 12.2: Проверить, что внутри `page.tsx` НЕ нужно править**

```bash
head -10 'src/app/(app)/(feed)/drafts/page.tsx'
```

Ожидание: первая строка по-прежнему `import { requireAuthState } from "@/lib/auth/guard";` и `requireAuthState()` вызывается внутри page-функции. Никаких изменений не нужно — `(feed)` layout идемпотентен (просто оборачивает в `<FeedShell>`).

- [ ] **Step 12.3: Smoke в dev**

```bash
pnpm dev
```

Залогинься (если ещё не) → `http://localhost:3000/drafts`. Должен открыться список твоих драфтов внутри 3-col shell'а. LeftNav подсвечивает «Драфты».

Логаут → `/drafts` → редирект на `/login` (как раньше, через `requireAuthState`).

- [ ] **Step 12.4: Build smoke**

```bash
pnpm build
```

Ожидание: build зелёный.

- [ ] **Step 12.5: Коммит**

```bash
git add -A 'src/app/(app)/(feed)'
git commit -m "refactor(plan-5a): move /drafts under (app)/(feed) shell"
```

---

## Task 13: `app/sitemap.ts` **(TDD на shape)**

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `tests/feed/sitemap.test.ts`

`sitemap.ts` отсутствует в репозитории (plan-01 пропустил — см. spec §6.1). Создаём с нуля.

- [ ] **Step 13.1: (TDD RED) Тест sitemap-shape**

```ts
// tests/feed/sitemap.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db";
import { posts, users } from "@db/schema";
import sitemap from "@/app/sitemap";

const db = getDb();
const TEST_USER_ID = "01J0SMAP0000000000000USER01";
const TEST_USERNAME = "smaptester";
const TEST_POST_ID = "01J0SMAP0000000000000POST01";
const TEST_SLUG = `smap-test-${TEST_POST_ID}`;

beforeAll(async () => {
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: `smap-${Date.now()}@example.test`,
    username: TEST_USERNAME,
  }).onConflictDoNothing();
  await db.insert(posts).values({
    id: TEST_POST_ID,
    authorId: TEST_USER_ID,
    slug: TEST_SLUG,
    title: "Sitemap test",
    content: { blocks: [] },
    status: "published",
    pubAt: new Date(),
  });
});

afterAll(async () => {
  await db.delete(posts).where(eq(posts.id, TEST_POST_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
  await getPool().end();
});

describe("sitemap", () => {
  it("содержит корневой URL", async () => {
    const entries = await sitemap();
    const urls = entries.map(e => e.url);
    expect(urls.some(u => u.endsWith("/"))).toBe(true);
  });

  it("содержит /tags", async () => {
    const entries = await sitemap();
    expect(entries.some(e => e.url.endsWith("/tags"))).toBe(true);
  });

  it("содержит /p/<slug> для опубликованного поста", async () => {
    const entries = await sitemap();
    expect(entries.some(e => e.url.endsWith(`/p/${TEST_SLUG}`))).toBe(true);
  });

  it("содержит /u/<username> для юзера с публикациями", async () => {
    const entries = await sitemap();
    expect(entries.some(e => e.url.endsWith(`/u/${TEST_USERNAME}`))).toBe(true);
  });

  it("содержит /t/<slug> для всех seed-тэгов", async () => {
    const entries = await sitemap();
    expect(entries.some(e => e.url.endsWith("/t/experience"))).toBe(true);
    expect(entries.some(e => e.url.endsWith("/t/lifehack"))).toBe(true);
  });
});
```

- [ ] **Step 13.2: Прогнать — FAIL**

```bash
pnpm test tests/feed/sitemap.test.ts
```

Ожидание: «Cannot find module '@/app/sitemap'».

- [ ] **Step 13.3: (TDD GREEN) `src/app/sitemap.ts`**

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { posts, tags, users } from "@db/schema";
import { siteConfig } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const base = siteConfig.url;

  const publishedPosts = await db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(and(eq(posts.status, "published"), isNull(posts.deletedAt)));

  const allTags = await db.select({ slug: tags.slug }).from(tags);

  const usersWithPosts = await db
    .selectDistinct({ username: users.username })
    .from(users)
    .innerJoin(posts, and(
      eq(posts.authorId, users.id),
      eq(posts.status, "published"),
      isNull(posts.deletedAt),
    ))
    .where(isNull(users.bannedAt));

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/tags`, changeFrequency: "weekly", priority: 0.6 },
    ...publishedPosts.map(p => ({
      url: `${base}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...allTags.map(t => ({
      url: `${base}/t/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...usersWithPosts
      .filter((u): u is { username: string } => Boolean(u.username))
      .map(u => ({
        url: `${base}/u/${u.username}`,
        changeFrequency: "weekly" as const,
        priority: 0.4,
      })),
  ];
}
```

- [ ] **Step 13.4: Прогнать — PASS**

```bash
pnpm test tests/feed/sitemap.test.ts
```

Ожидание: 5/5 зелёные.

- [ ] **Step 13.5: Smoke `/sitemap.xml`**

```bash
pnpm dev
# в браузере:
# http://localhost:3000/sitemap.xml
```

Ожидание: валидный XML с URL'ами `/`, `/tags`, `/p/*`, `/t/*`, `/u/*`. Можно «view-source» проверить, что ни одного URL без `http://localhost:3000` префикса.

- [ ] **Step 13.6: Прогнать весь test-suite + build**

```bash
pnpm test && pnpm build
```

Ожидание: всё зелёное.

- [ ] **Step 13.7: Коммит**

```bash
git add src/app/sitemap.ts tests/feed/sitemap.test.ts
git commit -m "feat(plan-5a): app/sitemap.ts with TDD shape test (plan-01 omission)"
```

---

## Task 14: Mobile DoD + Lighthouse + README + Retro

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-20-plan-05a-discovery.md` (заполнить retro в конце)

- [ ] **Step 14.1: Обновить README**

В `README.md` найди секцию «Маршруты» (если есть после plan-04) или раздел «Что внутри». Добавь блок:

```markdown
### Discovery (plan-5a)

Публичные read-only страницы:

- `/`             — главная лента (20 постов на страницу, `?page=N`)
- `/t/[slug]`     — посты по тэгу
- `/tags`         — индекс всех тэгов
- `/u/[username]` — профиль автора (bio + stats + посты)

Все обёрнуты в 3-col shell (`<FeedShell>`): левый nav + центральная лента + пустой правый sidebar.
На mobile (`<lg`) — bottom-bar навигация, sidebar скрыт.

`/drafts` (auth-only) переехал в тот же shell — `(app)/(feed)/drafts`.

Sitemap: `app/sitemap.ts` собирает `/`, `/tags`, `/p/*`, `/t/*`, `/u/*` из БД.
```

- [ ] **Step 14.2: Manual e2e DoD (анонимный браузер)**

В incognito-окне (без сессии):

1. `http://localhost:3000/` → видна главная лента, PostCard'ы. На каждой: cover (если есть), tags, title, excerpt, author + date + reading-time.
2. Клик в title PostCard → `/p/<slug>` (plan-04 страница) — открывается полная статья.
3. Клик в TagBadge внутри PostCard → `/t/<slug>` — открывается лента тэга.
4. Клик в LeftNav → `Темы` → `/tags` — индекс тэгов с count.
5. Клик в TagListRow → `/t/<slug>` — лента тэга.
6. На странице `/p/<slug>` — клик в имя автора (если PostBody/PostHero plan-04 делает это `<Link>`) или вручную `/u/<username>` — открывается профиль.
7. `/u/<known-username>` → header + посты. У юзера без постов — EmptyFeed «у автора пока нет публикаций».
8. `/u/nonexistent` → 404.
9. `/t/nonexistent` → 404.
10. `/?page=999` → 404 (если в ленте есть посты). Если ленты нет — пустая лента без 404 (это валидно).
11. LeftNav `Драфты` → редирект на `/login` (анон) → после логина → `/drafts` под shell'ом.
12. `view-source:http://localhost:3000/` → первые 20 заголовков постов видны в HTML (SSR-проверка).
13. `view-source:http://localhost:3000/sitemap.xml` → присутствуют `/`, `/tags`, `/p/*`, `/t/*`, `/u/*`.

- [ ] **Step 14.3: Mobile DoD (§15.11)**

Chrome DevTools → Device Toolbar:

- **iPhone 13** (390×844):
  - `/` → cover full-width, vertical stack под ним, BottomNav фиксирован, sticky.
  - Скролл до конца — последний PostCard полностью читается (BottomNav не перекрывает).
  - LeftNav и RightSidebar **не видны** (`hidden lg:block`).
  - Тач-таргеты BottomNav ≥48px (DevTools → Inspect, `getBoundingClientRect().height`).
- **Pixel 7** (412×915): тот же чеклист.
- **iPad mini** (744×1133): тот же (это всё ещё mobile-layout — `<1024px`).
- **Desktop ≥1024px**: 3-col layout полностью видим; LeftNav + RightSidebar sticky.

**Lighthouse mobile** (DevTools → Lighthouse, mobile preset):

```
URL                | Performance | A11y | Best Practices | SEO
/                  | ≥90         | ≥90  | ≥90            | ≥90
/t/experience      | ≥90         | ≥90  | ≥90            | ≥90
/u/<your-username> | ≥90         | ≥90  | ≥90            | ≥90
```

Если что-то ниже 90 — записать в retro как расхождение, не блокировать DoD (mitigation в plan-06 SEO).

- [ ] **Step 14.4: SEO-проверка**

В DevTools → Elements → `<head>` для каждой страницы:

- `/` → `<title>Skelet — сообщество</title>` (или `seo.defaultTitle`); `<meta name="description">` есть.
- `/t/experience` → `<title>#Опыт — Skelet</title>`; description = `tags.description` или fallback.
- `/u/<username>` → `<title>{name} — Skelet</title>`; description = `bio` или fallback.
- `/tags` → `<title>Все тэги — Skelet</title>`.

- [ ] **Step 14.5: Финальный gate — automated checks**

```bash
pnpm test && pnpm tsc --noEmit && pnpm build
```

Ожидание: всё зелёное. Если что-то сломалось из-за рефакторов Tasks 1–13 (например, путь к `siteConfig`, ломка существующих тестов после смены `environment: jsdom`) — фиксим **здесь**, не оставляем регрессию в retro.

Если `pnpm build` падает на `<Html>` outside of pages/_document с заполненным `.env` — повтори с `NODE_ENV=production pnpm build` (см. plan-04 retro #5: `.env` содержит `NODE_ENV=development`, который ломает prod-build). Это не блокер plan-5a, это техдолг plan-04 — записать в retro.

- [ ] **Step 14.6: Заполнить retro-секцию**

Скролл этого файла вниз — заполни секцию `## Retro (заполнить после выполнения)`:
- Что прошло гладко.
- Расхождения с планом (3–6 пунктов — обычно).
- Что отложено / маркеры на будущее (повтор из §«Сознательно отложено» + новые открытия).
- Готовность к plan-5b (что готово, что использовать оттуда).

- [ ] **Step 14.7: Финальный коммит**

```bash
git add README.md docs/superpowers/plans/2026-06-20-plan-05a-discovery.md
git commit -m "docs(plan-5a): README discovery section + retro skeleton"
```

(После заполнения retro — отдельный коммит `docs(plan-5a): retro — <короткая суть>`.)

---

## Definition of Done — итоговый чеклист (повтор, для удобной галочки)

### Automated
- [ ] `pnpm test` зелёный, ≥20 новых кейсов (reading-time:4, post-card:4, paginator:4, left-nav:4, feed-queries:12+, sitemap:5)
- [ ] `pnpm tsc --noEmit` чисто
- [ ] `pnpm build` зелёный с пустыми R2-env
- [ ] `pnpm build` зелёный с заполненными R2-env (Yandex)
- [ ] Никаких миграций — `drizzle/schema.ts` не менялся
- [ ] Все ранее проходившие тесты по-прежнему зелёные после смены vitest `environment` → `jsdom` (Task 1)

### Manual e2e (анонимный браузер на dev-сервере)
- [ ] 13 пунктов из Task 14 Step 14.2 пройдены

### Mobile DoD (§15.11)
- [ ] Chrome DevTools iPhone 13 / Pixel 7 / iPad mini — все 3 layout'а отыграли
- [ ] Lighthouse mobile ≥90 на `/`, `/t/<seeded-slug>`, `/u/<username>` по 4 метрикам
- [ ] BottomNav тач-таргеты ≥44px (реально 48px по спеке)

### SEO
- [ ] `generateMetadata` на `/`, `/t/[slug]`, `/u/[username]`, `/tags` валидируется в DevTools → `<head>`
- [ ] `/sitemap.xml` содержит `/`, `/tags`, `/p/*`, `/t/*`, `/u/*`
- [ ] `view-source:/` содержит первые 20 заголовков постов (SSR-проверка)

### Документация
- [ ] README обновлён (discovery routes)
- [ ] Retro-секция заполнена

---

## Retro (заполнить после выполнения)

### Что прошло гладко

- TDD-цикл на `readingTime`, `Paginator`, `LeftNav`, `PostCard`, `feed-queries`, `sitemap` —
  ни одного RED-кейса, который пришлось бы переписывать после реализации. План был
  достаточно конкретный, чтобы переход RED→GREEN занимал 1 итерацию.
- `server/feed.ts` — 7 запросов в одном файле без CTE/array_agg действительно
  читаемы, hydrate-helper с `inArray(postIds)` дал десятки строк трафика для V1
  и оставил архитектуру плоской.
- Route groups `(public)/(feed)/` + `(app)/(feed)/` под общим `<FeedShell>` сложились
  как ожидалось: разный auth, один layout, никакой дублирующей разметки.
- Overlay-link-паттерн в `PostCard` снял проблему nested `<a>` без введения
  client-компонентов.

### Расхождения с планом / спекой

1. **`tests/setup.ts` пришлось расширить** — `vi.mock("next/image")` (иначе jsdom-рендер
   `PostCard` падает на валидации `remotePatterns`) и `afterEach(cleanup)` для RTL.
   В плане Task 1 это не предусматривалось — добавилось по факту, когда PostCard-тесты
   начали падать с реальным `.env`.
2. **`tests/storage/upload-route.test.ts:withEnv`** содержал pre-existing баг
   (не удалял существующие `R2_*` перед оверрайдом). Всплыло только в Task 7,
   когда чтобы прогнать feed-queries.test.ts с реальной БД, приходится `source .env`.
   Починили там же — кейс «503 when R2 env not configured» теперь честный.
3. **`@/theme/*` алиас был переименован в `@theme/*`** — изначальное `@`-prefix-mapping
   в vitest конфликтовал с `@/theme` (последний шёл первым по prefix-match).
   Поменяли на отдельный alias, заодно почистили tsconfig — это решение пользователь
   выбрал явно, отказавшись от regex-обходного фикса.
4. **`TagBadge`: убран `onClick={stopPropagation}`** — overlay-pattern в PostCard
   уже изолирует тэги от карточной ссылки через `pointer-events`+`z-index`, а `onClick`
   превращал компонент в client-only и ронял RSC-рендер из `PostList` Server Component'а.
   План в Task 4 описывал stopPropagation, но при overlay он не нужен.
5. **`next.config.ts:remotePatterns`** — пришлось добавить OAuth-аватарные хосты
   (`avatars.yandex.net`, `*.userapi.com`, `*.vk.com`). До plan-5a `next/image` для
   author-аватара нигде не использовался, поэтому проблема не всплывала.
6. **`.env.example`: удалён `NODE_ENV=development`** — он же ломал `pnpm build`
   (Next бандлит dev-вариант `_error.tsx` с `<Html>`, что нелегально в App Router).
   Это техдолг plan-04 (предсказанный в Task 14.5), починили на месте.
7. **`Tasks 8-11`: вместо удаления `src/app/page.tsx` и `src/app/u/[username]/page.tsx`
   через `rm -rf` использовали `git rm`** — план описывает `rm`, но он не обновляет
   индекс, и `pnpm build` после такого падал с PageNotFoundError. С `git rm` сразу чисто.

### Что подтвердилось из плана

- 3-col shell (`200px / 1fr / 280px`) одинаково подходит публичным discovery и
  auth-only `/drafts` — никаких дублей.
- Пагинация через `<Link href="?page=N">` (RSC-friendly) не вынудила нас вводить
  client-state. Канонический URL без `?page=1` — реализован на стороне Paginator.
- `inArray(postIds)` для подтяжки тэгов одним доп. запросом масштабируется до 20×N
  без заметной latency.
- `force-dynamic` на `sitemap.ts` — без него Next пытается prerender'ить во время
  build и фолбэчит на pages-router `_error`.

### Отложено / маркеры на будущее

(Повтор из §«Сознательно отложено» наверху — всё ещё актуально.)

Новые открытия:

- **`next/image` для аватарок** — для 20×20 OAuth-аватаров оптимизация даёт минимум,
  но мы её включили ради консистентности. В фазе 2, если CDN-стоимость на оптимизацию
  пользовательских аватарок вырастет, рассмотреть `<img>` для аватаров ≤32px.
- **Sitemap-split** — пока один файл, см. §«Сознательно отложено».
- **`README.md` секция Discovery** — добавлена; в plan-06 (SEO) обновить под
  IndexNow + canonical URL.

### Готовность к plan-5b (Engagement: Comments + Moderation)

- ✅ **`PostCard` / `PostList` / `Paginator`** — переиспользуемы для списка комментов,
  если потребуется (но скорее всего комменты будут своим списком, без пагинации в V1).
- ✅ **`FeedShell` + route group `(public)/(feed)/`** — `/p/[slug]` уже в нём; для
  комментов под постом ничего не двигать.
- ✅ **`server/feed.ts:hydrateCards`** — паттерн «один JOIN + один `inArray` доп»
  готов к копированию для `comments + authors`.
- ✅ **`extractPlainText`** в server-feed уже используется (для reading-time) — можно
  переиспользовать для preview-комментов.
- ⚠️ **Drizzle schema без таблицы `comments`** — добавлять в plan-5b миграцией 0003.
- ⚠️ **Auth-guard для модерации** — `requireAuthState` пока без `role`-check; нужен
  отдельный хелпер `requireMod` для plan-5b.
