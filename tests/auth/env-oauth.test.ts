import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://app:test@localhost:5432/app",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "x".repeat(32),
};

describe("env: OAuth keys", () => {
  it("accepts env without any OAuth keys (dev/test default)", () => {
    const env = parseEnv(base);
    expect(env.YANDEX_CLIENT_ID).toBeUndefined();
    expect(env.VK_CLIENT_SECRET).toBeUndefined();
  });

  it("parses OAuth keys when provided", () => {
    const env = parseEnv({
      ...base,
      YANDEX_CLIENT_ID: "y-id", YANDEX_CLIENT_SECRET: "y-sec",
      VK_CLIENT_ID: "v-id", VK_CLIENT_SECRET: "v-sec",
    });
    expect(env.YANDEX_CLIENT_ID).toBe("y-id");
    expect(env.YANDEX_CLIENT_SECRET).toBe("y-sec");
    expect(env.VK_CLIENT_ID).toBe("v-id");
    expect(env.VK_CLIENT_SECRET).toBe("v-sec");
  });

  it("rejects partial pair (id without secret)", () => {
    expect(() => parseEnv({ ...base, VK_CLIENT_ID: "x" })).toThrow(/VK_CLIENT_SECRET/);
  });
});
