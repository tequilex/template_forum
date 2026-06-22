# План 5b — Engagement (Write button + Comments + Moderation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For tasks marked **(TDD)** — use `superpowers:test-driven-development`.

**Goal:** Завершить MVP-движок взаимодействия фазы 1: залогиненный юзер видит кнопку «Написать» из любого места UI, оставляет плоские комментарии под публикациями (plain text + автолинки, 2000 символов, пагинация 50, soft delete, 15-минутное окно edit), а админ (`users.role = 'admin'`, выставляется руками через `db:studio`) умеет удалить любой коммент, забанить юзера с причиной, временно скрыть чужой пост или soft-удалить его. Забаненный юзер попадает на `/banned` с причиной + кнопкой logout (вместо текущего жёсткого ban-kill).

**Architecture:** Новая таблица `comments` (post_id, author_id, parent_id nullable под фазу 2, content_text, createdAt/editedAt/deletedAt/deletedBy). Переиспользуем существующие `users.role` (PG enum `user|moderator|admin` из plan-02) и `posts.deletedAt` (из plan-04, теперь для admin-delete тоже). Добавляем `users.banReason` и `posts.hiddenByAdminAt/hiddenByAdminId` для разделения «временно скрыто» vs «удалено». Чтение комментов — RSC через `getCommentsByPost`; мутации — server actions `"use server"` с `revalidatePath`. Rate-limit — in-memory `Map<userId-kind, timestamps[]>` с gap-проверкой и LRU-cap 10k ключей. Текст рендерится сервером через pure `renderCommentText` (URL-regex + trailing-punct trim, React сам экранирует — XSS невозможен). Админ-UI — встроенные dropdown'ы на post page и под комментами, никакой отдельной `/admin` страницы.

**Tech Stack:** Drizzle ORM (новая таблица + 3 колонки в существующих), `nanoid`/`newId()` для id, vitest + `vi.useFakeTimers()` для rate-limit, `@testing-library/react` (уже из plan-5a) для UI-компонентов, `lucide-react` (уже стоит) — иконки `PenSquare`/`MoreHorizontal`/`Trash2`/`Pencil`/`Ban`/`EyeOff`/`Eye`/`RotateCcw`. Никаких новых деплендов.

**Спецификация:** [docs/superpowers/specs/2026-06-21-plan-05b-engagement-design.md](../specs/2026-06-21-plan-05b-engagement-design.md) — целиком (§2 решения, §3 модель данных, §4 actions, §6 UI — особенно важны).
**Канон высшего уровня:** [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](../specs/2026-06-05-skelet-blog-design.md) §6.2 (comments + parent_id заготовка), §7 (auth), §8.6 (soft-delete семантика), §11 (модерация), §12.1/§12.2 (что НЕ в фазе 1), §16 (разбивка фаз).
**Предшественник:** [docs/superpowers/plans/2026-06-20-plan-05a-discovery.md](./2026-06-20-plan-05a-discovery.md) — 3-col shell, LeftNav, BottomNav, UserProfileHeader, /p/[slug] post-page уже на месте.

**Definition of Done (что считается завершением плана 5b):**
- `pnpm test` зелёный — минимум **+19 новых** (schema 2, rate-limit 3, render-text 4, comments-queries 4, comments-actions 3, moderation 3). Все ранее проходившие продолжают проходить. Baseline до plan-5b: `rg "^\s*it\(|^\s*test\(" tests/ src/ --include='*.ts' --include='*.tsx' | wc -l` (≈166 на момент написания плана). Считаем относительно: `baseline + 19`, без фиксированного абсолютного числа.
- `pnpm tsc --noEmit` чисто.
- `pnpm lint` чисто.
- `NODE_ENV=production pnpm build` зелёный (с пустыми R2-env и с заполненными — как было в plan-5a).
- Миграция 0003 применяется на чистой БД (`pnpm db:migrate`) — таблица `comments` создаётся, в `users` появляется `ban_reason`, в `posts` — `hidden_by_admin_at` + `hidden_by_admin_id`.
- Миграция 0003 применяется на БД с plan-04+05a данными — без потерь, существующие посты/юзеры остаются, новые колонки nullable.
- Manual e2e на dev-сервере (см. §DoD ниже).
- `/api/auth/ban-kill` route удалён, `guard.ts` редиректит на `/banned`.
- Retro-секция в конце этого файла заполнена расхождениями с планом.

**Сознательно отложено (с маркерами в коде / эпилоге):**
- **Threading комментов** — фаза 2. `comments.parent_id` колонка существует (канон §6.2 заготовка), но в V1 всегда `NULL`, рендер плоский. Маркер `TODO(phase-2): threading` в `src/server/comments.ts`.
- **Лайки / реакции** — фаза 2 (§12.1).
- **Notifications / email-дайджесты** — фаза 3 (§12.2).
- **`mod_actions` audit-лог** — фаза 2+ (для одного админа избыточно).
- **Markdown / форматирование в комментах** — фаза 2.
- **Картинки в комментах** — фаза 2+ (потребовало бы R2-интеграции).
- **Subscriptions на пост / автора / тэг** — фаза 3.
- **`/admin` страница / отдельная админ-секция** — overkill для одного админа.
- **Reporting (жалобы юзеров на коммент)** — фаза 2+.
- **Causation history `comments.editedReason`** — фаза 2+.
- **`adminDeletePost` hard-cascade** — намеренно soft (spec §2 row 14). Hard-delete с UI-кнопкой «удалить безвозвратно» — фаза 2+.
- **`deletedBy` на постах** — не вводим (spec §2 row 15). Различать admin-delete и author-self-delete не требуется при V1 UX.
- **Persistent rate-limit (Redis/Postgres)** — фаза 2+ при scale-out. Маркер в `src/lib/rate-limit.ts`.
- **Distributed LRU eviction** — простой «дроп самого старого ключа при превышении 10k» (spec §4.4). Маркер там же.

---

## Repo layout, который добавляем/меняем в этом плане

```
skelet/
├── README.md                                       # ← короткая заметка про комменты, write-button, /banned (Task 16)
│
├── drizzle/
│   ├── schema.ts                                   # ← +comments; users +banReason; posts +hiddenByAdminAt/Id
│   └── migrations/0003_<auto>.sql                  # ← generated via pnpm db:generate
│
├── theme/
│   └── content.ts                                  # ← +blocks: comments, moderation, banned, write
│
├── src/
│   ├── lib/
│   │   ├── plural.ts                               # ← NEW (если нет — utility: ru-plural)
│   │   ├── rate-limit.ts                           # ← NEW: in-memory Map с gap + window + LRU cap
│   │   └── auth/
│   │       ├── assert-admin.ts                     # ← NEW: requireAdmin() — redirect('/') если не админ
│   │       └── guard.ts                            # ← MODIFY: requireAuthState → redirect('/banned'); requireOwnPost +isNull(hiddenByAdminAt)
│   │
│   ├── server/
│   │   ├── comments.ts                             # ← NEW: getCommentsByPost / getCommentCount (RSC queries)
│   │   ├── actions/
│   │   │   ├── comments.ts                         # ← NEW "use server": createComment / updateComment / deleteOwnComment
│   │   │   └── moderation.ts                       # ← NEW "use server": admin* для комментов/банов/постов
│   │   └── feed.ts                                 # ← MODIFY: PUBLISHED_PUBLIC += isNull(hiddenByAdminAt)
│   │   #   (нет server/posts.ts modify — /p/[slug] использует приватный loadPost внутри page.tsx)
│   │
│   ├── components/
│   │   ├── comments/
│   │   │   ├── CommentThread.tsx                   # ← NEW: server — список + пагинация + форма/login-prompt
│   │   │   ├── CommentItem.tsx                     # ← NEW: server — карточка коммента (или плашка)
│   │   │   ├── CommentDeletedPlaceholder.tsx       # ← NEW: server — «удалён [автором|админом]»
│   │   │   ├── CommentForm.tsx                     # ← NEW client: textarea + useTransition + counter
│   │   │   ├── EditCommentForm.tsx                 # ← NEW client: инлайн-замена CommentItem
│   │   │   ├── CommentItemActions.tsx              # ← NEW client: dropdown «...» edit/delete/admin
│   │   │   └── render-text.ts                      # ← NEW pure util: text → ReactNode[]
│   │   ├── moderation/
│   │   │   ├── PostAdminMenu.tsx                   # ← NEW client: dropdown «...» на post page (hide/delete/ban)
│   │   │   └── BanUserDialog.tsx                   # ← NEW client: ConfirmDialog + textarea (banReason ≥5)
│   │   ├── post/
│   │   │   └── WriteButton.tsx                     # ← NEW: variant=nav|fab|cta, server (Link под капотом)
│   │   ├── layout/
│   │   │   ├── LeftNav.tsx                         # ← MODIFY: WriteButton variant=nav (для залогиненных, сверху)
│   │   │   └── BottomNav.tsx                       # ← MODIFY: WriteButton variant=fab (для залогиненных)
│   │   └── profile/
│   │       └── UserProfileHeader.tsx               # ← MODIFY: для своего профиля — WriteButton variant=cta
│   │
│   └── app/
│       ├── banned/
│       │   └── page.tsx                            # ← NEW: server — banReason + кнопка logout (form-action)
│       ├── sitemap.ts                              # ← MODIFY: +isNull(hiddenByAdminAt) для published + usersWithPosts
│       ├── (public)/p/[slug]/page.tsx              # ← MODIFY: loadPost+hiddenByAdminAt, deleted→404, <CommentThread/> + <PostAdminMenu/> (admin)
│       ├── (app)/(feed)/drafts/page.tsx            # ← MODIFY: метка «скрыт администратором» на PostCard
│       └── api/
│           └── auth/
│               └── ban-kill/                       # ← DELETE целиком (миграция guard на /banned)
│
└── tests/
    ├── comments/
    │   ├── render-text.test.ts                     # 4 кейса
    │   ├── rate-limit.test.ts                      # 3 кейса (vi.useFakeTimers)
    │   ├── comments-queries.test.ts                # 4 кейса (integration на test-DB)
    │   ├── comments-actions.test.ts                # 3 кейса
    │   └── moderation-actions.test.ts              # 3 кейса
```

---

## Task 1: Миграция — `comments` + `users.banReason` + `posts.hiddenByAdminAt/Id` **(TDD на schema через интеграционный тест)**

**Files:**
- Modify: `drizzle/schema.ts` (+ `comments`, `users.banReason`, `posts.hiddenByAdminAt`, `posts.hiddenByAdminId`)
- Create: `drizzle/migrations/0003_<auto>.sql` (через `pnpm db:generate`)
- Create: `tests/comments/schema.test.ts` (на реальной test-DB)

Спецификация: §3. Важно: **НЕ создаём** `users.role` (уже PG enum из plan-02) и **НЕ создаём** `posts.deletedAt` (уже есть из plan-04).

- [ ] **Step 1.1: Расширить `drizzle/schema.ts`**

Открой `drizzle/schema.ts`.

В **`users`** — добавь ОДНУ колонку перед `bannedAt`:

```ts
banReason: text("ban_reason"),
```

В **`posts`** — добавь ДВЕ колонки перед `deletedAt`:

```ts
hiddenByAdminAt: timestamp("hidden_by_admin_at"),
hiddenByAdminId: text("hidden_by_admin_id").references(() => users.id),
```

После `postTags` (и перед `uploads`, чтобы соседствовала с тематически близкими таблицами) добавь **новую таблицу**:

```ts
// comments — плоские (V1 phase 1). parent_id зарезервирован под threading (канон §6.2,
// spec §2 row 13). В V1 всегда NULL, рендер плоский, миграция в фазу 2 без новых колонок.
// deletedBy: null = живой коммент; иначе userId — определяет плашку:
//   deletedBy === authorId → «удалён автором», иначе → «удалён администратором».
// Edge-case (spec §3.1): админ-автор удаляет СВОЙ коммент → плашка «удалён автором»
// (фактически верно — он действовал как автор). Acceptable для V1.
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),                                // ULID, newId()
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),                                // см. коммент выше; без FK (канон)
  contentText: text("content_text").notNull(),                // plain, 1..2000 символов
  createdAt: timestamp("created_at").defaultNow().notNull(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: text("deleted_by").references(() => users.id),
}, (t) => ({
  postCreatedIdx: index("comments_post_created_idx").on(t.postId, t.createdAt),
  authorCreatedIdx: index("comments_author_created_idx").on(t.authorId, t.createdAt),
}));
```

- [ ] **Step 1.2: Сгенерировать миграцию**

```bash
docker compose up -d db
docker compose ps
```

Ожидание: контейнер `db` health=`healthy`.

```bash
pnpm db:generate
```

Ожидание: `drizzle/migrations/0003_<random_name>.sql` создан. Содержимое — `CREATE TABLE "comments"` (+ 2 `CREATE INDEX`), `ALTER TABLE "users" ADD COLUMN "ban_reason" text`, `ALTER TABLE "posts" ADD COLUMN "hidden_by_admin_at"` и `"hidden_by_admin_id"` + FK. **Никаких DROP, никаких ALTER на `userRole`/`postStatus` ENUM'ы.**

Проверь:
```bash
cat drizzle/migrations/0003_*.sql
```

Если есть `ALTER TYPE "user_role"` или `DROP COLUMN role` — ты случайно тронул существующую колонку, верни schema.ts к шагу 1.1 (для `users.role` НИЧЕГО не меняем — она уже была из plan-02).

- [ ] **Step 1.3: Применить миграцию**

```bash
pnpm db:migrate
```

Ожидание: миграция применяется без ошибок. Открой `db:studio`:

```bash
pnpm db:studio
```

В UI должно появиться: новая таблица `comments` (8 колонок + 2 индекса), у `users` колонка `ban_reason` (text, nullable), у `posts` — `hidden_by_admin_at` (timestamp, nullable) + `hidden_by_admin_id` (text, FK к users).

- [ ] **Step 1.4: (TDD RED) Тест на schema-форму**

```ts
// tests/comments/schema.test.ts
import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";
import { comments, users, posts } from "@db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/auth/id";

describe("schema 0003 — comments + ban_reason + hidden_by_admin", () => {
  it("создаёт коммент с FK к existing post и юзеру", async () => {
    const db = getDb();
    // подготовим юзера и пост (минимальный set; в реальном тесте подмени на хелпер
    // из tests/posts/ если он есть)
    const userId = newId();
    await db.insert(users).values({ id: userId, email: `t-${userId}@x.io` });
    const postId = newId();
    await db.insert(posts).values({
      id: postId, authorId: userId, slug: `t-${postId}`, title: "t",
      content: { blocks: [] }, status: "draft",
    });

    const commentId = newId();
    await db.insert(comments).values({
      id: commentId, postId, authorId: userId, contentText: "привет",
    });

    const rows = await db.select().from(comments).where(eq(comments.id, commentId));
    expect(rows).toHaveLength(1);
    expect(rows[0].contentText).toBe("привет");
    expect(rows[0].parentId).toBeNull();
    expect(rows[0].deletedAt).toBeNull();

    // cleanup
    await db.delete(comments).where(eq(comments.id, commentId));
    await db.delete(posts).where(eq(posts.id, postId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("posts.hiddenByAdminAt и users.banReason доступны на запись", async () => {
    const db = getDb();
    const adminId = newId();
    const authorId = newId();
    await db.insert(users).values({ id: adminId, email: `a-${adminId}@x.io`, banReason: null });
    await db.insert(users).values({ id: authorId, email: `b-${authorId}@x.io`, banReason: "spam" });
    const postId = newId();
    await db.insert(posts).values({
      id: postId, authorId, slug: `t-${postId}`, title: "t", content: { blocks: [] }, status: "published",
      hiddenByAdminAt: new Date(), hiddenByAdminId: adminId,
    });

    const post = (await db.select().from(posts).where(eq(posts.id, postId)))[0];
    expect(post.hiddenByAdminAt).toBeInstanceOf(Date);
    expect(post.hiddenByAdminId).toBe(adminId);

    const banned = (await db.select().from(users).where(eq(users.id, authorId)))[0];
    expect(banned.banReason).toBe("spam");

    await db.delete(posts).where(eq(posts.id, postId));
    await db.delete(users).where(eq(users.id, adminId));
    await db.delete(users).where(eq(users.id, authorId));
  });
});
```

- [ ] **Step 1.5: Прогнать — оба теста PASS**

```bash
pnpm test tests/comments/schema.test.ts
```

Ожидание: 2/2 зелёные. Если падает по соединению с БД — проверь, что docker контейнер `db` поднят и `.env.test` ссылается на тот же `DATABASE_URL`.

- [ ] **Step 1.6: Smoke + коммит**

```bash
pnpm tsc --noEmit
git add drizzle/schema.ts drizzle/migrations/0003_*.sql tests/comments/schema.test.ts
git commit -m "feat(plan-5b): comments table + ban_reason + hidden_by_admin (migration 0003)"
```

---

## Task 2: Theme content keys + ru-plural утилита

**Files:**
- Create (если ещё нет): `src/lib/plural.ts`
- Modify: `theme/content.ts` (+blocks: `comments`, `moderation`, `banned`, `write`)

- [ ] **Step 2.1: `src/lib/plural.ts`** (только если файла нет — проверь сначала)

```bash
ls src/lib/plural.ts 2>/dev/null && echo "EXISTS" || echo "NEW"
```

Если NEW — создай:

```ts
// src/lib/plural.ts
// Русское pluralisation: word(1) | word(2..4) | word(5..)
// Учитывает исключения 11..14 (всегда 5+-форма).
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const n10 = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (n10 > 1 && n10 < 5) return few;
  if (n10 === 1) return one;
  return many;
}
```

- [ ] **Step 2.2: Расширить `theme/content.ts`**

Открой `theme/content.ts`. В конец объекта (рядом с `profile`/`feed`/`tags`) добавь четыре новых блока:

```ts
comments: {
  heading: "Обсуждение",
  countLabel: (n: number) => `${n} ${ruPlural(n, "комментарий", "комментария", "комментариев")}`,
  empty: "Будьте первым, кто оставит комментарий.",
  placeholder: "Ваш комментарий...",
  submit: "Отправить",
  edit: "Изменить",
  save: "Сохранить",
  cancel: "Отмена",
  delete: "Удалить",
  deleteConfirm: "Удалить комментарий?",
  deletedByAuthor: "Комментарий удалён автором",
  deletedByAdmin: "Комментарий удалён администратором",
  bannedAuthor: "автор заблокирован",
  loginToComment: "Войдите, чтобы оставить комментарий",
  editWindowClosed: "Окно редактирования (15 минут) закрыто.",
  rateLimitHit: (sec: number) => `Слишком часто. Попробуйте через ${sec} с.`,
  charCount: (n: number) => `${n} / 2000`,
  reply: "Ответить",
},
moderation: {
  postMenuLabel: "Действия модератора",
  hidePost: "Скрыть пост",
  unhidePost: "Показать пост",
  deletePost: "Удалить пост",
  deletePostConfirm: "Удалить пост? Восстановить сможете в админ-меню.",
  restorePost: "Восстановить",
  banUser: "Заблокировать автора",
  banReasonLabel: "Причина блокировки (обязательно)",
  banReasonPlaceholder: "Минимум 5 символов",
  banSubmit: "Заблокировать",
  unbanUser: "Разблокировать",
  hiddenByAdmin: "Скрыт администратором",
  adminDeleteComment: "Удалить",
  adminRestoreComment: "Восстановить",
},
banned: {
  heading: "Ваша учётная запись заблокирована",
  reasonLabel: "Причина:",
  noReason: "Причина не указана.",
  logout: "Выйти",
},
write: {
  label: "Написать",
  cta: "Написать пост",
},
```

Импорт в начале файла (если ещё нет):

```ts
import { ruPlural } from "@/lib/plural";
```

(Если в проекте `theme/` не может импортировать из `src/lib/` из-за алиасов — допиши `ruPlural` локально в этом же файле как self-contained helper.)

- [ ] **Step 2.3: Smoke**

```bash
pnpm tsc --noEmit
```

Ожидание: чисто.

- [ ] **Step 2.4: Коммит**

```bash
git add src/lib/plural.ts theme/content.ts
git commit -m "feat(plan-5b): content keys for comments/moderation/banned/write"
```

---

## Task 3: `renderCommentText` utility **(TDD)**

**Files:**
- Create: `src/components/comments/render-text.ts`
- Create: `tests/comments/render-text.test.ts`

Spec §6.5: pure-функция `string → ReactNode[]`, без зависимостей, регэксп `\bhttps?:\/\/[^\s<>"']+/g` + trim trailing `[.,;:!?)\]}»"']+$`, параграфы по `\n\n`, `\n` → `<br/>`.

- [ ] **Step 3.1: (TDD RED) Тесты**

```ts
// tests/comments/render-text.test.ts
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderCommentText } from "@/components/comments/render-text";

function html(text: string): string {
  const { container } = render(<>{renderCommentText(text)}</>);
  return container.innerHTML;
}

describe("renderCommentText", () => {
  it("plain без URL → один <p>", () => {
    const out = html("Привет, мир.");
    expect(out).toContain("<p>");
    expect(out).toContain("Привет, мир.");
    expect(out).not.toContain("<a ");
  });

  it("один URL в середине параграфа → <a> с правильным rel/target", () => {
    const out = html("Смотри https://example.com — круто.");
    expect(out).toContain('<a href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it("несколько URL в одном параграфе", () => {
    const out = html("https://a.com и https://b.com");
    expect(out.match(/<a /g)?.length).toBe(2);
  });

  it("URL с trailing-пунктуацией → знак НЕ попадает в href", () => {
    const out = html("Зайди на https://example.com, пожалуйста.");
    expect(out).toContain('href="https://example.com"');     // без запятой
    expect(out).not.toContain('href="https://example.com,"'); // запятая снаружи
  });
});
```

Файл `.tsx`-расширение — в `<>{...}</>`-фрагменте нужен JSX. Переименуй файл в `render-text.test.tsx`:

```bash
mv tests/comments/render-text.test.ts tests/comments/render-text.test.tsx 2>/dev/null || true
```

(Если ты уже создал с правильным расширением — пропусти.)

- [ ] **Step 3.2: Прогнать — FAIL**

```bash
pnpm test tests/comments/render-text.test.tsx
```

Ожидание: 4× FAIL «Cannot find module '@/components/comments/render-text'».

- [ ] **Step 3.3: (TDD GREEN) Реализация**

```ts
// src/components/comments/render-text.ts
import React from "react";

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCT = /[.,;:!?)\]}»"']+$/;

function renderParagraph(text: string, keyPrefix: string): React.ReactNode {
  // Найдём URL и сегментируем строку.
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;                              // reset state (g-flag)

  while ((m = URL_RE.exec(text)) !== null) {
    let url = m[0];
    let matchEnd = m.index + url.length;
    const trail = url.match(TRAILING_PUNCT);
    if (trail) {
      url = url.slice(0, -trail[0].length);
      matchEnd -= trail[0].length;
      URL_RE.lastIndex = matchEnd;
    }
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    parts.push(
      <a key={`${keyPrefix}-${m.index}`} href={url} target="_blank" rel="noopener noreferrer nofollow">
        {url}
      </a>
    );
    lastIdx = matchEnd;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  // \n внутри параграфа → <br />
  const withBreaks: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    if (typeof p !== "string") { withBreaks.push(p); return; }
    const lines = p.split("\n");
    lines.forEach((ln, j) => {
      withBreaks.push(ln);
      if (j < lines.length - 1) withBreaks.push(<br key={`${keyPrefix}-br-${i}-${j}`} />);
    });
  });

  return withBreaks;
}

// text → ReactNode[]: разбиение по \n\n на параграфы, внутри — авто-линки и <br/>.
// React сам экранирует строковые children — XSS невозможен.
export function renderCommentText(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((p, i) => (
    <p key={`p-${i}`} className="whitespace-pre-wrap">
      {renderParagraph(p, `p-${i}`)}
    </p>
  ));
}
```

(Если файл `.ts` — переименуй в `.tsx`, чтобы JSX компилировался.)

```bash
mv src/components/comments/render-text.ts src/components/comments/render-text.tsx 2>/dev/null || true
```

- [ ] **Step 3.4: Прогнать — PASS**

```bash
pnpm test tests/comments/render-text.test.tsx
```

Ожидание: 4/4 зелёные.

- [ ] **Step 3.5: Коммит**

```bash
git add src/components/comments/render-text.tsx tests/comments/render-text.test.tsx
git commit -m "feat(plan-5b): renderCommentText util (autolinks + paragraphs)"
```

---

## Task 4: Rate-limit module **(TDD)**

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `tests/comments/rate-limit.test.ts`

Spec §4.4: `Map<userId-kind, timestamps[]>`. Лимиты: comment 20/час + gap 10с, post 5/час + gap 30с. Cap 10k ключей (старый дропается). Admin-bypass — НЕ внутри `checkLimit`, делается в caller'е (action проверяет `session.user.role === 'admin'`).

- [ ] **Step 4.1: (TDD RED) Тесты**

```ts
// tests/comments/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkLimit, _resetForTests } from "@/lib/rate-limit";

describe("checkLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetForTests();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("gap: два вызова подряд → второй блок", () => {
    expect(checkLimit("u1", "comment").ok).toBe(true);
    const r = checkLimit("u1", "comment");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("gap-разрешение после wait", () => {
    expect(checkLimit("u2", "comment").ok).toBe(true);
    vi.advanceTimersByTime(11_000);  // > 10s gap
    expect(checkLimit("u2", "comment").ok).toBe(true);
  });

  it("окно: 20 успешных за час, 21-й — блок", () => {
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(11_000);  // обходим gap
      expect(checkLimit("u3", "comment").ok).toBe(true);
    }
    vi.advanceTimersByTime(11_000);
    expect(checkLimit("u3", "comment").ok).toBe(false);
  });
});
```

- [ ] **Step 4.2: Прогнать — FAIL**

```bash
pnpm test tests/comments/rate-limit.test.ts
```

Ожидание: 3× FAIL «Cannot find module '@/lib/rate-limit'».

- [ ] **Step 4.3: (TDD GREEN) Реализация**

```ts
// src/lib/rate-limit.ts
// In-memory rate limiter — для single-instance деплоя (Hetzner V1).
// При scale-out (multi-instance) лимиты будут расходиться — миграция на Redis в фазу 2.
// TODO(phase-2): persistent backend (Redis/Postgres) при появлении 2+ инстансов.

export type LimitKind = "comment" | "post";
export type LimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; reason: "gap" | "window" };

interface Rule { windowMs: number; maxInWindow: number; gapMs: number; }

const RULES: Record<LimitKind, Rule> = {
  comment: { windowMs: 60 * 60 * 1000, maxInWindow: 20, gapMs: 10_000 },
  post:    { windowMs: 60 * 60 * 1000, maxInWindow: 5,  gapMs: 30_000 },
};

const MAX_KEYS = 10_000;                              // LRU cap, spec §4.4
const store = new Map<string, number[]>();            // key = `${userId}:${kind}`

function evictIfFull(): void {
  if (store.size < MAX_KEYS) return;
  // Удаляем самый старый ключ (Map sохраняет insertion order).
  const firstKey = store.keys().next().value;
  if (firstKey !== undefined) store.delete(firstKey);
}

export function checkLimit(userId: string, kind: LimitKind): LimitResult {
  const rule = RULES[kind];
  const now = Date.now();
  const key = `${userId}:${kind}`;
  const arr = store.get(key) ?? [];

  // Очистка хвоста: убираем timestamps старше окна.
  const fresh = arr.filter((t) => now - t < rule.windowMs);

  // Gap-проверка: последняя метка не дальше gapMs назад.
  if (fresh.length > 0) {
    const last = fresh[fresh.length - 1];
    if (now - last < rule.gapMs) {
      return { ok: false, retryAfterSec: Math.ceil((rule.gapMs - (now - last)) / 1000), reason: "gap" };
    }
  }

  // Окно-проверка.
  if (fresh.length >= rule.maxInWindow) {
    const oldest = fresh[0];
    return { ok: false, retryAfterSec: Math.ceil((rule.windowMs - (now - oldest)) / 1000), reason: "window" };
  }

  // Сохраняем — touch (re-insertion для LRU-ordering).
  fresh.push(now);
  if (store.has(key)) store.delete(key);
  evictIfFull();
  store.set(key, fresh);
  return { ok: true };
}

// Только для тестов.
export function _resetForTests(): void { store.clear(); }
```

- [ ] **Step 4.4: Прогнать — PASS**

```bash
pnpm test tests/comments/rate-limit.test.ts
```

Ожидание: 3/3 зелёные.

- [ ] **Step 4.5: Коммит**

```bash
git add src/lib/rate-limit.ts tests/comments/rate-limit.test.ts
git commit -m "feat(plan-5b): in-memory rate-limit (gap + window + LRU cap)"
```

---

## Task 5: `assertAdmin()` guard

**Files:**
- Create: `src/lib/auth/assert-admin.ts`

Spec §4.5: тонкий wrapper над `auth()` + `redirect('/')` если не админ.

- [ ] **Step 5.1: Реализация**

```ts
// src/lib/auth/assert-admin.ts
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Использовать в начале каждого moderation server-action.
// Возвращает userId для логирования/связки (deletedBy и т.п.).
// Кидает Next.js redirect('/') не-админам — действие отменяется.
export async function assertAdmin(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/");
  }
  return { userId: session.user.id };
}
```

`session.user.role` уже типизирован в [src/types/next-auth.d.ts:6,15](src/types/next-auth.d.ts) (plan-02). Менять `next-auth.d.ts` здесь НЕ требуется — `banReason` для `/banned` добавим в Task 15.2.

- [ ] **Step 5.2: Smoke**

```bash
pnpm tsc --noEmit
```

Ожидание: чисто.

- [ ] **Step 5.3: Коммит**

```bash
git add src/lib/auth/assert-admin.ts
git commit -m "feat(plan-5b): assertAdmin guard for moderation actions"
```

---

## Task 6: `getCommentsByPost` + `getCommentCount` query layer **(TDD)**

**Files:**
- Create: `src/server/comments.ts`
- Create: `tests/comments/comments-queries.test.ts`

Spec §4.1: возвращаем ВСЕ комменты (включая deleted) для якорей; `totalCount` — только не-deleted. Пагинация 50. Включаем поля автора (username, name, image, bannedAt) одним JOIN.

- [ ] **Step 6.1: (TDD RED) Тесты**

```ts
// tests/comments/comments-queries.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "@/lib/db";
import { users, posts, comments } from "@db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/auth/id";
import { getCommentsByPost, getCommentCount } from "@/server/comments";

const ids = { user: newId(), post: newId(), c1: newId(), c2: newId(), c3: newId() };

beforeAll(async () => {
  const db = getDb();
  await db.insert(users).values({ id: ids.user, email: `q-${ids.user}@x.io`, username: "qauthor" });
  await db.insert(posts).values({
    id: ids.post, authorId: ids.user, slug: `q-${ids.post}`, title: "q",
    content: { blocks: [] }, status: "published", pubAt: new Date(),
  });
  // 3 коммента; c2 — deleted
  await db.insert(comments).values({ id: ids.c1, postId: ids.post, authorId: ids.user, contentText: "first" });
  await new Promise((r) => setTimeout(r, 10));
  await db.insert(comments).values({
    id: ids.c2, postId: ids.post, authorId: ids.user, contentText: "second-deleted",
    deletedAt: new Date(), deletedBy: ids.user,
  });
  await new Promise((r) => setTimeout(r, 10));
  await db.insert(comments).values({ id: ids.c3, postId: ids.post, authorId: ids.user, contentText: "third" });
});

afterAll(async () => {
  const db = getDb();
  await db.delete(comments).where(eq(comments.postId, ids.post));
  await db.delete(posts).where(eq(posts.id, ids.post));
  await db.delete(users).where(eq(users.id, ids.user));
});

describe("getCommentsByPost", () => {
  it("возвращает ВСЕ комменты включая deleted, ordered by createdAt ASC", async () => {
    const page = await getCommentsByPost(ids.post, 1);
    expect(page.items).toHaveLength(3);
    expect(page.items.map((c) => c.id)).toEqual([ids.c1, ids.c2, ids.c3]);
  });

  it("у deleted-коммента поле deletedAt != null", async () => {
    const page = await getCommentsByPost(ids.post, 1);
    const deleted = page.items.find((c) => c.id === ids.c2);
    expect(deleted?.deletedAt).toBeInstanceOf(Date);
  });

  it("totalCount — только не-deleted (2 из 3)", async () => {
    const page = await getCommentsByPost(ids.post, 1);
    expect(page.totalCount).toBe(2);
  });
});

describe("getCommentCount", () => {
  it("считает только не-deleted (2)", async () => {
    const n = await getCommentCount(ids.post);
    expect(n).toBe(2);
  });
});
```

- [ ] **Step 6.2: Прогнать — FAIL**

```bash
pnpm test tests/comments/comments-queries.test.ts
```

Ожидание: 4× FAIL «Cannot find module '@/server/comments'».

- [ ] **Step 6.3: (TDD GREEN) Реализация**

```ts
// src/server/comments.ts
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { comments, users } from "@db/schema";

export const COMMENTS_PER_PAGE = 50;

export interface CommentItem {
  id: string;
  parentId: string | null;
  authorId: string;
  authorUsername: string | null;
  authorName: string | null;
  authorImage: string | null;
  authorBannedAt: Date | null;
  contentText: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  deletedByAuthor: boolean;       // computed: deletedBy === authorId
}

export interface CommentsPage {
  items: CommentItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;             // не-deleted only
}

export async function getCommentsByPost(postId: string, page: number): Promise<CommentsPage> {
  const db = getDb();
  const offset = (page - 1) * COMMENTS_PER_PAGE;

  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      authorId: comments.authorId,
      authorUsername: users.username,
      authorName: users.name,
      authorImage: users.image,
      authorBannedAt: users.bannedAt,
      contentText: comments.contentText,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      deletedBy: comments.deletedBy,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt))
    .limit(COMMENTS_PER_PAGE)
    .offset(offset);

  const totalCount = await getCommentCount(postId);
  const totalPages = Math.max(1, Math.ceil(totalCount / COMMENTS_PER_PAGE));

  return {
    items: rows.map((r) => ({ ...r, deletedByAuthor: r.deletedBy === r.authorId })),
    currentPage: page,
    totalPages,
    totalCount,
  };
}

export async function getCommentCount(postId: string): Promise<number> {
  const db = getDb();
  // TODO(phase-2): threading — пока считаем плоско.
  const [{ n }] = await db
    .select({ n: count() })
    .from(comments)
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)));
  return Number(n);
}
```

- [ ] **Step 6.4: Прогнать — PASS**

```bash
pnpm test tests/comments/comments-queries.test.ts
```

Ожидание: 4/4 зелёные.

- [ ] **Step 6.5: Коммит**

```bash
git add src/server/comments.ts tests/comments/comments-queries.test.ts
git commit -m "feat(plan-5b): getCommentsByPost + getCommentCount queries"
```

---

## Task 7: Server actions комментов — `create`/`update`/`deleteOwn` **(TDD)**

**Files:**
- Create: `src/server/actions/comments.ts`
- Create: `tests/comments/comments-actions.test.ts`

Spec §4.2: проверяем session, длина 1..2000, edit-окно 15 минут, own-only delete. Rate-limit для admin'а bypass. `revalidatePath` после успеха.

- [ ] **Step 7.1: (TDD RED) Тесты**

```ts
// tests/comments/comments-actions.test.ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { getDb } from "@/lib/db";
import { users, posts, comments } from "@db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/auth/id";
import { _resetForTests as resetRateLimit } from "@/lib/rate-limit";
import { createComment, updateComment, deleteOwnComment } from "@/server/actions/comments";

// Мокаем auth() — каждый тест задаёт current user.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";

// Мокаем revalidatePath чтобы не падало в тестовом окружении.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ids = { user: newId(), post: newId() };

async function seed() {
  const db = getDb();
  await db.insert(users).values({ id: ids.user, email: `a-${ids.user}@x.io`, username: "actorx", role: "user" });
  await db.insert(posts).values({
    id: ids.post, authorId: ids.user, slug: `a-${ids.post}`, title: "a",
    content: { blocks: [] }, status: "published", pubAt: new Date(),
  });
}

async function cleanup() {
  const db = getDb();
  await db.delete(comments).where(eq(comments.postId, ids.post));
  await db.delete(posts).where(eq(posts.id, ids.post));
  await db.delete(users).where(eq(users.id, ids.user));
}

describe("comment actions", () => {
  beforeEach(async () => {
    resetRateLimit();
    vi.mocked(auth).mockResolvedValue({ user: { id: ids.user, role: "user" } } as never);
    await cleanup();
    await seed();
  });
  afterAll(cleanup);

  it("createComment без session → reject", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const r = await createComment(ids.post, "test");
    expect(r.ok).toBe(false);
  });

  it("updateComment по истечении 15 минут → reject", async () => {
    const r1 = await createComment(ids.post, "hello");
    expect(r1.ok).toBe(true);
    const cid = (r1 as { ok: true; data: { commentId: string } }).data.commentId;

    // вручную сдвинем createdAt на 16 минут назад
    await getDb().update(comments)
      .set({ createdAt: new Date(Date.now() - 16 * 60 * 1000) })
      .where(eq(comments.id, cid));

    const r2 = await updateComment(cid, "hello edited");
    expect(r2.ok).toBe(false);
  });

  it("deleteOwnComment чужого коммента → reject", async () => {
    const r1 = await createComment(ids.post, "mine");
    const cid = (r1 as { ok: true; data: { commentId: string } }).data.commentId;

    const otherId = newId();
    await getDb().insert(users).values({ id: otherId, email: `o-${otherId}@x.io`, role: "user" });
    vi.mocked(auth).mockResolvedValue({ user: { id: otherId, role: "user" } } as never);

    const r2 = await deleteOwnComment(cid);
    expect(r2.ok).toBe(false);

    await getDb().delete(users).where(eq(users.id, otherId));
  });
});
```

- [ ] **Step 7.2: Прогнать — FAIL**

```bash
pnpm test tests/comments/comments-actions.test.ts
```

Ожидание: 3× FAIL «Cannot find module '@/server/actions/comments'».

- [ ] **Step 7.3: (TDD GREEN) Реализация**

```ts
// src/server/actions/comments.ts
"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { comments, posts } from "@db/schema";
import { newId } from "@/lib/auth/id";
import { checkLimit } from "@/lib/rate-limit";

const MAX_LEN = 2000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getPostSlug(postId: string): Promise<string | null> {
  const r = await getDb().select({ slug: posts.slug }).from(posts).where(eq(posts.id, postId)).limit(1);
  return r[0]?.slug ?? null;
}

export async function createComment(postId: string, text: string): Promise<ActionResult<{ commentId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Не авторизован" };
  if (session.user.bannedAt) return { ok: false, error: "Аккаунт заблокирован" };

  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: "Пустой комментарий" };
  if (trimmed.length > MAX_LEN) return { ok: false, error: `Максимум ${MAX_LEN} символов` };

  if (session.user.role !== "admin") {
    const limit = checkLimit(session.user.id, "comment");
    if (!limit.ok) return { ok: false, error: `Слишком часто. Попробуйте через ${limit.retryAfterSec} с.` };
  }

  const slug = await getPostSlug(postId);
  if (!slug) return { ok: false, error: "Пост не найден" };

  const commentId = newId();
  await getDb().insert(comments).values({
    id: commentId, postId, authorId: session.user.id, contentText: trimmed,
  });

  revalidatePath(`/p/${slug}`);
  return { ok: true, data: { commentId } };
}

export async function updateComment(commentId: string, text: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Не авторизован" };

  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LEN) return { ok: false, error: "Длина 1..2000 символов" };

  const rows = await getDb().select().from(comments).where(eq(comments.id, commentId)).limit(1);
  const c = rows[0];
  if (!c) return { ok: false, error: "Комментарий не найден" };
  if (c.authorId !== session.user.id) return { ok: false, error: "Можно редактировать только свои" };
  if (c.deletedAt) return { ok: false, error: "Удалённый комментарий нельзя править" };

  const ageMs = Date.now() - c.createdAt.getTime();
  if (ageMs > EDIT_WINDOW_MS) return { ok: false, error: "Окно редактирования (15 минут) закрыто" };

  await getDb().update(comments)
    .set({ contentText: trimmed, editedAt: new Date() })
    .where(eq(comments.id, commentId));

  const slug = await getPostSlug(c.postId);
  if (slug) revalidatePath(`/p/${slug}`);
  return { ok: true, data: undefined };
}

export async function deleteOwnComment(commentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Не авторизован" };

  const rows = await getDb().select().from(comments).where(eq(comments.id, commentId)).limit(1);
  const c = rows[0];
  if (!c) return { ok: false, error: "Комментарий не найден" };
  if (c.authorId !== session.user.id) return { ok: false, error: "Можно удалять только свои" };
  if (c.deletedAt) return { ok: false, error: "Уже удалён" };

  await getDb().update(comments)
    .set({ deletedAt: new Date(), deletedBy: session.user.id })
    .where(eq(comments.id, commentId));

  const slug = await getPostSlug(c.postId);
  if (slug) revalidatePath(`/p/${slug}`);
  return { ok: true, data: undefined };
}
```

- [ ] **Step 7.4: Прогнать — PASS**

```bash
pnpm test tests/comments/comments-actions.test.ts
```

Ожидание: 3/3 зелёные.

- [ ] **Step 7.5: Коммит**

```bash
git add src/server/actions/comments.ts tests/comments/comments-actions.test.ts
git commit -m "feat(plan-5b): comment server actions (create/update/deleteOwn)"
```

---

## Task 8: Moderation server actions **(TDD)**

**Files:**
- Create: `src/server/actions/moderation.ts`
- Create: `tests/comments/moderation-actions.test.ts`

Spec §4.3: 9 actions, все начинаются с `assertAdmin()`. `adminDeletePost` — soft через `deletedAt` (spec §2 row 14), `contentHtml` НЕ зануляем (spec отклонение от канона §8.6).

- [ ] **Step 8.1: (TDD RED) Тесты**

```ts
// tests/comments/moderation-actions.test.ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { getDb } from "@/lib/db";
import { users, posts, comments } from "@db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/auth/id";
import { adminDeleteComment, adminBanUser, adminHidePost } from "@/server/actions/moderation";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async () => {
  const real = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return { ...real, redirect: vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); }) };
});

const ids = { admin: newId(), user: newId(), post: newId(), comment: newId() };

async function seed() {
  const db = getDb();
  await db.insert(users).values({ id: ids.admin, email: `adm-${ids.admin}@x.io`, role: "admin" });
  await db.insert(users).values({ id: ids.user, email: `usr-${ids.user}@x.io`, role: "user" });
  await db.insert(posts).values({
    id: ids.post, authorId: ids.user, slug: `m-${ids.post}`, title: "m",
    content: { blocks: [] }, status: "published", pubAt: new Date(),
  });
  await db.insert(comments).values({
    id: ids.comment, postId: ids.post, authorId: ids.user, contentText: "spam",
  });
}

async function cleanup() {
  const db = getDb();
  await db.delete(comments).where(eq(comments.postId, ids.post));
  await db.delete(posts).where(eq(posts.id, ids.post));
  await db.delete(users).where(eq(users.id, ids.user));
  await db.delete(users).where(eq(users.id, ids.admin));
}

describe("moderation actions", () => {
  beforeEach(async () => { await cleanup(); await seed(); });
  afterAll(cleanup);

  it("adminDeleteComment не-админом → redirect (через assertAdmin)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: ids.user, role: "user" } } as never);
    await expect(adminDeleteComment(ids.comment)).rejects.toThrow(/REDIRECT:/);
  });

  it("adminBanUser без причины → reject", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: ids.admin, role: "admin" } } as never);
    const r = await adminBanUser(ids.user, "abc");  // 3 < 5
    expect(r.ok).toBe(false);
  });

  it("adminHidePost ставит hiddenByAdminAt + hiddenByAdminId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: ids.admin, role: "admin" } } as never);
    const r = await adminHidePost(ids.post);
    expect(r.ok).toBe(true);
    const post = (await getDb().select().from(posts).where(eq(posts.id, ids.post)))[0];
    expect(post.hiddenByAdminAt).toBeInstanceOf(Date);
    expect(post.hiddenByAdminId).toBe(ids.admin);
  });
});
```

- [ ] **Step 8.2: Прогнать — FAIL**

```bash
pnpm test tests/comments/moderation-actions.test.ts
```

Ожидание: 3× FAIL «Cannot find module '@/server/actions/moderation'».

- [ ] **Step 8.3: (TDD GREEN) Реализация**

```ts
// src/server/actions/moderation.ts
"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { comments, posts, users } from "@db/schema";
import { assertAdmin } from "@/lib/auth/assert-admin";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MIN_BAN_REASON = 5;

async function getPostSlugByComment(commentId: string): Promise<string | null> {
  const r = await getDb()
    .select({ slug: posts.slug })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, commentId))
    .limit(1);
  return r[0]?.slug ?? null;
}

// ─── комменты ───────────────────────────────────────────────────────────
export async function adminDeleteComment(commentId: string): Promise<ActionResult> {
  const { userId } = await assertAdmin();
  await getDb().update(comments)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(eq(comments.id, commentId));
  const slug = await getPostSlugByComment(commentId);
  if (slug) revalidatePath(`/p/${slug}`);
  return { ok: true, data: undefined };
}

export async function adminRestoreComment(commentId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(comments)
    .set({ deletedAt: null, deletedBy: null })
    .where(eq(comments.id, commentId));
  const slug = await getPostSlugByComment(commentId);
  if (slug) revalidatePath(`/p/${slug}`);
  return { ok: true, data: undefined };
}

// ─── бан юзера ──────────────────────────────────────────────────────────
export async function adminBanUser(userId: string, reason: string): Promise<ActionResult> {
  await assertAdmin();
  const trimmed = reason.trim();
  if (trimmed.length < MIN_BAN_REASON) {
    return { ok: false, error: `Минимум ${MIN_BAN_REASON} символов причины` };
  }
  await getDb().update(users)
    .set({ bannedAt: new Date(), banReason: trimmed })
    .where(eq(users.id, userId));
  return { ok: true, data: undefined };
}

export async function adminUnbanUser(userId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(users)
    .set({ bannedAt: null, banReason: null })
    .where(eq(users.id, userId));
  return { ok: true, data: undefined };
}

// ─── скрытие поста (восстанавливаемо) ───────────────────────────────────
export async function adminHidePost(postId: string): Promise<ActionResult> {
  const { userId } = await assertAdmin();
  await getDb().update(posts)
    .set({ hiddenByAdminAt: new Date(), hiddenByAdminId: userId })
    .where(eq(posts.id, postId));
  const slug = (await getDb().select({ slug: posts.slug }).from(posts).where(eq(posts.id, postId)))[0]?.slug;
  if (slug) revalidatePath(`/p/${slug}`);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function adminUnhidePost(postId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(posts)
    .set({ hiddenByAdminAt: null, hiddenByAdminId: null })
    .where(eq(posts.id, postId));
  const slug = (await getDb().select({ slug: posts.slug }).from(posts).where(eq(posts.id, postId)))[0]?.slug;
  if (slug) revalidatePath(`/p/${slug}`);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

// ─── soft-delete поста (spec §2 row 14, отклонение §8.6: contentHtml НЕ зануляем) ──
export async function adminDeletePost(postId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(posts)
    .set({ deletedAt: new Date() })
    .where(eq(posts.id, postId));
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function adminRestorePost(postId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(posts)
    .set({ deletedAt: null })
    .where(eq(posts.id, postId));
  revalidatePath("/");
  return { ok: true, data: undefined };
}
```

- [ ] **Step 8.4: Прогнать — PASS**

```bash
pnpm test tests/comments/moderation-actions.test.ts
```

Ожидание: 3/3 зелёные.

- [ ] **Step 8.5: Коммит**

```bash
git add src/server/actions/moderation.ts tests/comments/moderation-actions.test.ts
git commit -m "feat(plan-5b): moderation actions (comments/bans/posts hide+delete)"
```

---

## Task 9: Server-комменты UI — `CommentDeletedPlaceholder`, `CommentItem`, `CommentThread`

**Files:**
- Create: `src/components/comments/CommentDeletedPlaceholder.tsx`
- Create: `src/components/comments/CommentItem.tsx`
- Create: `src/components/comments/CommentThread.tsx`

Все три — server (RSC). Client-острова (формы, dropdown) — следующий task. CommentForm и CommentItemActions подключим заглушками-`null`, чтобы CommentThread компилился без них; финальная сборка в Task 10/11.

- [ ] **Step 9.1: `CommentDeletedPlaceholder.tsx`**

```tsx
// src/components/comments/CommentDeletedPlaceholder.tsx
import { content } from "@theme/content";

export function CommentDeletedPlaceholder({ byAuthor }: { byAuthor: boolean }) {
  return (
    <p className="text-sm italic text-muted-foreground py-3">
      {byAuthor ? content.comments.deletedByAuthor : content.comments.deletedByAdmin}
    </p>
  );
}
```

- [ ] **Step 9.2: `CommentItem.tsx`**

```tsx
// src/components/comments/CommentItem.tsx
import Link from "next/link";
import Image from "next/image";
import type { CommentItem as CommentItemData } from "@/server/comments";
import { renderCommentText } from "./render-text";
import { CommentDeletedPlaceholder } from "./CommentDeletedPlaceholder";
import { CommentItemActions } from "./CommentItemActions";
import { content } from "@theme/content";

interface Props {
  comment: CommentItemData;
  postId: string;
  currentUserId: string | null;
  currentUserIsAdmin: boolean;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function CommentItem({ comment, postId, currentUserId, currentUserIsAdmin }: Props) {
  const isDeleted = comment.deletedAt != null;
  const isAuthorBanned = comment.authorBannedAt != null && !isDeleted;

  return (
    <article id={`comment-${comment.id}`} className="border-b border-border py-4">
      <header className="flex items-center gap-2 text-sm mb-2">
        {comment.authorImage && (
          <Image src={comment.authorImage} alt="" width={24} height={24} className="rounded-full" />
        )}
        {isAuthorBanned || !comment.authorUsername ? (
          <span className="font-medium text-muted-foreground">
            {comment.authorName ?? "—"}
          </span>
        ) : (
          <Link href={`/u/${comment.authorUsername}`} className="font-medium hover:underline">
            {comment.authorName ?? comment.authorUsername}
          </Link>
        )}
        <span className="text-muted-foreground">·</span>
        <time className="text-muted-foreground" dateTime={comment.createdAt.toISOString()}>
          {formatDate(comment.createdAt)}
        </time>
        {comment.editedAt && (
          <span className="text-xs text-muted-foreground italic">(изменено)</span>
        )}
        {isAuthorBanned && (
          <span className="text-xs text-destructive ml-2">{content.comments.bannedAuthor}</span>
        )}
        <div className="ml-auto">
          {!isDeleted && (
            <CommentItemActions
              commentId={comment.id}
              authorId={comment.authorId}
              createdAt={comment.createdAt}
              currentUserId={currentUserId}
              currentUserIsAdmin={currentUserIsAdmin}
              initialText={comment.contentText}
              postId={postId}
            />
          )}
          {isDeleted && currentUserIsAdmin && (
            <CommentItemActions
              commentId={comment.id}
              authorId={comment.authorId}
              createdAt={comment.createdAt}
              currentUserId={currentUserId}
              currentUserIsAdmin={currentUserIsAdmin}
              initialText={comment.contentText}
              postId={postId}
              isDeleted
            />
          )}
        </div>
      </header>

      {isDeleted ? (
        <CommentDeletedPlaceholder byAuthor={comment.deletedByAuthor} />
      ) : (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {renderCommentText(comment.contentText)}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 9.3: `CommentThread.tsx`**

```tsx
// src/components/comments/CommentThread.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCommentsByPost } from "@/server/comments";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { content } from "@theme/content";

interface Props {
  postId: string;
  postSlug: string;
  page?: number;
}

export async function CommentThread({ postId, postSlug, page = 1 }: Props) {
  const [session, data] = await Promise.all([
    auth(),
    getCommentsByPost(postId, page),
  ]);

  const currentUserId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "admin";

  return (
    <section id="comments" className="mt-12">
      <h2 className="text-xl font-semibold mb-4">
        {content.comments.heading}
        {data.totalCount > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({content.comments.countLabel(data.totalCount)})
          </span>
        )}
      </h2>

      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{content.comments.empty}</p>
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              postId={postId}
              currentUserId={currentUserId}
              currentUserIsAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {data.totalPages > 1 && (
        <nav className="flex gap-3 mt-6 text-sm">
          {page > 1 && (
            <Link href={`/p/${postSlug}?cpage=${page - 1}#comments`} className="hover:underline">
              ← Назад
            </Link>
          )}
          <span className="text-muted-foreground">
            Страница {page} из {data.totalPages}
          </span>
          {page < data.totalPages && (
            <Link href={`/p/${postSlug}?cpage=${page + 1}#comments`} className="hover:underline">
              Вперёд →
            </Link>
          )}
        </nav>
      )}

      <div className="mt-8">
        {session?.user ? (
          <CommentForm postId={postId} />
        ) : (
          <p className="text-sm">
            <Link href={`/login?from=/p/${postSlug}`} className="text-primary hover:underline">
              {content.comments.loginToComment}
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 9.4: Заглушки для client-компонентов** (чтобы TS компилил)

Создай минимальные stub'ы — наполним в Task 10:

```tsx
// src/components/comments/CommentForm.tsx
"use client";
export function CommentForm({ postId }: { postId: string }) {
  return <div data-stub-comment-form data-post-id={postId} />;
}
```

```tsx
// src/components/comments/CommentItemActions.tsx
"use client";
export function CommentItemActions(_: {
  commentId: string; authorId: string; createdAt: Date;
  currentUserId: string | null; currentUserIsAdmin: boolean;
  initialText: string; postId: string; isDeleted?: boolean;
}) {
  return null;
}
```

- [ ] **Step 9.5: Smoke**

```bash
pnpm tsc --noEmit
```

Ожидание: чисто.

- [ ] **Step 9.6: Коммит**

```bash
git add src/components/comments/CommentDeletedPlaceholder.tsx \
        src/components/comments/CommentItem.tsx \
        src/components/comments/CommentThread.tsx \
        src/components/comments/CommentForm.tsx \
        src/components/comments/CommentItemActions.tsx
git commit -m "feat(plan-5b): comment server UI (Thread/Item/Placeholder) + client stubs"
```

---

## Task 10: Client `CommentForm` + `EditCommentForm`

**Files:**
- Modify: `src/components/comments/CommentForm.tsx` (заменяем stub)
- Create: `src/components/comments/EditCommentForm.tsx`

Spec §6.1: textarea с autoresize (min 80, max 400) + счётчик (красный >1900) + `useTransition` + кнопка с `pending`.

- [ ] **Step 10.1: `CommentForm.tsx`**

```tsx
// src/components/comments/CommentForm.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createComment } from "@/server/actions/comments";
import { content } from "@theme/content";

const MAX = 2000;

export function CommentForm({ postId }: { postId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createComment(postId, text);
      if (!r.ok) { setError(r.error); return; }
      setText("");
      router.refresh();                 // подтянет revalidatePath
    });
  };

  const overLimit = text.length > MAX;
  const nearLimit = text.length > 1900;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={content.comments.placeholder}
        className="w-full min-h-[80px] max-h-[400px] p-3 rounded-md border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={isPending}
        required
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${overLimit ? "text-destructive" : nearLimit ? "text-amber-600" : "text-muted-foreground"}`}>
          {content.comments.charCount(text.length)}
        </span>
        <Button type="submit" pending={isPending} disabled={overLimit || text.trim().length === 0}>
          {content.comments.submit}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 10.2: `EditCommentForm.tsx`**

```tsx
// src/components/comments/EditCommentForm.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateComment } from "@/server/actions/comments";
import { content } from "@theme/content";

const MAX = 2000;

interface Props {
  commentId: string;
  initialText: string;
  onCancel: () => void;
}

export function EditCommentForm({ commentId, initialText, onCancel }: Props) {
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateComment(commentId, text);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
      onCancel();
    });
  };

  const overLimit = text.length > MAX;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 my-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full min-h-[80px] p-3 rounded-md border border-border bg-background text-sm resize-y"
        disabled={isPending}
        required
      />
      <div className="flex gap-2 items-center justify-end">
        <span className={`text-xs mr-auto ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
          {content.comments.charCount(text.length)}
        </span>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          {content.comments.cancel}
        </Button>
        <Button type="submit" pending={isPending} disabled={overLimit || text.trim().length === 0}>
          {content.comments.save}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 10.3: Smoke**

```bash
pnpm tsc --noEmit
```

Ожидание: чисто.

- [ ] **Step 10.4: Коммит**

```bash
git add src/components/comments/CommentForm.tsx src/components/comments/EditCommentForm.tsx
git commit -m "feat(plan-5b): client CommentForm + EditCommentForm"
```

---

## Task 11: `CommentItemActions` (dropdown edit/delete + admin actions)

**Files:**
- Modify: `src/components/comments/CommentItemActions.tsx` (заменяем stub)

Spec §6.1: dropdown `MoreHorizontal`, internal state переключает между display/edit. Кнопки: own — Edit (если в окне) + Delete; admin — Delete-чужое или Restore.

**ВАЖНО про `ConfirmDialog`:** реальный API в `src/components/ui/ConfirmDialog.tsx` — **trigger-driven**, диалог сам владеет open-state. Props: `trigger: ReactNode, title, description, confirmLabel, onConfirm, typedConfirm?, destructive?`. Никаких `open`/`onOpenChange`/`busy`. `onConfirm` может быть async — компонент сам ставит `busy` и закрывается после resolve. Здесь — кладём `<DropdownMenuItem>...</DropdownMenuItem>` внутрь `<ConfirmDialog trigger={...}>`, выводя dropdown-action из меню в диалог-триггер.

- [ ] **Step 11.1: Реализация**

```tsx
// src/components/comments/CommentItemActions.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditCommentForm } from "./EditCommentForm";
import { deleteOwnComment } from "@/server/actions/comments";
import { adminDeleteComment, adminRestoreComment } from "@/server/actions/moderation";
import { content } from "@theme/content";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

interface Props {
  commentId: string;
  authorId: string;
  createdAt: Date;
  currentUserId: string | null;
  currentUserIsAdmin: boolean;
  initialText: string;
  postId: string;
  isDeleted?: boolean;
}

export function CommentItemActions(props: Props) {
  const {
    commentId, authorId, createdAt, currentUserId, currentUserIsAdmin,
    initialText, isDeleted,
  } = props;

  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const isOwn = currentUserId === authorId;
  const canEdit = isOwn && !isDeleted && Date.now() - createdAt.getTime() < EDIT_WINDOW_MS;
  const canDelete = (isOwn && !isDeleted) || (currentUserIsAdmin && !isDeleted);
  const canRestore = currentUserIsAdmin && isDeleted;

  // Если нечего показать — выходим (минимизируем DOM).
  if (!canEdit && !canDelete && !canRestore) return null;

  // ConfirmDialog сам ставит busy на time await; нам только async-onConfirm.
  const onDelete = async () => {
    const r = isOwn
      ? await deleteOwnComment(commentId)
      : await adminDeleteComment(commentId);
    if (r.ok) router.refresh();
  };

  const onRestore = () => {
    startTransition(async () => {
      const r = await adminRestoreComment(commentId);
      if (r.ok) router.refresh();
    });
  };

  if (editing) {
    return <EditCommentForm commentId={commentId} initialText={initialText} onCancel={() => setEditing(false)} />;
  }

  // Delete-пункт встроен как trigger ConfirmDialog'а — клик по пункту откроет
  // диалог. Radix DropdownMenuItem закрывает меню по onSelect, поэтому
  // оборачиваем item в ConfirmDialog с `trigger`, и используем asChild на нём
  // через Radix-композицию (ConfirmDialog внутри уже делает Dialog.Trigger
  // asChild — пробрасывает наш ReactNode как сам триггер).
  const deleteTrigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      {isOwn ? content.comments.delete : content.moderation.adminDeleteComment}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="p-1 rounded hover:bg-accent">
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Действия</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            {content.comments.edit}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <ConfirmDialog
            trigger={deleteTrigger}
            title={content.comments.deleteConfirm}
            description={isOwn ? content.comments.deleteConfirm : content.moderation.adminDeleteComment}
            confirmLabel={content.comments.delete}
            destructive
            onConfirm={onDelete}
          />
        )}
        {canRestore && (
          <DropdownMenuItem onSelect={onRestore}>
            {content.moderation.adminRestoreComment}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Если Radix ругается на `DropdownMenuItem` внутри `Dialog.Trigger asChild` (нужен ровно один React-child) — оборачивай в `<span>...{deleteTrigger}</span>` или используй `<button type="button">` вместо `DropdownMenuItem` для delete-кнопки (потеряем «закрыть меню по клику», но Radix `Dialog` всё равно закроет dropdown через portal-focus). Альтернатива: вынести `<ConfirmDialog />` рядом с `DropdownMenu` (как sibling) и в `onSelect` пункта триггерить `<button>`-trigger через `useRef`. Для V1 — выбери первый вариант, если он рендерится без warning'ов в консоли.

- [ ] **Step 11.2: Smoke**

```bash
pnpm tsc --noEmit
```

Ожидание: чисто. Если падает на `Button variant="ghost"` отсутствует — посмотри `src/components/ui/button.tsx`, используй существующий вариант (`outline` или просто без `variant`).

- [ ] **Step 11.3: Коммит**

```bash
git add src/components/comments/CommentItemActions.tsx
git commit -m "feat(plan-5b): CommentItemActions (own edit/delete + admin moderation)"
```

---

## Task 12: `PostAdminMenu` + `BanUserDialog` (moderation UI на post page)

**Files:**
- Create: `src/components/moderation/PostAdminMenu.tsx`
- Create: `src/components/moderation/BanUserDialog.tsx`

Spec §6.3: dropdown «Скрыть/Показать/Удалить пост/Забанить автора». Бан с обязательной textarea ≥5 символов.

**ВАЖНО про Dialog:** в проекте **НЕТ** `src/components/ui/dialog.tsx` (только `ConfirmDialog.tsx`). `BanUserDialog` строим на `@radix-ui/react-dialog` напрямую — так же, как сделан `ConfirmDialog` ([src/components/ui/ConfirmDialog.tsx:4](src/components/ui/ConfirmDialog.tsx#L4)). Не пытайся импортировать `Dialog, DialogContent, ...` из `@/components/ui/dialog` — это shadcn-ноутайшн, в нашем репо такого helper'а нет, и создавать новый сейчас YAGNI.

`PostAdminMenu` использует ConfirmDialog как **trigger-driven** (см. Task 11 ВАЖНО-блок): delete-action — это `DropdownMenuItem` внутри `<ConfirmDialog trigger={...}>`, ban-action — `BanUserDialog` с тем же паттерном trigger-driven.

- [ ] **Step 12.1: `BanUserDialog.tsx`** (Radix-Dialog напрямую, trigger-driven)

```tsx
// src/components/moderation/BanUserDialog.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { adminBanUser } from "@/server/actions/moderation";
import { content } from "@theme/content";

interface Props {
  trigger: React.ReactNode;
  userId: string;
}

export function BanUserDialog({ trigger, userId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await adminBanUser(userId, reason);
      if (!r.ok) { setError(r.error); return; }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setError(null); setReason(""); } }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(90vw,480px)] rounded-md bg-background border border-border p-6 shadow-lg">
          <Dialog.Title className="font-display text-lg mb-2">
            {content.moderation.banUser}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {content.moderation.banReasonLabel}
          </Dialog.Description>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="text-sm">
              <span className="block mb-1">{content.moderation.banReasonLabel}</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={content.moderation.banReasonPlaceholder}
                className="w-full min-h-[80px] p-2 rounded-md border border-border bg-background text-sm"
                required
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  {content.comments.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" pending={busy} variant="destructive">
                {content.moderation.banSubmit}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 12.2: `PostAdminMenu.tsx`** (trigger-driven ConfirmDialog + trigger-driven BanUserDialog)

```tsx
// src/components/moderation/PostAdminMenu.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BanUserDialog } from "./BanUserDialog";
import { adminHidePost, adminUnhidePost, adminDeletePost } from "@/server/actions/moderation";
import { content } from "@theme/content";

interface Props {
  postId: string;
  authorId: string;
  isHidden: boolean;
}

export function PostAdminMenu({ postId, authorId, isHidden }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  const onHideToggle = () => {
    startTransition(async () => {
      const r = isHidden ? await adminUnhidePost(postId) : await adminHidePost(postId);
      if (r.ok) router.refresh();
    });
  };

  // ConfirmDialog/BanUserDialog сами управляют open/busy — нам нужен async onConfirm.
  const onDelete = async () => {
    const r = await adminDeletePost(postId);
    if (r.ok) router.refresh();
  };

  // DropdownMenuItem.onSelect препятствуем — иначе Radix закроет меню до того,
  // как Dialog откроется. Dialog.Trigger asChild возьмёт этот item как свой trigger.
  const deleteTrigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      {content.moderation.deletePost}
    </DropdownMenuItem>
  );
  const banTrigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      {content.moderation.banUser}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="p-2 rounded hover:bg-accent" aria-label={content.moderation.postMenuLabel}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onHideToggle}>
          {isHidden ? content.moderation.unhidePost : content.moderation.hidePost}
        </DropdownMenuItem>
        <ConfirmDialog
          trigger={deleteTrigger}
          title={content.moderation.deletePost}
          description={content.moderation.deletePostConfirm}
          confirmLabel={content.moderation.deletePost}
          destructive
          onConfirm={onDelete}
        />
        <BanUserDialog trigger={banTrigger} userId={authorId} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 12.3: Smoke**

```bash
pnpm tsc --noEmit
```

Ожидание: чисто. Не должно быть импорта из `@/components/ui/dialog` — такого файла НЕТ.

Если в браузере dropdown закрывается раньше, чем открывается dialog (известный Radix-кейс с trigger-asChild внутри MenuItem) — вариант фикса: рядом с dropdown'ом держи sibling `<ConfirmDialog trigger={<button hidden ref={delRef} />} ... />` + в `DropdownMenuItem.onSelect` вызывай `delRef.current?.click()`. Для V1 попробуй inline-вариант первым.

- [ ] **Step 12.4: Коммит**

```bash
git add src/components/moderation/PostAdminMenu.tsx src/components/moderation/BanUserDialog.tsx
git commit -m "feat(plan-5b): PostAdminMenu + BanUserDialog (admin actions on post)"
```

---

## Task 13: Подключить комменты + admin-меню на `/p/[slug]` + расширить queries фильтрами

**Files:**
- Modify: `src/server/feed.ts` (PUBLISHED_PUBLIC += isNull(hiddenByAdminAt))
- Modify: `src/app/sitemap.ts` (sitemap += isNull(hiddenByAdminAt))
- Modify: `src/app/(public)/p/[slug]/page.tsx` — `loadPost` ВЫБИРАЕТ `hiddenByAdminAt` + render-логика: skip `notFound` для админа, иначе hidden/deleted → 404; +`<CommentThread />`, +`<PostAdminMenu />` если admin
- Modify: `src/lib/auth/guard.ts` (`requireOwnPost` += isNull(hiddenByAdminAt))

**ВАЖНО:** в проекте **нет** экспортированного `getPostBySlug` — `/p/[slug]/page.tsx` использует приватный `loadPost(slug)` (см. [src/app/(public)/p/[slug]/page.tsx:14](src/app/(public)/p/[slug]/page.tsx#L14)). Не пытайся импортировать `getPostBySlug` из `@/server/posts` — его не существует. Меняй `loadPost` локально внутри page.tsx.

**Соглашение по UX (sync со spec §3.3 «delete → 404»):**
- Раньше page показывал «Пост удалён.» для `deletedAt != null` (TODO(plan-06) → 410 status). После plan-5b `deletedAt` ставит и author-self-delete, и `adminDeletePost` — отличить нельзя без `deletedBy` (которого мы не вводим, spec §2 row 15). Поэтому **унифицируем**: любой `deletedAt != null` → `notFound()` (404). Существующий JSX «Пост удалён» удаляем. У автора пост пропадает из `/drafts` (там уже `isNull(deletedAt)`) — это симметрично, автор увидит «пост пропал», что справедливо и для self-delete, и для admin-delete.
- `hiddenByAdminAt != null` → 404 для всех **кроме админа**. Админ должен видеть скрытый пост, чтобы нажать «Показать»/«Удалить» через `PostAdminMenu`.

- [ ] **Step 13.1: Расширить `PUBLISHED_PUBLIC` в `src/server/feed.ts`**

Открой `src/server/feed.ts`, найди константу:

```ts
const PUBLISHED_PUBLIC = and(eq(posts.status, "published"), isNull(posts.deletedAt));
```

Замени на:

```ts
const PUBLISHED_PUBLIC = and(
  eq(posts.status, "published"),
  isNull(posts.deletedAt),
  isNull(posts.hiddenByAdminAt),
);
```

- [ ] **Step 13.2: Расширить `sitemap.ts` фильтром hidden**

Открой [src/app/sitemap.ts](src/app/sitemap.ts). Два места:

(a) `publishedPosts` (строки 17-20):
```ts
const publishedPosts = await db
  .select({ slug: posts.slug, updatedAt: posts.updatedAt })
  .from(posts)
  .where(and(
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
    isNull(posts.hiddenByAdminAt),         // ← NEW
  ));
```

(b) `usersWithPosts` (innerJoin posts):
```ts
.innerJoin(
  posts,
  and(
    eq(posts.authorId, users.id),
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
    isNull(posts.hiddenByAdminAt),         // ← NEW
  ),
)
```

(Skip-from-sitemap для скрытых — spec §5 «Что НЕ меняется» подразумевает это; иначе Google проиндексирует 404.)

- [ ] **Step 13.3: Расширить `requireOwnPost` в `src/lib/auth/guard.ts`**

```ts
.where(and(
  eq(posts.id, postId),
  eq(posts.authorId, session.user.id),
  isNull(posts.deletedAt),
  isNull(posts.hiddenByAdminAt),         // ← NEW: автор не может править скрытый пост
))
```

(Если в `guard.ts` нет такой where — оставь как есть; цель — чтобы edit-роуты возвращали 404 на скрытом.)

- [ ] **Step 13.4: Подключить компоненты + переработать `loadPost` на post page**

Открой [src/app/(public)/p/[slug]/page.tsx](src/app/(public)/p/[slug]/page.tsx). Сейчас (line 14-33) `loadPost` НЕ выбирает `hiddenByAdminAt`. Меняем:

```ts
// добавь hiddenByAdminAt в select
async function loadPost(slug: string) {
  const rows = await getDb()
    .select({
      id: posts.id,
      authorId: posts.authorId,
      title: posts.title,
      slug: posts.slug,
      contentHtml: posts.contentHtml,
      coverUrl: posts.coverUrl,
      status: posts.status,
      pubAt: posts.pubAt,
      deletedAt: posts.deletedAt,
      hiddenByAdminAt: posts.hiddenByAdminAt,        // ← NEW
      authorUsername: users.username,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}
```

В рендере `PostPage` (line 60-103) — поменять логику:

```tsx
import { CommentThread } from "@/components/comments/CommentThread";
import { PostAdminMenu } from "@/components/moderation/PostAdminMenu";
// auth уже импортирован

export default async function PostPage({
  params, searchParams,
}: { params: Promise<Params>; searchParams: Promise<{ cpage?: string }> }) {
  const { slug } = await params;
  const { cpage } = await searchParams;
  const post = await loadPost(slug);
  if (!post) notFound();

  const session = await auth();
  const isOwner = session?.user?.id === post.authorId;
  const isAdmin = session?.user?.role === "admin";

  // unified delete → 404 (раньше был JSX "Пост удалён"); см. UX-соглашение в шапке Task 13.
  if (post.deletedAt) notFound();

  // Скрытый пост видит только админ; гость/автор/чужой — 404.
  if (post.hiddenByAdminAt && !isAdmin) notFound();

  if (post.status === "draft") notFound();
  if (post.status === "archived" && !isOwner) notFound();

  const html = post.contentHtml ?? "";
  const postTagsList = await loadTags(post.id);

  return (
    <article>
      <PostHero
        title={post.title}
        coverUrl={post.coverUrl}
        authorUsername={post.authorUsername}
        pubAt={post.pubAt}
      />
      {post.status === "archived" && (
        <p className="max-w-[680px] mx-auto px-4 mt-4 text-sm text-muted-foreground italic">
          (Пост в архиве — виден только тебе.)
        </p>
      )}
      {isAdmin && (
        <div className="max-w-[680px] mx-auto px-4 mt-4 flex justify-end">
          <PostAdminMenu
            postId={post.id}
            authorId={post.authorId}
            isHidden={post.hiddenByAdminAt != null}
          />
        </div>
      )}
      <PostBody html={html} />
      <PostTags tags={postTagsList} />
      <div className="max-w-[680px] mx-auto px-4">
        <CommentThread
          postId={post.id}
          postSlug={post.slug}
          page={Number(cpage ?? "1") || 1}
        />
      </div>
    </article>
  );
}
```

Также в `generateMetadata` (если есть строка `if (post.deletedAt) return {};`) добавь рядом `if (post.hiddenByAdminAt) return {};` — чтобы скрытый/удалённый не отдавал OG.

- [ ] **Step 13.5: Smoke + manual**

```bash
pnpm tsc --noEmit
pnpm dev
```

Открой `/p/<slug>` любого опубликованного поста — внизу должен появиться раздел «Обсуждение» с empty-state. Залогинься — появится форма. Залогинься админом — справа над PostBody должен появиться `MoreHorizontal` dropdown. Проверь, что soft-deleted пост (`deletedAt = now()` в db:studio) теперь даёт 404 (а не JSX «Пост удалён»). Hidden-пост (`hiddenByAdminAt = now()`) — 404 для гостя/автора, виден админу.

- [ ] **Step 13.6: Коммит**

```bash
git add src/server/feed.ts src/app/sitemap.ts src/lib/auth/guard.ts 'src/app/(public)/p/[slug]/page.tsx'
git commit -m "feat(plan-5b): wire CommentThread + PostAdminMenu into /p/[slug]; hidden/deleted filter in queries+sitemap"
```

---

## Task 14: `WriteButton` (3 variant) + интеграция в LeftNav/BottomNav/UserProfileHeader

**Files:**
- Create: `src/components/post/WriteButton.tsx`
- Modify: `src/components/layout/LeftNav.tsx` (+ WriteButton сверху, для залогиненных)
- Modify: `src/components/layout/BottomNav.tsx` (+ WriteButton variant=fab)
- Modify: `src/components/profile/UserProfileHeader.tsx` (+ WriteButton variant=cta для своего профиля)

Spec §6.2: один компонент, три формы (nav/fab/cta). Гость → `/login?from=/drafts/new`.

- [ ] **Step 14.1: `WriteButton.tsx`**

```tsx
// src/components/post/WriteButton.tsx
import Link from "next/link";
import { PenSquare } from "lucide-react";
import { content } from "@theme/content";

export type WriteButtonVariant = "nav" | "fab" | "cta";

interface Props {
  variant: WriteButtonVariant;
  isAuthed: boolean;
  className?: string;
}

export function WriteButton({ variant, isAuthed, className = "" }: Props) {
  const href = isAuthed ? "/drafts/new" : "/login?from=/drafts/new";

  if (variant === "nav") {
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity ${className}`}
      >
        <PenSquare className="h-4 w-4" />
        {content.write.label}
      </Link>
    );
  }

  if (variant === "fab") {
    return (
      <Link
        href={href}
        aria-label={content.write.cta}
        className={`flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity ${className}`}
      >
        <PenSquare className="h-6 w-6" />
      </Link>
    );
  }

  // cta
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity ${className}`}
    >
      <PenSquare className="h-4 w-4" />
      {content.write.cta}
    </Link>
  );
}
```

- [ ] **Step 14.2: Интеграция в `LeftNav`**

`LeftNav` сейчас принимает `profileHref`. Расширим props — `isAuthed: boolean`. Тогда выше списка `items.map(...)` отрендерим `<WriteButton variant="nav" isAuthed />` только для залогиненных.

Файл `src/components/layout/LeftNav.tsx`. Меняем interface:

```ts
interface LeftNavProps {
  profileHref: Route;
  isAuthed: boolean;                                  // ← NEW
  className?: string;
}
```

В JSX **перед** `{items.map(...)}` вставь:

```tsx
{isAuthed && (
  <>
    <WriteButton variant="nav" isAuthed className="mb-2" />
    <div className="h-px bg-border my-1" />
  </>
)}
```

Импорт сверху: `import { WriteButton } from "@/components/post/WriteButton";`.

- [ ] **Step 14.3: Интеграция в `BottomNav`**

Файл `src/components/layout/BottomNav.tsx`. Меняем props:

```ts
interface BottomNavProps {
  profileHref: Route;
  isAuthed: boolean;                                  // ← NEW
  className?: string;
}
```

После `<nav>...</nav>` (или внутри родителя BottomNav в FeedShell — там, где удобнее) разрешим plain JSX-fragment, чтобы вынести FAB как **отдельный** элемент над навбаром:

```tsx
return (
  <>
    <nav className={...}>
      {/* существующие 4 link'а */}
    </nav>
    {isAuthed && (
      <WriteButton
        variant="fab"
        isAuthed
        className="fixed bottom-20 right-4 z-40"
      />
    )}
  </>
);
```

(`bottom-20` = `5rem` = чуть выше навбара. Подгони если нужно.)

- [ ] **Step 14.4: Передать `isAuthed` через `FeedShell`**

Открой `src/components/layout/FeedShell.tsx`. Уже есть `const session = await auth();`. Передай в оба нав-компонента:

```tsx
const isAuthed = !!session?.user;
// ...
<LeftNav profileHref={profileHref} isAuthed={isAuthed} className="..." />
// ...
<BottomNav profileHref={profileHref} isAuthed={isAuthed} className="..." />
```

- [ ] **Step 14.5: Интеграция в `UserProfileHeader`** (2-file change: компонент + caller)

Сейчас [src/components/profile/UserProfileHeader.tsx](src/components/profile/UserProfileHeader.tsx) — **sync** server-компонент, props: `{ username, name, image, bio, postsCount, registeredAt, topTags }`. **Нет** ни `userId`, ни `viewerId`/`isOwner`. Нужно добавить `isOwner: boolean` пропом (определять снаружи, через caller) — это держит компонент чистым (без auth-импорта внутри) и тривиально тестируется.

(a) В `src/components/profile/UserProfileHeader.tsx` расширь interface и JSX:

```tsx
import Image from "next/image";
import { UserStatsRow } from "./UserStatsRow";
import { WriteButton } from "@/components/post/WriteButton";

interface UserProfileHeaderProps {
  username: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  postsCount: number;
  registeredAt: Date;
  topTags: { slug: string; name: string }[];
  isOwner: boolean;                                  // ← NEW
}

export function UserProfileHeader(props: UserProfileHeaderProps) {
  const { username, name, image, bio, postsCount, registeredAt, topTags, isOwner } = props;
  const displayName = name ?? username;

  return (
    <header className="flex items-start gap-4 mb-6 pb-4 border-b border-border">
      {image ? (
        <Image src={image} alt="" width={72} height={72} className="rounded-full shrink-0" />
      ) : (
        <div className="w-[72px] h-[72px] rounded-full bg-muted shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold leading-tight">{displayName}</h1>
        <p className="text-sm text-muted-foreground">@{username}</p>
        {bio && <p className="text-sm mt-2 leading-relaxed">{bio}</p>}
        <UserStatsRow postsCount={postsCount} registeredAt={registeredAt} topTags={topTags} />
        {isOwner && (
          <div className="mt-4">
            <WriteButton variant="cta" isAuthed />
          </div>
        )}
      </div>
    </header>
  );
}
```

(b) Найди caller — `src/app/(public)/(feed)/u/[username]/page.tsx` (или похожий — определяется по `Header` rendering). Сейчас caller **НЕ зовёт** `auth()` — добавь импорт `import { auth } from "@/lib/auth";` и `const session = await auth();` в начале функции. Затем прокинь `isOwner`:

```tsx
const isOwner = session?.user?.id === user.id;   // user.id — id юзера-владельца профиля
// ...
<UserProfileHeader
  username={user.username}
  name={user.name}
  image={user.image}
  bio={user.bio}
  postsCount={...}
  registeredAt={user.createdAt}
  topTags={...}
  isOwner={isOwner}                              // ← NEW
/>
```

Если на странице **нет** ни `session`, ни доступа к id юзера-владельца — добавь оба (читай через `getDb()`/`auth()` — стандартный паттерн plan-5a).

(c) Если в тестах рендерится `<UserProfileHeader />` — добавь `isOwner={false}` в существующие вызовы:

```bash
rg "UserProfileHeader" tests/
```

Прогон: `pnpm test tests/<path>` для каждого затронутого файла.

- [ ] **Step 14.6: Обнови существующий тест `LeftNav`**

Файл `tests/feed/left-nav.test.tsx` сейчас рендерит `<LeftNav profileHref=... />`. После Task 14.2 нужен `isAuthed` пропом. Добавь во все 4 случая `isAuthed={true}` (или `false` — выбери, что соответствует тесту). Прогон:

```bash
pnpm test tests/feed/left-nav.test.tsx
```

Ожидание: всё ещё 4/4 зелёные.

- [ ] **Step 14.7: Smoke + manual**

```bash
pnpm tsc --noEmit
pnpm dev
```

- Анонимный браузер на `/`: LeftNav БЕЗ кнопки «Написать», BottomNav без FAB.
- Залогиненный: LeftNav «Написать» сверху primary-цветом; на мобиле — FAB справа над навбаром.
- На своём `/u/<username>` (залогиненный): рядом с био — кнопка «Написать пост».

- [ ] **Step 14.8: Коммит**

```bash
git add src/components/post/WriteButton.tsx \
        src/components/layout/LeftNav.tsx src/components/layout/BottomNav.tsx \
        src/components/layout/FeedShell.tsx \
        src/components/profile/UserProfileHeader.tsx \
        'src/app/(public)/u/[username]/page.tsx' \
        tests/feed/left-nav.test.tsx
git commit -m "feat(plan-5b): WriteButton (nav/fab/cta) + integrate into LeftNav/BottomNav/UserProfileHeader"
```

(Если `UserProfileHeader` рендерится из другого файла — подмени путь caller'а.)

---

## Task 15: `/banned` страница + переключение guard + удаление `/api/auth/ban-kill`

**Files:**
- Modify: `src/types/next-auth.d.ts` (+`banReason` в User & Session)
- Modify: `src/lib/auth/config.edge.ts` (+`banReason` в session callback)
- Create: `src/app/banned/page.tsx`
- Modify: `src/lib/auth/guard.ts` (`/api/auth/ban-kill` → `/banned`)
- Delete: `src/app/api/auth/ban-kill/` (целиком)

Spec §5: `/banned` ВНЕ всех route-group (нет sidebar). Перед удалением route — обязательный grep-аудит.

- [ ] **Step 15.1: Pre-delete audit**

```bash
rg "ban-kill|ban_kill|banKill" src/
```

Ожидание: ровно одна строка — [src/lib/auth/guard.ts:13](src/lib/auth/guard.ts#L13). Если есть другие caller'ы — STOP, оцени, перенеси их на `/banned` в этом же task'е.

- [ ] **Step 15.2: Прокинуть `banReason` в типы сессии + callback**

(a) Открой [src/types/next-auth.d.ts](src/types/next-auth.d.ts). Сейчас `User` имеет `bannedAt` но не `banReason`, и `Session.user` не имеет `banReason`. Дополни:

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    username?: string | null;
    role?: "user" | "moderator" | "admin";
    bannedAt?: Date | null;
    banReason?: string | null;                     // ← NEW
    bio?: string | null;
  }

  interface Session {
    user: {
      id: string;
      username: string | null;
      role: "user" | "moderator" | "admin";
      bannedAt: Date | null;
      banReason: string | null;                    // ← NEW
    } & DefaultSession["user"];
  }
}
```

(b) Открой [src/lib/auth/config.edge.ts](src/lib/auth/config.edge.ts). В callback `session({ session, user })` — добавь одну строку:

```ts
session({ session, user }) {
  session.user.id = user.id;
  session.user.username = user.username ?? null;
  session.user.role = user.role ?? "user";
  session.user.bannedAt = user.bannedAt ?? null;
  session.user.banReason = user.banReason ?? null;   // ← NEW
  return session;
},
```

**Без этого шага `session.user.banReason` будет `undefined`** на странице `/banned`, и юзер увидит «Причина не указана» даже когда она есть в БД.

- [ ] **Step 15.3: `src/app/banned/page.tsx`**

```tsx
// src/app/banned/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { content } from "@theme/content";

export const metadata = { title: "Доступ ограничен" };

export default async function BannedPage() {
  const session = await auth();
  // Не забанен — нечего тут делать.
  if (!session?.user?.bannedAt) redirect("/");

  return (
    <main className="container mx-auto max-w-md py-16 px-4 flex flex-col items-center text-center">
      <h1 className="text-2xl font-semibold mb-4">{content.banned.heading}</h1>
      <div className="rounded-lg border border-border bg-card p-6 w-full mb-6">
        <p className="text-sm text-muted-foreground mb-2">{content.banned.reasonLabel}</p>
        <p className="text-base">{session.user.banReason ?? content.banned.noReason}</p>
      </div>
      <form action="/api/auth/signout" method="POST">
        <Button type="submit" variant="outline">{content.banned.logout}</Button>
      </form>
    </main>
  );
}
```

**Не импортируй** `signOut from "next-auth/react"` — это клиентский хук, в server-component не работает; form-action на `/api/auth/signout` уже делает то же самое. Никаких других импортов из next-auth/react не нужно.

- [ ] **Step 15.4: Переключить guard**

Открой [src/lib/auth/guard.ts](src/lib/auth/guard.ts). На строке 13:

```ts
// было:  if (session.user.bannedAt) redirect("/api/auth/ban-kill");
if (session.user.bannedAt) redirect("/banned");
```

- [ ] **Step 15.5: Удалить ban-kill route**

```bash
rm -rf src/app/api/auth/ban-kill
```

- [ ] **Step 15.6: Smoke + manual**

```bash
pnpm tsc --noEmit
pnpm test                                  # никаких регрессий
pnpm dev
```

Manual: ставь в `db:studio` своему юзеру `bannedAt = now()` и `banReason = "тест"`. Залогинься. Должно редиректнуть на `/banned`, показать причину «тест», кнопка «Выйти» работает. Сними бан (NULL обе колонки) — нормальный доступ.

- [ ] **Step 15.7: Коммит**

```bash
git add src/types/next-auth.d.ts src/lib/auth/config.edge.ts \
        src/app/banned/page.tsx src/lib/auth/guard.ts
git rm -r src/app/api/auth/ban-kill
git commit -m "feat(plan-5b): /banned page (with reason); migrate guard from ban-kill route"
```

---

## Task 16: Метка «скрыт администратором» в `/drafts`

**Files:**
- Modify: `src/app/(app)/(feed)/drafts/page.tsx` (или компонент DraftsList — посмотри plan-04)
- Modify: `src/components/posts/DraftsList.tsx` (или аналог)

Spec §1.4: автор видит свой скрытый пост в /drafts с плашкой «скрыт администратором».

- [ ] **Step 16.1: Доработать query на /drafts**

Открой `src/app/(app)/(feed)/drafts/page.tsx`. Найди SELECT по своим постам. Сейчас он, вероятно, фильтрует `isNull(deletedAt)` — оставь. Колонку `hiddenByAdminAt` НЕ фильтруй (автор должен видеть). В возвращаемых полях добавь `hiddenByAdminAt`.

- [ ] **Step 16.2: Метка на карточке черновика**

В компоненте, который рендерит карточку (DraftsList / PostCardInDrafts / inline в page.tsx — зависит от структуры):

```tsx
{post.hiddenByAdminAt && (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive">
    {content.moderation.hiddenByAdmin}
  </span>
)}
```

Помести рядом с status-badge или title.

- [ ] **Step 16.3: Smoke + manual**

```bash
pnpm tsc --noEmit
pnpm dev
```

Manual: в db:studio выставь у одного своего опубликованного поста `hidden_by_admin_at = now()`. Зайди в `/drafts` — на карточке должна быть плашка. Публично пост уже 404.

- [ ] **Step 16.4: Коммит**

```bash
git add src/app/\(app\)/\(feed\)/drafts/page.tsx src/components/posts/DraftsList.tsx
git commit -m "feat(plan-5b): hidden-by-admin badge on /drafts cards"
```

---

## Task 17: README + DoD-чеклист + ручное e2e + retro

**Files:**
- Modify: `README.md` (короткая заметка про комменты, write-button, /banned)
- Modify: текущий план-файл (заполнить retro в конце)

- [ ] **Step 17.1: README**

В разделе «Discovery» (был добавлен в plan-5a) после описания feed/tags добавь подсекцию:

```md
### Engagement (plan-5b)

- `/p/[slug]` имеет раздел «Обсуждение» под телом поста: плоские комменты, plain text + автолинки, лимит 2000 символов, edit-окно 15 минут после публикации, soft-delete своих с плашкой.
- Кнопка «Написать» доступна из LeftNav (desktop), FAB в правом нижнем углу (mobile), на своём профиле `/u/<username>`.
- Админ (роль `users.role = 'admin'`, выставляется руками через `pnpm db:studio`) имеет dropdown «...» на post page для скрытия/удаления чужого поста и бана автора (с обязательной причиной). Под чужими комментами — кнопки удаления/восстановления.
- Забаненный юзер попадает на `/banned` с причиной + кнопкой выхода.
- Rate-limit: 20 комментов/час (gap 10с), 5 постов/час (gap 30с). Админу — bypass.
```

- [ ] **Step 17.2: Полный прогон тестов и проверок**

```bash
pnpm test
pnpm tsc --noEmit
pnpm lint
NODE_ENV=production pnpm build
```

Все четыре — зелёные. Прогон тестов: baseline + 19 новых (schema 2, rate-limit 3, render-text 4, queries 4, actions 3, moderation 3). Если меньше — найди какие из новых не созданы / не прошли. Baseline до plan-5b считай командой `rg "^\s*it\(|^\s*test\(" tests/ src/ --include='*.ts' --include='*.tsx' | wc -l` ДО начала плана и запиши число в retro.

- [ ] **Step 17.3: Manual e2e (DoD §8 ниже)**

Пройди весь чеклист DoD ниже руками в браузере (Chrome + DevTools mobile-эмуляция iPhone 13). Зафиксируй проблемы — если есть, фикси отдельным коммитом.

- [ ] **Step 17.4: Retro**

Заполни **в этом файле** раздел «Retro» в самом конце: что прошло как написано, что отклонилось, какие сюрпризы, что пометить TODO для plan-06 / phase 2.

- [ ] **Step 17.5: Финальный коммит**

```bash
git add README.md docs/superpowers/plans/2026-06-21-plan-05b-engagement.md
git commit -m "docs(plan-5b): README engagement section + retro"
```

---

## DoD checklist (manual e2e)

Автоматическая часть DoD:

- [x] Миграция 0003 применена локально (`pnpm db:migrate`) — таблица `comments` + новые колонки `users.banReason`, `posts.hiddenByAdminAt`, `posts.hiddenByAdminId` создаются. (Schema-tests `tests/comments/schema.test.ts` подтверждают.)
- [x] `pnpm test` зелёный — **197/197** (baseline 178 ≈ 166 base + 12 утечки plan-5a фиксов; добавлено ровно +19 новых: schema 2, rate-limit 3, render-text 4, queries 4, actions 3, moderation 3).
- [x] `pnpm tsc --noEmit` чисто.
- [x] `NODE_ENV=production pnpm build` зелёный (с пустыми R2-env). Все маршруты собрались: `/banned`, `/drafts`, `/p/[slug]`, `/u/[username]` — fingerprints в логе build'а.
- [x] `/api/auth/ban-kill` route удалён (см. коммит `10e6b5a`); в коде не осталось caller'ов (`rg ban-kill src/` пусто).

Ручная часть (требует браузера + админ-роль в db:studio) — оставлено пользователю для приёмки:

- [ ] LeftNav (desktop): для залогиненных «Написать» выделена сверху primary-цветом; для гостя — нет.
- [ ] BottomNav (mobile, ≤lg): FAB-кнопка «Написать» справа над навбаром для залогиненных, нет для гостя.
- [ ] `/u/<свой-username>` (залогиненный своим аккаунтом): кнопка «Написать пост» рядом с био; на чужом — нет.
- [ ] `/p/<slug>` гостем: внизу раздел «Обсуждение», ссылка «Войдите, чтобы оставить комментарий»; формы нет.
- [ ] `/p/<slug>` залогиненным: textarea с счётчиком символов, кнопка «Отправить». Создание коммента → коммент появляется без F5, якорь `#comment-<id>` ведёт на него.
- [ ] Edit-окно: только что созданный коммент — есть кнопка «Изменить»; коммент с createdAt > 15 минут назад (выстави в db:studio) — кнопка пропала.
- [ ] Soft delete своего коммента: плашка «Комментарий удалён автором», текст не показывается, кнопок нет.
- [ ] Rate-limit: 2 коммента подряд (<10с) → второй даёт ошибку в форме с числом секунд.
- [ ] Админ (поставь `role='admin'` в db:studio): на post page справа сверху — `MoreHorizontal` dropdown с пунктами «Скрыть пост / Удалить пост / Заблокировать автора». Скрытие → публично 404, у автора в `/drafts` плашка «Скрыт администратором». Delete → публично 404, у автора пост пропал из /drafts.
- [ ] Админ под чужим комментом видит «Удалить»; под удалённым чужим — «Восстановить».
- [ ] Бан юзера: textarea причины обязательна (≥5 символов). После бана — `/u/<его username>` 404, его комменты в треде остаются с плашкой «автор заблокирован» (ник без ссылки).
- [ ] Забаненный юзер: при попытке зайти на любую auth-страницу попадает на `/banned`, видит причину, кнопка «Выйти» работает.
- [ ] `curl -I http://localhost:3000/api/auth/ban-kill` → 404.
- [ ] Тесты на mobile (DevTools iPhone 13, Pixel 7): FAB не перекрывает контент, форма коммента helpful (autoresize textarea), dropdown'ы открываются без сдвига header'а (Radix `modal={false}` уже зашит).

> `pnpm lint` сейчас интерактивный (Next 15 deprecated `next lint` без созданного eslint.config) — это унаследованная пустота, не вводилась plan-5b. Миграция на ESLint CLI — отдельная chore-задача (см. ниже Markers).

---

## Retro

**Что прошло как написано:**
- TDD-разбивка по 6 файлам тестов сработала ровно как описано: +19 unit-тестов, ни одного flaky после фикса username collision (см. ниже).
- Бите-сайз гранулярность steps (1 step = 1 действие) — оставалось маленькое окно для дрейфа; все 17 task'ов сложились в одну сессию без переплана.
- Маркер `TODO(phase-2): threading` в `src/server/comments.ts` поставлен в Task 6, заметка осталась читаемой даже после расширения query.
- Spec-плана-кода чейн оказался плотным: в архитектурных решениях (`hiddenByAdminAt` vs status, ban-kill → /banned, 15-min edit window) ни одного пересмотра.

**Что отклонилось от плана:**
- **Task 13 — discoverability soft-deleted поста:** план предполагал в page-tsx разметку «пост удалён» (как было в plan-04); по факту перешёл на унифицированный 404 для всех (deleted = автором OR админом). Это потребовало правки 1 теста в `tests/posts/p-slug-route.test.ts` (`"deleted markup"` → `"notFound"`). Соответственно поправил README (видимость пункта soft-deleted).
- **Task 14 — отсутствующий API ConfirmDialog:** план приводил пример с `open`/`onOpenChange`-управляемым диалогом; реальный API trigger-driven. Реализовал через `<DropdownMenuItem onSelect={(e) => e.preventDefault()}>` внутри `<ConfirmDialog trigger={...}>`.
- **Task 12 — отсутствует shadcn `dialog.tsx`:** `BanUserDialog` поэтому использует `@radix-ui/react-dialog` напрямую (с теми же a11y-гарантиями), а не shadcn-обёртку.
- **Task 16 — `/drafts` query:** план не учёл, что текущий /drafts фильтрует по `status = 'draft' | 'archived'`, а hidden published-пост остаётся published. Расширил drafts-таб условием `OR isNotNull(hiddenByAdminAt)`, чтобы автор видел скрытое (как требует spec §1.4).
- **Task 14.5 — UserProfileHeader:** в имплементации добавил `auth()` рядом с `Promise.all` для вычисления `isOwner` — план описывал только пропс, не источник значения.
- **Task 14 — гость и WriteButton (отклонение от spec §1, §6 row 6):** spec требует, чтобы гость видел кнопку «Написать» и нажатие вело на `/login?callbackUrl=/new`, после логина — возврат на `/new`. По факту цепочка callbackUrl не работает: `/login` page не читает `searchParams.callbackUrl`, `ProviderButtons` хардкодит `signIn(..., { callbackUrl: "/" })`, VK-стартер тоже игнорирует callback. Реализовали минимум: кнопка показывается **только** залогиненным (в LeftNav/BottomNav обёрнуто в `{isAuthed && …}`), у `WriteButton` `href = "/new"` без вариантов. Гость-flow со spec — отложен до полной прокидки callbackUrl (LoginPage + ProviderButtons + VK-старт).
- **Chore-коммит для drizzle journal/snapshot 0003:** отдельный `chore(db): commit drizzle journal+snapshot for migration 0003` — журнал миграций не попал в коммит Task 3 в предыдущей сессии (находка при `git status` перед коммитом Task 14).

**Сюрпризы / undocumented gotcha'и:**
- `tests/comments/comments-queries.test.ts` оказался flaky на повторных isolated-запусках: `newId()` (ULID) даёт одинаковый префикс в пределах ~30 минут → `username: qa${id.slice(0, 6)}` коллизит с прошлой записью если cleanup не отработал. Фикс: `slice(-8)` (хвост = случайная часть ULID).
- `pnpm lint` в Next 15 теперь интерактивен и упирается в пустой eslint config; не блокировало plan-5b, но DoD-чекбокс `pnpm lint чисто` пришлось переименовать в маркер «миграция на ESLint CLI — отдельный chore».
- `DATABASE_URL` не подцепляется автоматически из `.env` при запуске `pnpm test` — для интеграционных тестов нужен префикс `DATABASE_URL=... pnpm test`. Унаследовано от plan-04 setup, не блокировало.
- IDE diagnostics-хук показывает stale TypeScript-errors сразу после `Edit` (даже когда `pnpm tsc --noEmit` уже чист) — пришлось перепроверять командой каждый «ошибочный» сигнал из хука.

**Маркеры на phase-2 / plan-06:**
- **ESLint CLI migration** — `next lint` deprecated в Next 16; нужна разовая chore-задача: `npx @next/codemod@canary next-lint-to-eslint-cli .`, добавить `eslint.config.mjs`, обновить `package.json` scripts.
- **Persistent rate-limit** (Redis/Postgres) — маркер уже стоит в `src/lib/rate-limit.ts`; станет blocking при горизонтальном scale-out.
- **Threading комментов** — `comments.parent_id` колонка уже есть; в Task 6 стоит маркер `TODO(phase-2): threading`.
- **Reporting (жалобы юзеров)** — не реализовано в фазе 1 сознательно; добавить `reports`-таблицу + UI «пожаловаться» под комментом и постом.
- **`mod_actions` audit-лог** — для одного админа избыточно; станет нужным при появлении модераторской команды.
- **HTTP-статус для деленых постов:** сейчас 404; spec §8.6 канона предполагает 410 «Gone» для soft-deleted — отложено в plan-06.
- **Pre-existing flaky tests cleanup:** проверить остальные интеграционные тесты на тот же ULID-prefix паттерн (`slice(0, N)` для derived-уникальностей).
- **WriteButton для гостя + callbackUrl flow:** spec §1 + §6 row 6 — гость видит кнопку, нажатие ведёт на `/login?callbackUrl=/new`, после логина возвращает на `/new`. Требует: (а) LoginPage читает `searchParams.callbackUrl`, прокидывает в `ProviderButtons`; (б) `ProviderButtons` использует переданный callbackUrl в `signIn(...)` и в href VK-кнопок (`/api/oauth/vk/start?provider=...&callbackUrl=...`); (в) `/api/oauth/vk/start` route учитывает `callbackUrl` и сохраняет его в state/cookie до возврата с OAuth; (г) в LeftNav/BottomNav убрать `{isAuthed && …}` обёртку вокруг WriteButton и вернуть гость-вариант с правильным href.

---

## Post-plan правки (приёмка 2026-06-22)

Ручная приёмка вскрыла три gap'а в spec'е, которые имплементация унаследовала буквально. Все три закрыты до коммита plan-5b в master, без отдельного плана — простые follow-up'ы.

**1. Скрытый админом пост: автор получал 404 из своего же /drafts.**
Spec §1.4 описывал бейдж «Скрыт администратором» в `/drafts`, но не уточнял, что происходит при клике. Реальный edit-guard `requireOwnPost` фильтрует по `hiddenByAdminAt IS NULL` → `/edit/[id]` тоже 404. Автору некуда было нажать.
- `loadPost` в `/p/[slug]` теперь джойнит `users` по `hiddenByAdminId` (alias `hidden_by_user`), отдаёт `hiddenByAdminUsername`.
- Visibility: `if (post.hiddenByAdminAt && !isAdmin && !isOwner) notFound();` — автор и админ открывают, гость по-прежнему 404.
- Плашка над `<PostBody>`: автору — «Этот пост скрыт администратором. Он недоступен публично.», админу — «Скрыт администратором @{username}.» (или fallback «Скрыт администратором.» если кто-то снёс хайдера).
- `DraftsList`: для `hiddenByAdminAt != null` ссылка ведёт на `/p/[slug]`, не на `/edit/[id]`.
- Новые content-ключи: `moderation.hiddenBannerOwner`, `moderation.hiddenBannerAdmin(username)`, `moderation.hiddenBannerAdminUnknown`.

**2. Админ не мог разбанить юзера из UI.**
PostAdminMenu умеет банить, но разбан был только через `db:studio` — `getUserByUsername` отдаёт юзера, а page-guard в `/u/[username]` делал `notFound()` для всех при `bannedAt != null`. То есть админ не мог даже зайти на профиль забаненного.
- `/u/[username]` теперь: `if (user.bannedAt && !isAdmin) notFound();` — забаненный публично всё ещё 404, админу доступен.
- Новый компонент `src/components/moderation/UserAdminMenu.tsx`: трёхточечный dropdown в `UserProfileHeader`, виден только админу на чужом профиле (`isAdmin && !isOwner`). В состоянии «не забанен» — пункт «Заблокировать автора» через `BanUserDialog`; в состоянии «забанен» — «Разблокировать» через `ConfirmDialog` → `adminUnbanUser` (сервер-экшен уже был с plan-5b Task 8).
- `UserProfileHeader` теперь принимает `userId`, `isAdmin`, `isBanned`. Для забаненного юзера показывает inline-бейдж «Заблокирован» рядом с username.
- Новые content-ключи: `moderation.userMenuLabel`, `moderation.unbanUserConfirm`.

**3. /banned: добавлена контактная строка.**
Spec §1 описывал «причина + кнопка выйти», но реальная польза без contact'а нулевая (юзер не знает, куда писать, чтобы оспорить). Добавлено в [`src/app/banned/page.tsx`](../../../src/app/banned/page.tsx): `<p>{content.banned.contact}</p>` (текст: «Для подробной информации напишите: test@mail.ru») между причиной и кнопкой Logout. Адрес в content.ts → меняется без правок page-кода.

**Что это значит для phase-2 spec'ов:** в spec-документах модерации впредь явно расписывать, какие role-комбинации видят что и куда ведут ссылки (а не «бейдж "скрыт"» в вакууме). Author-flow и admin-flow часто противоречат друг другу по умолчанию (404 для всех vs доступ для админа) — это нужно проектировать, а не наследовать из общих guard'ов.
