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

  it("concatenates STORAGE_PUBLIC_BASE + / + key", () => {
    withEnv({
      STORAGE_ENDPOINT: "https://s3.timeweb.cloud",
      STORAGE_BUCKET: "b",
      STORAGE_ACCESS_KEY_ID: "k",
      STORAGE_SECRET_ACCESS_KEY: "s",
      STORAGE_PUBLIC_BASE: "https://images.example.ru",
    }, () => {
      expect(buildPublicUrl("uploads/u/x.webp"))
        .toBe("https://images.example.ru/uploads/u/x.webp");
    });
  });

  it("trims trailing slash from STORAGE_PUBLIC_BASE", () => {
    withEnv({
      STORAGE_ENDPOINT: "https://s3.timeweb.cloud",
      STORAGE_BUCKET: "b",
      STORAGE_ACCESS_KEY_ID: "k",
      STORAGE_SECRET_ACCESS_KEY: "s",
      STORAGE_PUBLIC_BASE: "https://images.example.ru/",
    }, () => {
      expect(buildPublicUrl("uploads/u/x.webp"))
        .toBe("https://images.example.ru/uploads/u/x.webp");
    });
  });
});
