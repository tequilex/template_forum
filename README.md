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

### OAuth для dev (опционально, но как минимум один провайдер)

Самый быстрый — **GitHub**:
1. https://github.com/settings/developers → «New OAuth App»
2. Homepage URL: `http://localhost:3000`
3. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Сохрани Client ID и сгенерируй Client Secret
5. В `.env` раскомментируй `GITHUB_CLIENT_ID=...` и `GITHUB_CLIENT_SECRET=...` и впиши значения
6. Рестарт `pnpm dev`

`curl http://localhost:3000/api/auth/providers` теперь отдаёт `{"github":{...}}`, на `/login` появится кнопка.

Для prod-ниши настраивай Google + Yandex + VK + GitHub по той же схеме, callback URL: `https://<домен>/api/auth/callback/<provider>`.

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
