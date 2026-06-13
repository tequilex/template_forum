import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { _resetEnvCacheForTests } from "@/lib/env";
import {
  buildAuthorizeUrl,
  generatePkce,
  generateState,
  isVkSubProvider,
  sessionCookieName,
  vkCallbackUrl,
} from "@/lib/auth/oauth-vk";

const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://app:test@localhost:5432/app",
  NEXTAUTH_URL: "http://localhost",
  NEXTAUTH_SECRET: "x".repeat(32),
  VK_CLIENT_ID: "54630151",
  VK_CLIENT_SECRET: "vk-secret",
};

function withEnv<T>(overrides: Record<string, string>, fn: () => T): T {
  const prev = { ...process.env };
  Object.assign(process.env, baseEnv, overrides);
  _resetEnvCacheForTests();
  try { return fn(); } finally {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, prev);
    _resetEnvCacheForTests();
  }
}

function b64urlOfSha256(input: string): string {
  return createHash("sha256").update(input).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

describe("oauth-vk: pkce/state", () => {
  it("PKCE challenge equals base64url(SHA256(verifier))", () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toBe(b64urlOfSha256(verifier));
  });

  it("state has no dots (compatible with VK ID round-trip)", () => {
    const s = generateState();
    expect(s).toMatch(/^[0-9a-f]+$/);
    expect(s).not.toContain(".");
  });
});

describe("oauth-vk: sub-provider guard", () => {
  it("accepts only vkid|mail_ru|ok_ru", () => {
    expect(isVkSubProvider("vkid")).toBe(true);
    expect(isVkSubProvider("mail_ru")).toBe(true);
    expect(isVkSubProvider("ok_ru")).toBe(true);
    expect(isVkSubProvider("google")).toBe(false);
    expect(isVkSubProvider(null)).toBe(false);
  });
});

describe("oauth-vk: URLs and cookie name", () => {
  it("vkCallbackUrl derives from NEXTAUTH_URL", () => {
    withEnv({}, () => {
      expect(vkCallbackUrl()).toBe("http://localhost/api/oauth/vk/callback");
    });
    withEnv({ NEXTAUTH_URL: "https://example.com/" }, () => {
      expect(vkCallbackUrl()).toBe("https://example.com/api/oauth/vk/callback");
    });
  });

  it("sessionCookieName uses __Secure- prefix only on https", () => {
    withEnv({ NEXTAUTH_URL: "http://localhost" }, () => {
      expect(sessionCookieName()).toBe("authjs.session-token");
    });
    withEnv({ NEXTAUTH_URL: "https://example.com" }, () => {
      expect(sessionCookieName()).toBe("__Secure-authjs.session-token");
    });
  });

  it("buildAuthorizeUrl omits provider= for vkid, includes for mail_ru/ok_ru", () => {
    withEnv({}, () => {
      const a = new URL(buildAuthorizeUrl({ state: "s", codeChallenge: "c", subProvider: "vkid" }));
      expect(a.origin + a.pathname).toBe("https://id.vk.com/authorize");
      expect(a.searchParams.get("response_type")).toBe("code");
      expect(a.searchParams.get("client_id")).toBe("54630151");
      expect(a.searchParams.get("redirect_uri")).toBe("http://localhost/api/oauth/vk/callback");
      expect(a.searchParams.get("state")).toBe("s");
      expect(a.searchParams.get("code_challenge")).toBe("c");
      expect(a.searchParams.get("code_challenge_method")).toBe("S256");
      expect(a.searchParams.get("scope")).toBe("email");
      expect(a.searchParams.get("provider")).toBeNull();

      const m = new URL(buildAuthorizeUrl({ state: "s", codeChallenge: "c", subProvider: "mail_ru" }));
      expect(m.searchParams.get("provider")).toBe("mail_ru");

      const o = new URL(buildAuthorizeUrl({ state: "s", codeChallenge: "c", subProvider: "ok_ru" }));
      expect(o.searchParams.get("provider")).toBe("ok_ru");
    });
  });
});
