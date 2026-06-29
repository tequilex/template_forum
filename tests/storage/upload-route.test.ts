// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { _resetEnvCacheForTests } from "@/lib/env";
import { _resetR2ClientForTests } from "@/lib/storage/r2";

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

const baseStorageEnv = {
  STORAGE_ENDPOINT: "https://s3.timeweb.cloud",
  STORAGE_BUCKET: "test-bucket",
  STORAGE_ACCESS_KEY_ID: "key",
  STORAGE_SECRET_ACCESS_KEY: "secret",
  STORAGE_PUBLIC_BASE: "https://images.example.ru",
};

const withEnv = <T>(extra: Record<string, string>, fn: () => Promise<T>): Promise<T> => {
  const snapshot = { ...process.env };
  // Гарантируем чистый env: удаляем всё лишнее, затем выставляем минимум.
  // Без этого STORAGE_*, попавшие через .env, утекают в кейс «503 when storage env not configured».
  for (const k of Object.keys(process.env)) delete process.env[k];
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
  form.append("image", new Blob([new Uint8Array(file)], { type: mime }), filename);
  return new Request("http://localhost:3000/api/upload", { method: "POST", body: form });
};

beforeEach(() => {
  authMock.mockReset();
  dbInsert.mockClear();
  dbInsertValues.mockClear();
  s3Send.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/upload", () => {
  it("503 when storage env not configured", async () => {
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
    await withEnv(baseStorageEnv, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(fix("small.jpg"), "x.jpg", "image/jpeg") as any);
      expect(res.status).toBe(401);
    });
  });

  it("415 for txt file (magic bytes fail)", async () => {
    authMock.mockResolvedValue({ user: { id: "01HQUSER" } });
    await withEnv(baseStorageEnv, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(fix("not-an-image.txt"), "x.txt", "image/jpeg") as any);
      expect(res.status).toBe(415);
    });
  });

  it("413 for oversized buffer", async () => {
    authMock.mockResolvedValue({ user: { id: "01HQUSER" } });
    const huge = Buffer.alloc(11 * 1024 * 1024, 0xff);
    await withEnv(baseStorageEnv, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(huge, "huge.bin", "image/jpeg") as any);
      expect(res.status).toBe(413);
    });
  });

  it("200 for valid jpeg — calls storage put + DB insert + returns Editor.js shape", async () => {
    authMock.mockResolvedValue({ user: { id: "01HQUSER" } });
    await withEnv(baseStorageEnv, async () => {
      const { POST } = await import("@/app/api/upload/route");
      const res = await POST(makeReq(fix("small.jpg"), "x.jpg", "image/jpeg") as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(1);
      expect(body.file).toBeDefined();
      expect(body.file.url).toMatch(/^https:\/\/images\.example\.ru\/uploads\/01HQUSER\/.+\.webp$/);
      expect(body.file.width).toBe(200);
      expect(body.file.height).toBe(200);
      expect(body.uploadId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/i);
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
