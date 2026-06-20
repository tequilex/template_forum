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
| `pnpm cleanup:orphans [--dry-run]` | Удалить uploads без `post_id`, старше 7 дней (R2 + DB) |

## Маршруты (plan-04)

- `/new` — создание поста (требует логин). Редактор Editor.js с автосейвом.
- `/edit/[id]` — редактирование своего поста (404 на чужой / soft-deleted).
- `/drafts` — список моих черновиков и архива (табы `?tab=drafts|archived`); живёт под discovery-shell'ом.
- `/p/[slug]` — публичная страница поста. Видимость:
  - draft → 404
  - published → 200 (всем)
  - archived → 200 только автору, остальным 404
  - soft-deleted → 410 (разметка «удалён»; точный HTTP-status — plan-06)

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

См. [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](docs/superpowers/specs/2026-06-05-skelet-blog-design.md) → раздел «Деплой».

## sharp на Linux x64 (Hetzner)

При прод-сборке на Linux x64 Hetzner-машине `pnpm install` подтягивает `@img/sharp-linux-x64`
автоматически. Если в Docker-образе используется multi-platform build и кто-то соберёт
на M-серии Mac под `--platform linux/amd64`, может потребоваться:

```bash
pnpm install --config.platform=linux --config.arch=x64
```

Или установка переменной `SHARP_IGNORE_GLOBAL_LIBVIPS=1` перед `pnpm install`,
если на хост-системе живёт несовместимая глобальная libvips.

Подробности — `node_modules/sharp/install/check.js` после `pnpm install`.
