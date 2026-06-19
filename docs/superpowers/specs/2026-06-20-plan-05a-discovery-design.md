# Plan 5a (Discovery — Feed + Tags + Profile) — спецификация

**Дата:** 2026-06-20
**Состояние:** brainstorm пройден, дизайн утверждён владельцем
**Канон высшего уровня:** `docs/superpowers/specs/2026-06-05-skelet-blog-design.md` §6 (схема users/posts/tags/post_tags), §8.4 (чтение поста), §9 (SEO), §12.1/§12.2 (что НЕ в фазе 1), §15 (адаптив), §16 (разбивка фаз — plan-05 разделён на 5a/5b)

---

## 1. Цель плана

Закрыть цепочку «читатель попадает на сайт → находит интересный пост». После plan-05a посторонний посетитель видит главную ленту с опубликованными постами, может перейти в страницу тэга, посмотреть индекс всех тэгов, открыть профиль автора. Никакого взаимодействия (комменты, реакции) пока нет — это plan-5b.

Что входит:

1. Главная лента `/` — список опубликованных постов (новое → старое, `?page=N`).
2. Tag-страница `/t/[slug]` — посты по конкретному тэгу.
3. Tags-индекс `/tags` — список всех тэгов с count постов.
4. Профиль автора `/u/[username]` — bio + stats + лента постов автора.
5. **3-колоночный layout shell** (left nav + center feed + right sidebar) для feed-like страниц через новый route group `(app)/(feed)/layout.tsx`.
6. Mobile-адаптив: левый nav → bottom-bar, правый sidebar скрыт.
7. SEO: расширение `sitemap.ts` (новые URL'ы), `generateMetadata` на каждой странице.

**Не делаем:**

- Комменты, модерация — plan-5b.
- Лайки, поиск, RSS, похожие посты, treads — фаза 2 (§12.1).
- Подписки на авторов/тэги, персональная лента «Для тебя», notifications — фаза 3 (§12.2).
- Виджеты в правом sidebar — отложено (пустой `<aside>` слот, наполнение — отдельный mini-chore или plan-5b/phase 2).
- Сортировка `popular` — фаза 2 (когда появятся лайки/реакции, считаем popular по ним, не по наивному `views`).
- Cursor-pagination — миграция при росте ниши до >1000 постов, V1 не нужно.
- Tabs `Posts | Tags` на профиле — V1 минимум, добавим при расширении.
- Admin-CRUD для тэгов и `tags.description`-редактирование — plan-5b/5c admin-UI (сейчас description редактируется руками в БД или через сидер).
- Tag-cloud-вёрстка `/tags` — отвергнута на брейне (бедно при <20 тэгах).
- IndexNow/`revalidatePath` — plan-06 (SEO-проход).
- ViewTracker (наивный счётчик §8.7) — отложен в plan-5b/phase 2 (нет UI «популярное» в plan-5a).

---

## 2. Архитектурные решения (зафиксированы в brainstorm)

| # | Решение | Альтернативы рассмотрены | Почему |
|---|---|---|---|
| 1 | **Раскладка** = 3 колонки (left nav + центральная лента + правый sidebar) | a) одна колонка (Medium-style) b) две колонки (правый sidebar) | a беден на навигацию, нужно по тэгам/драфтам гонять через хедер. b близок, но левый nav заметнее и persistent при навигации. 3-col даёт явный shell для discovery-страниц. |
| 2 | **Где живёт shell** = два route group'а — `(public)/(feed)/` для discovery + `(app)/(feed)/` для drafts. Оба рендерят общий `<FeedShell>` компонент | a) shell на всех страницах включая editor; c) shell только на `/`; d) единый `(feed)` group с middleware-auth | Editor (`/new`, `/edit/[id]`) требует full-width 1200px и концентрации — sidebar мешает. Drafts — feed-like инструмент, держим в shell. Public discovery (`/`, `/t`, `/u`, `/tags`) не должны быть auth-gated — поэтому в `(public)`, а не `(app)`. Два route group'а лучше middleware-magic'а: explicit > implicit. |
| 3 | **Правый sidebar = пустой слот** в plan-5a | a) топ-тэги + about b) топ-тэги + случайный пост + about c) «популярное за неделю» по views | На малой нише все «top»-виджеты выглядят бедно/врут. Структуру layout зафиксировать сейчас, наполнение — отдельная итерация после plan-5b когда появятся комменты/реакции и будут реальные сигналы. |
| 4 | **Левый nav** = 4 пункта `Лента / Тэги / Драфты / Профиль` | a) +Подписки b) +Поиск c) +About | Подписки — фаза 3. Поиск — фаза 2. About — статика, не nav-пункт. 4 пункта — минимум, который даёт навигацию по всему discovery. |
| 5 | **Сортировка ленты** = только «новое» (`pub_at DESC`) | a) две вкладки Новое \| Популярное b) популярное по `views` | Popular по наивному `views` накручиваемо рефрешами и бесполезно при <100 view/день. В фазе 2 (лайки) popular считаем по реакциям — тогда вкладку добавим. |
| 6 | **PostCard** = vertical full-width: cover 16:9 + tags + title + excerpt + meta (author + date + reading-time) | b) horizontal compact (cover 120px слева) c) text-first без cover | b плотнее, но excerpt теряется → читатель кликает каждую карточку чтобы понять о чём. c режет визуальный сигнал (обложка — главный hook). a соответствует §15.8 «cover сверху, мета снизу». |
| 7 | **/t/[slug] header** = минимум: `#name` + count постов | b) +description + count авторов c) +топ-авторы тэга | b/c требуют editable description в админ-UI (которого нет) и зрелой ниши. В V1 description в БД для seed-данных подан как есть — но не показываем на странице (поддержание UX-консистенции: не показывать пустые поля). |
| 8 | **/tags index** = list-строки `name + description + count`, сортировка по count DESC | a) grid карточек 2×N c) tag-cloud (размер шрифта пропорционален count) | a красиво на десктопе, но в узкой 640px центральной колонке умещается 1 в ряд → деградирует в list. c бедно на <20 тэгах ниши, конфигурации шрифтов — лишние решения. Description показываем (в отличие от §7) — здесь это первый и единственный контекст про тэг. |
| 9 | **/u/[username]** = avatar + username + bio + stats-строка + лента постов | a) только bio + посты c) +tabs `Posts \| Tags` | Stats-строка (`X постов · с {month year} · топ-тэги #...`) бесплатна (один SQL CTE) и даёт sense «кто этот человек». Tabs Posts/Tags усложняют без полезности при V1-объёмах. Драфты сюда не идут — приватны, живут только в `/drafts` авторизованного юзера. |
| 10 | **Пагинация** = `?page=N`, 20 постов на страницу | b) cursor `?cursor=<id>` c) infinite scroll d) гибрид page+«ещё» | a indexable (каждая страница ловит SEO), share-friendly URL, простая реализация. Минус — `OFFSET` медленный на больших таблицах, но при V1 (<200 постов в нише) перформанс несущественный. Когда упрёмся в >1000 постов → миграция на keyset (не ломая URL'ов). |
| 11 | **Mobile** = левый nav схлопывается в **bottom-bar** sticky, правый sidebar **скрыт** (`display:none`) | a) hamburger-menu для левого b) collapsed sidebar | Bottom-bar = 4 пункта × тач-таргет 48px, всегда виден без жестов. Hamburger тратит клик и скрывает основную навигацию. Правый sidebar в V1 всё равно пустой, на mobile нет места — скрываем. |
| 12 | **Чтение в RSC, без server actions** | b) клиентский paginator + fetch | Пагинация через `<Link href="?page=2">` → следующая страница SSR'ится. Никаких useState/useEffect для основного потока. Server actions используем только в plan-5b для комментов. |

---

## 3. Routes — карта

**Текущее состояние (важно — реальные факты в коде):**

- `src/app/layout.tsx` — единственный layout сейчас. Никаких `(app)/layout.tsx`, `(public)/layout.tsx`, `(auth)/layout.tsx` нет.
- Auth НЕ enforced на уровне route group. Каждая страница сама вызывает `requireAuthState()` (см. `src/app/page.tsx`, `(app)/new/page.tsx`, `(app)/drafts/page.tsx`, `src/app/u/[username]/page.tsx`).
- `src/app/page.tsx` — главная, сейчас **auth-gated** (`requireAuthState()`). В plan-5a становится **публичной** (главная лента — discovery, должна быть видна не залогиненным).
- `src/app/u/[username]/page.tsx` — существует, **auth-gated**, минимальный профиль. В plan-5a переезжает в `(public)/(feed)/u/[username]`, становится публичной, расширяется.
- `src/app/sitemap.ts` **отсутствует** (plan-01 чек-лист пропустил). В plan-5a создаём целиком.

**Целевая структура после plan-5a:**

```
src/app/
├── layout.tsx                            ─ root layout (без изменений)
├── sitemap.ts                            ─ NEW (создаём, не было)
├── page.tsx                              ─ DELETE (переезжает в (public)/(feed)/page.tsx)
├── u/[username]/page.tsx                 ─ DELETE (переезжает в (public)/(feed)/u/[username])
├── (public)/
│   ├── (feed)/                           ─ NEW route group: 3-col shell для публичных discovery-страниц
│   │   ├── layout.tsx                    ─ NEW: оборачивает <FeedShell> вокруг children
│   │   ├── page.tsx                      ─ NEW: главная лента "/" (publicly accessible)
│   │   ├── t/[slug]/page.tsx             ─ NEW: лента по тэгу
│   │   ├── u/[username]/page.tsx         ─ NEW: профиль автора (заменяет старый /u/[username])
│   │   └── tags/page.tsx                 ─ NEW: индекс тэгов
│   └── p/[slug]/page.tsx                 ─ без изменений (plan-04, full-width post-страница)
├── (app)/
│   ├── (feed)/                           ─ NEW route group: 3-col shell для auth-only feed-инструментов
│   │   ├── layout.tsx                    ─ NEW: оборачивает <FeedShell> вокруг children
│   │   └── drafts/                       ─ MOVE из (app)/drafts/
│   │       ├── page.tsx                  ─ requireAuthState() остаётся inline (page-level guard)
│   │       └── ...
│   ├── new/page.tsx                      ─ без изменений (full-width, без FeedShell)
│   └── edit/[id]/page.tsx                ─ без изменений (full-width, без FeedShell)
├── (auth)/                               ─ без изменений
├── api/                                  ─ без изменений
└── dev/                                  ─ без изменений
```

**Почему два `(feed)` route group'а, а не один:**

`(public)/` и `(app)/` — два логических домена (auth не требуется vs требуется). `(feed)` оба раза — это группа, дающая 3-col layout. Чтобы не дублировать layout-код, создаём общий компонент `<FeedShell>` в `src/components/layout/FeedShell.tsx`, и оба `layout.tsx` его рендерят. Альтернатива (singleton `(feed)` группа с auth-проверкой через middleware) — over-engineering под V1.

**Auth boundary:**

- `(public)/(feed)/*` — НЕ требуют auth. Не залогиненный юзер видит главную, тэги, профили.
- `(app)/(feed)/drafts/` — `requireAuthState()` остаётся inline в `drafts/page.tsx`, как сейчас. Перенос в route group не вводит auth-guard через layout — это намеренно, чтобы держать source-of-truth в одном месте.

**Что произойдёт со старыми импортами `/` и `/u/[username]`:**

Удалить старые файлы `src/app/page.tsx` и `src/app/u/[username]/page.tsx` атомарно с созданием новых. Никаких внешних ссылок на эти URL'ы в коде нет (header использует `Link href="/"`, что разрешится в новый `(public)/(feed)/page.tsx`).

---

## 4. Компоненты — карта

```
src/components/
├── feed/
│   ├── PostCard.tsx                ─ NEW: vertical card (cover/tags/title/excerpt/meta)
│   ├── PostList.tsx                ─ NEW: PostCard[] + Paginator
│   ├── Paginator.tsx               ─ NEW: RSC, <Link>'ы ← prev | next →
│   ├── EmptyFeed.tsx               ─ NEW: «постов пока нет, напиши первый»
│   └── readingTime.ts              ─ NEW: util — оценка по word-count
├── tags/
│   ├── TagListRow.tsx              ─ NEW: строка name + desc + count
│   └── TagBadge.tsx                ─ NEW: inline chip <Link href="/t/{slug}">#name</Link>
├── profile/
│   ├── UserProfileHeader.tsx       ─ NEW: avatar + username + bio + stats-row
│   └── UserStatsRow.tsx            ─ NEW: «X постов · с {month year} · #tag1 #tag2 #tag3»
└── layout/
    ├── FeedShell.tsx               ─ NEW: 3-col grid (LeftNav + main + RightSidebar) + BottomNav на mobile.
    │                                  Используется в (public)/(feed)/layout.tsx и (app)/(feed)/layout.tsx.
    ├── LeftNav.tsx                 ─ NEW: 4 ссылки (Лента / Тэги / Драфты / Профиль)
    ├── BottomNav.tsx               ─ NEW: mobile, те же 4 пункта sticky bottom
    └── RightSidebar.tsx            ─ NEW: пустой <aside> с placeholder-комментом
```

`FeedShell` принимает `children` и рендерит 3-col grid вокруг. Левый/правый sidebar — стейтлесс RSC. На «Профиль» в LeftNav: если юзер залогинен → `/u/{session.user.username}`, если нет → `/login`. Сессия читается в `LeftNav` через `auth()` из server-context.

`PostCard` использует `TagBadge` (для tags-строки) и `readingTime` (для meta). Никаких client-компонентов в этом списке — всё RSC.

---

## 5. Серверные запросы (drizzle)

**Импорты для всех запросов ниже (общие):**

```ts
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { posts, postTags, tags, users } from "@db/schema";
import { getDb } from "@/lib/db";
```

### 5.1. Главная `/`

```ts
const PAGE_SIZE = 20;

const rows = await db
  .select({
    id: posts.id, slug: posts.slug, title: posts.title,
    excerpt: posts.excerpt, coverUrl: posts.coverUrl, pubAt: posts.pubAt,
    authorId: posts.authorId,
    authorUsername: users.username, authorName: users.name, authorImage: users.image,
  })
  .from(posts)
  .innerJoin(users, eq(users.id, posts.authorId))
  .where(and(eq(posts.status, "published"), isNull(posts.deletedAt)))
  .orderBy(desc(posts.pubAt))
  .limit(PAGE_SIZE)
  .offset((page - 1) * PAGE_SIZE);

const totalCount = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(posts)
  .where(and(eq(posts.status, "published"), isNull(posts.deletedAt)));
```

Tags для каждой карточки: один доп. запрос `WHERE post_id IN (...)`, мапим в памяти. Альтернатива (LATERAL/array_agg) — over-engineering для V1.

### 5.2. `/t/[slug]`

```ts
const tag = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
if (!tag[0]) notFound();

const rows = await db
  .select({ /* ...как 5.1... */ })
  .from(posts)
  .innerJoin(postTags, eq(postTags.postId, posts.id))
  .innerJoin(users, eq(users.id, posts.authorId))
  .where(and(
    eq(postTags.tagId, tag[0].id),
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
  ))
  .orderBy(desc(posts.pubAt))
  .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
```

### 5.3. `/tags`

```ts
const rows = await db
  .select({
    id: tags.id, slug: tags.slug, name: tags.name, description: tags.description,
    postCount: sql<number>`count(${postTags.postId})::int`,
  })
  .from(tags)
  .leftJoin(postTags, eq(postTags.tagId, tags.id))
  .leftJoin(posts, and(
    eq(posts.id, postTags.postId),
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
  ))
  .groupBy(tags.id)
  .orderBy(desc(sql`count(${postTags.postId})`), tags.name);
```

Тэги с `postCount = 0` показываем — пусть видны как «новые/пустые». Альтернатива (`HAVING count > 0`) скрывает свежее-сидированные тэги.

### 5.4. `/u/[username]`

```ts
const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
if (!user[0]) notFound();

const [postCountRow] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(posts)
  .where(and(
    eq(posts.authorId, user[0].id),
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
  ));

const topTags = await db
  .select({
    slug: tags.slug, name: tags.name,
    count: sql<number>`count(*)::int`,
  })
  .from(postTags)
  .innerJoin(tags, eq(tags.id, postTags.tagId))
  .innerJoin(posts, eq(posts.id, postTags.postId))
  .where(and(
    eq(posts.authorId, user[0].id),
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
  ))
  .groupBy(tags.id)
  .orderBy(desc(sql`count(*)`))
  .limit(3);

// Постов автора — отдельный select как в 5.1, фильтр по authorId.
```

3 запроса вместо одного CTE — проще читать, dev-cost меньше. Перформанс приемлем (`<100ms` суммарно при V1-объёмах).

---

## 6. SEO

### 6.1. `sitemap.ts` — создаём с нуля

Файл `src/app/sitemap.ts` сейчас отсутствует (plan-01 чек-лист пропустил). В plan-5a создаём целиком:

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
    { url: base, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/tags`, changeFrequency: "weekly", priority: 0.6 },
    ...publishedPosts.map(p => ({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...allTags.map(t => ({ url: `${base}/t/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...usersWithPosts.filter(u => u.username).map(u => ({ url: `${base}/u/${u.username}`, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
```

Объём: ≤6 seeded тэгов + ≤N постов + ≤M users-with-posts в нише. На V1 (десятки сущностей) trivially мал. При росте до тысяч постов — split на multiple sitemap'ы через `app/sitemap/[id].ts` (отложено в plan-06).

`siteConfig.url` (BASE) — берём из `src/lib/site-config.ts` (созданном в plan-01). Если поля нет — добавляем минимально (`url: process.env.NEXTAUTH_URL ?? "http://localhost:3000"`).

### 6.2. `generateMetadata` для каждой страницы

```ts
// /t/[slug]
export async function generateMetadata({ params }) {
  const tag = await getTagBySlug((await params).slug);
  if (!tag) return {};
  return {
    title: `#${tag.name} — ${siteConfig.name}`,
    description: tag.description ?? `Посты по тэгу ${tag.name}`,
  };
}

// /u/[username]
export async function generateMetadata({ params }) {
  const user = await getUserByUsername((await params).username);
  if (!user) return {};
  return {
    title: `${user.name ?? user.username} — ${siteConfig.name}`,
    description: user.bio ?? `Посты автора ${user.username}`,
  };
}

// /tags
export const metadata = {
  title: `Все тэги — ${siteConfig.name}`,
  description: "Список всех тэгов на сайте",
};
```

### 6.3. JSON-LD

В plan-5a не добавляем. `Article` JSON-LD на `/p/[slug]` уже в plan-04 (если нет — отдельный mini-chore). `BlogPosting`/`Person` микроразметка для tag/profile-страниц — phase 2 polish.

---

## 7. Mobile (§15)

### 7.1. Брейкпоинты

Используем стандарт §15.1:
- `<768px` → mobile: левый nav → bottom-bar (sticky, 4 пункта, тач-таргет 48px), правый sidebar `hidden`
- `≥768px` → tablet: левый nav `w-48` collapse в icon-only? — нет, прячем целиком, показываем bottom-bar (как mobile)
- `≥1024px` → desktop: полный 3-col

### 7.2. Layout transitions

```tsx
// (app)/(feed)/layout.tsx
<div className="lg:grid lg:grid-cols-[200px_1fr_280px] lg:gap-8 lg:px-6">
  <LeftNav className="hidden lg:block sticky top-16 self-start" />
  <main className="px-4 lg:px-0 pb-20 lg:pb-8">{children}</main>
  <aside className="hidden lg:block sticky top-16 self-start"><RightSidebar /></aside>
  <BottomNav className="lg:hidden fixed bottom-0 left-0 right-0" />
</div>
```

`pb-20` на mobile под bottom-bar — иначе последний PostCard перекрывается.

### 7.3. PostCard на mobile

Тот же `PostCard.tsx` — Tailwind-классы внутри переключают grid → vertical. Cover full-width на mobile, на desktop как есть (центральная колонка ~640px).

### 7.4. Тач-таргеты

- BottomNav: каждая иконка 48×48px, padding 12px
- TagBadge: padding 4px 8px, min-height 28px (нормально для inline)
- PostCard клик-зона — весь `<article>`, обёрнут в `<Link>`

---

## 8. Acceptance criteria (DoD)

**Функциональные:**

1. `/` показывает первые 20 опубликованных постов в виде PostCard'ов, отсортированных `pub_at DESC`.
2. `?page=N` валиден для `N ∈ [1, ceil(total/20)]`, выход за границы → 404.
3. `/t/[slug]` для существующего тэга показывает только посты с этим тэгом; для несуществующего — 404.
4. `/tags` показывает все тэги, включая с `postCount=0`, отсортированы по count DESC, потом по name ASC.
5. `/u/[username]` для существующего юзера показывает header (avatar/name/bio/stats) + ленту его постов; для несуществующего — 404.
6. Статистика на профиле включает: count постов, дата регистрации, top-3 тэга автора.
7. Левый nav (`Лента / Тэги / Драфты / Профиль`) виден на `/`, `/t/*`, `/u/*`, `/tags`, `/drafts`; не виден на `/new`, `/edit/*`.
8. Левый nav persistent: переход между feed-страницами не вызывает визуального мигания, scroll-position у nav сохраняется, DOM-identity nav-элементов сохраняется (`<nav>`-узел не пересоздаётся). NB: layout — RSC, поэтому на сервере он re-render'ится при каждой навигации — это нормально и не нарушает «persistent» в UX-смысле.
9. Правый `<aside>` присутствует в DOM на тех же страницах (пустой, для будущих виджетов).
10. Sitemap содержит `/tags`, `/t/<slug>` × all_tags, `/u/<username>` × users_with_posts.
11. `generateMetadata` на `/`, `/t/[slug]`, `/u/[username]`, `/tags` выдаёт title/description, валидируется в DevTools → Elements → `<head>`.

**Mobile (§15.11):**

12. На viewport 390×844 (iPhone 13) bottom-bar виден, sticky, не перекрывается контентом (последний PostCard полностью читается).
13. Правый sidebar не виден на mobile/tablet (`<1024px`).
14. PostCard на mobile: cover full-width, под ним vertical-stack.
15. Lighthouse mobile ≥ 90 (Performance, Accessibility, Best Practices, SEO) на `/` и `/t/<seeded-slug>`.

**Тесты:**

16. Unit-тесты на `readingTime` (граничные значения: 0 слов, 200 слов, 1000 слов).
17. Component-тесты на `PostCard` (рендер с обложкой / без обложки / без тэгов).
18. Integration: вызов `getFeedPage(1)` возвращает 20 постов; `getFeedPage(2)` — следующие; `getFeedPage(999)` → empty.
19. Все ранее проходившие тесты продолжают проходить.

**SEO/perf:**

20. `view-source:/` содержит первые 20 заголовков (SSR-проверка).
21. `view-source:/sitemap.xml` содержит новые URL'ы.

---

## 9. Что НЕ в plan-5a (explicit out-of-scope)

| Фича | Куда | Почему отложено |
|---|---|---|
| Комментарии (flat) | plan-5b | Отдельная схема `comments`, server actions, UX-полишинг — независимый кусок. |
| Soft-delete / hide / restore постов админом | plan-5b | Связано с moderation-UI комментов. |
| Reports (жалобы) | phase 3 (§12.2) | Очередь, аудит — большая инфра. |
| Лайки, реакции | phase 2 (§12.1) | Нужны для попадания popular-сортировки. |
| Тред-комментарии | phase 2 | `parent_id` есть в схеме, но рендер дерева — отдельно. |
| Поиск по постам | phase 2 | tsvector миграция + UI. |
| RSS feed | phase 2 | `/feed.xml` route. |
| Похожие посты | phase 2 | Jaccard по тэгам. |
| Подписки на тэги/авторов | phase 3 | UI «подписаться», `subscriptions` таблица. |
| Персональная лента «Для тебя» | phase 3 | Зависит от subscriptions. |
| ViewTracker (наивный views) | plan-5b/phase 2 | Бесполезен без UI «популярное» — переносим вместе с popular-сортировкой. |
| Виджеты в правом sidebar | mini-chore после plan-5b | Структура layout уже готова, наполнение — отдельная итерация. |
| Tabs `Posts \| Tags` на профиле | mini-chore при росте контента | V1-минимум — один список постов. |
| Tag cloud для `/tags` | отвергнуто | Бедно на <20 тэгах ниши. |
| Cursor-pagination | при росте до >1000 постов | URL-схема `?page=N` остаётся совместимой. |
| Admin-UI для тэгов | plan-5b/5c | Описание тэга редактируется через сидер/db:studio. |
| IndexNow / `revalidatePath` при публикации | plan-06 (SEO) | Целый SEO-проход отдельно. |
| JSON-LD `BlogPosting`/`Person` | phase 2 polish | Базовая HTML-разметка уже SEO-friendly. |

---

## 10. Связь с plan-04 и предыдущими планами

- **plan-04** дал posts/tags/post_tags + жизненный цикл + страницу `/p/[slug]`. plan-5a их **только читает**, ничего не пишет.
- **plan-03** дал uploads. plan-5a использует только `posts.cover_url` (он заполняется publishPost'ом из plan-04).
- **plan-02** дал session/auth. plan-5a — публичные read-only страницы, `requireAuthState()` остаётся inline в `(app)/(feed)/drafts/page.tsx`, `(app)/new/page.tsx`, `(app)/edit/[id]/page.tsx`.
- **plan-01** дал `siteConfig`, `theme/tokens.css`. plan-5a **создаёт** `src/app/sitemap.ts` (его не было — упущение plan-01), использует токены без изменений. Поле `siteConfig.url` (если отсутствует) добавляем мини-патчем в `lib/site-config.ts`.

Никаких миграций в `drizzle/schema.ts` plan-5a не добавляет. `users.bio` уже в схеме (`drizzle/schema.ts`) с plan-02 — рендер на `/u/[username]` миграции не требует.

---

## 11. Открытые вопросы (если всплывут на executions)

1. `/u/[username]` для юзера без постов — показываем профиль или 404? **Решение по умолчанию:** показываем, секцию постов заменяем на `EmptyFeed` «у автора пока нет публикаций».
2. `/t/[slug]` для тэга без постов — показываем или 404? **Решение по умолчанию:** показываем (`/tags` всё равно его линкует с count=0).
3. SSR queries `/` — кэшировать через `unstable_cache`? **Решение:** в plan-5a не кэшируем (свежесть важнее). Кэш появится в phase 2 когда трафик подойдёт к точке боли.
4. Что если `users.username = null` (юзер не прошёл `/welcome`)? **Решение:** не индексируем в sitemap (см. §6.1 — `usersWithPosts.filter(u => u.username)`), не показываем в линках с других страниц. Существующий `src/app/u/[username]/page.tsx` уже `toLowerCase()`-нормализует username перед lookup — новый `(public)/(feed)/u/[username]/page.tsx` сохраняет тот же контракт.
5. Если `session.user.username = null` (юзер залогинен, но не прошёл `/welcome`) — куда ведёт «Профиль» в LeftNav? **Решение:** на `/welcome` (forced onboarding). Это согласовано с поведением header'а из plan-02.

---
