import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

const baseValid = {
  DATABASE_URL: "postgres://app:pw@localhost:5432/app",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "x".repeat(32),
};

describe("env STORAGE keys — all-or-nothing", () => {
  it("accepts zero STORAGE keys", () => {
    expect(() => parseEnv(baseValid)).not.toThrow();
  });

  it("accepts all 5 STORAGE keys", () => {
    expect(() => parseEnv({
      ...baseValid,
      STORAGE_ENDPOINT: "https://s3.timeweb.cloud",
      STORAGE_BUCKET: "skelet-dev",
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_SECRET_ACCESS_KEY: "secret",
      STORAGE_PUBLIC_BASE: "https://images.example.ru",
    })).not.toThrow();
  });

  it("throws when only 1 of 5 STORAGE keys is set", () => {
    expect(() => parseEnv({
      ...baseValid,
      STORAGE_BUCKET: "skelet-dev",
    })).toThrow(/STORAGE_/);
  });

  it("throws when 4 of 5 STORAGE keys are set (STORAGE_PUBLIC_BASE missing)", () => {
    expect(() => parseEnv({
      ...baseValid,
      STORAGE_ENDPOINT: "https://s3.timeweb.cloud",
      STORAGE_BUCKET: "skelet-dev",
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_SECRET_ACCESS_KEY: "secret",
    })).toThrow(/STORAGE_/);
  });

  it("validates STORAGE_ENDPOINT as URL", () => {
    expect(() => parseEnv({
      ...baseValid,
      STORAGE_ENDPOINT: "not-a-url",
      STORAGE_BUCKET: "skelet-dev",
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_SECRET_ACCESS_KEY: "secret",
      STORAGE_PUBLIC_BASE: "https://images.example.ru",
    })).toThrow();
  });
});
