import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

const BASE: Record<string, string> = {
  DATABASE_URL: "postgres://app:pw@db:5432/app",
  NEXTAUTH_URL: "https://example.ru",
  NEXTAUTH_SECRET: "x".repeat(32),
};

describe("parseEnv — production gate", () => {
  it("прод без DOMAIN/LETSENCRYPT_EMAIL — падает", () => {
    expect(() => parseEnv({ ...BASE, NODE_ENV: "production" }))
      .toThrow(/DOMAIN is required in production/);
  });

  it("прод без STORAGE_* — падает", () => {
    expect(() => parseEnv({
      ...BASE,
      NODE_ENV: "production",
      DOMAIN: "example.ru",
      LETSENCRYPT_EMAIL: "ops@example.ru",
    })).toThrow(/STORAGE_/);
  });
});
