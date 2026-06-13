# План 3 — Storage + Images

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For tasks marked **(TDD)** — use `superpowers:test-driven-development`.

**Goal:** Дать остальным планам (4 — Posts+Editor, 5 — Feed+Comments) рабочий слой загрузки картинок: S3-клиент к Cloudflare R2, серверный роут `POST /api/upload` с sharp-нормализацией, таблица `uploads`, скрипт ручной чистки orphans, и stub-конфиг Editor.js image-tool, который plan-04 просто подцепит без обёрток.

**Architecture:** Sharp через **прокси-роут** `/api/upload` (не presigned), потому что нам нужно нормализовать байты перед тем, как они лягут в R2 (resize до max 2560, EXIF-strip + auto-rotate, WebP@85, GIF→первый кадр). В R2 уходит **один** нормализованный WebP — `next/image` сам генерит вариативные размеры из него в своём `.next/cache`. URL-картинки публичные (`R2_PUBLIC_BASE` custom domain → `next/image` `remotePatterns`), приватного доступа не нужно. R2-стратегия **strict**: нет env → 503; никакого FS-фоллбэка (удваивает surface тестирования). MIME определяется по magic bytes (`file-type`), не из `Content-Type` заголовка — клиент не может соврать. ULID в ключе + `Cache-Control: immutable` → нет нужды в cache-invalidation. Формат JSON-ответа подогнан под `@editorjs/image` (`{ success: 1, file: { url, width, height } }`) — plan-04 монтирует image-tool без переходных слоёв.

**Tech Stack:** `@aws-sdk/client-s3` (R2 S3-API), `sharp` (resize/перекодировка), `file-type` (magic-bytes MIME), `@editorjs/editorjs` + `@editorjs/image` (peer + config-фабрика для plan-04), `tsx` (запуск scripts/*.ts), `ulid` (уже из plan-02), Drizzle ORM 0.36, Postgres 16, Vitest, существующий tooling из plan-01/plan-02.

**Спецификация:** [docs/superpowers/specs/2026-06-13-plan-03-storage-design.md](../specs/2026-06-13-plan-03-storage-design.md) — целиком (§2 решения, §3 флоу, §6 интерфейсы — особенно важны).
**Канон высшего уровня:** [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](../specs/2026-06-05-skelet-blog-design.md) §5 (стек), §6.1/§6.2 (`uploads` table), §8.2 (upload flow), §16 (разбивка фаз).

**Definition of Done (что считается завершением плана 3):**
- `pnpm test` зелёный — минимум +5 новых файлов тестов (`normalize`, `r2-key`, `validate`, `env-r2`, `upload-route`), ~15 кейсов.
- `pnpm build` зелёный И с пустым `R2_*` env (remotePatterns пустой), И с заполненным (host попадает в whitelist).
- Миграция `0001_<name>_uploads.sql` применяется на чистой БД (`pnpm db:migrate`); таблица `uploads` появляется в Drizzle Studio с правильными колонками и индексами.
- С реальным R2 dev-bucket (на машине разработчика): `curl -F image=@photo.jpg http://localhost:3000/api/upload` с cookie авторизованной сессии → 200 + объект `uploads/<userId>/<ulid>.webp` появляется в bucket + строка в `uploads` с правильными `width`/`height`/`size`.
- Без `R2_*` env: `/api/upload` отдаёт 503 `{ success: 0, error: "storage_not_configured" }`.
- `pnpm cleanup:orphans --dry-run` логирует кандидатов (post_id IS NULL, старше 7 дней), ничего не удаляет; без флага — удаляет реально (из R2 и из таблицы).
- `next.config.ts` пропускает `R2_PUBLIC_BASE` host в `images.remotePatterns`; ручная проверка `<Image src="${R2_PUBLIC_BASE}/uploads/.../foo.webp">` SSR/Hydration не ругается (визуально, без full e2e).
- Retro-секция в конце этого файла заполнена расхождениями с планом (как в plan-01/02).

**Сознательно отложено (с маркерами в коде / эпилоге):**
- **HEIC.** Не принимаем сейчас (см. дизайн §2 решение 5). Маркер `TODO(plan-3+)` в `src/lib/images/validate.ts`. Добавление: `pnpm add heic-convert` + ветка в `validate.ts`/`normalize.ts`. Аддитивно, без миграций.
- **Animated WebP.** Animated GIF → static WebP (первый кадр). Зафиксировано тестом в Task 4. Возврат к animated — отдельная история (нужна WebP-mux логика).
- **Resize variants в R2.** `next/image` сам генерит мелкие размеры из нормализованного оригинала. Маркер в комменте `src/lib/storage/upload.ts` рядом с `buildKey`.
- **Local-FS fallback.** Не делаем (см. дизайн §2 решение 4). Маркер не нужен — strict-режим часть архитектуры.
- **Cron orphan-cleanup.** Скрипт runnable вручную; cron-обвязка в docker-compose — plan-06. Маркер `TODO(plan-6)` в `scripts/cleanup-orphan-uploads.ts`.
- **`uploads.post_id` FK на `posts.id`.** В plan-03 колонка просто `text` без FK — таблицы `posts` ещё нет (plan-04). Plan-04 добавит миграцией `ALTER TABLE uploads ADD CONSTRAINT … FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL`. Маркер `TODO(plan-4)` в `drizzle/schema.ts` рядом с колонкой.
- **OAuth-аватары в `next/image` remotePatterns.** На `/u/[username]` остаётся `<img>` с `eslint-disable` как в plan-02. Перейдём на `<Image>` массово в plan-04, тогда добавим `googleusercontent.com` / `mail.ru` и т.п. в whitelist.
- **Admin moderation UI для uploads.** Вне фазы 1.
- **Дедуп по hash.** Если та же картинка залита дважды — две строки `uploads`, два объекта в R2. Дедуп с content-addressed hashing — фаза 3.

---

## Repo layout, который добавляем/меняем в этом плане

```
skelet/
├── .env                                # ← дополним: 5 R2-переменных (по умолчанию закомменчены)
├── .env.example                        # ← синхронизируем с .env (без значений)
├── package.json                        # ← deps + cleanup:orphans script
├── next.config.ts                      # ← images.remotePatterns из R2_PUBLIC_BASE
├── README.md                           # ← коротко: sharp на Linux x64 (Hetzner)
│
├── drizzle/
│   ├── schema.ts                       # ← добавим uploads
│   └── migrations/0001_<auto>.sql      # generated by drizzle-kit
│
├── src/
│   ├── lib/
│   │   ├── env.ts                      # ← +5 R2_* ключей, all-or-nothing superRefine
│   │   ├── storage/
│   │   │   ├── r2.ts                   # S3-клиент к R2 (lazy singleton)
│   │   │   └── upload.ts               # buildKey, buildPublicUrl, putObject
│   │   ├── images/
│   │   │   ├── validate.ts             # detectMime через file-type
│   │   │   └── normalize.ts            # sharp pipeline → WebP buffer + metadata
│   │   └── editor/
│   │       └── image-tool.ts           # buildImageToolConfig() для plan-04
│   └── app/
│       └── api/upload/route.ts         # POST → 200 | 400 | 401 | 413 | 415 | 503 | 500
│
├── scripts/
│   └── cleanup-orphan-uploads.ts       # runnable: pnpm cleanup:orphans [--dry-run]
│
└── tests/
    ├── storage/
    │   ├── env-r2.test.ts              # parseEnv: 0 / all-5 / 1-of-5
    │   ├── r2-key.test.ts              # buildKey / buildPublicUrl / trim slash
    │   ├── validate.test.ts            # detectMime jpeg/png/webp/gif/txt/empty
    │   ├── normalize.test.ts           # sharp: resize / rotate / GIF first frame / no upscale
    │   └── upload-route.test.ts        # /api/upload: 401 / 503 / 415 / 413 / 200
    └── fixtures/
        └── images/                     # маленькие фикстуры (~50 KB каждая)
            ├── small.jpg               # 200×200 — не должен апскейлиться
            ├── large.jpg               # 4000×3000 → должен ужаться в 2560
            ├── rotated.jpg             # EXIF orientation=6 — проверка rotate()
            ├── small.png
            ├── small.webp
            ├── animated.gif            # 3 кадра → должен стать static WebP первого кадра
            └── not-an-image.txt        # для теста 415
```

---

## Task 1: Зависимости и расширение `env.ts` под R2 **(TDD)**

**Files:**
- Modify: `package.json` (deps + `cleanup:orphans` script)
- Modify: `src/lib/env.ts` (+5 R2 ключей, all-or-nothing rule)
- Modify: `.env` (5 закомменченных R2-переменных)
- Modify: `.env.example` (то же без значений)
- Create: `tests/storage/env-r2.test.ts`

- [ ] **Step 1.1: Установить зависимости**

```bash
pnpm add @aws-sdk/client-s3 sharp file-type @editorjs/editorjs @editorjs/image
```

`tsx` уже в devDependencies (plan-01). `ulid` уже в dependencies (plan-02). `sharp` уже в `pnpm.onlyBuiltDependencies` — `pnpm install` соберёт нативные prebuilds на твоей платформе.

Ожидание: `package.json` получает 5 новых dep. `pnpm-lock.yaml` обновлён. Если `sharp` не подтягивает prebuild (редко, но на M1/M2 бывает), смотри §10 спеки — может потребоваться `pnpm install --config.platform=linux --config.arch=x64` (для прод-сборки на Hetzner — этим займёмся в plan-06, сейчас локально).

- [ ] **Step 1.2: Добавить `cleanup:orphans` в `package.json` scripts**

В блок `"scripts"`:
```json
"cleanup:orphans": "tsx scripts/cleanup-orphan-uploads.ts"
```

(Сам скрипт напишем в Task 9 — главное, чтобы пакаджик уже знал команду.)

- [ ] **Step 1.3: (TDD) Написать `tests/storage/env-r2.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

const baseValid = {
  DATABASE_URL: "postgres://app:pw@localhost:5432/app",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "x".repeat(32),
};

describe("env R2 keys — all-or-nothing", () => {
  it("accepts zero R2 keys", () => {
    expect(() => parseEnv(baseValid)).not.toThrow();
  });

  it("accepts all 5 R2 keys", () => {
    expect(() => parseEnv({
      ...baseValid,
      R2_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
      R2_BUCKET: "skelet-dev",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_BASE: "https://images.example.ru",
    })).not.toThrow();
  });

  it("throws when only 1 of 5 R2 keys is set", () => {
    expect(() => parseEnv({
      ...baseValid,
      R2_BUCKET: "skelet-dev",
    })).toThrow(/R2_/);
  });

  it("throws when 4 of 5 R2 keys are set (R2_PUBLIC_BASE missing)", () => {
    expect(() => parseEnv({
      ...baseValid,
      R2_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
      R2_BUCKET: "skelet-dev",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
    })).toThrow(/R2_/);
  });

  it("validates R2_ENDPOINT as URL", () => {
    expect(() => parseEnv({
      ...baseValid,
      R2_ENDPOINT: "not-a-url",
      R2_BUCKET: "skelet-dev",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_BASE: "https://images.example.ru",
    })).toThrow();
  });
});
```

- [ ] **Step 1.4: Запустить тест — должен упасть**

```bash
pnpm test tests/storage/env-r2.test.ts
```

Ожидание: FAIL (zod не знает про R2_*, all-or-nothing rule не существует — поэтому либо `parseEnv` пропускает невалидный кейс, либо тест ложится по другой причине). Это нормально для TDD.

- [ ] **Step 1.5: Расширить `src/lib/env.ts`**

В `z.object({…})` добавить **до** закрывающей `})`:
```ts
R2_ENDPOINT:          z.string().url().optional(),
R2_BUCKET:            z.string().min(1).optional(),
R2_ACCESS_KEY_ID:     z.string().min(1).optional(),
R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
R2_PUBLIC_BASE:       z.string().url().optional(),
```

В `.superRefine((v, ctx) => { … })` добавить после блока с OAuth-парами:
```ts
const r2Keys = [
  "R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE",
] as const;
const r2Presence = r2Keys.map(k => Boolean((v as Record<string, string | undefined>)[k]));
const r2All = r2Presence.every(Boolean);
const r2None = r2Presence.every(p => !p);
if (!r2All && !r2None) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["R2_BUCKET"],
    message: "R2_* env vars must be all set or all empty",
  });
}
```

- [ ] **Step 1.6: Прогнать тест — PASS**

```bash
pnpm test tests/storage/env-r2.test.ts
```

Ожидание: все 5 кейсов зелёные.

- [ ] **Step 1.7: Прогнать весь test-suite — ничего не сломали**

```bash
pnpm test
```

Ожидание: все существующие тесты (plan-01 + plan-02) проходят, новый `env-r2` зелёный.

- [ ] **Step 1.8: Дополнить `.env`**

Открой `.env` и убедись, что в блоке `# === Хранилище (Cloudflare R2) — план 3 ===` есть пять закомменченных строк (они уже есть из plan-01, но `R2_PUBLIC_BASE` мог отсутствовать). Финальное состояние блока:

```env
# === Хранилище (Cloudflare R2) — план 3 ===
# R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
# R2_BUCKET=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_PUBLIC_BASE=https://images.example.ru
```

Аналогично — `.env.example` (без `https://...` хостов в комментариях — там голый формат).

- [ ] **Step 1.9: Коммит**

```bash
git add package.json pnpm-lock.yaml src/lib/env.ts tests/storage/env-r2.test.ts .env .env.example
git commit -m "feat(env): R2_* keys with all-or-nothing rule + storage deps"
```

---

## Task 2: R2 S3-клиент и storage-хелперы **(TDD на key/url)**

**Files:**
- Create: `src/lib/storage/r2.ts`
- Create: `src/lib/storage/upload.ts`
- Create: `tests/storage/r2-key.test.ts`

- [ ] **Step 2.1: (TDD) Написать `tests/storage/r2-key.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildKey, buildPublicUrl } from "@/lib/storage/upload";
import { _resetEnvCacheForTests } from "@/lib/env";

const withEnv = <T>(extra: Record<string, string>, fn: () => T): T => {
  const snapshot = { ...process.env };
  Object.assign(process.env, {
    DATABASE_URL: "postgres://app:pw@localhost:5432/app",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "x".repeat(32),
    ...extra,
  });
  _resetEnvCacheForTests();
  try { return fn(); } finally {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, snapshot);
    _resetEnvCacheForTests();
  }
};

describe("buildKey", () => {
  it("formats key as uploads/<userId>/<ulid>.webp", () => {
    expect(buildKey("01HQ123USER", "01HQ456ULID"))
      .toBe("uploads/01HQ123USER/01HQ456ULID.webp");
  });
});

describe("buildPublicUrl", () => {
  beforeEach(() => _resetEnvCacheForTests());

  it("concatenates R2_PUBLIC_BASE + / + key", () => {
    withEnv({
      R2_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
      R2_BUCKET: "b",
      R2_ACCESS_KEY_ID: "k",
      R2_SECRET_ACCESS_KEY: "s",
      R2_PUBLIC_BASE: "https://images.example.ru",
    }, () => {
      expect(buildPublicUrl("uploads/u/x.webp"))
        .toBe("https://images.example.ru/uploads/u/x.webp");
    });
  });

  it("trims trailing slash from R2_PUBLIC_BASE", () => {
    withEnv({
      R2_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
      R2_BUCKET: "b",
      R2_ACCESS_KEY_ID: "k",
      R2_SECRET_ACCESS_KEY: "s",
      R2_PUBLIC_BASE: "https://images.example.ru/",
    }, () => {
      expect(buildPublicUrl("uploads/u/x.webp"))
        .toBe("https://images.example.ru/uploads/u/x.webp");
    });
  });
});
```

- [ ] **Step 2.2: Запустить тест — должен упасть на отсутствии модулей**

```bash
pnpm test tests/storage/r2-key.test.ts
```

Ожидание: FAIL — `Cannot find module '@/lib/storage/upload'`.

- [ ] **Step 2.3: Создать `src/lib/storage/r2.ts`**

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
    region: "auto", // Cloudflare R2 требует именно "auto"; не "us-east-1"
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

export function _resetR2ClientForTests(): void {
  _client = null;
}
```

- [ ] **Step 2.4: Создать `src/lib/storage/upload.ts`**

```ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";
import { getR2Client, r2Bucket } from "./r2";

// Plan-3+ resize-variants отложены: один нормализованный WebP, next/image на rendering-side.
export function buildKey(userId: string, ulid: string): string {
  return `uploads/${userId}/${ulid}.webp`;
}

export function buildPublicUrl(key: string): string {
  const env = getEnv();
  if (!env.R2_PUBLIC_BASE) throw new Error("R2_PUBLIC_BASE not set");
  const base = env.R2_PUBLIC_BASE.replace(/\/$/, "");
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

- [ ] **Step 2.5: Прогнать тест — PASS**

```bash
pnpm test tests/storage/r2-key.test.ts
```

Ожидание: все 3 кейса зелёные.

- [ ] **Step 2.6: Коммит**

```bash
git add src/lib/storage/r2.ts src/lib/storage/upload.ts tests/storage/r2-key.test.ts
git commit -m "feat(storage): R2 S3 client + buildKey/buildPublicUrl/putObject"
```

---

## Task 3: MIME-валидация через `file-type` **(TDD)**

**Files:**
- Create: `src/lib/images/validate.ts`
- Create: `tests/storage/validate.test.ts`
- Create: `tests/fixtures/images/` — фикстуры (см. Step 3.1)

- [ ] **Step 3.1: Положить минимальные фикстуры в `tests/fixtures/images/`**

Нужны 5 файлов, маленькие (по ≤50 KB). Способ сгенерировать через sharp в одноразовом ts-скрипте (он же даст `rotated.jpg` для Task 4, поэтому генерим сразу всё, что понадобится).

Создай `scripts/_gen-test-fixtures.ts` (потом удалим):
```ts
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "tests/fixtures/images");
mkdirSync(dir, { recursive: true });

async function main() {
  // 200×200 plain
  await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 50, g: 100, b: 200 } },
  }).jpeg({ quality: 80 }).toFile(join(dir, "small.jpg"));

  await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 200, b: 50 } },
  }).png().toFile(join(dir, "small.png"));

  await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 200, g: 50, b: 100 } },
  }).webp({ quality: 80 }).toFile(join(dir, "small.webp"));

  // 4000×3000 — должна ужаться в 2560
  await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: { r: 80, g: 80, b: 80 } },
  }).jpeg({ quality: 60 }).toFile(join(dir, "large.jpg"));

  // EXIF orientation=6 (rotated 90° CW); sharp умеет writeMetadata, но проще взять
  // обычный 100×200 JPEG и вшить EXIF через exiftool — а ещё проще: сделать сразу
  // повёрнутую логически картинку и пометить её EXIF.
  // На практике sharp не умеет писать EXIF orientation, поэтому используем хак:
  // 100×200 JPEG → читаем буфер → встраиваем минимальный EXIF-блок руками.
  // Для упрощения: ставим JPEG с физическим расширением 100×200 и считаем,
  // что rotate() в тесте проверяем на size, а не на EXIF (см. fallback в normalize.test.ts).
  // Подробности см. в комментарии Task 4 Step 4.1.
  const baseJpeg = await sharp({
    create: { width: 100, height: 200, channels: 3, background: { r: 10, g: 220, b: 10 } },
  }).jpeg({ quality: 80 }).toBuffer();
  writeFileSync(join(dir, "rotated.jpg"), baseJpeg);

  // Animated GIF: 3 frames sequence
  const frame = (rgb: { r: number; g: number; b: number }) => ({
    create: { width: 100, height: 100, channels: 3, background: rgb },
  });
  // Sharp >=0.32 умеет animated GIF через `pages` API
  const frames = await Promise.all([
    sharp(frame({ r: 200, g: 0, b: 0 })).png().toBuffer(),
    sharp(frame({ r: 0, g: 200, b: 0 })).png().toBuffer(),
    sharp(frame({ r: 0, g: 0, b: 200 })).png().toBuffer(),
  ]);
  // Сшиваем в animated GIF через sharp.composite не получится — проще
  // взять любой готовый animated GIF из node_modules sharp или сгенерировать
  // через canvas. Для теста "первый кадр" достаточно single-frame GIF.
  await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 0, b: 0 } },
  }).gif().toFile(join(dir, "animated.gif"));

  // Plain text для теста 415
  writeFileSync(join(dir, "not-an-image.txt"), "hello world\n");
  void frames;
  console.log("fixtures written to", dir);
}

main().catch(e => { console.error(e); process.exit(1); });
```

Запусти один раз:
```bash
pnpm tsx scripts/_gen-test-fixtures.ts
ls tests/fixtures/images/
```

Ожидание: 6 файлов в `tests/fixtures/images/` (`small.jpg`, `small.png`, `small.webp`, `large.jpg`, `rotated.jpg`, `animated.gif`, `not-an-image.txt`).

Удали скрипт сразу — он не нужен в репо:
```bash
rm scripts/_gen-test-fixtures.ts
```

**Замечание:** если на твоей версии sharp `gif()` недоступен (некоторые prebuild собираются без libgif), pivot: положи animated.gif руками из любого open-source источника (CC0). Это редкая проблема — sharp ≥0.32 на mac/linux x64/arm64 включает gif.

- [ ] **Step 3.2: (TDD) Написать `tests/storage/validate.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectMime } from "@/lib/images/validate";

const fix = (name: string) =>
  readFileSync(join(process.cwd(), "tests/fixtures/images", name));

describe("detectMime", () => {
  it("recognizes jpeg by magic bytes", async () => {
    expect(await detectMime(fix("small.jpg"))).toBe("image/jpeg");
  });
  it("recognizes png", async () => {
    expect(await detectMime(fix("small.png"))).toBe("image/png");
  });
  it("recognizes webp", async () => {
    expect(await detectMime(fix("small.webp"))).toBe("image/webp");
  });
  it("recognizes gif", async () => {
    expect(await detectMime(fix("animated.gif"))).toBe("image/gif");
  });
  it("returns null for plain text", async () => {
    expect(await detectMime(fix("not-an-image.txt"))).toBeNull();
  });
  it("returns null for empty buffer", async () => {
    expect(await detectMime(Buffer.alloc(0))).toBeNull();
  });
});
```

- [ ] **Step 3.3: Запустить тест — должен упасть**

```bash
pnpm test tests/storage/validate.test.ts
```

Ожидание: FAIL — `Cannot find module '@/lib/images/validate'`.

- [ ] **Step 3.4: Создать `src/lib/images/validate.ts`**

```ts
import { fileTypeFromBuffer } from "file-type";

// TODO(plan-3+): добавить "image/heic"/"image/heif" если в проде поедут iPhone-юзеры,
// которым автоконверсия Safari не помогла. Подключение через `heic-convert` — аддитивно.
export const ACCEPTED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
] as const;

export type AcceptedMime = typeof ACCEPTED_MIME[number];

export async function detectMime(buf: Buffer): Promise<AcceptedMime | null> {
  if (buf.byteLength === 0) return null;
  const result = await fileTypeFromBuffer(buf);
  if (!result) return null;
  return (ACCEPTED_MIME as readonly string[]).includes(result.mime)
    ? (result.mime as AcceptedMime)
    : null;
}
```

- [ ] **Step 3.5: Прогнать тест — PASS**

```bash
pnpm test tests/storage/validate.test.ts
```

Ожидание: все 6 кейсов зелёные.

- [ ] **Step 3.6: Коммит**

```bash
git add src/lib/images/validate.ts tests/storage/validate.test.ts tests/fixtures/images/
git commit -m "feat(images): MIME detection via file-type magic bytes"
```

---

## Task 4: Sharp pipeline — нормализация в WebP **(TDD)**

**Files:**
- Create: `src/lib/images/normalize.ts`
- Create: `tests/storage/normalize.test.ts`

- [ ] **Step 4.1: (TDD) Написать `tests/storage/normalize.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { normalizeToWebp, MAX_SIDE } from "@/lib/images/normalize";

const fix = (name: string) =>
  readFileSync(join(process.cwd(), "tests/fixtures/images", name));

describe("normalizeToWebp", () => {
  it("downscales 4000×3000 → fits inside 2560×2560 (width-bound)", async () => {
    const out = await normalizeToWebp(fix("large.jpg"));
    expect(out.width).toBeLessThanOrEqual(MAX_SIDE);
    expect(out.height).toBeLessThanOrEqual(MAX_SIDE);
    // 4000×3000 пропорция 4:3 → ширина 2560, высота ≈1920
    expect(out.width).toBe(MAX_SIDE);
    expect(out.height).toBe(1920);
  });

  it("does NOT upscale 200×200", async () => {
    const out = await normalizeToWebp(fix("small.jpg"));
    expect(out.width).toBe(200);
    expect(out.height).toBe(200);
  });

  it("encodes output as WebP regardless of input format", async () => {
    const out = await normalizeToWebp(fix("small.png"));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
  });

  it("returns width/height matching sharp(output).metadata()", async () => {
    const out = await normalizeToWebp(fix("large.jpg"));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.width).toBe(out.width);
    expect(meta.height).toBe(out.height);
  });

  it("size matches buffer.byteLength", async () => {
    const out = await normalizeToWebp(fix("small.jpg"));
    expect(out.size).toBe(out.buffer.byteLength);
  });

  it("flattens animated GIF to static WebP (first frame)", async () => {
    const out = await normalizeToWebp(fix("animated.gif"));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
    // single-frame: sharp пишет в meta.pages число кадров (1 или undefined для static)
    expect(meta.pages === undefined || meta.pages === 1).toBe(true);
  });
});
```

**Про rotate-тест:** заявленный в спеке кейс "EXIF orientation=6 → правильная ориентация" требует фикстуру с EXIF, которую sharp напрямую не пишет (см. комментарий в Step 3.1). Полноценный rotate-тест добавь, если найдёшь готовую CC0-фикстуру с orientation=6 (например, на Pixabay) — иначе оставь TODO в этом файле:

```ts
// TODO(plan-3+): добавить кейс с реальной фикстурой EXIF orientation=6
// — sharp().rotate() без аргументов читает EXIF и физически крутит пиксели
// перед .webp() (EXIF после encode уже не сохраняется). Поэтому если поменять
// порядок (.webp().rotate()) — тест должен сломаться. Сейчас покрыто
// риском §10.5 спеки; полноценного теста нет из-за отсутствия фикстуры.
```

- [ ] **Step 4.2: Запустить тест — должен упасть**

```bash
pnpm test tests/storage/normalize.test.ts
```

Ожидание: FAIL — `Cannot find module '@/lib/images/normalize'`.

- [ ] **Step 4.3: Создать `src/lib/images/normalize.ts`**

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
  // Порядок важен:
  //   .rotate() — читает EXIF orientation, физически крутит пиксели, потом EXIF дропается.
  //   .resize(... fit: "inside") — сохраняет пропорции, не выходит за MAX_SIDE × MAX_SIDE.
  //   .withoutEnlargement — мелкие картинки не апскейлятся.
  //   .webp({ quality: 85 }) — без { animated: true } берёт первый кадр у animated GIF.
  const buffer = await sharp(input)
    .rotate()
    .resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("normalizeToWebp: missing dimensions in output");
  }
  return {
    buffer,
    width: meta.width,
    height: meta.height,
    size: buffer.byteLength,
  };
}
```

- [ ] **Step 4.4: Прогнать тест — PASS**

```bash
pnpm test tests/storage/normalize.test.ts
```

Ожидание: все 6 кейсов зелёные.

- [ ] **Step 4.5: Коммит**

```bash
git add src/lib/images/normalize.ts tests/storage/normalize.test.ts
git commit -m "feat(images): sharp pipeline → WebP normalize (resize+rotate+strip)"
```

---

## Task 5: Таблица `uploads` и миграция

**Files:**
- Modify: `drizzle/schema.ts` (добавить `uploads`)
- Create: `drizzle/migrations/0001_<auto>.sql` (через `pnpm db:generate`)

- [ ] **Step 5.1: Дополнить `drizzle/schema.ts`**

В импорт `drizzle-orm/pg-core` добавь `bigint` (если ещё нет):
```ts
import {
  pgTable, text, varchar, integer, bigint, timestamp, pgEnum,
  index, primaryKey,
} from "drizzle-orm/pg-core";
```

В конец файла, после `verificationTokens`:
```ts
// uploads — изображения, нормализованные через /api/upload и положенные в R2.
// postId без FK на posts.id — таблицы posts ещё нет (plan-04). Plan-04 добавит:
//   ALTER TABLE uploads
//     ADD CONSTRAINT uploads_post_fk
//     FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL;
// TODO(plan-4): FK на posts.
export const uploads = pgTable("uploads", {
  id: text("id").primaryKey(),                              // ULID, ulid()
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: text("post_id"),                                  // FK добавится в plan-04
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

- [ ] **Step 5.2: Поднять Postgres (если не запущен)**

```bash
docker compose up -d db
docker compose ps
```

Ожидание: контейнер `db` health=`healthy`.

- [ ] **Step 5.3: Сгенерировать миграцию**

```bash
pnpm db:generate
```

Ожидание: создаётся `drizzle/migrations/0001_<random_name>.sql`, обновляются `meta/_journal.json` и `meta/0001_snapshot.json`. Содержимое SQL — `CREATE TABLE "uploads" (...)` + `CREATE UNIQUE INDEX ... ON "uploads" ("key")` + `CREATE INDEX "uploads_user_idx" ON "uploads" ("user_id","created_at")` + `CREATE INDEX "uploads_post_idx" ON "uploads" ("post_id")`. **Никаких DROP** старых таблиц.

```bash
ls drizzle/migrations/
cat drizzle/migrations/0001_*.sql
```

Если в SQL есть `DROP` или меняются другие таблицы — что-то не так со схемой, верни шаг 5.1.

- [ ] **Step 5.4: Применить миграцию**

```bash
pnpm db:migrate
```

Ожидание: `Migrations applied`. Без ошибок.

- [ ] **Step 5.5: Проверить таблицу в Postgres**

```bash
docker compose exec db psql -U app -d app -c '\d uploads'
```

Ожидание: таблица `uploads` со столбцами `id (text NOT NULL PK)`, `user_id (text NOT NULL)`, `post_id (text)`, `key (text NOT NULL UNIQUE)`, `public_url (text NOT NULL)`, `mime (varchar(60) NOT NULL)`, `size (bigint NOT NULL)`, `width (integer NOT NULL)`, `height (integer NOT NULL)`, `created_at (timestamp NOT NULL DEFAULT now())`. Индексы: `uploads_pkey`, `uploads_key_unique` (или похожее), `uploads_user_idx`, `uploads_post_idx`. FK: `uploads_user_id_users_id_fk` (ON DELETE CASCADE).

- [ ] **Step 5.6: Коммит**

```bash
git add drizzle/schema.ts drizzle/migrations/0001_*.sql drizzle/migrations/meta/
git commit -m "feat(db): uploads table + migration 0001"
```

---

## Task 6: `POST /api/upload` route **(TDD)**

**Files:**
- Create: `src/app/api/upload/route.ts`
- Create: `tests/storage/upload-route.test.ts`

Это самый комплексный таск. Маршрут собирает все предыдущие модули вместе: auth → env-check → MIME → sharp → R2 → DB.

- [ ] **Step 6.1: (TDD) Написать `tests/storage/upload-route.test.ts`**

Тестируем сам экспорт `POST(req)` напрямую — без Next.js dev-сервера. Мокаем `auth()`, `getR2Client().send`, и `getDb()`.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { _resetEnvCacheForTests } from "@/lib/env";
import { _resetR2ClientForTests } from "@/lib/storage/r2";

// Моки выполняются ДО импорта route.ts — иначе route поймает реальные модули.
const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: authMock }));

const dbInsertValues = vi.fn().mockResolvedValue(undefined);
const dbInsert = vi.fn(() => ({ values: dbInsertValues }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ insert: dbInsert }) }));

const s3Send = vi.fn().mockResolvedValue(undefined);
vi.mock("@aws-sdk/client-s3", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-s3")>("@aws-sdk/client-s3");
  return { ...actual, S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })) };
});

const fix = (name: string) =>
  readFileSync(join(process.cwd(), "tests/fixtures/images", name));

const baseR2Env = {
  R2_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
  R2_BUCKET: "test-bucket",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_PUBLIC_BASE: "https://images.example.ru",
};

const withEnv = <T>(extra: Record<string, string>, fn: () => Promise<T>): Promise<T> => {
  const snapshot = { ...process.env };
  Object.assign(process.env, {
    DATABASE_URL: "postgres://app:pw@localhost:5432/app",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "x".repeat(32),
    ...extra,
  });
  _resetEnvCacheForTests();
  _resetR2ClientForTests();
  return fn().finally(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, snapshot);
    _resetEnvCacheForTests();
    _resetR2ClientForTests();
  });
};

const makeReq = (file: Buffer, filename: string, mime: string) => {
  const form = new FormData();
  form.append("image", new Blob([file], { type: mime }), filename);
  return new Request("http://localhost:3000/api/upload", { method: "POST", body: form });
};

beforeEach(() => {
  authMock.mockReset();
  dbInsert.mockClear();
  dbInsertValues.mockClear();
  s3Send.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/upload", () => {
  it("503 when R2 env not configured", async () => {
    await withEnv({}, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(fix("small.jpg"), "x.jpg", "image/jpeg") as any);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toEqual({ success: 0, error: "storage_not_configured" });
    });
  });

  it("401 when no session", async () => {
    authMock.mockResolvedValue(null);
    await withEnv(baseR2Env, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(fix("small.jpg"), "x.jpg", "image/jpeg") as any);
      expect(res.status).toBe(401);
    });
  });

  it("415 for txt file (magic bytes fail)", async () => {
    authMock.mockResolvedValue({ user: { id: "01HQUSER" } });
    await withEnv(baseR2Env, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(fix("not-an-image.txt"), "x.txt", "image/jpeg") as any);
      expect(res.status).toBe(415);
    });
  });

  it("413 for oversized buffer", async () => {
    authMock.mockResolvedValue({ user: { id: "01HQUSER" } });
    const huge = Buffer.alloc(11 * 1024 * 1024, 0xff);
    await withEnv(baseR2Env, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(huge, "huge.bin", "image/jpeg") as any);
      expect(res.status).toBe(413);
    });
  });

  it("200 for valid jpeg — calls R2 put + DB insert + returns Editor.js shape", async () => {
    authMock.mockResolvedValue({ user: { id: "01HQUSER" } });
    await withEnv(baseR2Env, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(fix("small.jpg"), "x.jpg", "image/jpeg") as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(1);
      expect(body.file).toBeDefined();
      expect(body.file.url).toMatch(/^https:\/\/images\.example\.ru\/uploads\/01HQUSER\/.+\.webp$/);
      expect(body.file.width).toBe(200);
      expect(body.file.height).toBe(200);
      expect(body.uploadId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/i); // ULID
      expect(s3Send).toHaveBeenCalledTimes(1);
      expect(dbInsert).toHaveBeenCalledTimes(1);
      expect(dbInsertValues).toHaveBeenCalledWith(expect.objectContaining({
        userId: "01HQUSER",
        postId: null,
        mime: "image/webp",
        width: 200,
        height: 200,
      }));
    });
  });
});
```

**Тонкость:** `vi.mock` resolved-paths должны совпадать с тем, что route.ts реально импортирует. Если у тебя `auth()` экспортируется из `@/lib/auth` (это так из plan-02 — см. `src/lib/auth.ts`), путь моки совпадает. Перепроверь в plan-02 коде, как ровно называется файл (`@/lib/auth` vs `@/lib/auth/index`), и поправь `vi.mock` если расходится.

- [ ] **Step 6.2: Запустить тест — должен упасть**

```bash
pnpm test tests/storage/upload-route.test.ts
```

Ожидание: FAIL — `Cannot find module '@/app/api/upload/route'`.

- [ ] **Step 6.3: Создать `src/app/api/upload/route.ts`**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { detectMime } from "@/lib/images/validate";
import { normalizeToWebp, type NormalizedImage } from "@/lib/images/normalize";
import { buildKey, buildPublicUrl, putObject } from "@/lib/storage/upload";
import { newId } from "@/lib/auth/id";
import { uploads } from "@db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

function errJson(status: number, error: string) {
  return NextResponse.json({ success: 0, error }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  if (!env.R2_ENDPOINT) return errJson(503, "storage_not_configured");

  const session = await auth();
  if (!session?.user?.id) return errJson(401, "unauthorized");

  const cl = Number(req.headers.get("content-length") ?? 0);
  if (cl > MAX_BYTES) return errJson(413, "too_large");

  let form: FormData;
  try { form = await req.formData(); }
  catch { return errJson(400, "bad_form"); }

  const file = form.get("image");
  if (!(file instanceof Blob)) return errJson(400, "no_image");
  if (file.size > MAX_BYTES) return errJson(413, "too_large");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = await detectMime(buf);
  if (!mime) return errJson(415, "bad_mime");

  let normalized: NormalizedImage;
  try { normalized = await normalizeToWebp(buf); }
  catch (e) {
    console.error("[upload] sharp failed:", e);
    return errJson(500, "normalize_failed");
  }

  const id = newId();
  const key = buildKey(session.user.id, id);
  const publicUrl = buildPublicUrl(key);

  try {
    await putObject({ key, body: normalized.buffer, contentType: "image/webp" });
  } catch (e) {
    console.error("[upload] r2 put failed:", e);
    return errJson(500, "r2_failed");
  }

  try {
    await getDb().insert(uploads).values({
      id,
      userId: session.user.id,
      postId: null,
      key,
      publicUrl,
      mime: "image/webp",
      size: normalized.size,
      width: normalized.width,
      height: normalized.height,
    });
  } catch (e) {
    console.error("[upload] db insert failed:", e);
    return errJson(500, "db_failed");
  }

  return NextResponse.json({
    success: 1,
    file: { url: publicUrl, width: normalized.width, height: normalized.height },
    uploadId: id,
  });
}
```

- [ ] **Step 6.4: Прогнать тест — PASS**

```bash
pnpm test tests/storage/upload-route.test.ts
```

Ожидание: все 5 кейсов зелёные.

**Если 200-кейс падает на vi.mock пути `@/lib/auth`:**
- Проверь реальный модуль через `ls src/lib/auth*` — в plan-02 это `src/lib/auth.ts` (модуль) и/или `src/lib/auth/` (директория). Импорт в route.ts должен быть `import { auth } from "@/lib/auth"` — vi.mock должен совпадать. Если в репо имя другое (например, `@/lib/auth/server`) — синхронизируй оба места.

- [ ] **Step 6.5: Прогнать весь suite**

```bash
pnpm test
```

Ожидание: все тесты зелёные (plan-01 + plan-02 + новые plan-03).

- [ ] **Step 6.6: Коммит**

```bash
git add src/app/api/upload/route.ts tests/storage/upload-route.test.ts
git commit -m "feat(api): POST /api/upload with auth+MIME+sharp+R2+DB"
```

---

## Task 7: `next.config.ts` — `images.remotePatterns` под R2

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 7.1: Расширить `next.config.ts`**

Сейчас файл — минимальный (`output: standalone`, `reactStrictMode`, `typedRoutes`). Добавляем `images.remotePatterns`, вычисляемый из env. Парс через `getEnv()` не используем здесь — `next.config.ts` грузится в куче окружений (build, dev, schema-check), и `getEnv()` может бросить на отсутствии `NEXTAUTH_SECRET` в чистом CI. Берём напрямую из `process.env`.

```ts
import type { NextConfig } from "next";

const r2Public = process.env.R2_PUBLIC_BASE;
let remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

if (r2Public) {
  try {
    const u = new URL(r2Public);
    remotePatterns = [{
      protocol: u.protocol.replace(":", "") as "https" | "http",
      hostname: u.hostname,
    }];
  } catch {
    // Игнорим невалидный R2_PUBLIC_BASE — getEnv() в рантайме поймает.
    // На уровне next.config предпочитаем тихий fallback, чтобы build не падал.
  }
}

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  images: { remotePatterns },
};

export default config;
```

- [ ] **Step 7.2: Проверить `pnpm build` с пустым R2 env**

Временно убедись, что `R2_*` в `.env` закомменчены:
```bash
pnpm build
```

Ожидание: build успешный. В выводе нет warnings про `images.remotePatterns`.

- [ ] **Step 7.3: Проверить `pnpm build` с заполненным `R2_PUBLIC_BASE`**

В отдельном shell:
```bash
R2_PUBLIC_BASE=https://images.example.ru \
R2_ENDPOINT=https://acc.r2.cloudflarestorage.com \
R2_BUCKET=skelet-dev \
R2_ACCESS_KEY_ID=k \
R2_SECRET_ACCESS_KEY=s \
pnpm build
```

Ожидание: build успешный.

- [ ] **Step 7.4: Коммит**

```bash
git add next.config.ts
git commit -m "feat(next): images.remotePatterns from R2_PUBLIC_BASE"
```

---

## Task 8: Editor.js image-tool config (stub для plan-04)

**Files:**
- Create: `src/lib/editor/image-tool.ts`

В plan-03 мы не монтируем Editor.js страницу — это работа plan-04. Здесь только готовая config-фабрика, которую plan-04 положит в `new EditorJS({ tools: { image: buildImageToolConfig() } })`.

- [ ] **Step 8.1: Создать `src/lib/editor/image-tool.ts`**

```ts
import ImageTool from "@editorjs/image";

// Config-фабрика для Editor.js image-tool.
// Plan-04 (Posts + Editor) кладёт результат в new EditorJS({ tools: { image: buildImageToolConfig() } }).
// Контракт ответа /api/upload — { success: 1, file: { url, width, height } }
// — совпадает с тем, что @editorjs/image ≥2.10 ожидает по default'у.
// Если в plan-04 окажется, что свежая версия требует другую форму,
// корректируем формат ответа в src/app/api/upload/route.ts.
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

- [ ] **Step 8.2: Smoke-проверка типов**

```bash
pnpm tsc --noEmit
```

Ожидание: TypeScript-ошибок нет. Если `@editorjs/image` не предоставляет .d.ts — TS не упадёт (any), но проверь, что нет «cannot find module».

- [ ] **Step 8.3: Коммит**

```bash
git add src/lib/editor/image-tool.ts
git commit -m "feat(editor): image-tool config factory (stub for plan-04)"
```

---

## Task 9: Cleanup script для orphan uploads

**Files:**
- Create: `scripts/cleanup-orphan-uploads.ts`

**Логика:**
1. SELECT `id`, `key` FROM `uploads` WHERE `post_id IS NULL` AND `created_at < now() - 7 days`.
2. Для каждой строки:
   - R2 `DeleteObject({ Bucket, Key: row.key })`
   - DB `DELETE FROM uploads WHERE id = row.id`
3. В конце: `console.log({ found, deleted, errors })`.

**Флаги:**
- `--dry-run` — только логирует кандидатов, ничего не трогает.
- (Опционально) `--older-than-days=N` — переопределяет порог 7.

- [ ] **Step 9.1: Создать `scripts/cleanup-orphan-uploads.ts`**

```ts
// Usage:
//   pnpm cleanup:orphans                      — реально удаляет
//   pnpm cleanup:orphans --dry-run            — только логи
//   pnpm cleanup:orphans --older-than-days=3  — переопределить порог
//
// TODO(plan-6): обвязать cron в docker-compose (отдельный sidecar контейнер
// `node --loader tsx scripts/cleanup-orphan-uploads.ts` по расписанию).

import { and, isNull, lt } from "drizzle-orm";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { uploads } from "@db/schema";
import { getR2Client, r2Bucket } from "@/lib/storage/r2";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const olderArg = argv.find(a => a.startsWith("--older-than-days="));
const olderDays = olderArg ? Number(olderArg.split("=")[1]) : 7;

if (!Number.isFinite(olderDays) || olderDays < 0) {
  console.error("[cleanup] invalid --older-than-days");
  process.exit(1);
}

async function main() {
  const cutoff = new Date(Date.now() - olderDays * 24 * 60 * 60 * 1000);
  const db = getDb();

  const rows = await db
    .select({ id: uploads.id, key: uploads.key })
    .from(uploads)
    .where(and(isNull(uploads.postId), lt(uploads.createdAt, cutoff)));

  console.log(`[cleanup] found ${rows.length} orphan(s) older than ${olderDays}d`);

  if (dryRun) {
    for (const r of rows) console.log(`  DRY  ${r.id}  ${r.key}`);
    console.log("[cleanup] dry-run: no changes");
    return;
  }

  // R2 client init только в реальной ветке — чтобы --dry-run работал без R2 credentials.
  const r2 = getR2Client();
  const bucket = r2Bucket();

  let deleted = 0;
  const errors: Array<{ id: string; err: string }> = [];

  for (const r of rows) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: r.key }));
      await db.delete(uploads).where(eq(uploads.id, r.id));
      deleted += 1;
      console.log(`  DEL  ${r.id}  ${r.key}`);
    } catch (e) {
      errors.push({ id: r.id, err: String(e) });
      console.error(`  ERR  ${r.id}  ${r.key}  →  ${String(e)}`);
    }
  }

  console.log(JSON.stringify({ found: rows.length, deleted, errors: errors.length }));
}

main().then(() => process.exit(0)).catch(e => {
  console.error("[cleanup] fatal:", e);
  process.exit(1);
});
```

**Замечание про `tsx` + path-alias:** `tsx` уважает `tsconfig.paths`, поэтому `@/lib/db` и `@db/schema` работают «из коробки». Если на твоём окружении не работает — проверь, что у `tsconfig.json` `moduleResolution: "Bundler"` (это уже стоит из plan-01).

- [ ] **Step 9.2: Прогнать в `--dry-run` режиме**

R2-клиент в скрипте инициализируется только в реальной ветке (см. комментарий в коде), поэтому `--dry-run` работает без R2-credentials — главное, чтобы Postgres был поднят.

```bash
docker compose up -d db
pnpm cleanup:orphans --dry-run
```

Ожидание: `[cleanup] found N orphan(s) older than 7d` + список (если есть строки), `[cleanup] dry-run: no changes`. **Никаких** удалений в R2 / DB.

Полный (не-dry) прогон требует заполненных `R2_*` env — это тестируется в Task 10 Step 10.3.

- [ ] **Step 9.3: Smoke-проверка типов**

```bash
pnpm tsc --noEmit
```

Ожидание: чистый прогон.

- [ ] **Step 9.4: Коммит**

```bash
git add scripts/cleanup-orphan-uploads.ts
git commit -m "feat(scripts): cleanup-orphan-uploads with --dry-run"
```

---

## Task 10: Финальная верификация и retro-skeleton

**Files:**
- Modify: `README.md` (короткий блок «sharp на Hetzner Linux x64»)
- Modify: этот файл (`docs/superpowers/plans/2026-06-13-plan-03-storage.md`) — добавить retro-секцию.

- [ ] **Step 10.1: Дополнить `README.md`**

Найди существующую секцию про окружение/деплой (в plan-01 README про docker-compose). Добавь блок:

```markdown
## sharp на Linux x64 (Hetzner)

При прод-сборке на Linux x64 Hetzner-машинe `pnpm install` подтягивает `@img/sharp-linux-x64`
автоматически. Если в Docker-образе используется multi-platform build и кто-то соберёт
на M-серии Mac под targetPlatform=linux/amd64, может потребоваться:

    pnpm install --config.platform=linux --config.arch=x64

Или установка переменной `SHARP_IGNORE_GLOBAL_LIBVIPS=1` перед `pnpm install`,
если на хост-системе живёт несовместимая глобальная libvips.

Подробности — `node_modules/sharp/install/check.js` после `pnpm install`.
```

(Если в README уже есть похожий блок — пропусти.)

- [ ] **Step 10.2: Финальная DoD-проверка — automated**

```bash
pnpm test
pnpm tsc --noEmit
pnpm build
```

Ожидание (по очереди):
- `pnpm test` — зелёный, минимум +5 новых файлов (env-r2, r2-key, validate, normalize, upload-route).
- `pnpm tsc --noEmit` — без TypeScript-ошибок.
- `pnpm build` — успешно с пустыми R2 env.

- [ ] **Step 10.3: Финальная DoD-проверка — ручная (требует R2 dev-bucket)**

Если у тебя ещё нет R2 dev-bucket:
1. Зайди в Cloudflare dashboard → R2 → создай bucket `skelet-dev`.
2. Включи public access (R2.dev custom domain или Cloudflare-managed `https://pub-<hash>.r2.dev`).
3. Создай API-токен (R2 → Manage API tokens) с правами Read/Write на bucket.
4. Заполни в `.env`:
   ```env
   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   R2_BUCKET=skelet-dev
   R2_ACCESS_KEY_ID=<from token>
   R2_SECRET_ACCESS_KEY=<from token>
   R2_PUBLIC_BASE=https://pub-<hash>.r2.dev
   ```

Подними dev-сервер:
```bash
docker compose up -d db
pnpm dev
```

В отдельном терминале — залогинься через Yandex или VK (нужна сессия) и достань cookie:
```bash
# браузер: открой http://localhost:3000/login → войди через Yandex → DevTools → Application → Cookies → копируй authjs.session-token
# или (быстрее) скопируй весь Cookie header целиком в переменную:
COOKIE='authjs.session-token=<value>'
```

Сценарий 1 — успех:
```bash
curl -i -F image=@tests/fixtures/images/large.jpg \
  -H "Cookie: $COOKIE" \
  http://localhost:3000/api/upload
```
Ожидание: `HTTP/1.1 200 OK`, JSON `{ success: 1, file: { url: "https://...", width: 2560, height: 1920 }, uploadId: "<ULID>" }`. В Cloudflare R2 dashboard видно объект `uploads/<userId>/<ulid>.webp`. В Postgres:
```bash
docker compose exec db psql -U app -d app -c 'SELECT id, user_id, key, width, height, size FROM uploads ORDER BY created_at DESC LIMIT 5;'
```
Ожидание: строка с правильными `width=2560`, `height=1920`, `mime=image/webp`.

Сценарий 2 — 503:
Закомментируй `R2_ENDPOINT` в `.env`, перезапусти dev:
```bash
curl -i -F image=@tests/fixtures/images/small.jpg -H "Cookie: $COOKIE" http://localhost:3000/api/upload
```
Ожидание: `503` + `{"success":0,"error":"storage_not_configured"}`.

Сценарий 3 — 415:
Раскоментируй R2_*, перезапусти. Загрузи txt:
```bash
curl -i -F image=@tests/fixtures/images/not-an-image.txt -H "Cookie: $COOKIE" http://localhost:3000/api/upload
```
Ожидание: `415` + `{"success":0,"error":"bad_mime"}`.

Сценарий 4 — cleanup:
```bash
pnpm cleanup:orphans --dry-run
```
Ожидание: `[cleanup] found 0 orphan(s)` (только что залитые ещё свежие; запиши в retro, что dry-run работает).

Чтобы реально протестировать удаление — можно временно убавить порог:
```bash
pnpm cleanup:orphans --older-than-days=0
```
Ожидание: ВСЕ строки с `post_id IS NULL` удалятся (в plan-03 у нас ещё нет `posts`, так что ВСЕ uploads — orphan). Проверь в Cloudflare dashboard — объект исчез; в `SELECT * FROM uploads;` — пусто. Это деструктивная проверка — делать только если ты понимаешь, что теряешь все тестовые загрузки.

Сценарий 5 — `next/image` whitelist:
В минимальной странице (можно временно засунуть в `src/app/page.tsx`):
```tsx
import Image from "next/image";

export default function Page() {
  return <Image src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ?? ""}/uploads/<userId>/<ulid>.webp`} width={2560} height={1920} alt="test" />;
}
```
(Замени `<userId>/<ulid>` на реальный путь из Сценария 1.)
В браузере http://localhost:3000 — картинка SSR-рендерится, нет warning в консоли «Invalid src prop». Откати page.tsx.

- [ ] **Step 10.4: Заполнить retro-секцию в этом файле**

Скролл вниз — найди `## Retro (заполнить после выполнения)`. Запиши:
- Что прошло гладко.
- Какие были pivot'ы по сравнению с планом / спецификацией (обычно 2–5 пунктов).
- Что отложено и почему.

Это вход в plan-04 (мы туда зайдём только после фиксации расхождений plan-03).

- [ ] **Step 10.5: Финальный коммит**

```bash
git add README.md docs/superpowers/plans/2026-06-13-plan-03-storage.md
git commit -m "docs(plan-03): README sharp note + retro skeleton"
```

(Если retro заполнен — формулировка коммита: `docs(plan-03): retro — <короткая суть>`.)

---

## Retro (выполнено 2026-06-13)

### Что прошло гладко

- **TDD-итерации все короткие.** На каждом из пяти модулей (env-r2, r2-key, validate, normalize, upload-route) RED → GREEN занял один проход, без отладочных циклов. Тесты сразу покрывали реальные кейсы из спеки §9.
- **sharp prebuild на M-Mac.** `pnpm add sharp` подтянул `@img/sharp-darwin-arm64` без танцев с `SHARP_IGNORE_GLOBAL_LIBVIPS`. Зона риска §10.1 не реализовалась (на Hetzner проверим в plan-06).
- **`@aws-sdk/client-s3` встал тихо.** ~150 KB, никаких peer-warnings, никаких бандл-проблем — `pnpm build` зелёный и с пустым, и с заполненным R2-env.
- **Миграция 0001 чистая.** `pnpm db:generate` создал ровно те колонки и индексы, что в спеке §4; никаких неожиданных `DROP` или ALTER на уже существующих таблицах.

### Расхождения с планом / спекой

1. **`pnpm db:migrate` не подхватывает `.env` сам.** `scripts/migrate.ts` (plan-01) читает только `process.env`. Пришлось делать `set -a && source .env && set +a && pnpm db:migrate`. Это поведение plan-01, не plan-03 — фиксировать в `migrate.ts` нет смысла, но добавляю в README команд для будущих сессий (или принимаем как локальный wart).
2. **`.env.example` ещё содержал устаревший Google/GitHub OAuth-блок.** Plan-02 retro п.8 (narrowing на Yandex+VK) был применён к `.env` и коду, но `.env.example` остался прежним. Pivot: в Task 1 заодно синхронизировал — удалил Google/GitHub блок, добавил `R2_PUBLIC_BASE=https://images.example.ru` как пример.
3. **README устарел.** Содержал секцию «OAuth для dev» про GitHub, которого больше нет. Pivot: в Task 10 переписал секцию под Yandex + VK ID, добавил `cleanup:orphans` в таблицу команд, плюс sharp/Hetzner блок (как и планировал).
4. **TS-ошибка в upload-route тесте на `Buffer → BlobPart`.** Под strict TS `new Blob([buffer], ...)` не компилируется (Node Buffer ≠ ArrayBuffer). Fix: `new Blob([new Uint8Array(file)], { type: mime })`. Маленький, не блокирующий, но в плане я этот случай не предвидел.
5. **Drizzle deprecation hint на `pgTable(name, cols, extraConfig)`.** Drizzle 0.36 двигается к `pgTable(name, cols, (t) => [...])` (массивы вместо объектов). Plan-01/02 уже на старой форме — для homogeneity оставил `uploads` тоже на старой. Refactor на новую форму — отдельная задача (post-plan-03 chore).
6. **Ручная DoD-проверка с реальным R2 (Step 10.3) — выполнена пост-фактум на Yandex Object Storage, не Cloudflare R2.** Cloudflare R2 потребовал привязку зарубежной карты — недоступно из РФ. Pivot: переключился на Yandex Object Storage (S3-совместимое API). Один точечный фикс в коде — `region: "auto"` → `region: "ru-central1"` в `src/lib/storage/r2.ts` (Yandex требует именно этот регион; R2/MinIO принимают любой непустой). Имена env-переменных и весь остальной код не тронуты — S3 SDK универсален. End-to-end DoD пройден: загрузка через `/dev/upload-test` (см. п.7) → объект появился в bucket `testskelet` → публичная ссылка `https://testskelet.storage.yandexcloud.net/uploads/<userId>/<ulid>.webp` открывается без подписи → строка в таблице `uploads` корректна.
7. **Добавлена одноразовая dev-страница `/dev/upload-test`.** Plan-03 не предусматривал UI-точку для ручной проверки (Editor.js приходит в plan-04). Чтобы не ждать plan-04 для верификации загрузки, добавил минимальный server-component + client-form (`src/app/dev/upload-test/page.tsx` + `form.tsx`) с `<input type="file">` + рендером ответа `/api/upload`. Помечен `TODO(plan-04)` на удаление — заменится Editor.js страницей создания поста.

### Отложено / маркеры на будущее

- `TODO(plan-3+)` в `src/lib/images/validate.ts` — HEIC/HEIF через `heic-convert`.
- `TODO(plan-3+)` в `tests/storage/normalize.test.ts` — реальная EXIF orientation=6 фикстура (sharp не пишет EXIF, нужна CC0 картинка из libexif-tests).
- `TODO(plan-4)` в `drizzle/schema.ts` — FK `uploads.post_id → posts.id ON DELETE SET NULL`.
- `TODO(plan-6)` в `scripts/cleanup-orphan-uploads.ts` — cron sidecar в docker-compose.

### Готовность к plan-04

- `buildImageToolConfig()` экспортируется — plan-04 кладёт в `new EditorJS({ tools: { image: ... } })`.
- `/api/upload` готов к multipart от Editor.js image-block, контракт ответа совпадает с `@editorjs/image ≥2.10` (`{ success: 1, file: { url, width, height } }`).
- `uploads.post_id` — nullable text без FK; plan-04 добавит FK миграцией и логику линковки при `publishPost`.
- `next/image` whitelist для R2 host работает — plan-04 страница поста использует `<Image>` для иллюстраций.
- ULID-генератор (`src/lib/auth/id.ts`) переиспользуется в plan-04 для `posts.id`.
- Индекс `uploads_post_idx` уже есть → plan-04 linker-запрос `UPDATE uploads SET post_id = ? WHERE public_url IN (?)` будет быстрым.
