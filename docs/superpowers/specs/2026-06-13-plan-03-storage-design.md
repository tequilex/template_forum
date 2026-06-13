# Plan 3 (Storage + Images) — спецификация

**Дата:** 2026-06-13
**Состояние:** brainstorm пройден, дизайн утверждён владельцем
**Канон высшего уровня:** `docs/superpowers/specs/2026-06-05-skelet-blog-design.md` §5 (стек), §6.1/§6.2 (`uploads` table), §8.2 (upload flow), §16 (разбивка фаз)

---

## 1. Цель плана

Дать остальным планам (4 — Posts+Editor, 5 — Feed+Comments) рабочий слой загрузки картинок:

1. S3-совместимый клиент к Cloudflare R2 + конфиг через env.
2. Серверный роут `POST /api/upload`, который принимает картинку, нормализует через `sharp`, кладёт в R2, пишет строку в `uploads`.
3. Таблица `uploads` со схемой и миграцией.
4. Скрипт `cleanup-orphan-uploads.ts` (logic есть, cron — отложен до plan-06).
5. Stub-конфиг Editor.js image-tool, готовый к монтажу в plan-04.
6. `next/image` `remotePatterns` под public R2 host.

**Не делаем:**
- UI-страницы с Editor.js (это plan-04).
- Линковку `uploads.post_id` (таблицы `posts` ещё нет — plan-04).
- Cron-инфраструктуру (plan-06).
- HEIC (отложено; добавляется аддитивно через `heic-convert`).
- Animated WebP (GIF→статичный WebP, первый кадр).
- Resize variants (`next/image` сам генерит мелкие размеры из нормализованного оригинала).
- Local-FS fallback (R2-only; нет env → 503).
- Admin moderation UI (вне фазы 1).

---

## 2. Архитектурные решения (зафиксированы в brainstorm)

| # | Решение | Альтернативы рассмотрены | Почему |
|---|---|---|---|
| 1 | Sharp через **прокси-роут** `/api/upload` (multipart) | A) presigned-PUT без ресайза; C) presigned + background-sharp воркер | A: в R2 ложатся тяжёлые оригиналы, `next/image` гоняет их через свой оптимизатор на каждый запрос. C: нужна очередь/воркер — overhead для фазы 1. |
| 2 | **Один** нормализованный WebP в R2 | 1) +thumb 640; 2) полный набор (orig/1280/640/320) | `next/image` уже делает on-demand resize у себя в `.next/cache`. Дублировать в R2 = лишнее место и код. |
| 3 | Public R2 bucket + `R2_PUBLIC_BASE` | Прокси через Next (`/img/[key]`) | Картинки в постах публичны по природе. Прокси даёт двойной траф (R2→Next→браузер) и CPU. Приватный доступ — фаза 3+. |
| 4 | **R2-only strict** (нет env → 503) | Hybrid с FS-фоллбэком в `./public/uploads` | Удваивает surface тестирования (два пути в storage-слое), магия в коде. R2 dev-bucket делается за 5 минут. |
| 5 | MIME accept = `{jpeg,png,webp,gif}`, output = `image/webp` | + HEIC; без GIF | HEIC откладываем аддитивно через `heic-convert` (не требует libheif). GIF принимаем, но animated flatten → static WebP (первый кадр). |
| 6 | Editor.js image-tool — **только config-фабрика** в `src/lib/editor/` | a) Только бэкенд + dev-страница; c) реальная Editor.js страница | Полное монтирование Editor.js — это plan-04. Фабрика-стаб даёт plan-04 готовый объект для `new EditorJS({ tools: { image: ... } })`. |
| 7 | Orphan cleanup — **скрипт runnable вручную** в plan-03; cron в plan-06 | a) полностью отложить в plan-06; c) node-cron внутри Next | Логику пишем сейчас, чтобы plan-06 не превратился в день деплоя + сырой код. Инфра-обвязка cron'а — отдельная история для compose. |

---

## 3. Архитектура флоу

```
Браузер (multipart/form-data, поле "image")
   └─ POST /api/upload
        │
        ├─ await auth() → 401 если нет сессии
        ├─ env.R2_* отсутствует → 503 "storage not configured"
        ├─ readFormData → Blob → arrayBuffer → Buffer (early-reject по Content-Length > 10 MB)
        ├─ buf.byteLength > 10 MB → 413
        ├─ detectMime(buf)  (magic bytes, file-type)
        │     ├─ null или ∉ ACCEPTED_MIME → 415
        ├─ normalizeToWebp(buf) → { buffer, width, height, size }
        │     sharp(buf).rotate().resize({width:2560,height:2560,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer()
        │     + sharp(out).metadata() → width/height
        ├─ id = ulid()
        ├─ key = buildKey(session.user.id, id)           → uploads/<userId>/<ulid>.webp
        ├─ publicUrl = buildPublicUrl(key)               → ${R2_PUBLIC_BASE}/<key>
        ├─ putObject({key, body, contentType:"image/webp"})
        │     CacheControl: "public, max-age=31536000, immutable"
        ├─ INSERT uploads (id, user_id, post_id=null, key, public_url, mime="image/webp", size, width, height)
        └─ 200 { success: 1, file: { url: publicUrl, width, height }, uploadId: id }
```

**Свойства:**
- **Single source of truth для URL.** `publicUrl` всегда = `${R2_PUBLIC_BASE}/${key}`. В коде нет других мест, где конструируется URL картинки.
- **Content-addressed.** ULID в key + `Cache-Control: immutable` → cache-invalidation не нужен. Перезалив = новый ULID = новый URL.
- **width/height из sharp**, не с клиента. Клиент-probe из старой спеки §8.2 убран — мы теперь видим файл на сервере, незачем доверять браузеру.
- **MIME из magic bytes**, не из `Content-Type` заголовка. Клиент не может соврать.
- **Формат ответа подогнан под `@editorjs/image`** — `{ success: 1, file: { url, width, height } }`. Это контракт image-tool'а; plan-04 просто монтирует его без обёрток.
- **Идемпотентность не требуется.** Если та же картинка загружена дважды — это два разных ULID, две строки `uploads`, два объекта в R2. Дедуп по hash — выходит за scope фазы 1.

---

## 4. DB-схема и миграция

```ts
// drizzle/schema.ts (добавление)
export const uploads = pgTable("uploads", {
  id: text("id").primaryKey(),                              // ULID, генерим на app
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: text("post_id"),                                  // FK добавится в plan-04 миграцией
  key: text("key").notNull().unique(),                      // uploads/<userId>/<ulid>.webp
  publicUrl: text("public_url").notNull(),                  // ${R2_PUBLIC_BASE}/<key>
  mime: varchar("mime", { length: 60 }).notNull(),          // в plan-03 всегда "image/webp"
  size: bigint("size", { mode: "number" }).notNull(),       // байты финального WebP
  width: integer("width").notNull(),                        // sharp всегда возвращает
  height: integer("height").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("uploads_user_idx").on(t.userId, t.createdAt),
  postIdx: index("uploads_post_idx").on(t.postId),
}));
```

**Расхождения со спекой §6.2:**
- `postId` без FK на `posts.id` — `posts` появится в plan-04. План-04 добавит миграцию `ALTER TABLE uploads ADD CONSTRAINT uploads_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL`.
- `width`/`height` сделаны `notNull` (в спеке были nullable). Sharp всегда возвращает их, незачем поддерживать null-кейс.
- Индекс `uploads_post_idx` — нужен для cleanup-script (`WHERE post_id IS NULL`) и линковки в plan-04 (`UPDATE … WHERE public_url IN (…)`); в спеке индекса не было.
- `mime` остаётся `varchar(60)` для будущего расширения (animated WebP с MIME-аннотацией, AVIF), но в plan-03 всегда `"image/webp"`.

Файл миграции: `drizzle/migrations/0001_uploads.sql` через `pnpm db:generate`.

---

## 5. Файловая раскладка

**Новые файлы:**

```
src/lib/storage/r2.ts              # S3-клиент к R2 (lazy singleton)
src/lib/storage/upload.ts          # buildKey, buildPublicUrl, putObject

src/lib/images/validate.ts         # detectMime через magic bytes (file-type)
src/lib/images/normalize.ts        # sharp pipeline → WebP buffer + metadata

src/lib/editor/image-tool.ts       # buildImageToolConfig() для plan-04

src/app/api/upload/route.ts        # POST → 200 | 401 | 413 | 415 | 503 | 500

scripts/cleanup-orphan-uploads.ts  # runnable: pnpm cleanup:orphans [--dry-run]

tests/storage/normalize.test.ts
tests/storage/r2-key.test.ts
tests/storage/validate.test.ts
tests/storage/upload-route.test.ts
tests/storage/env-r2.test.ts

tests/fixtures/images/             # маленькие фикстуры jpeg/png/webp/gif/txt
```

**Изменяемые:**

- `drizzle/schema.ts` — добавить `uploads`
- `src/lib/env.ts` — пять `R2_*` ключей + superRefine (all-5 или zero)
- `.env`, `.env.example` — пять закомменченных R2-переменных + `R2_PUBLIC_BASE`
- `next.config.ts` — `images.remotePatterns: [{ protocol: "https", hostname: new URL(env.R2_PUBLIC_BASE).hostname }]`, пустой массив если env не задан
- `package.json` — `"cleanup:orphans": "tsx scripts/cleanup-orphan-uploads.ts"`
- (тесты, retro) — `tests/auth/env-oauth.test.ts` остаётся; новые env-кейсы — отдельный файл

**Новые зависимости:**

| Пакет | Назначение | dep/devDep |
|---|---|---|
| `@aws-sdk/client-s3` | R2 S3-API клиент | dep |
| `sharp` | ресайз/перекодировка | dep |
| `file-type` | MIME из magic bytes | dep |
| `@editorjs/editorjs` | peer для image-tool config | dep |
| `@editorjs/image` | image-tool класс | dep |
| `tsx` | запуск `scripts/*.ts` | devDep |

---

## 6. Интерфейсы модулей

### 6.1. `src/lib/storage/r2.ts`

```ts
import { S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_client) return _client;
  const env = getEnv();
  if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 not configured");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function r2Bucket(): string {
  const env = getEnv();
  if (!env.R2_BUCKET) throw new Error("R2_BUCKET not set");
  return env.R2_BUCKET;
}

export function _resetR2ClientForTests(): void { _client = null; }
```

### 6.2. `src/lib/storage/upload.ts`

```ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";
import { getR2Client, r2Bucket } from "./r2";

export function buildKey(userId: string, ulid: string): string {
  return `uploads/${userId}/${ulid}.webp`;
}

export function buildPublicUrl(key: string): string {
  const base = getEnv().R2_PUBLIC_BASE!.replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function putObject(opts: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await getR2Client().send(new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: opts.key,
    Body: opts.body,
    ContentType: opts.contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
}
```

### 6.3. `src/lib/images/validate.ts`

```ts
import { fileTypeFromBuffer } from "file-type";

export const ACCEPTED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
] as const;
export type AcceptedMime = typeof ACCEPTED_MIME[number];

export async function detectMime(buf: Buffer): Promise<AcceptedMime | null> {
  const result = await fileTypeFromBuffer(buf);
  if (!result) return null;
  return (ACCEPTED_MIME as readonly string[]).includes(result.mime)
    ? (result.mime as AcceptedMime)
    : null;
}
```

### 6.4. `src/lib/images/normalize.ts`

```ts
import sharp from "sharp";

export const MAX_SIDE = 2560;
export const WEBP_QUALITY = 85;

export type NormalizedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
};

export async function normalizeToWebp(input: Buffer): Promise<NormalizedImage> {
  const buffer = await sharp(input)
    .rotate()                                  // авто-rotate по EXIF, потом EXIF strip
    .resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) throw new Error("normalizeToWebp: missing dimensions");
  return { buffer, width: meta.width, height: meta.height, size: buffer.byteLength };
}
```

### 6.5. `src/lib/editor/image-tool.ts`

```ts
import ImageTool from "@editorjs/image";

export function buildImageToolConfig(): {
  class: typeof ImageTool;
  config: { endpoints: { byFile: string } };
} {
  return {
    class: ImageTool,
    config: { endpoints: { byFile: "/api/upload" } },
  };
}
```

(Plan-04 импортирует и кладёт в `tools.image` при инициализации Editor.js.)

### 6.6. `src/app/api/upload/route.ts`

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  if (!env.R2_ENDPOINT) return errJson(503, "storage_not_configured");

  const session = await auth();
  if (!session?.user?.id) return errJson(401, "unauthorized");

  const cl = Number(req.headers.get("content-length") ?? 0);
  if (cl > MAX_BYTES) return errJson(413, "too_large");

  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof Blob)) return errJson(400, "no_image");
  if (file.size > MAX_BYTES) return errJson(413, "too_large");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = await detectMime(buf);
  if (!mime) return errJson(415, "bad_mime");

  let normalized: NormalizedImage;
  try { normalized = await normalizeToWebp(buf); }
  catch (e) { console.error("[upload] sharp failed:", e); return errJson(500, "normalize_failed"); }

  const id = newId();
  const key = buildKey(session.user.id, id);
  const publicUrl = buildPublicUrl(key);

  try { await putObject({ key, body: normalized.buffer, contentType: "image/webp" }); }
  catch (e) { console.error("[upload] r2 put failed:", e); return errJson(500, "r2_failed"); }

  try {
    await getDb().insert(uploads).values({
      id, userId: session.user.id, postId: null,
      key, publicUrl, mime: "image/webp",
      size: normalized.size, width: normalized.width, height: normalized.height,
    });
  } catch (e) { console.error("[upload] db insert failed:", e); return errJson(500, "db_failed"); }

  return NextResponse.json({
    success: 1,
    file: { url: publicUrl, width: normalized.width, height: normalized.height },
    uploadId: id,
  });
}

function errJson(status: number, error: string) {
  return NextResponse.json({ success: 0, error }, { status });
}
```

### 6.7. `scripts/cleanup-orphan-uploads.ts`

```ts
// Usage:
//   pnpm cleanup:orphans            (реально удаляет)
//   pnpm cleanup:orphans --dry-run  (только логи)
//
// Логика:
// SELECT id, key FROM uploads WHERE post_id IS NULL AND created_at < now() - interval '7 days';
// for each: R2 DeleteObject(key) → DELETE FROM uploads WHERE id = $1;
// в конце: console.log totals { found, deleted, errors }
```

---

## 7. env-схема

```ts
// src/lib/env.ts (добавить в z.object)
R2_ENDPOINT:           z.string().url().optional(),
R2_BUCKET:             z.string().min(1).optional(),
R2_ACCESS_KEY_ID:      z.string().min(1).optional(),
R2_SECRET_ACCESS_KEY:  z.string().min(1).optional(),
R2_PUBLIC_BASE:        z.string().url().optional(),
```

В `.superRefine`:

```ts
const r2Keys = ["R2_ENDPOINT","R2_BUCKET","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_PUBLIC_BASE"] as const;
const presence = r2Keys.map(k => Boolean((v as Record<string,string|undefined>)[k]));
const all = presence.every(Boolean);
const none = presence.every(p => !p);
if (!all && !none) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["R2_BUCKET"],
    message: "R2_* env vars must be all set or all empty" });
}
```

`.env.example` (расширение):
```env
# === Хранилище (Cloudflare R2) — план 3 ===
# R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
# R2_BUCKET=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_PUBLIC_BASE=https://images.example.ru
```

---

## 8. `next.config.ts`

```ts
import { getEnv } from "@/lib/env";

const env = getEnv();
const remotePatterns = env.R2_PUBLIC_BASE
  ? [{ protocol: new URL(env.R2_PUBLIC_BASE).protocol.replace(":","") as "https"|"http",
       hostname: new URL(env.R2_PUBLIC_BASE).hostname }]
  : [];

export default {
  images: { remotePatterns },
  // … остальные настройки plan-01
};
```

При пустых R2-env (большинство dev-машин) `remotePatterns: []` — это валидно, `next build` проходит.

---

## 9. Тесты

| Файл | Покрывает |
|---|---|
| `tests/storage/normalize.test.ts` | sharp: 4000×3000 → 2560×1920; EXIF-rotate 6 → правильная ориентация; JPEG-вход → WebP-выход; `.metadata()` совпадает с возвращёнными w/h; маленькая 200×200 не апскейлится |
| `tests/storage/r2-key.test.ts` | `buildKey` формат; `buildPublicUrl` склейка; trim trailing slash в `R2_PUBLIC_BASE` |
| `tests/storage/validate.test.ts` | `detectMime` для jpeg/png/webp/gif → корректный MIME; для txt и пустого буфера → null |
| `tests/storage/env-r2.test.ts` | `parseEnv`: ноль ключей ок; все 5 ключей ок; 1 из 5 — throw с упоминанием `R2_*` |
| `tests/storage/upload-route.test.ts` | `/api/upload`: 401 без сессии; 503 без R2-env; 415 для txt; 413 для 15 MB; 200 для jpeg — мокаем `getR2Client().send` + in-memory Drizzle |

Фикстуры в `tests/fixtures/images/`: маленькие (≤50 KB) `.jpg`, `.png`, `.webp`, `.gif`, `.txt`, `.jpg-rotate6` (EXIF orientation=6).

`_resetEnvCacheForTests` из `src/lib/env.ts` переиспользуем; добавляем `_resetR2ClientForTests` в `src/lib/storage/r2.ts`.

---

## 10. Зона риска (заранее)

1. **`sharp` бинарники.** На M1/M2 macOS prebuild идёт через `@img/sharp-darwin-arm64`; на Hetzner Linux x64 — `@img/sharp-linux-x64`. Если `pnpm install` не сразу скачивает нужный prebuild — может потребоваться `pnpm install --config.platform=linux --config.arch=x64` или `SHARP_IGNORE_GLOBAL_LIBVIPS=1`. Зафиксировать в README раздел «sharp on Hetzner».
2. **`@aws-sdk/client-s3` размер бандла.** Полный SDK тащит ~150 KB сжатого в Node-роут. Это окей для server-side, но если когда-то понадобится edge-runtime для `/api/upload` — пакет несовместим. План-03 фиксирует `runtime = "nodejs"` явно.
3. **`@editorjs/image` config-форма.** Тестировано на @editorjs/image@2.10+. Контракт ответа: `{ success: 1, file: { url, ... } }`. Если в plan-04 окажется, что свежая версия требует другую форму (`{ data: { url } }` — было в 1.x) — корректируем формат ответа `/api/upload`. Контракт зафиксировать тестом в plan-04.
4. **R2 endpoint и `region: "auto"`.** Cloudflare R2 требует `region: "auto"` в S3-клиенте; не `"us-east-1"`. Это легко перепутать — фиксируем в `getR2Client()` хардкодом, не из env.
5. **EXIF-strip vs orientation.** `sharp().rotate()` без аргументов сначала читает EXIF orientation и физически крутит пиксели — только потом WebP-encode без EXIF. Если поменять порядок (`.webp().rotate()`) — orientation пропадёт. Тест на EXIF rotate=6 это ловит.
6. **GIF animated.** `sharp(animatedGif).webp({ quality: 85 })` без `{ animated: true }` берёт **первый кадр**. Это наше явное решение (см. §2/решение 5). Тест: animated GIF на вход → WebP с одним кадром на выход.
7. **`next.config.ts` сейчас `.mjs` или `.ts`?** Если `.mjs`, `import { getEnv }` ломается без `tsx`/`esbuild-register`. Возможно потребуется перевести в `next.config.ts` (Next 15 поддерживает) или вынести env-чтение в `lib/env.cjs`-stub. Проверить в plan-03 task 0.

---

## 11. DoD (готовность плана-03 для перехода к plan-04)

1. `pnpm test` зелёный (минимум +5 новых файлов, ~15 кейсов).
2. `pnpm build` зелёный с пустым R2-env (remotePatterns пустой) И с заполненным.
3. Миграция `0001_uploads.sql` применяется на чистой БД (`pnpm db:migrate`); rollback не требуется (фаза 1).
4. С реальным R2 dev-bucket: `curl -F image=@photo.jpg http://localhost:3000/api/upload` с cookie авторизованной сессии → 200 + объект `uploads/<uid>/<ulid>.webp` появляется в bucket + строка в `uploads` с правильными width/height/size.
5. Без `R2_*` env → `/api/upload` отдаёт 503 `{ success: 0, error: "storage_not_configured" }`.
6. `pnpm cleanup:orphans --dry-run` логирует кандидатов, ничего не удаляет; без флага — реально удаляет из R2 и из `uploads`.
7. `next.config.ts` пропускает `R2_PUBLIC_BASE` host в `remotePatterns`, ручная проверка: на странице с `<Image src="${R2_PUBLIC_BASE}/uploads/.../foo.webp">` SSR/Hydration не ругается.
8. Retro-секция в `docs/superpowers/plans/2026-06-XX-plan-03-storage.md` — расхождения с планом (как в plan-01/02).

---

## 12. Что готово к плану-04 (Posts + Editor) после plan-03

- `buildImageToolConfig()` → plan-04 кладёт в `new EditorJS({ tools: { image: { ... } } })`.
- `/api/upload` готов принимать multipart от Editor.js image-block без переходных слоёв.
- `uploads.post_id` — nullable text без FK; plan-04 добавит FK миграцией и логику линковки при `publishPost`.
- `next/image` whitelist для R2 host уже работает — план-04 страница поста может использовать `<Image>` для иллюстраций.
- ULID-генератор (`src/lib/auth/id.ts` из plan-02) уже используется — plan-04 берёт его же для `posts.id`.

Аватары провайдеров OAuth (`googleusercontent.com`, `mail.ru` и т.п.) **не** добавляются в `remotePatterns` в plan-03 — на странице `/u/[username]` остаётся `<img>` с `eslint-disable` (как и в plan-02). Это решение отложено до plan-04 (когда `next/image` начнём использовать массово на страницах поста и фида).
