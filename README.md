# foxgeek — блог-платформа

Переиспользуемый скелет для быстрого создания тематических блогов / форумов (стиль vc.ru / drive2.ru). Каждая ниша = отдельный git-репо + VPS. Текущий инстанс: **foxgeek.ru**.

См. полную спеку: [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](docs/superpowers/specs/2026-06-05-skelet-blog-design.md).

## Стек

Next.js 15 · React 19 · TypeScript · Tailwind v3 · Drizzle ORM · Postgres 16 · Auth.js · Editor.js · Timeweb S3 · Caddy 2 · Docker.

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

# 4. Применить миграции
pnpm db:migrate

# 5. Запустить dev-сервер
pnpm dev
```

Сайт доступен на http://localhost:3000.

### OAuth для dev (опционально)

Доступны только провайдеры, разрешённые в РФ: **Yandex** (через NextAuth) и **VK ID** (кастомный роут, единый шлюз для VK / Mail.ru / OK).

- Yandex: https://oauth.yandex.ru/client/new → callback `http://localhost:3000/api/auth/callback/yandex`. Заполни `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` в `.env`.
- VK ID: https://id.vk.com/about/business/go → callback `http://localhost:3000/api/oauth/vk/callback`. Заполни `VK_CLIENT_ID` / `VK_CLIENT_SECRET` в `.env`.

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
| `pnpm cleanup:orphans [--dry-run]` | Удалить uploads без `post_id`, старше 7 дней (S3 + DB) |

## Маршруты (plan-04)

- `/new` — создание поста (требует логин). Редактор Editor.js с автосейвом.
- `/edit/[id]` — редактирование своего поста (404 на чужой / soft-deleted).
- `/drafts` — список моих черновиков и архива (табы `?tab=drafts|archived`); живёт под discovery-shell'ом.
- `/p/[slug]` — публичная страница поста. Видимость:
  - draft → 404
  - published → 200 (всем)
  - archived → 200 только автору, остальным 404
  - soft-deleted (автором или админом) → 404
  - скрыт админом → 404 для всех, кроме админа

### Discovery (plan-5a)

Публичные read-only страницы:

- `/`             — главная лента (20 постов на страницу, `?page=N`)
- `/t/[slug]`     — посты по тэгу
- `/tags`         — индекс всех тэгов
- `/u/[username]` — профиль автора (bio + stats + посты)

Все обёрнуты в 3-col shell (`<FeedShell>`): левый nav + центральная лента + пустой
правый sidebar. На mobile (`<lg`) — bottom-bar навигация, sidebar скрыт.

`/drafts` (auth-only) переехал в тот же shell — `(app)/(feed)/drafts`.

Sitemap: `app/sitemap.ts` собирает `/`, `/tags`, `/p/*`, `/t/*`, `/u/*` из БД.

### Engagement (plan-5b)

- `/p/[slug]` имеет раздел «Обсуждение» под телом поста: плоские комменты, plain
  text + автолинки, лимит 2000 символов, edit-окно 15 минут после публикации,
  soft-delete своих с плашкой.
- Кнопка «Написать» доступна из LeftNav (desktop), FAB в правом нижнем углу
  (mobile), на своём профиле `/u/<username>`.
- Админ (роль `users.role = 'admin'`, выставляется руками через `pnpm db:studio`)
  имеет dropdown «…» на post page для скрытия/удаления чужого поста и бана
  автора (с обязательной причиной). Под чужими комментами — кнопки удаления /
  восстановления.
- Забаненный юзер попадает на `/banned` с причиной + кнопкой выхода.
- Rate-limit: 20 комментов/час (gap 10с), 5 постов/час (gap 30с). Админу —
  bypass. Хранение in-memory (Map с LRU 10k); persistent — фаза 2+.

### Seed-тэги (миграция 0002)

При первой миграции в `tags` создаётся 6 generic тэгов: experience, question,
news, review, opinion, lifehack. Для своей ниши переписать INSERTs в
`drizzle/migrations/0002_*.sql` **до первого деплоя** — после деплоя тэги уже
будут использоваться в постах и менять их PK небезопасно.

## Полный стек локально (Docker)

```bash
docker compose up -d
# https://localhost (Caddy self-signed cert)
```

## Структура

См. [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](docs/superpowers/specs/2026-06-05-skelet-blog-design.md) → раздел «Структура репозитория».

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

foxgeek деплоится на Timeweb Cloud VPS через docker-compose (caddy + app + db + backup). HTTPS — автоматически через Caddy + Let's Encrypt.

Подробности: [docs/DEPLOY.md](./docs/DEPLOY.md). Восстановление из бэкапа: [docs/RECOVERY.md](./docs/RECOVERY.md).

Общая архитектура: [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](docs/superpowers/specs/2026-06-05-skelet-blog-design.md) → раздел «Деплой».

## SEO

- `sitemap.xml` и `robots.txt` — динамические (`src/app/sitemap.ts`, `src/app/robots.ts`).
- JSON-LD на публичных страницах: `BlogPosting` + `BreadcrumbList` + `WebSite` (`src/lib/jsonld.ts`).
- OG-изображения: реальная обложка поста, иначе динамика через `next/og` (`src/app/og/[slug]/route.tsx`).
- IndexNow: при `publishPost`/`updatePost`/`hidePost`/`deletePost`/`adminBanUser` пингуем `api.indexnow.org` (`src/lib/indexnow.ts`).

## Analytics

Яндекс.Метрика (`clickmap + trackLinks + accurateTrackBounce`, без webvisor) — `src/components/analytics/YandexMetrika.tsx`. Грузится только в `NODE_ENV=production` при `YANDEX_METRIKA_ID`. Cookie-баннер не делаем; в футере disclaimer + страница `/privacy`.

## Monitoring

- `/api/health` — `SELECT 1` к Postgres, 200/503.
- UptimeRobot пингует `/api/health` каждые 5 минут, алёрты в Telegram (см. `docs/DEPLOY.md` §8.5).

## sharp / libvips

Два инварианта, проверенные пилотным деплоем (иначе `ERR_DLOPEN_FAILED` в standalone на Alpine):

1. Версия `sharp` в package.json должна совпадать по minor с той, которую Next.js несёт
   как optional dependency (`pnpm why sharp` — не должно быть двух версий).
2. `.npmrc` в корне (`node-linker=hoisted` + `supported-architectures`) — не удалять,
   он копируется в Docker-билд.

Детали: `docs/DEPLOY.md` §10 (troubleshooting).
