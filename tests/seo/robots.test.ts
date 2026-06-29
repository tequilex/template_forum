import { describe, it, expect, beforeEach, afterEach } from "vitest";
import robots from "@/app/robots";
import { _resetEnvCacheForTests } from "@/lib/env";

const env = process.env as Record<string, string | undefined>;
const ORIG = env.NEXTAUTH_URL;

describe("robots()", () => {
  beforeEach(() => {
    env.NEXTAUTH_URL = "https://example.ru";
    _resetEnvCacheForTests();
  });
  afterEach(() => {
    env.NEXTAUTH_URL = ORIG;
    _resetEnvCacheForTests();
  });

  it("disallow содержит все приватные пути", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules!;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow!];
    expect(disallow).toEqual(expect.arrayContaining([
      "/drafts", "/edit/", "/new", "/admin", "/banned", "/auth/", "/api/", "/dev/",
    ]));
  });

  it("sitemap указывает на NEXTAUTH_URL/sitemap.xml", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://example.ru/sitemap.xml");
  });
});
