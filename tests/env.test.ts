import { describe, it, expect } from "vitest";
import { parseEnv } from "../src/lib/env";

describe("env validation", () => {
  it("accepts a complete dev env", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://app:pwd@localhost:5432/app",
      NEXTAUTH_SECRET: "x".repeat(32),
      NEXTAUTH_URL: "http://localhost:3000",
      NODE_ENV: "development",
    });
    expect(env.DATABASE_URL).toContain("postgres://");
  });

  it("rejects missing DATABASE_URL", () => {
    expect(() => parseEnv({
      NEXTAUTH_SECRET: "x".repeat(32),
      NEXTAUTH_URL: "http://localhost:3000",
      NODE_ENV: "development",
    } as never)).toThrow();
  });

  it("rejects short NEXTAUTH_SECRET", () => {
    expect(() => parseEnv({
      DATABASE_URL: "postgres://x:y@z/db",
      NEXTAUTH_SECRET: "short",
      NEXTAUTH_URL: "http://x",
      NODE_ENV: "development",
    })).toThrow(/NEXTAUTH_SECRET/);
  });
});
