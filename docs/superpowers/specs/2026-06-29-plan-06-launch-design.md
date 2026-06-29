# Plan 6 (Launch — SEO + OG + IndexNow + Analytics + Deploy + Backups + Monitoring) — спецификация

**Дата:** 2026-06-29
**Состояние:** brainstorm пройден, дизайн утверждён владельцем
**Канон высшего уровня:** `docs/superpowers/specs/2026-06-05-skelet-blog-design.md` §6 (схема), §11 (деплой/бэкапы), §12.1/§12.2 (что НЕ в фазе 1), §16 (разбивка фаз — plan-06 закрывает MVP)
**Предшественник:** `docs/superpowers/specs/2026-06-21-plan-05b-engagement-design.md` (engagement — кнопка «Написать», комментарии, модерация)

---

## 1. Цель плана

Закрыть Phase 1. После plan-06 проект публично работает на собственном домене: страницы постов индексируются Google и Yandex, в мессенджерах ссылки красиво превьюшатся, аналитика собирается, БД ежедневно бэкапится в S3, об инцидентах узнаём через UptimeRobot и Telegram.

Что входит:

1. **SEO** — динамический `sitemap.xml`, `robots.txt` с указанием sitemap, JSON-LD (`BlogPosting` + `BreadcrumbList` + `WebSite`), Metadata API на всех публичных страницах.
2. **OG-картинки** — реальная обложка поста, если есть; иначе динамика через `next/og` (заголовок + автор + дата на градиенте).
3. **IndexNow** — пинг `api.indexnow.org` при публикации / изменении / скрытии поста; шлюз распиливает на Yandex + Bing.
4. **Yandex.Metrika** — счётчик с `clickmap + trackLinks + accurateTrackBounce` (без webvisor), грузится только в production. Cookie-баннер не делаем; в футере disclaimer + страница `/privacy` объясняет что собираем.
5. **Деплой** — Timeweb Cloud VPS (1×5GHz / 1GB / 15GB / 825 ₽/мес + 180 ₽ за IPv4) с docker-compose (caddy + app + db + backup). HTTPS через Caddy + Let's Encrypt. Деплой руками через `git pull && docker compose up -d`. Один сервер, без staging, без CI/CD.
6. **Бэкапы** — Postgres → Timeweb S3 Cold (`skelet-backups` bucket), ежедневно в 03:00 MSK, retention 30 дней через lifecycle policy.
7. **Хранилище картинок** — переезд с Yandex Object Storage на Timeweb S3 Standard (`skelet-images`). Env vars `R2_*` → `STORAGE_*`. Dev может остаться на Yandex или завести отдельный Timeweb dev-bucket — на выбор.
8. **Мониторинг** — `/api/health` endpoint, UptimeRobot free tier пингует каждые 5 минут, алёрты идут в Telegram-бота.
9. **Контактный email** — рефакторинг: `theme/content.ts.site.contactEmail` — единый источник, на который ссылаются `banned.contact`, `privacy.contact`, и любые будущие точки.
10. **Документация** — `docs/DEPLOY.md` (пошагово от пустого VPS до работающего сайта), `docs/RECOVERY.md` (восстановление из бэкапа).

**Не делаем (явно вне scope):**

- Staging-окружение (отложено на Phase 2, когда появится регулярный поток изменений)
- GitHub Actions / автодеплой
- Webvisor в Метрике (увеличивает объём собранных данных, в Phase 1 не нужен)
- Поиск (`tsvector`) — отложен на Phase 2 (§12.1 главного дизайна)
- RSS feed — Phase 2
- Email-логин — Phase 2
- Уведомления авторам/подписчикам — Phase 3
- Persistent monitoring (Loki/Grafana/Prometheus) — далёкая Phase 3
- Миграция уже загруженных в dev-Yandex-bucket картинок на Timeweb (прод стартует с пустым bucket'ом)
- CDN перед Timeweb (рассматриваем при появлении заметного трафика)

---

## 2. Архитектурные решения (зафиксированы в brainstorm)

| # | Решение | Альтернативы | Почему так |
|---|---|---|---|
| 1 | **Timeweb Cloud VPS** для prod | Hetzner (изначально в spec), Yandex Cloud, Selectel | Хотим ру-провайдера; Timeweb — самый дешёвый из надёжных |
| 2 | **1×5GHz / 1GB / 15GB** тариф | 2 GB, 4 GB | Минимум для старта; если билд упадёт в OOM — fallback: swap-файл 3GB (5 минут работы) перед апгрейдом тарифа |
| 3 | **IPv4 публичный + IPv6 публичный + без приватной сети** | private network | Одна VM, ничего к ней не цепляется |
| 4 | **Postgres в контейнере, бэкап pg_dump в S3 Cold** | Managed Postgres от Timeweb | Дешевле, проще, бэкапы под нашим контролем; на масштаб «MVP-блог» хватает с большим запасом |
| 5 | **Один прод-VPS, ручной деплой** | Прод+staging+CI/CD | YAGNI для MVP; миграция вверх — без переписывания кода |
| 6 | **Без cookie-banner**, в футере disclaimer + `/privacy` | GDPR-style модальный consent banner | Ру-аудитория, ставим только Метрику (российский сервис), 152-ФЗ требует ясной политики — не баннер с двумя кнопками |
| 7 | **OG = cover-image поста, иначе динамика через `next/og`** | Только статика; только динамика | Реальная обложка > рендеренная плашка, но fallback нужен для постов без обложки |
| 8 | **IndexNow через `api.indexnow.org`** (Yandex+Bing), Google через Search Console + sitemap | Прямой пинг Yandex IndexNow API; skip IndexNow | Один пинг покрывает всех IndexNow-participants; для Google IndexNow не работает — нужен sitemap |
| 9 | **Webvisor выключен** | Включить (clickmap записывает поведение мыши) | Меньше данных, проще `/privacy`, в Phase 1 не нужен |
| 10 | **Storage: Timeweb S3 Standard** (картинки), **S3 Cold** (бэкапы) | Один bucket; managed Image CDN | Cold-тариф ~50% дешевле для редкого чтения; бэкапы за год экономят значимо |
| 11 | **Rename `R2_*` → `STORAGE_*`** | Оставить как есть | Имя R2 — историческое легаси (изначально планировалась Cloudflare R2); сейчас сбивает с толку |
| 12 | **UptimeRobot free + Telegram alerts** | Self-hosted Uptime Kuma; Sentry; skip monitoring | External pinger обязателен (Kuma на том же VPS никого не оповестит при падении VPS); UptimeRobot бесплатно для нашего масштаба |
| 13 | **Контактный email — единый константный** | Дублировать в каждом месте | One source of truth, легче править перед запуском, легче подменять в тестах |
| 14 | **Domain placeholder `example.ru`** в spec'е и шаблонах | Зафиксировать конкретный | Реальный домен решаем при покупке; в коде через env var `DOMAIN` / `NEXTAUTH_URL` |

---

## 3. Новые routes / surfaces

### 3.1. SEO routes

| Route | Файл | Описание |
|---|---|---|
| `GET /sitemap.xml` | `src/app/sitemap.ts` | Динамический sitemap: `/`, `/p/[slug]`, `/t/[slug]`, `/tags`, `/u/[username]` (только не-banned). `revalidate = 3600`. |
| `GET /robots.txt` | `src/app/robots.ts` | Disallow для `/drafts`, `/edit/`, `/new`, `/admin`, `/banned`, `/auth/`, `/api/`, `/dev/`. Allow `/`. `Sitemap: https://example.ru/sitemap.xml` |

### 3.2. OG-картинки

| Route | Файл | Описание |
|---|---|---|
| `GET /og/[slug]` | `src/app/og/[slug]/route.tsx` | `ImageResponse` из `next/og`. Рендерит 1200×630: фон-градиент (dark), лого «Skelet» сверху, заголовок поста (line-clamp 3), внизу `@username · 15 июня`. Шрифт system-ui. `revalidate = false` (Next кеширует output). |

### 3.3. Health / API

| Route | Файл | Описание |
|---|---|---|
| `GET /api/health` | `src/app/api/health/route.ts` | `SELECT 1` к Postgres. 200 если ок, 503 при db_error. `dynamic = "force-dynamic"`, `revalidate = 0`. |

### 3.4. Публичные страницы

| Route | Файл | Описание |
|---|---|---|
| `GET /privacy` | `src/app/(public)/privacy/page.tsx` | Статичная политика конфиденциальности. Контент в `theme/content.ts.privacy`. Линкуется из футера disclaimer. |

### 3.5. Verification files (в `public/`)

| Файл | Назначение |
|---|---|
| `public/<INDEXNOW_KEY>.txt` | IndexNow требует файл по ключу с содержимым = тот же ключ. Имя файла — значение env `INDEXNOW_KEY` (32-hex). |
| `public/google<hash>.html` | Google Search Console domain verification (HTML-метод). Контент даёт GSC после регистрации сайта. |
| `public/yandex_<hash>.html` | Yandex Webmaster verification (HTML-метод). Аналогично GSC. |

**Когда создаются:** все три файла кладутся руками в `public/` после деплоя — IndexNow `.txt` создаём один раз сразу после генерации `INDEXNOW_KEY` (см. §9 шаг 4), Google/Yandex html — после регистрации сайта в соответствующих кабинетах (см. §9 шаги 6–7). Все три коммитим в git (содержимое не секретное); Next.js отдаёт их статикой из `public/` без дополнительной маршрутизации.

---

## 4. Подсистемы — детали реализации

### 4.1. Подсистема SEO

**`src/lib/jsonld.ts`** — конструкторы schema.org структур:

```ts
buildBlogPostingJsonLd(input: {
  post: { slug, title, excerpt, pubAt, updatedAt, coverUrl, contentHtml };
  author: { username, name };
  tags: { name }[];
  siteUrl: string;
}): object

buildBreadcrumbJsonLd(items: { name: string; url: string }[]): object

buildWebSiteJsonLd(siteUrl: string): object
```

Все три возвращают plain objects. Размещаются на странице как:

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
```

**Где какой JSON-LD ставится:**

| Страница | Metadata API | JSON-LD |
|---|---|---|
| `/` | `og:type=website` | `WebSite` |
| `/p/[slug]` | `og:type=article` | `BlogPosting` + `BreadcrumbList` |
| `/t/[slug]` | `og:type=website` | `BreadcrumbList` |
| `/tags` | `og:type=website` | — |
| `/u/[username]` | `og:type=profile` | `BreadcrumbList` |
| `/privacy` | `robots: noindex` запрещаем (через `metadata.robots`)? Нет, оставим indexable. | — |
| `/new`, `/edit/*`, `/drafts`, `/admin`, `/banned`, `/auth/*` | `robots: { index: false, follow: false }` | — |

**Sitemap (`src/app/sitemap.ts`):**

```ts
import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { posts, tags, users } from "@db/schema";
import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { getEnv } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getEnv().NEXTAUTH_URL.replace(/\/$/, "");
  const db = getDb();

  // Аналог PUBLISHED_PUBLIC из feed.ts
  const publishedPublic = and(
    eq(posts.status, "published"),
    isNull(posts.deletedAt),
    isNull(posts.hiddenByAdminAt),
  );

  const [postRows, tagRows, userRows] = await Promise.all([
    db.select({ slug: posts.slug, updatedAt: posts.updatedAt }).from(posts).where(publishedPublic),
    db.select({ slug: tags.slug }).from(tags),  // все тэги; updatedAt — пересчёт через макс по постам если хочется детальнее
    db.select({ username: users.username, updatedAt: users.updatedAt })
       .from(users)
       .where(and(isNotNull(users.username), isNull(users.bannedAt))),
  ]);

  return [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/tags`, changeFrequency: "weekly", priority: 0.7 },
    ...tagRows.map(t => ({ url: `${siteUrl}/t/${t.slug}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...postRows.map(p => ({ url: `${siteUrl}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...userRows.map(u => ({ url: `${siteUrl}/u/${u.username}`, lastModified: u.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
```

**Robots (`src/app/robots.ts`):**

```ts
import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getEnv().NEXTAUTH_URL.replace(/\/$/, "");
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/drafts", "/edit/", "/new", "/admin", "/banned", "/auth/", "/api/", "/dev/"],
    }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

### 4.2. Подсистема OG-картинок

**`src/app/og/[slug]/route.tsx`:**

```tsx
import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { posts, users } from "@db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";  // standalone не имеет edge runtime, но next/og работает в Node

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await getDb()
    .select({ title: posts.title, pubAt: posts.pubAt, username: users.username, name: users.name })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.slug, slug), eq(posts.status, "published"), isNull(posts.deletedAt), isNull(posts.hiddenByAdminAt)))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  const dateLabel = row.pubAt ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(row.pubAt) : "";
  const authorLabel = row.name ?? row.username ?? "Аноним";

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        display: "flex", flexDirection: "column",
        padding: "64px",
        fontFamily: "system-ui",
        color: "white",
      }}>
        <div style={{ fontSize: 32, fontWeight: 700, opacity: 0.7 }}>Skelet</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.15, maxHeight: 64 * 1.15 * 3, overflow: "hidden" }}>
            {row.title}
          </div>
        </div>
        <div style={{ fontSize: 28, opacity: 0.7, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 24 }}>
          @{row.username} · {dateLabel}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
```

**Логика выбора OG URL** в `generateMetadata` поста:

```ts
const ogImage = post.coverUrl ?? `${siteUrl}/og/${post.slug}`;
```

### 4.3. Подсистема IndexNow

**`src/lib/indexnow.ts`:**

```ts
import { getEnv } from "@/lib/env";

export async function pingIndexNow(urls: string[]): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  const key = process.env.INDEXNOW_KEY;
  if (!key) return;
  if (urls.length === 0) return;

  const siteUrl = getEnv().NEXTAUTH_URL.replace(/\/$/, "");
  const host = new URL(siteUrl).host;

  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${siteUrl}/${key}.txt`,
        urlList: urls.slice(0, 10000),  // лимит протокола
      }),
      signal: AbortSignal.timeout(5000),  // не блокируем server action даже при медленном api.indexnow.org
    });
  } catch (e) {
    console.warn("[indexnow] ping failed", e);
  }
}

// Хелпер: вычислить набор URL'ов для пинга при изменении поста
export function postUrlsForIndexNow(args: {
  siteUrl: string;
  postSlug: string;
  authorUsername: string | null;
  tagSlugs: string[];
}): string[] {
  const base = args.siteUrl.replace(/\/$/, "");
  const urls = [
    `${base}/p/${args.postSlug}`,
    `${base}/`,
    ...args.tagSlugs.map(s => `${base}/t/${s}`),
  ];
  if (args.authorUsername) urls.push(`${base}/u/${args.authorUsername}`);
  return urls;
}
```

**Где зовём (без `await`, fire-and-forget):**

| Server action | URL'ы |
|---|---|
| `publishPost(id)` — первая публикация | пост + главная + автор + все его теги |
| `updatePost(id)` — если уже published | пост (теги/автор не меняются обычно) |
| `hidePost(id)` (admin) | пост |
| `deletePost(id)` (author/admin) | пост |
| `adminBanUser(id)` если у юзера есть посты | `/u/{username}` |

В тестах вызовы IndexNow можно замокать через `vi.mock("@/lib/indexnow")`.

### 4.4. Подсистема Метрики + /privacy + футер

**`src/components/analytics/YandexMetrika.tsx`** — client component с `<Script strategy="afterInteractive">`, рендерит инициализационный snippet с `clickmap + trackLinks + accurateTrackBounce`, без webvisor. Дополнительно `<noscript>` с pixel-tag для случаев когда JS выключен.

**Подключение в `src/app/layout.tsx`:**

```tsx
{process.env.NODE_ENV === "production" && process.env.YANDEX_METRIKA_ID && (
  <YandexMetrika counterId={process.env.YANDEX_METRIKA_ID} />
)}
```

**`src/app/(public)/privacy/page.tsx`** — серверный компонент, читает строки из `theme/content.ts.privacy`. Структура:

1. Кто мы — имя проекта + `content.site.contactEmail`
2. Какие данные собираем (OAuth-данные, контент, Метрика-аналитика)
3. Cookies — что ставим и зачем
4. Как удалить аккаунт — пишите на email (UI delete account — Phase 2)
5. Контакты — `content.site.contactEmail`
6. Дата обновления

**Футер** — обновляем `src/components/layout/Footer.tsx` (или где он сейчас): добавляем строку «Используем cookies и Yandex.Metrika для аналитики. [Политика](/privacy)».

### 4.5. Подсистема деплоя

**Caddyfile** (финальный, в репо):

```caddy
{
    email {$LETSENCRYPT_EMAIL}
}

www.{$DOMAIN} {
    redir https://{$DOMAIN}{uri} permanent
}

{$DOMAIN} {
    encode gzip zstd
    reverse_proxy app:3000

    @static {
        path /_next/static/*
        path /favicon.ico
        path /icons/*
        path /og/*
    }
    header @static Cache-Control "public, max-age=31536000, immutable"

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        Permissions-Policy "interest-cohort=()"
        X-Frame-Options DENY
        -Server
    }
}
```

**Замечание:** используем два отдельных site-блока (www и apex) — Caddy v2 не объединяет логику `redir` для site-блока с несколькими хостами, поэтому редирект `www → apex` выносим в свой блок. Это однозначно работающий вариант.

**`docker-compose.yml` — изменения относительно текущего:**

```yaml
services:
  caddy:
    environment:
      - DOMAIN=${DOMAIN}
      - LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}    # NEW

  app:
    healthcheck:                                    # NEW
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    # ports: ["127.0.0.1:5432:5432"]  ← УДАЛИТЬ в prod-режиме (если оставляем для dev — отдельный override-файл)
    # Решение: оставляем как есть для dev convenience; на prod 127.0.0.1 уже не доступен извне VPS, не страшно

  backup:
    entrypoint: ["sh", "/backup-entrypoint.sh"]    # CHANGED — переход с while-loop sleep 86400 на расчёт 03:00 MSK
    volumes:
      - ./scripts/backup.sh:/backup.sh:ro
      - ./scripts/backup-entrypoint.sh:/backup-entrypoint.sh:ro    # NEW
```

**`scripts/backup-entrypoint.sh`** — sleep до следующего 03:00 MSK, потом вызов `/backup.sh`, цикл:

```sh
#!/bin/sh
set -e
apk add --no-cache aws-cli tzdata
export TZ=Europe/Moscow

while true; do
  NEXT=$(date -d "today 03:00" +%s)
  NOW=$(date +%s)
  if [ "${NOW}" -ge "${NEXT}" ]; then
    NEXT=$(date -d "tomorrow 03:00" +%s)
  fi
  SLEEP=$((NEXT - NOW))
  echo "[backup] sleeping ${SLEEP}s until $(date -d "@${NEXT}" -Iseconds)"
  sleep "${SLEEP}"
  sh /backup.sh || echo "[backup] FAILED at $(date -Iseconds)"
done
```

**`scripts/backup.sh`** — финальная версия:

```sh
#!/bin/sh
set -e
DATE=$(date +%Y-%m-%d-%H%M)
FILE="backup-${DATE}.sql.gz"
LOCAL="/tmp/${FILE}"

echo "[backup] starting at $(date -Iseconds)"
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h db -U app -d app \
  --no-owner --no-acl --format=plain \
  | gzip -9 > "${LOCAL}"
SIZE=$(du -h "${LOCAL}" | cut -f1)
echo "[backup] dump done: ${FILE} (${SIZE})"

aws --endpoint-url="${BACKUP_S3_ENDPOINT}" \
    s3 cp "${LOCAL}" "s3://${BACKUP_S3_BUCKET}/db/${FILE}"

rm "${LOCAL}"
echo "[backup] uploaded: s3://${BACKUP_S3_BUCKET}/db/${FILE}"
```

### 4.6. Подсистема Storage (рефакторинг env vars)

**Find&replace через IDE:**

| Файл | Изменение |
|---|---|
| `src/lib/env.ts` | Поля `R2_*` → `STORAGE_*`. Добавить `BACKUP_S3_*`. Добавить `DOMAIN`, `LETSENCRYPT_EMAIL`, `INDEXNOW_KEY`, `YANDEX_METRIKA_ID` (optional). |
| `src/lib/storage.ts` (или где `new S3Client(...)`) | Чтение через `getEnv().STORAGE_ENDPOINT` и т.д. |
| `.env`, `.env.example` | Те же имена |
| `next.config.ts` | Переменная `r2Public` → `storagePublic`, комментарий обновить (R2 → Timeweb S3) |
| Тесты, читающие `R2_*` | Соответственно |

Single commit, никакой бизнес-логики.

### 4.7. Подсистема контактного email

**Изменения в `theme/content.ts`** — выносим email в константу верхнего уровня и используем прямую интерполяцию (никаких шаблонных плейсхолдеров):

```ts
const SITE_CONTACT_EMAIL = "test@mail.ru";

export const content = {
  // ... всё что уже есть ...
  site: {
    contactEmail: SITE_CONTACT_EMAIL,
  },
  banned: {
    title: "...",
    reason: "...",
    contact: `Для подробной информации напишите: ${SITE_CONTACT_EMAIL}`,
  },
  privacy: {
    title: "Политика конфиденциальности",
    section: { /* множество строк */ },
    contact: `По вопросам обработки данных пишите: ${SITE_CONTACT_EMAIL}`,
    deleteRequest: `Чтобы удалить аккаунт, напишите на ${SITE_CONTACT_EMAIL} — удалим в течение 7 дней.`,
  },
  footer: {
    disclaimer: "Используем cookies и Yandex.Metrika для аналитики.",
    privacyLink: "Политика",
  },
} as const;
```

Email фиксируется на момент сборки — это нас устраивает (менять email = редеплой). Никаких runtime-подстановок и helper-функций не пишем.

### 4.8. Подсистема мониторинга

**`/api/health`** — реализация в §3.3.

**UptimeRobot setup** — manual post-deploy, описан в `docs/DEPLOY.md`:

1. Регистрация на uptimerobot.com (free tier — до 50 мониторов, 5 минут min interval)
2. Telegram-бот:
   - `/newbot` у @BotFather → имя `skelet_status_bot` → токен
   - `/start` у @userinfobot → твой `chat_id`
3. UptimeRobot → Add Alert Contact → Webhook
   - URL: `https://api.telegram.org/bot<TOKEN>/sendMessage`
   - POST body (JSON): `{"chat_id":"<CHAT_ID>","text":"*alertTypeFriendlyName* — *monitorFriendlyName*"}`
4. Add Monitor → HTTP(s)
   - URL: `https://example.ru/api/health`
   - Interval: 5 min, Timeout: 30s
   - Alert when: 2 consecutive failures
   - Alert Contacts: тот webhook

---

## 5. Структура файлов — итого

### Создаются

```
src/app/
  sitemap.ts
  robots.ts
  api/health/route.ts
  og/[slug]/route.tsx
  (public)/privacy/page.tsx

src/lib/
  jsonld.ts
  indexnow.ts

src/components/
  analytics/YandexMetrika.tsx

scripts/
  backup-entrypoint.sh

docs/
  DEPLOY.md
  RECOVERY.md

public/
  <INDEXNOW_KEY>.txt           # генерим из env при деплое (не commit'им — содержит ключ)
  google<hash>.html             # коммитим когда зарегаем сайт
  yandex_<hash>.html            # коммитим когда зарегаем сайт
```

### Модифицируются

```
src/app/layout.tsx                        # подключение YandexMetrika, обновление Metadata API
src/app/(public)/(feed)/page.tsx          # JSON-LD WebSite, generateMetadata
src/app/(public)/p/[slug]/page.tsx        # JSON-LD BlogPosting + Breadcrumb, OG image выбор
src/app/(public)/(feed)/t/[slug]/page.tsx # JSON-LD Breadcrumb
src/app/(public)/(feed)/u/[username]/page.tsx # JSON-LD Breadcrumb
src/app/banned/page.tsx                   # читаем contact через SITE_CONTACT_EMAIL
src/app/new/page.tsx                      # robots noindex (если ещё не стоит)
src/app/edit/[id]/page.tsx                # robots noindex
src/app/drafts/page.tsx                   # robots noindex
src/app/admin/page.tsx                    # robots noindex

src/components/layout/Footer.tsx          # disclaimer + link на /privacy
src/components/posts/actions/*.ts         # pingIndexNow в publishPost/updatePost/hidePost/deletePost
src/components/admin/banUser*             # pingIndexNow в adminBanUser

src/lib/env.ts                            # R2_* → STORAGE_*, добавить BACKUP_S3_*, DOMAIN, LETSENCRYPT_EMAIL, INDEXNOW_KEY, YANDEX_METRIKA_ID
src/lib/storage.ts                        # читать STORAGE_* (вместо R2_*)
src/lib/db.ts                             # без изменений (использует DATABASE_URL)

theme/content.ts                          # site.contactEmail, privacy.*, footer.*, banned.contact через ref

next.config.ts                            # переменная r2Public → storagePublic, комментарий

docker-compose.yml                        # healthcheck на app, backup entrypoint
Caddyfile                                 # prod-headers, LETSENCRYPT_EMAIL, www→apex redirect
scripts/backup.sh                         # финальная версия с --no-owner и gzip -9
.env, .env.example                        # переименование переменных + новые
```

### Удаляются

Ничего.

---

## 6. Env vars — полный список

См. §4.6 + §4.5. Финальный `.env.example` после plan-06:

```bash
# === Application ===
NODE_ENV=production
NEXTAUTH_URL=https://example.ru
NEXTAUTH_SECRET=<openssl rand -base64 32>
DOMAIN=example.ru
LETSENCRYPT_EMAIL=test@mail.ru

# === Database ===
DB_PASSWORD=<openssl rand -base64 24>
DATABASE_URL=postgres://app:${DB_PASSWORD}@db:5432/app

# === OAuth (создать prod-приложения с redirect на https://example.ru/api/auth/callback/...) ===
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
VK_CLIENT_ID=...
VK_CLIENT_SECRET=...

# === Image storage (Timeweb S3 Standard) ===
STORAGE_ENDPOINT=https://s3.timeweb.cloud
STORAGE_BUCKET=skelet-images
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_PUBLIC_BASE=https://skelet-images.s3.timeweb.cloud

# === Backups (Timeweb S3 Cold; separate user) ===
BACKUP_S3_ENDPOINT=https://s3.timeweb.cloud
BACKUP_S3_BUCKET=skelet-backups
BACKUP_S3_ACCESS_KEY_ID=...
BACKUP_S3_SECRET_ACCESS_KEY=...

# === SEO ===
INDEXNOW_KEY=<openssl rand -hex 16>

# === Analytics (optional — если пусто, Метрика не грузится) ===
YANDEX_METRIKA_ID=...
```

В `env.ts` zod-схема использует `.superRefine` чтобы:
- В `NODE_ENV === 'production'` обязательны: DOMAIN, LETSENCRYPT_EMAIL, STORAGE_*, BACKUP_S3_*, INDEXNOW_KEY (остальные — `optional`)
- В dev — STORAGE_* можно опускать (если пусто, upload-route вернёт 503 при попытке загрузить)

---

## 7. Тесты

Тестов в plan-06 относительно немного — большинство нового кода это plumbing (Metadata API, JSON-LD constructors) и infrastructure (deploy scripts). Но критическое покрываем:

### 7.1. Unit-тесты

**`tests/lib/jsonld.test.ts`:**
- `buildBlogPostingJsonLd` — для типичного поста + автор + теги → проверяем все обязательные поля schema.org (`@context`, `@type`, `headline`, `datePublished`, `author`, etc.)
- `buildBreadcrumbJsonLd` — два-три уровня хлебных крошек → правильный `itemListElement`
- `buildWebSiteJsonLd` — минимальные поля + потенциальный `inLanguage: ru-RU`

**`tests/lib/indexnow.test.ts`:**
- `pingIndexNow([])` — пустой массив, no-op (не делает fetch)
- `pingIndexNow(["/p/abc"])` без `INDEXNOW_KEY` — no-op
- `pingIndexNow(["/p/abc"])` в `NODE_ENV !== production` — no-op
- `pingIndexNow(["/p/abc"])` с key + production — `fetch` вызван с правильным body (через `vi.fn` mock)
- `postUrlsForIndexNow({...})` — корректные URL'ы для типичного случая

**`tests/lib/env.test.ts`** (если есть, иначе создаём):
- В `NODE_ENV === 'production'` без `STORAGE_ENDPOINT` — `parseEnv` бросает
- В `NODE_ENV === 'development'` без `STORAGE_ENDPOINT` — OK

### 7.2. Integration-тесты

**`tests/seo/sitemap.test.ts`:**
- Запускаем `sitemap()` против тестовой БД с известным набором постов/тегов/пользователей
- Проверяем что:
  - Не-опубликованные посты (`status='draft'|'archived'`) не попадают
  - Soft-deleted (`deletedAt != null`) не попадают
  - Скрытые админом (`hiddenByAdminAt != null`) не попадают
  - Banned юзеры (`bannedAt != null`) не попадают в `/u/*`
  - `/`, `/tags` всегда есть
  - URL'ы с правильным `siteUrl` префиксом

**`tests/seo/robots.test.ts`:**
- `robots()` возвращает все disallow-пути
- `sitemap` URL правильный (по `NEXTAUTH_URL`)

**`tests/og/route.test.tsx`** (если можно — `ImageResponse` сложно тестировать; в minimum:)
- GET с несуществующим slug → 404
- GET с опубликованным постом → 200 + Content-Type `image/png`
- (рендеринг проверяем визуально руками — это статика)

### 7.3. Component tests

**`tests/components/analytics/YandexMetrika.test.tsx`:**
- В `NODE_ENV !== production` — компонент рендерит `null` (или его не вызывают — проверяется в layout-тесте)
- В production с counterId — script-тег есть в DOM, содержит правильный counterId

**`tests/components/layout/Footer.test.tsx`:**
- Содержит disclaimer + ссылку на `/privacy`

### 7.4. Page tests

**`tests/app/privacy.test.tsx`:**
- `/privacy` рендерится, содержит контактный email (тот же что в `theme/content.ts.site.contactEmail`)
- Содержит секции о Метрике и cookies

**`tests/app/post-page-seo.test.tsx`** (или расширение существующего post-page-test):
- На `/p/[slug]` есть `<script type="application/ld+json">` с `BlogPosting`
- Есть `<script type="application/ld+json">` с `BreadcrumbList`
- В `<head>` есть `og:image` со значением `coverUrl` ИЛИ `/og/<slug>` если нет cover

### 7.5. Не покрываем тестами (вручную)

- Каддивский `Caddyfile` — проверяется через `docker compose up` локально перед деплоем
- `backup.sh` и `backup-entrypoint.sh` — recovery drill (отдельная задача)
- UptimeRobot, Search Console, Webmaster — manual setup
- Pre-deploy smoke test (см. §10) — checklist в `docs/DEPLOY.md`

---

## 8. DoD checklist (для plan-файла)

Финальный плановый файл должен иметь чек-лист:

- [ ] `pnpm tsc --noEmit` — зелено
- [ ] `pnpm test` — все тесты зелёные, без новых flake'ов
- [ ] `pnpm build` — production-сборка проходит локально
- [ ] `docker compose build app` — образ собирается без ошибок локально
- [ ] `docker compose up -d` локально работает: открываются /, /p/[slug], /t/[slug], /u/[username], /sitemap.xml, /robots.txt, /api/health, /og/[slug], /privacy
- [ ] JSON-LD на /p/[slug] валиден через Google Rich Results Test (manual)
- [ ] OG-картинки для постов корректно отображаются в Telegram превью (manual — отправить ссылку в @userinfobot или личный чат)
- [ ] Sitemap содержит ожидаемое количество постов/тегов/пользователей
- [ ] Robots блокирует все приватные пути
- [ ] IndexNow: `publishPost` в integration-тесте вызывает `pingIndexNow` с корректным URL-списком (через mock)
- [ ] Yandex.Metrika: счётчик грузится в production-сборке (manual: `docker compose up` с `NODE_ENV=production` локально + DevTools Network → `tag.js`)
- [ ] `/privacy` страница содержит контактный email из `content.site.contactEmail`
- [ ] Footer disclaimer + ссылка на /privacy есть на всех публичных страницах
- [ ] Каддивский конфиг проходит проверку: `caddy validate --config Caddyfile`
- [ ] Recovery drill пройден: тестовый дамп → пустая БД → восстановление → counts совпадают
- [ ] `docs/DEPLOY.md` написан и пошагово работоспособен (manual review)
- [ ] `docs/RECOVERY.md` написан (manual review)
- [ ] Pre-deploy smoke test чек-лист в `docs/DEPLOY.md` (см. §10)
- [ ] Все env vars переименованы (`R2_*` → `STORAGE_*`); `grep -r "R2_" src/` пусто (кроме контекста где исторически фигурирует Cloudflare R2 в комментариях)

---

## 9. Post-deploy manual steps (не часть кода)

После первого `docker compose up -d` на VPS — одноразовая настройка внешних сервисов. Документируется в `docs/DEPLOY.md`:

1. **DNS** — у регистратора создать A-запись `example.ru → VPS_IP` (и `www.example.ru → VPS_IP`)
2. **OAuth** — в Yandex/VK OAuth-кабинетах создать prod-приложения с redirect URI `https://example.ru/api/auth/callback/{yandex,vk}`
3. **Timeweb S3 Cold bucket** `skelet-backups`: создать, добавить lifecycle policy (delete >30 дней), создать service user
4. **Timeweb S3 Standard bucket** `skelet-images`: создать, CORS-конфиг, public read, создать service user
5. **Yandex.Metrika** — счётчик через metrica.yandex.ru, получить ID, прописать в env
6. **Yandex Webmaster** — добавить сайт, верифицировать (HTML-метод: положить файл в `public/`, redeploy)
7. **Google Search Console** — добавить сайт, верифицировать (HTML-метод аналогично)
8. **UptimeRobot** — см. §4.8
9. **Telegram-бот** для алёртов — см. §4.8

После всего этого — sitemap засабмитить в GSC и Webmaster (один раз).

---

## 10. Pre-deploy smoke test (на локальной машине)

Перед первым деплоем и перед каждым релизом. Документируется в `docs/DEPLOY.md`:

1. `pnpm test` — зелёно
2. `pnpm tsc --noEmit` — зелёно
3. `pnpm build` — production-сборка локально прошла
4. `docker compose build app` — Docker-сборка локально проходит
5. (Опционально) Создать `.env.prod-test` с реальными prod-кредами Timeweb S3 + локальной БД, запустить `docker compose --env-file .env.prod-test up -d`. Открыть `http://localhost` и проверить:
   - / открывается, видны посты
   - /p/[slug] → есть JSON-LD в DOM, есть OG-meta в head
   - Загрузка картинки через `/new` идёт в Timeweb (не Yandex)
   - /sitemap.xml содержит ожидаемые URL'ы
   - /robots.txt отдаёт sitemap
   - /api/health возвращает 200
   - /og/[slug] отдаёт PNG
   - Метрика-счётчик в DOM (если `YANDEX_METRIKA_ID` указан и `NODE_ENV=production`)

Только после зелёного — `ssh skelet@vps && git pull && docker compose up -d app`.

---

## 11. Зависимости и риски

| # | Риск / Зависимость | Митигейшн |
|---|---|---|
| 1 | **Первая Docker-сборка падает в OOM на 1GB VPS** | Документировать в `docs/DEPLOY.md` fallback: `fallocate -l 3G /swapfile && mkswap && swapon` (5 минут). Если и со swap не идёт — апгрейд тарифа |
| 2 | **Caddy не получает сертификат от Let's Encrypt** | Обычно — DNS не указывает на IP, или 80/443 закрыты firewall'ом. Чек-лист в `docs/DEPLOY.md`: `curl -I http://example.ru` должен ходить через Caddy |
| 3 | **Timeweb S3 CORS не настроен — uploads ломаются** | Описать в `docs/DEPLOY.md` шаг настройки CORS перед первым реальным uploadом. Smoke-test catch'нет |
| 4 | **IndexNow ping вешает server action** | `pingIndexNow` ловит ошибки, не `await`-им результат там где не критично; в любом случае таймаут fetch (по умолчанию ~30s — это много); рассмотреть `AbortSignal.timeout(5000)` |
| 5 | **`next/og` не работает в standalone-выводе** | В spec'е написано "работает" — нужно подтвердить локально через `docker compose up` + curl `/og/test-slug`. Если не работает — fallback: pre-render OG как static при publish (сложнее, отложим если столкнёмся) |
| 6 | **Backup-контейнер не имеет aws-cli — apk add фейлится** | `apk add --no-cache aws-cli` есть в Alpine main repo. Тест: локально запустить `docker run --rm postgres:16-alpine apk add --no-cache aws-cli` и проверить exit 0 |
| 7 | **Восстановление дампа на разных Postgres-версиях** | Используем тот же `postgres:16-alpine` и для dump'а, и для restore. Если переходим на 17 — отдельная задача (Phase 2+) |
| 8 | **UptimeRobot пингует /api/health, который ходит в Postgres → лишняя нагрузка** | `SELECT 1` каждые 5 минут — копейки. На случай если боимся: добавить `pg_stat_statements` исключение, или health endpoint без БД-чека (тогда не ловим broken-db ошибки — компромисс) |
| 9 | **Verification-файлы Google/Yandex попадают в git с реальным hash** | Решение: коммитим только когда зарегаем сайт. Hash не секретный — попадание в публичный repo не страшно |
| 10 | **Метрика в `NODE_ENV=production` локально шлёт реальные хиты в кабинет** | YANDEX_METRIKA_ID в `.env.prod-test` ставить пустым ИЛИ использовать отдельный test-counter в Metrica |
| 11 | **Переход с picsum.photos на реальные uploads после мержа seed-script ветки** | seed-script ветка отдельная; в plan-06 spec'е её не касаемся. Когда смержат — `next.config.ts` уже будет содержать picsum-hosts (для dev), на prod это безвредно (никто там не открывает picsum URL'ы) |

---

## 12. Открытые вопросы (решаем при имплементации)

1. **Можно ли использовать `next/og` в Node runtime standalone?** Документация говорит «works in Node and Edge». Проверим первым делом при имплементации — если нет, отдельная задача переписать.
2. **`/api/health`: проверять только Postgres или ещё S3 (через `HeadBucket`)?** Сейчас только Postgres — это keep-it-simple. Если в Phase 2 будут проблемы с S3 — добавим.
3. **Email в `/privacy` как `mailto:` или просто текст?** Дефолт — `<a href="mailto:...">` для удобства. Окончательно — на этапе вёрстки.
4. **Recovery drill — на dev-БД или поднимать отдельный test compose?** Логично на dev — заводим новую БД через `psql -c "CREATE DATABASE restore_test"`, накатываем туда, проверяем counts, дропаем. Подробности в `docs/RECOVERY.md`.
5. **Тестируемость `/og/[slug]` через vitest:** `next/og` `ImageResponse` плохо запускается в `jsdom`. Если запуск в vitest проблематичен — заменяем интеграционный тест на проверку через `next dev` руками (см. §7.5) и оставляем только unit-тесты на хелперы вокруг (truncate, fallback initials).

---

## 13. Что НЕ делает plan-06 — явно (откладывается)

- **Поиск (tsvector)** — Phase 2 (§12.1 главного дизайна)
- **RSS feed** — Phase 2
- **Email-логин (Resend)** — Phase 2
- **Лайки / реакции** — Phase 2
- **Треды в комментах** — Phase 2
- **Похожие посты** — Phase 2
- **Подписки на авторов/теги, email-дайджесты, уведомления** — Phase 3
- **Persistent observability** (Grafana/Loki/Sentry) — Phase 3 если понадобится
- **CDN перед Timeweb** — когда заметим, что Timeweb S3 не успевает
- **CI/CD (GitHub Actions автодеплой)** — Phase 2 если ритм релизов вырастет
- **Staging environment** — Phase 2 если релизы станут страшными
- **Multi-tenancy / сводить несколько ниш на один VPS** — §11.7 главного дизайна, отдельная задача
- **delete-account UI** — Phase 2 (пока через email-запрос в `/privacy`)

---

## 14. Канонические ссылки

- Главный дизайн (Phase 1 + roadmap): `docs/superpowers/specs/2026-06-05-skelet-blog-design.md`
- Предыдущая спека (engagement): `docs/superpowers/specs/2026-06-21-plan-05b-engagement-design.md`
- Memory: `Skelet 6 milestone plans` (plan-06 закрывает Phase 1)
