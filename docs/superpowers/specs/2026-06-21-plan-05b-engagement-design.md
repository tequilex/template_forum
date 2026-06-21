# Plan 5b (Engagement — Write button + Comments + Moderation) — спецификация

**Дата:** 2026-06-21
**Состояние:** brainstorm пройден, дизайн утверждён владельцем
**Канон высшего уровня:** `docs/superpowers/specs/2026-06-05-skelet-blog-design.md` §6 (схема users/posts/tags), §7 (комменты — flat в фазе 1), §11 (модерация), §12.1/§12.2 (что НЕ в фазе 1), §16 (разбивка фаз — plan-05 разделён на 5a/5b)
**Предшественник:** `docs/superpowers/specs/2026-06-20-plan-05a-discovery-design.md` (discovery — feed/tags/profile + 3-col shell)

---

## 1. Цель плана

Закрыть цепочку «читатель решил вступить в обсуждение → автор написал пост → админ модерирует». После plan-5b залогиненный юзер может из любого места UI начать писать пост, оставлять плоские комментарии под публикациями, а админ — удалять чужие комменты, банить юзеров (с причиной), скрывать чужие посты. Это завершает MVP-движок взаимодействия фазы 1.

Что входит:

1. **Кнопка «Написать»** — выделенный пункт в `LeftNav`, floating action button в `BottomNav`, CTA на собственном профиле `/u/me`. Гость → редирект на `/login?callbackUrl=/drafts/new`.
2. **Комментарии** (плоские, без тредов): plain text + автолинки на сервере, лимит 2000 символов, пагинация по 50, якоря `#comment-<id>`, цитата ника при «Ответить».
3. **Edit-окно 15 минут** после публикации, после — кнопка edit пропадает. **Soft delete** своих с плашкой «удалён автором».
4. **Админ** (`users.role = 'admin'`, выставляется руками через `db:studio`, без авто-промоушена; колонка `role` уже существует с plan-02 как PG enum `user|moderator|admin`, V1 использует только `user` и `admin`, `moderator` зарезервирован):
   - удалить любой коммент (soft) / восстановить;
   - забанить юзера (обязательная причина в `users.banReason`) / разбанить;
   - скрыть чужой пост (`posts.hiddenByAdminAt`) / показать;
   - soft-delete чужого поста (`posts.deletedAt = now()`, существующее поле из plan-04) / восстановить.
5. **Страница `/banned`** — забаненный юзер видит причину + кнопка logout. Сессия не убивается (в отличие от текущего поведения), чтобы юзер мог прочитать причину.
6. **Rate-limit in-memory**: комментарии 20/час + gap 10с, посты 5/час + gap 30с, админ без лимитов.
7. **Видимость**: бан-юзер → его комменты остаются с плашкой «автор заблокирован» (текст виден, ник без ссылки); скрытый пост → 404 публично, у автора в `/drafts` помечен.

**Не делаем:**

- Threading вложенных ответов — фаза 2 (миграция `comments.parentId`).
- Likes / реакции — фаза 2 (§12.1).
- Notifications, email-дайджесты, in-app уведомления — фаза 3 (§12.2).
- `mod_actions` audit-лог действий админа — фаза 2+ (для одного админа избыточно).
- Markdown / форматирование в комментах — фаза 2 (V1 plain + автолинки).
- Картинки в комментах — фаза 2+ (потребовало бы интеграции с R2 из plan-03).
- Subscriptions на пост / автора / тэг — фаза 3.
- Поиск по комментам — фаза 2.
- `/admin` страница / отдельная админ-секция — overkill для одного админа, всё через inline-кнопки на post page и под комментами.
- Reporting (репорт от юзера на коммент) — фаза 2+ (для V1 админ сам мониторит).
- Per-user `comments.editedReason` / история редактур — фаза 2+.
- Email верификация при бане — за пределами фазы 1.
- Captcha / антибот — за пределами фазы 1, ставка на OAuth-only авторизацию (plan-02).

---

## 2. Архитектурные решения (зафиксированы в brainstorm)

| # | Решение | Альтернативы рассмотрены | Почему |
|---|---|---|---|
| 1 | **Админ = `users.role` колонка**, выставляется руками через Drizzle Studio | a) первый зарегистрированный авто-промоутится b) ENV-переменная `ADMIN_EMAILS` | a опасно (если первая регистрация — спам-бот) и плохо переносится между средами. b завязывает на деплой-конфиг, ротация сложнее. Ручная установка через `db:studio` — простой и явный контроль. |
| 2 | **Edit-окно собственного коммента** = 15 минут после `createdAt` | a) без ограничений b) 5 минут c) только пока никто не ответил | a → редактирование задним числом ломает контекст обсуждения. c при flat-комментах не работает (нет «ответов на коммент»). 15 минут — стандартный паттерн (правишь опечатки, не переписываешь смысл после реакций). |
| 3 | **Soft delete собственного коммента**, не hard | b) hard delete (полное удаление строки) c) только админ может удалить | b ломает якоря/анкеры в треде (`#comment-<id>` 404), читатели теряют контекст. c слишком жёстко — юзер должен иметь право удалить свой контент. Soft с плашкой сохраняет структуру. `deletedBy = 'self' | 'admin'` отличает UX-плашку. |
| 4 | **Полномочия админа** = средний набор (B) | A) только delete коммента + ban C) +редактировать чужой контент + audit-лог `mod_actions` | A не покрывает спам-посты (только посты-родителей нельзя тронуть). C избыточно: один админ-владелец, audit-лог — фаза 2+. B = delete-comment + ban-user (с reason) + hide-post + delete-post — закрывает реальные сценарии модерации блога. |
| 5 | **Формат коммента** = plain text + автолинки, 2000 символов, пагинация 50, якоря, цитата ника | A) plain без автолинков, без пагинации C) markdown + 5000 символов | A — нет пагинации опасно при 1000+ комментах под вирусным постом. C — markdown тянет marked + sanitize-html, расширяет attack surface, при V1 объёмах оверкилл. B — минимально удобно, не плодит deps. Автолинки на сервере (без HTML-хранения, парсинг при чтении — текст короткий, дешёво). |
| 6 | **Размещение кнопки «Написать»** = LeftNav (выделенная) + BottomNav FAB + CTA на своём профиле | A) только LeftNav (один пункт) C) +sticky в RightRail +textarea-заглушка в шапке ленты | A теряется на мобиле (CTA утоплен в дне). C избыточно для одного источника контента (через 5 разных мест писать — confusing). B = 3 видимых точки в типичных user flow (навигация / мобильная сессия / профиль). |
| 7 | **Rate-limit** = in-memory `Map<userId-kind, timestamps[]>` | A) без лимитов C) Postgres-таблица `rate_events` | A — первая волна спама пройдёт без помех. C — пишет в БД на каждый POST, перформанс хуже, при single-instance Hetzner overkill. B — простой Map в памяти процесса, рестарт обнуляет (приемлемо для V1), 0 внешних зависимостей. Тесты — gap + последний-в-окне. Limits настраиваются. |
| 8 | **Видимость бан/скрытие** = soft (B) | A) бан → все его комменты подменяются «удалён», скрытие → 404 поста C) бан → ничего не меняется, скрытие → 404 | A переписывает историю обсуждения (другие участники теряют контекст ответов). C оставляет забаненных «как живых» в треде. B — бан скрывает личность (плашка «автор заблокирован», профиль 404), скрытие поста = модерация всего треда (404). Сбалансировано. |
| 9 | **Бан не убивает сессию**, юзер видит причину на `/banned` | b) текущее поведение — `/api/auth/ban-kill` сразу логаутит | b — забаненный не понимает почему его выгнало, повторно регистрируется. `/banned` показывает причину + кнопку logout — этичнее и снижает рецидив. Guard переезжает с ban-kill на redirect `/banned`. |
| 10 | **Чтение тредов в RSC + server actions для мутаций** | b) клиентский fetch комментов через REST | a — `getCommentsByPost(postId, page)` в RSC, форма ввода через server action `createComment`. Гость → `<a href="/login?callbackUrl=...">` вместо формы. Никаких useEffect для основного потока. b плодит API-роуты без выгод. |
| 11 | **Soft-delete семантика чтения** = возвращаем все комменты включая deleted, плашка рендерится клиентом | b) фильтровать deleted на уровне SQL c) отдельный flag `?showDeleted=true` | b ломает якоря (`#comment-<id>` указывает в пустоту) и нумерацию пагинации скачет. c — лишний UX-флаг, не нужно. a — query возвращает всё, рендер решает что показать (плашка вместо contentText, скрытие кнопок edit/delete). |
| 12 | **Контент-render** = серверный `renderCommentText(text)` → ReactNode[], без хранения HTML | b) хранить `contentHtml` параллельно с `contentText` c) рендерить на клиенте | b плодит расхождения text↔html при будущих edits и миграциях. c — XSS-риск выше, плюс flash без линков на первый рендер. a — чистый pure function, тестируется юнитами, текст короткий (≤2000 chars × десятки на страницу — дешёво). |
| 13 | **`comments.parentId` nullable, всегда `NULL` в V1** | a) убрать поле, добавить миграцией в фазу 2 | Канон §6.2 предписывает «схема готова, UI потом» именно чтобы фаза 2 не требовала миграции. Колонка nullable text без FK (как в каноне) — стоимость нулевая, риск миграции отсутствует. V1 query всегда вставляет `NULL`, рендер плоский — игнорирует поле. |
| 14 | **Admin permanent-delete поста = soft (`posts.deletedAt`)**, не hard cascade | b) `DELETE FROM posts WHERE id=...` с cascade на comments | Канон §8.6: «Запись остаётся для аудита». `deletedAt` уже существует и уже используется автором (`softDeletePost` в `src/server/posts.ts`). Админ-delete использует то же поле — единый код-путь чтения (`isNull(deletedAt)` уже в `PUBLISHED_PUBLIC` и `requireOwnPost`). Комменты остаются в БД, но недостижимы (только через post page, которая теперь 410 Gone). Admin-restore тривиален: `deletedAt = null`. |
| 15 | **`deletedAt` без `deletedBy` на постах**, в отличие от комментов | b) добавить `posts.deletedBy text references users.id` | На post page нет публичного «удалён [автором/админом]» (просто 410 Gone). Автор soft-deleted поста его уже не видит (`requireOwnPost` фильтрует `isNull(deletedAt)`) — у него в `/drafts` пост исчезает в любом случае. Различать кто удалил нужно только для admin-only restore-UI; в V1 админ может восстановить любой soft-deleted пост вне зависимости от инициатора. Колонка не нужна. |

---

## 3. Модель данных — изменения

### 3.1 Новая таблица `comments`

```ts
// drizzle/schema.ts (импортить newId как в posts)
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),                                // ULID, newId() (как в posts)
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),                                // nullable, без FK; всегда NULL в V1 (см. §2 row 13)
  contentText: text("content_text").notNull(),                // plain text, 1..2000 символов
  createdAt: timestamp("created_at").notNull().defaultNow(),
  editedAt: timestamp("edited_at"),                           // null если не редактировался
  deletedAt: timestamp("deleted_at"),                         // soft delete
  deletedBy: text("deleted_by").references(() => users.id),   // кто удалил
}, (t) => ({
  postCreatedIdx: index("comments_post_created_idx").on(t.postId, t.createdAt),
  authorCreatedIdx: index("comments_author_created_idx").on(t.authorId, t.createdAt),
}));
```

**Замечания:**
- Timestamps без `withTimezone` — следуем существующему стилю проекта (см. `users.createdAt`, `posts.createdAt`).
- `deletedBy` хранит userId; на рендере: `deletedBy === authorId` → «удалён автором», иначе → «удалён администратором». Edge-case: если админ забывает выйти и удаляет СВОЙ коммент — отрендерится как «удалён автором» (фактически верно, действовал как автор; формально admin-power не задействован). Acceptable для V1.
- `parentId` присутствует ради §2 row 13: канонная заготовка под фазу 2.
- НЕТ `contentHtml` — рендер на сервере при чтении (см. §6.1).
- `onDelete: "cascade"` для `postId` — если админ HARD-удаляет пост (не наш случай в V1, см. §2 row 14), комменты улетают. В V1 admin-delete soft → cascade не срабатывает, комменты остаются в БД.

### 3.2 Изменения в `users`

```ts
// добавляем ОДНУ колонку:
banReason: text("ban_reason"),                  // показывается на /banned
// bannedAt — УЖЕ ЕСТЬ из plan-02, переиспользуем
// role     — УЖЕ ЕСТЬ из plan-02 как PG enum userRole = ["user","moderator","admin"]
//            default 'user'. V1 использует только 'user' и 'admin'.
//            'moderator' — зарезервированное enum-значение, не используется в plan-5b.
```

**Замечания:**
- `assertAdmin()` проверяет ровно `session.user.role === 'admin'`. Значение `'moderator'` существует в enum (канон §6.2), но в V1 не получает никаких прав — это намеренно, чтобы будущая фаза могла ввести «модератор без бана» без миграции.
- `banReason` nullable (старые баны до plan-5b не имеют причины; новые баны через `adminBanUser` action требуют `reason.length >= 5`).
- НЕ переводим `role` из enum в text — миграция дорогая, а v1+ ничего не требует от добавления значений в enum (`ALTER TYPE ... ADD VALUE` в Postgres дёшев).

### 3.3 Изменения в `posts`

```ts
// добавляем ДВЕ колонки (для hide; для delete переиспользуем существующий deletedAt):
hiddenByAdminAt: timestamp("hidden_by_admin_at"),
hiddenByAdminId: text("hidden_by_admin_id").references(() => users.id),
// deletedAt — УЖЕ ЕСТЬ из plan-04, переиспользуем (см. §2 row 14, 15)
```

**Два разных admin-действия над постом:**

| Действие | Поле | Семантика | Видимость для автора |
|----------|------|-----------|----------------------|
| Hide | `hiddenByAdminAt` (NEW) | Временное сокрытие, восстанавливаемо | Виден в `/drafts` с плашкой «скрыт администратором» |
| Delete | `deletedAt` (existing) | Постоянное удаление с аудитом (канон §8.6) | НЕ виден в `/drafts` (текущий `requireOwnPost` фильтрует `isNull(deletedAt)`) |

**Замечания:**
- Соответственно, hide и delete — два разных кейса в UI. На post-page hide и delete оба → 404/410 публично, но через разные пути.
- Публичные query (`PUBLISHED_PUBLIC` в `src/server/feed.ts`) уже фильтруют `isNull(deletedAt)`. Добавляем `AND isNull(hiddenByAdminAt)`. Один константный `and(...)` обновляется.
- `getPostBySlug` (для `/p/[slug]`) — аналогично: hidden или deleted → возврат null → 404/410.
- `/drafts` автора: SELECT WHERE authorId = me AND deletedAt IS NULL (current). НЕ фильтрует `hiddenByAdminAt` — автор видит свой скрытый пост с плашкой.
- `requireOwnPost` (в `src/lib/auth/guard.ts`) уже фильтрует `isNull(deletedAt)`. Добавляем `AND isNull(hiddenByAdminAt)` — автор не может редактировать скрытый админом пост (после unhide сможет).
- НЕТ `deletedBy` на постах (см. §2 row 15).
- НЕТ причины скрытия — поле сознательно опущено (см. §1.4).

### 3.4 Миграция

Одна Drizzle-миграция (`pnpm db:generate`):
- `CREATE TABLE comments` (см. §3.1; колонки + 2 индекса);
- `ALTER TABLE users ADD COLUMN ban_reason text`;
- `ALTER TABLE posts ADD COLUMN hidden_by_admin_at timestamp`;
- `ALTER TABLE posts ADD COLUMN hidden_by_admin_id text REFERENCES users(id)`.

НЕ создаём: `users.role` (уже есть PG enum), `posts.deletedAt` (уже есть).

**Артефакты миграции:**
- `pnpm db:generate` создаёт SQL-файл в `drizzle/` — коммитим в репо в составе plan-5b PR (как делалось в plan-04).
- `pnpm db:push` применяет локально для дев-БД.
- На проде применение — в plan-06 (деплой); spec plan-5b просто кладёт миграцию в репо.

---

## 4. Server actions и query-функции

### 4.1 Чтение (RSC, `src/server/comments.ts`)

```ts
// возвращает все комменты поста ВКЛЮЧАЯ deleted (для якорей и плашек)
// page — 1-based, COMMENTS_PER_PAGE = 50
type CommentItem = {
  id: string;
  authorId: string;
  authorUsername: string | null;
  authorName: string | null;
  authorImage: string | null;
  authorBannedAt: Date | null;
  contentText: string;       // raw, плашка определяется на рендере
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedByAuthor: boolean;  // computed: deletedBy === authorId
};
type CommentsPage = {
  items: CommentItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;        // только не-deleted; для заголовка «N комментариев»
};
export async function getCommentsByPost(postId: string, page: number): Promise<CommentsPage>;

// для подсчёта на профиле и в карточке поста
export async function getCommentCount(postId: string): Promise<number>;
```

### 4.2 Server actions комментов (`src/server/actions/comments.ts`)

```ts
type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// требует session, проверяет rate-limit, валидирует длину 1..2000
export async function createComment(postId: string, text: string): Promise<ActionResult<{ commentId: string }>>;

// own-only, проверка: editedAt = null || createdAt + 15min > now
export async function updateComment(commentId: string, text: string): Promise<ActionResult>;

// own-only, soft delete deletedBy=session.user.id
export async function deleteOwnComment(commentId: string): Promise<ActionResult>;
```

Каждый action: `revalidatePath(`/p/${slug}`)` затронутого поста после успеха.

### 4.3 Server actions модерации (`src/server/actions/moderation.ts`)

```ts
// все требуют assertAdmin() в начале
export async function adminDeleteComment(commentId: string): Promise<ActionResult>;
export async function adminRestoreComment(commentId: string): Promise<ActionResult>;
export async function adminBanUser(userId: string, reason: string): Promise<ActionResult>;
export async function adminUnbanUser(userId: string): Promise<ActionResult>;
export async function adminHidePost(postId: string): Promise<ActionResult>;     // SET hiddenByAdminAt=now(), hiddenByAdminId=admin.id
export async function adminUnhidePost(postId: string): Promise<ActionResult>;   // SET hiddenByAdminAt=null, hiddenByAdminId=null
export async function adminDeletePost(postId: string): Promise<ActionResult>;   // SET deletedAt=now() (soft, см. §2 row 14)
export async function adminRestorePost(postId: string): Promise<ActionResult>;  // SET deletedAt=null (восстановление soft-deleted)
```

`adminBanUser` валидирует `reason.length >= 5` (не пустая отписка).

Важно: `adminDeletePost` — soft, по канону §8.6. Хард-delete с cascade не делаем (комменты остаются в БД для аудита). Восстановление — через `adminRestorePost`, после которого пост опять public-видимый.

**Отклонение от канона §8.6:** канон предписывает на admin-delete также `content_html=null`. Мы намеренно НЕ зануляем `contentHtml` (как и existing `softDeletePost` автора — см. inline-комментарий в `src/server/posts.ts:221`), чтобы `adminRestorePost` сразу давал полностью рабочий пост без перегенерации HTML. Регенерация HTML дорогая и завязана на актуальную версию рендерера блоков; держать stale-cache безопаснее. Канон обновим в фазу 2, когда появится отдельная `republishPost` для restored-кейса.

### 4.4 Rate-limit (`src/lib/rate-limit.ts`)

```ts
type LimitKind = "comment" | "post";
type LimitResult = { ok: true } | { ok: false; retryAfterSec: number; reason: string };

// in-memory Map<`${userId}:${kind}`, number[]> с очисткой хвоста
export function checkLimit(userId: string, kind: LimitKind): LimitResult;
```

**Правила:**

| kind | окно | макс в окне | минимальный gap |
|------|------|------|------|
| `comment` | 1 час | 20 | 10 сек |
| `post` | 1 час | 5 | 30 сек |

**Поведение:**
- Gap проверяется отдельно от окна (защита от очереди 20 событий за 5 секунд).
- Админу (`session.user.role === 'admin'`) — bypass без вызова `checkLimit`.
- Превышение → `RateLimitError(retryAfterSec)` → action возвращает `{ ok: false, error: "Слишком часто. Попробуйте через N секунд." }`.
- Сброс при рестарте процесса (для single-instance Hetzner деплоя приемлемо).
- Жёсткий cap: если `Map.size > 10_000` — при следующей записи дропаем самый старый ключ (защита от OOM при misuse / медленной утечки). Чистка хвостов timestamps внутри ключа происходит при каждом `checkLimit`.

### 4.5 Admin guard (`src/lib/auth/assert-admin.ts`)

```ts
// бросает redirect('/') если не админ
// используется в moderation actions (server-side)
export async function assertAdmin(): Promise<{ userId: string }>;
```

---

## 5. Routes — карта

### Новые роуты

```
src/app/
├── banned/
│   └── page.tsx                          ─ NEW: server, читает session, показывает banReason + logout
```

Замечание: `/banned` ВНЕ всех route group'ов (`(public)`, `(app)`) — забаненный не должен видеть feed-shell с sidebar. Просто root layout + центрированный card.

### Изменённые роуты

```
src/app/(public)/p/[slug]/page.tsx         ─ MODIFY: добавляем <CommentThread postId={post.id} slug={post.slug} />
                                             (фактический путь поста в коде; не путать с (public)/(feed)/p/[slug])
src/app/(public)/(feed)/u/[username]/page.tsx ─ MODIFY: если admin — добавить admin-меню (ban/unban) в header
src/app/(app)/(feed)/drafts/page.tsx       ─ MODIFY: добавить флаг «Скрытые админом» (новый возможный раздел/фильтр)
                                             + метка на PostCard если hiddenByAdminAt != null
src/server/feed.ts                         ─ MODIFY: PUBLISHED_PUBLIC дополнить isNull(hiddenByAdminAt)
src/server/posts.ts                        ─ MODIFY: getPostBySlug учитывает isNull(hiddenByAdminAt)
src/lib/auth/guard.ts                      ─ MODIFY: requireOwnPost дополнить isNull(hiddenByAdminAt)
src/app/(auth)/login/page.tsx              ─ без изменений
```

### Middleware / guard

```
src/lib/auth/guard.ts                      ─ MODIFY: requireAuthState — если bannedAt != null → redirect('/banned')
                                             (сейчас redirect('/api/auth/ban-kill') на строке 13)
src/app/api/auth/ban-kill/route.ts         ─ DELETE: единственный caller был guard.ts:13 (grep подтверждён);
                                             после смены guard на /banned — удаляем route целиком
```

**Pre-delete audit:** перед удалением `/api/auth/ban-kill/route.ts` исполнитель плана должен прогнать `rg 'ban-kill|ban_kill|banKill' src` и убедиться, что нет других callers. На момент написания спецификации — только `src/lib/auth/guard.ts:13`.

### Что НЕ меняется

- `/`, `/t/[slug]`, `/tags`, `/welcome`, editor-роуты — без изменений в plan-5b.
- `sitemap.ts` — комменты не индексируем (фрагменты #comment-<id>), посты с `hiddenByAdminAt != null` исключаем (добавить в существующий фильтр).

---

## 6. UI-компоненты

### 6.1 Комментарии (`src/components/comments/`)

```
CommentThread.tsx       ─ server: getCommentsByPost(postId, page), список + пагинация + <CommentForm/гость>
CommentItem.tsx         ─ server: avatar + ник (без ссылки если author banned) + дата + рендер текста + actions
CommentItemActions.tsx  ─ client: dropdown «...» edit/delete (own) или admin-delete/restore
CommentForm.tsx         ─ client: useTransition + <Button pending>, textarea autoresize, счётчик символов
EditCommentForm.tsx     ─ client: инлайн-замена CommentItem, save/cancel
CommentDeletedPlaceholder.tsx ─ server: «Комментарий удалён [автором/администратором]» (заглушка вместо текста)
```

**Семантика рендера `CommentItem`:**
- Если `deletedAt != null` → рендерим `<CommentDeletedPlaceholder by={deletedByAuthor ? 'author' : 'admin'} />`, скрываем все actions.
- Иначе если `authorBannedAt != null` → рендерим текст + автолинки, но ник без `<Link>` (просто `<span>`) и под ним плашка «автор заблокирован». Actions показываем (админ может удалить даже коммент забаненного).
- Иначе обычный рендер.

### 6.2 Кнопка «Написать» (`src/components/post/WriteButton.tsx`)

```ts
type Variant = "nav" | "fab" | "cta";
interface Props {
  variant: Variant;
  isAuthed: boolean;       // если false → href = /login?callbackUrl=/drafts/new
}
```

- `nav` — пункт LeftNav с `bg-primary text-primary-foreground` подложкой, иконка `PenSquare` (отличается от обычных пунктов nav).
- `fab` — `fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg`, иконка `PenSquare` 24px. Скрыт на десктопе (`md:hidden`).
- `cta` — обычная кнопка `<Button>` для встраивания в `UserProfileHeader` (только своего профиля).

### 6.3 Модерация (`src/components/moderation/`)

```
PostAdminMenu.tsx       ─ client: dropdown «...» рядом с автором поста, видна только админу
                          items: Hide/Show post, Delete post, Ban author
BanUserDialog.tsx       ─ client: ConfirmDialog + textarea для banReason (required, min 5 символов)
HidePostAction.tsx      ─ client: useTransition wrapper для adminHidePost/Unhide
DeletePostAction.tsx    ─ client: ConfirmDialog + useTransition wrapper для adminDeletePost
```

### 6.4 Изменения существующих компонентов

```
LeftNav.tsx             ─ MODIFY: добавить WriteButton variant=nav (для залогиненных) ВЫШЕ остальных пунктов
BottomNav.tsx           ─ MODIFY: рендерить рядом WriteButton variant=fab (для залогиненных)
UserProfileHeader.tsx   ─ MODIFY: для своего профиля добавить WriteButton variant=cta
                          для админа на чужом профиле добавить кнопку «Забанить» / «Разбанить»
PostHeader.tsx (or /p/[slug]/page.tsx) ─ MODIFY: добавить PostAdminMenu (если admin)
ConfirmDialog.tsx       ─ без изменений (pending prop уже есть из UX-фиксов)
```

### 6.5 Утилиты

```
src/lib/comments/render-text.ts    ─ NEW: renderCommentText(text: string): ReactNode[]
                                     разбивает на параграфы, находит URL через регэксп, оборачивает в <a>
                                     БЕЗ внешних зависимостей, тесты юнитами
src/lib/rate-limit.ts              ─ NEW: см. §4.4
src/lib/auth/assert-admin.ts       ─ NEW: см. §4.5
```

**`renderCommentText` детально:**
- Разбивает по `\n\n` на параграфы → `<p>`.
- Внутри параграфа: `\n` → `<br />`.
- Регэксп для URL (точная форма для имплементации):
  ```ts
  const URL_RE = /\bhttps?:\/\/[^\s<>"']+/g;
  // После match — trim trailing punctuation:
  const TRAILING_PUNCT = /[.,;:!?)\]}»"']+$/;
  ```
- Найденные URL → `<a href={url} target="_blank" rel="noopener noreferrer nofollow">{url}</a>`.
- React автоматически экранирует текст в children — XSS невозможен.
- Без markdown, без bold/italic, без emoji-шорткатов.

### 6.6 Theme content (`theme/content.ts`)

Новые блоки:

```ts
comments: {
  heading: "Обсуждение",
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
  rateLimitHit: "Слишком часто. Попробуйте через {sec} секунд.",
  charCount: "{n} / 2000",
  reply: "Ответить",
  countLabel: (n: number) => `${n} ${plural(n, "комментарий", "комментария", "комментариев")}`,
},
moderation: {
  postMenuLabel: "Действия модератора",
  hidePost: "Скрыть пост",
  unhidePost: "Показать пост",
  deletePost: "Удалить пост",
  deletePostConfirm: "Удалить пост безвозвратно? Все комментарии тоже будут удалены.",
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

`plural` — простая хелпер-функция для русских числительных, можно вынести в `src/lib/plural.ts` (если ещё нет).

---

## 7. Тесты

### 7.1 Юнит-тесты (vitest)

```
tests/lib/rate-limit.test.ts          ─ NEW: 3 теста
  - gap-блок: два вызова подряд → второй { ok: false }
  - gap-разрешение: вызов, vi.advanceTimersByTime(11_000), вызов → оба { ok: true }
  - окно: 20 успешных, 21-й → { ok: false }

tests/lib/comments/render-text.test.ts ─ NEW: 4 теста
  - plain без URL → один <p>
  - один URL в середине параграфа
  - несколько URL в одном параграфе
  - URL рядом с пунктуацией (запятая в конце не попадает в href)

tests/server/comments.test.ts         ─ NEW: 4 теста
  - getCommentsByPost возвращает deleted с подменой contentText? нет — возвращает raw, плашка на рендере
  - getCommentsByPost пагинация offset/limit
  - getCommentCount считает только не-deleted
  - createComment валидирует длину (0 и 2001 символов → reject)

tests/server/actions/comments.test.ts ─ NEW: 3 теста
  - updateComment граница edit-окна: createdAt + 14min59s → ok, createdAt + 15min01s → reject
  - deleteOwnComment чужого коммента → reject
  - createComment гостем (без session) → reject

tests/server/actions/moderation.test.ts ─ NEW: 3 теста
  - adminDeleteComment без admin role → redirect '/' (assertAdmin)
  - adminBanUser без reason → reject ("min 5 chars")
  - adminHidePost ставит hiddenByAdminAt + hiddenByAdminId
```

### 7.2 Интеграция / smoke

- `pnpm test` — все существующие 178 + новые ≈17 не должны сломаться.
- `pnpm tsc --noEmit` — clean.
- `pnpm lint` — clean.
- `NODE_ENV=production pnpm build` — green.

### 7.3 Что НЕ тестируем

- E2E через playwright — нет инфры в проекте.
- Визуальное позиционирование FAB / dropdown — руками в Chrome + Safari mobile.
- «Забанили во время сессии» сценарий — полагаемся на guard, проверка вручную.
- Реальный SMTP / push при бане — нотификаций нет в фазе 1.
- Race-conditions rate-limit (несколько процессов в один момент) — single-instance.

---

## 8. DoD checklist (для plan-файла)

- [ ] Миграция `comments` + новые колонки в `users`/`posts` применена локально, `db:studio` показывает структуру.
- [ ] Кнопка «Написать» видна на LeftNav (выделена, для залогиненных), BottomNav FAB (для залогиненных), `/u/me` (только своего профиля).
- [ ] Гость на post page видит «Войдите, чтобы оставить комментарий»; залогиненный — форму с textarea + счётчиком символов.
- [ ] Создать коммент → виден без F5 (revalidatePath), якорь `#comment-<id>` работает.
- [ ] Edit-окно: до 15 минут — кнопка edit есть, после — кнопки нет (даже если page recheck'нуть).
- [ ] Soft-delete своего коммента → плашка «удалён автором», ник скрыт, текст недоступен.
- [ ] Rate-limit: 21 коммент за час (или 2 коммента подряд <10с) → `error` в форме с сообщением.
- [ ] Админ (вручную выставленный `role='admin'` через db:studio):
  - видит admin-меню «...» на post page (hide / delete / ban author);
  - видит кнопку «Удалить» под каждым не-deleted чужим комментом и «Восстановить» под deleted;
  - забанивает с обязательной причиной (≥5 символов).
- [ ] Скрытие поста админом → публично 404 (на `/`, `/t/...`, `/u/...`, `/p/...`), у автора в `/drafts` есть метка «скрыт администратором».
- [ ] Бан юзера: `/u/<его>` 404, его комменты в треде остаются с плашкой «автор заблокирован» (ник без ссылки), сам он попадает на `/banned` с причиной + кнопкой logout.
- [ ] `pnpm test` = 178 + 17 новых = 195, `tsc --noEmit` clean, `pnpm lint` clean, `NODE_ENV=production pnpm build` green.
- [ ] Retro-секция в plan-файле заполнена после имплементации.

---

## 9. Зависимости и риски

**Зависит от:**
- plan-02 (auth, `users.bannedAt`, session).
- plan-04 (posts, slug, `/p/[slug]`, `/drafts`).
- plan-5a (3-col shell, LeftNav, BottomNav, UserProfileHeader, PostList).

**Не блокирует:** plan-06 (SEO / deploy / backups) — может писаться параллельно по другим разделам, но финальный билд для деплоя — после plan-5b.

**Риски:**
1. **In-memory rate-limit при будущем scale-out** — если деплой переедет на multi-instance, лимиты будут расходиться. Митigation: явно документировано в комменте модуля, миграция на Redis/Postgres — separate ticket в фазе 2.
2. ~~Cascade delete постов уносит комменты~~ — снято: per §2 row 14, `adminDeletePost` теперь soft (`deletedAt = now()`), комменты остаются в БД, восстановление через `adminRestorePost` возвращает и пост, и все его комменты. Cascade в FK сохраняем как страховку от ручных операций в БД.
3. **Edit-окно 15 минут vs кэш страницы** — если страница SSR'ится с edit-кнопкой в момент 14:59, юзер может попытаться сохранить на 15:01 → reject на сервере. UI покажет ошибку «окно закрыто». Приемлемо.
4. **`renderCommentText` regex для URL** — не покрывает unicode-домены (`https://пример.рф`). V1 ниша преимущественно ASCII-ссылки. Митigation: добавить `[^\s<>"]` уже разрешает unicode; тесты с unicode добавить если будет реальный кейс.
5. **`/banned` доступна для не-забаненных** — `redirect('/')` если не забанен, чтобы не плодить странных URL. Тест-кейс в DoD.

---

## 10. Открытые вопросы (решаем при имплементации)

Все архитектурные вопросы закрыты в §2. Имплементационные мелочи, которые решим по месту:

- Точная высота textarea autoresize: min 80px, max 400px (или скролл).
- Анимация появления нового коммента после submit (вероятно — никакой, просто revalidatePath + scroll-to-anchor).
- Иконка для пункта «Написать» в LeftNav: `PenSquare` (lucide-react) — единая для всех trois variant'ов.
- Где именно `PostAdminMenu` живёт визуально на странице поста: справа от блока автора (иконка `MoreHorizontal`).
- Counter символов: красный цвет при `>1900`, иначе muted.

---

**Конец спецификации.**
