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
