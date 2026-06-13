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
