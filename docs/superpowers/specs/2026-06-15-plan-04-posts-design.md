# Plan 4 (Posts + Editor) — спецификация

**Дата:** 2026-06-15
**Состояние:** brainstorm пройден, дизайн утверждён владельцем
**Канон высшего уровня:** `docs/superpowers/specs/2026-06-05-skelet-blog-design.md` §6.1/§6.2 (схема `posts`/`tags`/`post_tags`), §8 (жизненный цикл поста), §15.7/§15.9/§15.11 (mobile UX и DoD), §16 (разбивка фаз)

---

## 1. Цель плана

Закрыть цепочку «писатель пишет пост → читатель видит пост». После plan-04 один залогиненный юзер может: написать пост в Editor.js → опубликовать → расшарить ссылку → посторонний посетитель открывает `/p/<slug>` и читает.

Что входит:

1. Schema: `posts`, `tags`, `post_tags`, FK `uploads.post_id → posts.id` (plan-03 оставил `TODO(plan-04)`).
2. Editor.js (6 блоков: Paragraph, Header, Image, List, Quote, Delimiter) — клиентский монтаж + автосейв.
3. Server-side рендер `content_json → content_html` через собственный `renderBlock.ts` + `sanitize-html`.
4. Страницы: `(public)/p/[slug]`, `(app)/new`, `(app)/edit/[id]`, `(app)/drafts`.
5. Server actions: `saveDraft`, `publishPost`, `republishPost`, `archivePost`, `unarchivePost`, `softDeletePost`.
6. Slug-генератор (RU→latin транслит + collision suffix).
7. Tags: seed-миграция 6 generic тэгов + dropdown-picker + валидация ≥1 на публикации.
8. Линкер uploads → post при `publishPost`.
9. Mobile-полишинг Editor.js (§15.7) + DoD-чеклист §15.11.

**Не делаем:**

- Лента / главная страница, страницы тэгов `/t/[slug]`, комменты, модерация — plan-05.
- Admin-UI для тэгов и постов — plan-05.
- ViewTracker (счётчик просмотров §8.7) — plan-05.
- IndexNow / `revalidatePath` уведомления при публикации — plan-06 (SEO).
- Code / Embed / Checklist Editor.js блоки — отдельный mini-chore при необходимости.
- Восстановление soft-deleted постов через UI — plan-05 admin.
- 301-redirect при смене slug — отложено (slug фиксируется после первой публикации).
- Strict-concurrency (version-колонка + optimistic check) — plan-05+.

---

## 2. Архитектурные решения (зафиксированы в brainstorm)

| # | Решение | Альтернативы рассмотрены | Почему |
|---|---|---|---|
| 1 | **Скоуп** = канон §16 «CRUD автора», без ViewTracker | a) Минимум (только create+publish+view) c) Wide (+ views) | a отбрасывает D из CRUD, расходится с каноном. c смешивает счётчик-инфру с editing. ViewTracker естественно живёт в plan-05 рядом с лентой («популярное»). |
| 2 | Editor.js блоки = **Paragraph, Header, Image, List, Quote, Delimiter** | a) strict-min (4 блока) c) full §8.1 (+ Code, Embed, Checklist) | Code = +syntax highlight зависимость. Embed = whitelist провайдеров + iframe-safety. Checklist = interactive `<input>`. Каждый стоит самостоятельной задачи и не блокирует основной флоу. |
| 3 | Tags = **seed-миграция + dropdown**; admin-UI откладывается в plan-05 | b) author create-on-the-fly d) `theme/tags.ts` + seed-script e) hybrid с moderation f) admin-CRUD в plan-04 | b спам-риск + расходится §6.2. d красивее архитектурно, но требует ещё одной точки конфига; для V1 — over-engineering. e/f раздувают scope в plan-05-территорию. |
| 4 | content_json → content_html = **собственный `renderBlock.ts`** + `sanitize-html` | b) `editorjs-html` c) `editorjs-react-renderer` + renderToStaticMarkup | b слабая поддержка + всё равно sanitize на выходе. c затаскивает react-dom/server ради генерации строки. Для 6 блоков собственная функция ~80 строк — короче, безопаснее, под полным контролем. |
| 5 | Slug **фиксируется после первой публикации** | b) регенерируется на каждом updatePost c) регенерируется + `post_slug_history` 301 | b ломает все расшаренные ссылки на любую правку title. c +1 таблица +1 lookup на каждой странице поста — over-engineering для V1. |
| 6 | Cover = **первый image-блок в `content`**, без отдельного uploader | b) отдельный cover-input c) `coverUrl=null` всегда | b лишний UX-шаг + дублирующий uploader (обычно автор всё равно использует ту же картинку). c режет OG-карточки. |
| 7 | Author CRUD-D = **archive + soft-delete (от автора)** | a) только archive c) hard-delete | **Отклонение от §8.6** (там soft-delete = модератор). Обоснование: UX-ожидание юзера «удалить мой пост» перевешивает; восстановление возможно через plan-05 admin или `db:studio`. |
| 8 | `/p/[slug]` visibility = **канонический матрикс** §8.4/§8.6 | b) `/edit/[id]/preview` route c) strict (всё non-published 404) | b дублирует логику renderBlock. c расходится с §8.6 «archived доступен автору». Inline Editor.js WYSIWYG достаточно как preview. |
| 9 | `/drafts` = **Drafts \| Archived табы**, soft-deleted скрыты | b) +Trash таб с restore c) единый список с filter | b раздувает scope (restore action + auto-purge). c визуальный шум. Восстановление soft-deleted — админ-фича plan-05. |
| 10 | Mobile = §15.7 polish целиком + §15.11 чеклист в DoD | a) только базовый адаптив c) частичный polish | «Писать со смартфона» — базовая ценность блог-платформы. §15.11 даёт independent verification. |

---

## 3. Жизненный цикл поста (машина состояний)

```
              ┌──────────┐  publishPost  ┌────────────┐  archivePost  ┌──────────┐
   saveDraft  │  draft   │──────────────►│ published  │──────────────►│ archived │
   (null id)  │          │               │            │◄──────────────│          │
  ───────────►└────┬─────┘               └─────┬──────┘ unarchivePost └────┬─────┘
                   │                           │                            │
                   │ softDeletePost            │ softDeletePost             │ softDeletePost
                   ▼                           ▼                            ▼
              ┌─────────────────────────────────────────────────────────────┐
              │           deleted_at IS NOT NULL  (терминальное)            │
              └─────────────────────────────────────────────────────────────┘
```

- Из `draft` → только в `published` (через `publishPost`).
- `published` ↔ `archived` (через `archivePost` / `unarchivePost`).
- Любое состояние → `deleted_at IS NOT NULL` (через `softDeletePost`).
- Из `archived` напрямую в `draft` — **не поддерживается** в V1.
- Восстановление из `deleted_at` — только админ (`UPDATE posts SET deleted_at=NULL`) в plan-05.

---

## 4. Схема БД

### 4.1. Изменения `drizzle/schema.ts`

```ts
export const postStatus = pgEnum("post_status", ["draft", "published", "archived"]);

export const posts = pgTable("posts", {
  id: text("id").primaryKey(),                          // ULID, newId()
  authorId: text("author_id").notNull().references(() => users.id),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  excerpt: varchar("excerpt", { length: 280 }),
  content: jsonb("content").notNull(),                  // Editor.js OutputData
  contentHtml: text("content_html"),                    // SSR cache; null до publishPost
  coverUrl: text("cover_url"),                          // первый image-блок из content
  status: postStatus("status").notNull().default("draft"),
  pubAt: timestamp("pub_at"),                           // null до publishPost
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  feedIdx: index("posts_feed_idx").on(t.status, t.pubAt),
  authorIdx: index("posts_author_idx").on(t.authorId),
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
  tagIdx: index("post_tags_tag_idx").on(t.tagId, t.postId),  // для tag-page в plan-05
}));
```

**Изменение `uploads`** (FK, который plan-03 оставил с `TODO(plan-04)`):

```ts
// Было:  postId: text("post_id"),
postId: text("post_id").references(() => posts.id, { onDelete: "set null" }),
```

При hard-delete поста (никто из CRUD plan-04 это не делает, но возможен админ-вмешательством или каскадом из других FK в будущем) → uploads теряют связь, cleanup-script `cleanup:orphans` через 7 дней удалит их.

**Отклонение от §6.2:** колонка `views: integer` намеренно НЕ добавлена в plan-04 — ViewTracker откладывается в plan-05.

### 4.2. Миграция 0002

Drizzle-kit генерит DDL автоматически (`pnpm db:generate`). После генерации **вручную** дописываем seed-INSERT'ы:

```sql
-- (auto-generated DDL: CREATE TYPE post_status, CREATE TABLE posts,
-- CREATE TABLE tags, CREATE TABLE post_tags,
-- ALTER TABLE uploads ADD CONSTRAINT uploads_post_id_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL)

-- Seed tags (plan-04 §8.3 требует ≥1 тэг на публикации).
-- Niche fork: замени эти строки в своей миграции перед первым деплоем.
-- Opaque seed identifiers (не генерятся через newId(), форма Crockford-base32 намеренно не валидируется); стабильны между окружениями by design — внешние ссылки всё равно идут через slug.
INSERT INTO tags (id, slug, name, description) VALUES
  ('01J0SEED000000000000TAGEXP', 'experience',  'Опыт',      'Личный опыт автора'),
  ('01J0SEED000000000000TAGQST', 'question',    'Вопрос',    'Вопросы сообществу'),
  ('01J0SEED000000000000TAGNWS', 'news',        'Новости',   'Новости и анонсы'),
  ('01J0SEED000000000000TAGRVW', 'review',      'Обзор',     'Обзор продукта / события'),
  ('01J0SEED000000000000TAGOPN', 'opinion',     'Мнение',    'Колонка-мнение'),
  ('01J0SEED000000000000TAGLFH', 'lifehack',    'Лайфхаки',  'Практические советы')
ON CONFLICT (slug) DO NOTHING;
```

Фиксированные ULID'ы (`01J0SEED...`) — чтобы между окружениями ID совпадали (упрощает тесты и fixture'ы plan-05).

**Generic post-type тэги** (не niche-specific): подходят любому форку из коробки. Документируется в README.

---

## 5. Server actions (`src/server/posts.ts`)

Все экспорты — `"use server"`. Каждый action начинается с `requireAuthState()` + `requireOwnPost(postId)` (для не-create-функций). 401/403 не утекаются — всегда `notFound()` (404) на чужие посты, чтобы скрывать существование.

### 5.1. `saveDraft(postId: string | null, title: string, content: OutputData)`

Возвращает `{ postId, updatedAt }`.

- Auth: `requireAuthState()`. Если `postId !== null` → `requireOwnPost(postId)`.
- Валидация: `title.length <= 200`. `content` парсится как Editor.js `OutputData` (zod-схема).
- Если `postId === null`:
  - `id = newId()` (ULID из `src/lib/auth/id.ts`)
  - `INSERT INTO posts (id, author_id, slug='draft-'||id, title, content, status='draft', updated_at=now())`
  - Возвращает `{ postId: id, updatedAt: now }`. Клиент replace'ит URL `/new` → `/edit/[id]`.
- Если `postId !== null`:
  - `UPDATE posts SET title=?, content=?, updated_at=now() WHERE id=?`
  - **Статус не меняется**: если пост уже `published`, saveDraft обновляет `content`/`title` прямо в строке, но `content_html` НЕ перерегенится (это работа `republishPost`).
  - Возвращает `{ postId, updatedAt: now }`.

Клиент дёргает с дебаунсом 2 сек (§8.1).

### 5.2. `publishPost(postId: string, tagIds: string[])`

Возвращает `{ slug }`. Клиент делает `router.push(/p/${slug})`.

- Auth + ownership.
- Загрузить пост.
- Валидация:
  - `title.trim().length > 0` иначе `title_empty`
  - В `content.blocks` есть ≥1 блок типа `paragraph`/`header` с непустым `.text` иначе `content_empty`
  - `tagIds.length >= 1` иначе `tags_required`
  - `tagIds` все существуют в `tags` (защита от подмены) иначе `bad_tags`
  - `status === 'draft'` иначе `not_draft`
- Slug-генерация:
  - `base = slugify(title)` — RU→latin, lowercase, `[a-z0-9-]`, collapse `-`, trim, max 80
  - `slug = await uniqueSlug(base, db)` — пробует `base`, `base-2`, `base-3`, …, лимит 50, throws `slug_too_many_collisions`
- Извлечения:
  - `excerpt = extractPlainText(content).slice(0, 200)`
  - `coverUrl = extractCoverUrl(content)` (или `null`)
  - `contentHtml = sanitize(renderBlock(content))`
- Транзакция:
  - `UPDATE posts SET status='published', pub_at=now(), slug=?, excerpt=?, cover_url=?, content_html=?, updated_at=now() WHERE id=?`
  - `INSERT INTO post_tags (post_id, tag_id) VALUES …` (по одному на каждый tagId)
  - **Линкер uploads**: парсим image-блоки из `content`, собираем `publicUrl`-ы, `UPDATE uploads SET post_id=? WHERE public_url IN (?) AND user_id=?` (фильтр по user_id — защита от приписки чужих uploads).

### 5.3. `republishPost(postId: string)`

Редактирование уже опубликованного поста. Никакого `redirect` — клиент остаётся в `/edit/[id]`, тост «обновлено».

- Auth + ownership.
- `status === 'published'` иначе `not_published`.
- Перегенерация:
  - `excerpt = extractPlainText(content).slice(0, 200)`
  - `coverUrl = extractCoverUrl(content)`
  - `contentHtml = sanitize(renderBlock(content))`
- **Slug не меняется** (политика slug-fixity).
- `UPDATE posts SET excerpt=?, cover_url=?, content_html=?, updated_at=now() WHERE id=?`
- Линкер uploads (повторный — для новых картинок, добавленных при редактировании).
- **Тэги в plan-04 не меняются** через `republishPost`. Если автор хочет другие тэги на published-посте — это plan-05+ (через unpublish flow или admin-UI). В UI редактора при `status==='published'` TagPicker рендерится read-only.

### 5.4. `archivePost(postId)`, `unarchivePost(postId)`, `softDeletePost(postId)`

- `archivePost`: `status === 'published'` иначе `cannot_archive` → `UPDATE status='archived', updated_at=now()`.
- `unarchivePost`: `status === 'archived'` иначе `cannot_unarchive` → `UPDATE status='published', updated_at=now()`.
- `softDeletePost`: `deleted_at IS NULL` иначе `already_deleted` → `UPDATE deleted_at=now(), updated_at=now()`. **НЕ** обнуляет `content_html` (отличие от §8.6 admin-delete) — для возможного admin-restore в plan-05.

### 5.5. Helpers

`src/components/editor/extractPlainText.ts`:

```ts
export function extractPlainText(doc: OutputData): string
```

Обходит `blocks`, для `paragraph`/`header` возвращает strip-HTML `.text`, для `list` — join `.items` пробелом, для `quote` — `.text` + ` ` + `.caption`, для `image` — `.caption`. Join всех — пробелом.

`src/components/editor/extractCoverUrl.ts`:

```ts
export function extractCoverUrl(doc: OutputData): string | null
```

Первый `block.type === "image"`, возвращает `block.data.file.url`. `null` если нет image-блоков.

`src/lib/slugify.ts`:

```ts
export function slugify(input: string): string
export async function uniqueSlug(base: string, db: Db): Promise<string>
```

`slugify` — pre-определённая map cyrillic→ascii (зашита в файле, без npm-зависимости на `transliteration` — ~30 строк map'а), lowercase, `[^a-z0-9-]` → `-`, collapse, trim, max 80.

`uniqueSlug` — `base`, `base-2`, …, лимит 50, иначе throw.

`src/lib/auth/guard.ts` (extend):

```ts
export async function requireOwnPost(postId: string): Promise<Post>
```

Получает session, fetch `posts WHERE id=? AND author_id=session.user.id`. `notFound()` (404) если нет — НЕ 403.

---

## 6. Рендеринг content_json → content_html

### 6.1. `src/components/editor/renderBlock.ts`

```ts
export function renderBlock(doc: OutputData): string
// Iterates doc.blocks, dispatches by type, joins outputs.
// Unknown type → "" (graceful degrade, не throw).
```

Per-block функции (~10–15 строк каждая):

- `paragraph` → `<p>${data.text}</p>` (text уже содержит inline-теги от Editor.js: `<b>`, `<i>`, `<a>`, `<code>`, `<mark>`)
- `header` (level 2–4) → `<h${level}>${data.text}</h${level}>`. level 1 → fallback на `<h2>` (h1 = title поста). level ≥5 → fallback `<h4>`.
- `image` → `<figure><img src="${url}" alt="${caption || ""}" width="${width}" height="${height}" loading="lazy"/>${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`
- `list` (style: ordered|unordered) → `<ol>` или `<ul>`, items → `<li>${item}</li>`
- `quote` → `<blockquote>${data.text}${data.caption ? `<cite>${data.caption}</cite>` : ""}</blockquote>`
- `delimiter` → `<hr/>`

`width`/`height` для image — извлекаются из `data.file.width`/`data.file.height` (полю `file` plan-03 кладёт width/height из normalize-pipeline, см. `/api/upload`). Если их нет (defensive) — рендерится без атрибутов (CLS hit, но без падения).

### 6.2. `src/components/editor/sanitize.ts`

```ts
import sanitizeHtml from "sanitize-html";

export function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "h2", "h3", "h4", "strong", "em", "b", "i", "u", "code", "mark",
                  "ul", "ol", "li", "blockquote", "cite", "figure", "figcaption",
                  "img", "hr", "a", "br"],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "width", "height", "loading"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          rel: "nofollow noopener noreferrer",
          target: "_blank",
        },
      }),
    },
  });
}
```

`<script>`, `<iframe>`, `<style>`, `on*=` атрибуты, `javascript:` / `data:` схемы — режутся by default.

---

## 7. UI / страницы

### 7.1. `(public)/p/[slug]/page.tsx`

Server component, без auth-guard (публичная):

```ts
const post = await db.query.posts.findFirst({
  where: eq(posts.slug, params.slug),
  with: { author: true, tags: true },
});
if (!post) notFound();

const session = await auth();
const isOwner = session?.user?.id === post.authorId;

if (post.deletedAt) {
  return new Response(/* 410 page markup */, { status: 410 });
}
if (post.status === "draft") notFound();
if (post.status === "archived" && !isOwner) notFound();

return <PostPage post={post} />;
```

`generateMetadata` использует те же проверки; на 404/410 возвращает `{}`.

Адаптив (§15.9): cover full-width mobile, контент `max-width: 680px mx-auto px-4`. На десктопе cover ограничивается контейнером 1200px.

### 7.2. `(app)/new/page.tsx`

Server component:

```ts
await requireAuthState();
const availableTags = await db.select().from(tags).orderBy(tags.name);
return <EditorClient initialPostId={null} initialTitle="" initialContent={{blocks:[]}} initialTagIds={[]} status="draft" availableTags={availableTags}/>;
```

### 7.3. `(app)/edit/[id]/page.tsx`

```ts
await requireAuthState();
const post = await requireOwnPost(params.id);          // 404 если не свой
const postTagIds = (await db.select({tagId: postTags.tagId}).from(postTags).where(eq(postTags.postId, post.id))).map(r => r.tagId);
const availableTags = await db.select().from(tags).orderBy(tags.name);
return <EditorClient initialPostId={post.id} initialTitle={post.title} initialContent={post.content} initialTagIds={postTagIds} status={post.status} availableTags={availableTags}/>;
```

### 7.4. `(app)/drafts/page.tsx`

Server component, табы через query `?tab=drafts|archived`, дефолт `drafts`:

```ts
const session = await requireAuthState();
const tab = searchParams.tab === "archived" ? "archived" : "drafts";
const targetStatus = tab === "archived" ? "archived" : "draft";
const items = await db.select().from(posts)
  .where(and(
    eq(posts.authorId, session.user.id),
    isNull(posts.deletedAt),
    eq(posts.status, targetStatus),
  ))
  .orderBy(desc(posts.updatedAt));
return <DraftsList items={items} activeTab={tab}/>;
```

Soft-deleted посты скрыты из UI автора. Восстановление — через plan-05 admin / `db:studio`.

---

## 8. React-компоненты

### 8.1. `<EditorClient />` (`src/components/editor/EditorClient.tsx`)

`"use client"`. Props:

```ts
type Props = {
  initialPostId: string | null;
  initialTitle: string;
  initialContent: OutputData;
  initialTagIds: string[];
  status: "draft" | "published" | "archived";
  availableTags: { id: string; slug: string; name: string }[];
};
```

State:

- `useRef<EditorJS>` — инстанс редактора (после dynamic import)
- `useState<string>` — `title` (controlled input)
- `useState<string[]>` — `selectedTagIds` (передаётся в TagPicker)
- `useState<{state: "idle"|"saving"|"saved"|"error"; at?: Date}>` — индикатор save-state
- `useState<string | null>` — `postId` (null до первого save для нового поста)

Lifecycle:

- `useEffect` (mount):
  - Dynamic import `@editorjs/editorjs` + tools (header, image, list, quote, delimiter; paragraph по умолчанию).
  - `new EditorJS({ holder, data: initialContent, tools, onChange: handleEditorChange })`
  - Tools.image = `buildImageToolConfig()` из plan-03 (`src/lib/editor/image-tool.ts`).
- Save flow:
  - `handleEditorChange` или title `onChange` → reset debounce timer 2 сек.
  - По истечении: `setIndicator("saving")` → `saveDraft(postId, title, content)` → `setPostId(returned.postId)` + `setIndicator("saved", at: returned.updatedAt)`.
  - На ошибке: `setIndicator("error")` → авто-retry через 5 сек × 3 → toast «Сохранение приостановлено».
- Publish flow:
  - Кнопка disabled пока `state === "saving"` (force-flush pending save сначала).
  - `publishPost(postId, selectedTagIds)` → `router.push(/p/${slug})`.
  - На ошибке валидации: toast красный с конкретным error-кодом → русское сообщение.
- Republish flow (если `status === 'published'` на mount):
  - Кнопка вместо «Опубликовать» — «Сохранить изменения» → `republishPost(postId)` → toast «Обновлено».
  - TagPicker рендерится read-only (visible chips, но без интерактива).
- Unarchive flow (если `status === 'archived'`):
  - Кнопка «Разархивировать» → `unarchivePost(postId)` → reload page или `router.refresh()`.
- Archive / Delete:
  - Кнопки в action-bar → `<ConfirmDialog>` (shadcn/ui `Dialog`).
  - Delete: typed-confirm («введи "удалить"») — антифрод против случайных кликов.
- Unmount: flush pending save, `editor.destroy()`.

### 8.2. `<TagPicker />` (`src/components/ui/TagPicker.tsx`)

`"use client"`. Props: `availableTags`, `value: string[]`, `onChange: (ids) => void`, `readonly?: boolean`.

Mobile (`md:hidden`) — список чекбоксов в `<details>` (collapsible).

Desktop (`hidden md:flex`) — chips:

```tsx
{availableTags.map(t => (
  <button onClick={() => onChange(toggle(t.id))} disabled={readonly}
    className={cn("rounded-full px-3 py-1 text-sm border",
                  value.includes(t.id) ? "bg-primary text-primary-fg" : "border-border")}>
    {t.name}
  </button>
))}
```

### 8.3. `<StickySaveBar />` (§15.7 #4)

```tsx
<div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background border-t border-border
                 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
                 flex items-center justify-between">
  <SaveIndicator state={...}/>          {/* «Сохранено 14:23» / «Сохранение…» / «Ошибка» */}
  <Button>{primaryAction}</Button>      {/* «Опубликовать» / «Сохранить» / «Разархивировать» */}
</div>
```

### 8.4. `<PostBody />`, `<PostHero />`, `<PostTags />`

Server components.

`PostBody`:

```tsx
<div className="prose prose-neutral dark:prose-invert max-w-[680px] mx-auto px-4"
     dangerouslySetInnerHTML={{ __html: html }}/>
```

`@tailwindcss/typography` добавляется в `package.json` как новый dev-dep (~5 KB plugin).

`PostHero`: cover через `next/image` (`fill`, `sizes`), title `<h1>`, мета (link на `/u/<username>`, дата).

`PostTags` plan-04: `<span>` с именем тэга. `TODO(plan-05): обернуть в <Link href={/t/${slug}}>` — комментарий в коде.

---

## 9. Editor.js mobile-polishинг (§15.7)

| # | §15.7 пункт | Реализация в plan-04 |
|---|---|---|
| 1 | Тулбар-позиция (не слева) | CSS override на `.ce-toolbar` для `@media (max-width: 768px)`: `position: sticky; top: 0; background: var(--background)`. Делаем floating top instead of inline-left. |
| 2 | Slash-меню | Floating `<button>` "+" `position: fixed bottom-20 right-4 md:hidden` (выше StickySaveBar), вызывает `editor.blocks.insert()`. Альтернатива дефолтному «+»-слева. |
| 3 | Image capture | В `buildImageToolConfig()` (plan-03) добавляется property `captureOnMobile: true` — image-tool config поддерживает кастомный `field`. Если нативно нет — patch через `additionalRequestData` + custom file-input компонент с `<input type="file" accept="image/*" capture="environment">`. |
| 4 | Sticky save-bar | Компонент `<StickySaveBar />` (см. §8.3). Mobile-only. |

---

## 10. Обработка ошибок (UX)

| Случай | Реакция |
|---|---|
| `saveDraft` сетевая ошибка | Indicator → «Не удалось сохранить, повторим…» → авто-retry через 5 сек × 3. После — toast «Сохранение приостановлено, проверь интернет», красный border на indicator. |
| `publishPost` валидация (`tags_required` / `title_empty` / `content_empty`) | Toast красный с конкретным сообщением. Публикация не происходит. |
| `publishPost` race (две публикации одновременно) | Server: идемпотентен по `status='draft'` — вторая вернёт `not_draft`. Клиент: debounce + кнопка `disabled` на время выполнения. |
| `requireOwnPost` (попытка зайти на чужой `/edit/[id]`) | `notFound()` (404) — НЕ 403. Скрывает существование. |
| `softDeletePost` случайный клик | typed-confirm `<input>` («введи "удалить"»). |

---

## 11. Тесты (≥35 новых)

### 11.1. Unit

```
tests/posts/
├── slugify.test.ts            (8–10 кейсов)
├── unique-slug.test.ts        (3 кейса)
├── render-block.test.ts       (6 блоков × happy/edge; ~15 кейсов)
├── sanitize.test.ts           (XSS: <script>, <img onerror>, javascript:, <iframe>, data:; ~6 кейсов)
├── extract-cover-url.test.ts  (3 кейса)
├── extract-plain-text.test.ts (3–4 кейса, включая truncation)
```

### 11.2. Integration (мок-БД, мок-auth)

```
tests/posts/server-actions.test.ts
  saveDraft:    null→INSERT, exist→UPDATE, без auth, чужой пост
  publishPost:  happy, без тэгов, пустой content, не draft, линкер uploads, slug collision
  republishPost: happy, не published, slug fix
  archive/unarchive/softDelete: happy + edge (cannot_archive, already_deleted)
```

### 11.3. Route

```
tests/posts/p-slug-route.test.ts — матрица /p/[slug]:
  200: published & deleted_at=null (anon & owner)
  200: archived & deleted_at=null (owner only)
  404: archived (anon)
  404: draft (всё)
  410: deleted_at != null (всё)
  404: bad slug
```

### 11.4. Schema (реальная test-DB)

```
tests/posts/schema.test.ts
  INSERT post пустой title → fails
  slug > 80 → fails
  post_tags несущ. post → fails (FK)
  DELETE post → cascade post_tags
  DELETE post → uploads.post_id SET NULL
  Seed-тэги (6 шт.) присутствуют после миграции
```

Pre-existing `tests/storage/upload-route.test.ts` (plan-03) — проверить не сломались.

Общий целевой `pnpm test` после plan-04: **≥96** (61 plan-03 + ≥35 plan-04).

---

## 12. DoD-чеклист

### 12.1. Automated (must-pass перед мерджем):

- [ ] `pnpm test` зелёное, новых тестов ≥35
- [ ] `pnpm tsc --noEmit` чисто
- [ ] `pnpm build` успешно с заполненным .env (Yandex storage)
- [ ] `pnpm build` успешно с пустыми R2_* env (image-блок становится no-op или показывает баннер «storage не настроен»)
- [ ] `pnpm db:migrate` на чистой БД — миграция 0002 применяется, 6 seed-тэгов в `tags`, FK uploads.post_id создан
- [ ] `pnpm db:migrate` на БД с plan-03 данными — миграция применяется без потерь, существующие uploads остаются orphan

### 12.2. Manual e2e (требует Yandex storage configured):

- [ ] `/new` → набрать title → блоки: Header, Paragraph (bold), List (ordered+unordered), Quote, Image, Delimiter → indicator «Сохранено HH:MM» появляется в 3 сек → перейти `/drafts` → пост в табе «Drafts»
- [ ] `/edit/[id]` → данные подгрузились → выбрать 2 тэга → «Опубликовать» → редирект `/p/<slug>` → страница рендерит cover (первый image), title, дату, link на `/u/<username>`, content, тэги (текст)
- [ ] `view-source:/p/<slug>` → `<meta name="og:image">` = cover-url или дефолт `theme/seo.ts`
- [ ] `pnpm db:studio` → `uploads.post_id` для загруженной = ID поста (линкер сработал)
- [ ] `/p/<slug>` в incognito = 200
- [ ] `/edit/[id]` → поменять title → indicator «сохранено» → `/p/<slug>` — slug **не** поменялся, title новый
- [ ] «Архивировать» → confirm → пост в табе «Archived» → `/p/<slug>` для автора 200, incognito 404
- [ ] «Разархивировать» → пост вернулся в публичку → `/p/<slug>` для всех 200
- [ ] «Удалить» → typed-confirm «удалить» → пост исчез из табов автора → `/p/<slug>` для всех 410
- [ ] `/edit/[чужой-id]` → 404
- [ ] Publish с пустым title → ошибка валидации
- [ ] Publish без тэгов → ошибка «Выберите минимум 1 тэг»

### 12.3. Mobile (§15.11):

- [ ] Chrome DevTools iPhone 13 (390×844): полный цикл «написать пост с нуля». Тулбар не перекрывает контент. Sticky save-bar виден. «Опубликовать» доступна. Slash-меню через явную «+» кнопку.
- [ ] Pixel 7 (412×915): тот же цикл. Image-блок открывает file picker; real-device — камера через `capture`.
- [ ] iPad mini (744×1133): корректные md-breakpoints.
- [ ] Десктоп 1280×800: TagPicker в режиме chips.
- [ ] Тач-таргеты ≥ 44px: «Опубликовать», «Edit», «Archive», «Delete», табы — проверены DevTools.
- [ ] Lighthouse mobile на `/`, `/new`, `/p/<slug>` → Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90.
- [ ] Real device (свой телефон через ngrok/Tailscale): написан пост целиком, без зажимов / зависаний. Видео или галочка.

### 12.4. Документация:

- [ ] README обновлён: упоминание `/drafts`, новые env-варианты если будут.
- [ ] `theme/` — упоминание, что для prod ниши **обязательно** отредактировать seed-INSERT тэгов в миграции 0002.
- [ ] CLAUDE.md / памяти — не требуют изменений.

---

## 13. Известные TODO / leak'и (помечены в коде через `TODO(plan-05+)` / задокументировано в retro)

1. **uploads не отвязываются при diff-редактировании published-поста.** Картинка удалена из контента → `post_id` остаётся приписанным → cleanup-script её не подберёт (он работает только с `post_id IS NULL`). Не критично для V1. Fix в plan-05: diff-линкер + расширение cleanup на «orphan по `key` not in any post's content».
2. **PostTags без ссылок** — текстовые `<span>`. Plan-05 заменит на `<Link href={/t/${slug}}>`.
3. **TagPicker fetch без cache.** Каждый рендер `/new`, `/edit/[id]` SELECT'ит все тэги. 6 строк — копейки. Plan-05 (когда тэгов могут добавлять админы) — переведём на `unstable_cache` с инвалидацией.
4. **`archived → draft` не поддерживается.** Если автор хочет вернуть архив в «писательский» режим — нет UI. Добавим в plan-05 если будет запрос.
5. **TagPicker read-only на published-постах.** Тэги после публикации не редактируются автором. Для plan-05 решим (через unpublish-flow или admin-overide).
6. **Один пост на одного автора одновременно.** Нет lock'а от concurrent edit'ов (две открытые вкладки). Last-write-wins. В plan-04 принимаем; plan-05+ — version-колонка + optimistic check.

---

## 14. Зависимости от других планов

**От plan-03 (готово):**

- `@aws-sdk/client-s3` (для image-блок upload через `/api/upload`)
- `buildImageToolConfig()` (`src/lib/editor/image-tool.ts`)
- `/api/upload` контракт `{ success: 1, file: { url, width, height } }`
- `next/image` `remotePatterns` для Yandex storage host
- `cleanup-orphan-uploads.ts` (для orphan-картинок до публикации)
- `uploads.post_id` колонка (text, nullable) — plan-04 добавляет FK

**От plan-02 (готово):**

- `requireAuthState()` (`src/lib/auth/guard.ts`)
- `users.role` enum (для будущего admin-UI plan-05, в plan-04 не используется)
- DB session strategy (`session.user.id` в server actions)

**От plan-01 (готово):**

- Tailwind base, theme/ структура (для `prose` styling — добавляем `@tailwindcss/typography`)
- shadcn/ui (Button, Dialog для ConfirmDialog)

**Дает plan-05+:**

- Таблицы `posts`, `tags`, `post_tags` (готовы к feed-query и tag-page)
- `content_html` (готов для feed-cards и SSR-prerendering)
- `coverUrl` (готов для feed-thumbnails)
- `post_tags(tag_id, post_id)` индекс (готов к `WHERE tag_id = ?`)

---

## 15. Новые зависимости (`package.json`)

- `@editorjs/editorjs` (core)
- `@editorjs/header`
- `@editorjs/list`
- `@editorjs/quote`
- `@editorjs/delimiter`
- `@editorjs/image` (уже установлен в plan-03 — переиспользуется)
- `sanitize-html`
- `@types/sanitize-html` (dev)
- `@tailwindcss/typography` (dev)

Все — стабильные пакеты с активной поддержкой. Точные версии — на этапе writing-plans (drift-протекция через `pnpm-lock.yaml`).

---

## 16. Риски и mitigation

| Риск | Mitigation |
|---|---|
| Editor.js core breaks между minor-версиями | Pin major через `^` в package.json; интеграционные тесты на mount + save flow |
| sanitize-html слишком агрессивен (режет валидное) | Whitelist sanitize начат с минимума, расширяется по тест-кейсам из реальных постов |
| Slug-коллизия для одинаковых русских title (например 2 поста «Опыт») | `uniqueSlug` с суффиксом `-2`, `-3`; лимит 50 |
| `extractCoverUrl` ломается на неожиданном Editor.js data shape | Zod-схема на `OutputData` в server actions; fallback `coverUrl=null` |
| Mobile real-device проверка показывает баги, не воспроизводимые в DevTools | §15.11 чеклист требует real-device — обнаруживаем рано, до DoD |
| `sanitize-html` имеет CVE в будущем | Регулярные `pnpm audit` в plan-06; pin patch-версии через lock |

---

**Конец спецификации.** Следующий шаг — `superpowers:writing-plans` на эту спеку.
