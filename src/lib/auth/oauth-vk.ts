import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { accounts, sessions, users } from "@db/schema";
import { newId } from "@/lib/auth/id";
import { getEnv } from "@/lib/env";

export const VK_AUTHORIZE_URL = "https://id.vk.com/authorize";
export const VK_TOKEN_URL = "https://id.vk.com/oauth2/auth";
export const VK_USERINFO_URL = "https://id.vk.com/oauth2/user_info";

export const COOKIE_VERIFIER = "oauth-vk-verifier";
export const COOKIE_STATE = "oauth-vk-state";
export const COOKIE_CALLBACK = "oauth-vk-callback";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const PKCE_TTL_SECONDS = 10 * 60;

export type VkSubProvider = "vkid" | "mail_ru" | "ok_ru";

export function isVkSubProvider(v: string | null | undefined): v is VkSubProvider {
  return v === "vkid" || v === "mail_ru" || v === "ok_ru";
}

export function vkCallbackUrl(): string {
  const base = getEnv().NEXTAUTH_URL.replace(/\/$/, "");
  return `${base}/api/oauth/vk/callback`;
}

export function sessionCookieName(): string {
  return getEnv().NEXTAUTH_URL.startsWith("https://")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

export const pkceTtlSeconds = PKCE_TTL_SECONDS;
export const sessionTtlSeconds = SESSION_TTL_SECONDS;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(opts: {
  state: string;
  codeChallenge: string;
  subProvider: VkSubProvider;
}): string {
  const env = getEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.VK_CLIENT_ID!,
    redirect_uri: vkCallbackUrl(),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    scope: "email",
  });
  if (opts.subProvider !== "vkid") {
    params.set("provider", opts.subProvider);
  }
  return `${VK_AUTHORIZE_URL}?${params.toString()}`;
}

export type VkProfile = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
};

type VkTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  deviceId: string;
  state: string;
}): Promise<VkTokens> {
  const env = getEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code_verifier: opts.codeVerifier,
    redirect_uri: vkCallbackUrl(),
    code: opts.code,
    client_id: env.VK_CLIENT_ID!,
    device_id: opts.deviceId,
    state: opts.state,
  });
  const res = await fetch(VK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`VK token exchange failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as Record<string, unknown>;
  const accessToken = asString(json.access_token);
  if (!accessToken) throw new Error(`VK token exchange returned no access_token: ${text}`);
  return {
    accessToken,
    refreshToken: asString(json.refresh_token),
    expiresIn: asNumber(json.expires_in),
  };
}

export async function fetchUserInfo(accessToken: string): Promise<VkProfile> {
  const env = getEnv();
  const body = new URLSearchParams({
    access_token: accessToken,
    client_id: env.VK_CLIENT_ID!,
  });
  const res = await fetch(VK_USERINFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`VK user_info failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as Record<string, unknown>;
  const u = json.user as Record<string, unknown> | undefined;
  const userId = u ? asString(u.user_id) ?? (typeof u.user_id === "number" ? String(u.user_id) : null) : null;
  if (!userId) throw new Error(`VK user_info missing user.user_id: ${text}`);
  return {
    user_id: userId,
    email: u ? asString(u.email) : null,
    first_name: u ? asString(u.first_name) : null,
    last_name: u ? asString(u.last_name) : null,
    avatar: u ? asString(u.avatar) : null,
  };
}

export async function upsertUserAndSession(opts: {
  profile: VkProfile;
  tokens: VkTokens;
}): Promise<{ sessionToken: string; expires: Date }> {
  const db = getDb();
  const { profile, tokens } = opts;
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || null;

  const existingAcc = await db.select().from(accounts).where(
    and(eq(accounts.provider, "vk"), eq(accounts.providerAccountId, profile.user_id)),
  ).limit(1);

  let userId: string;

  if (existingAcc.length > 0) {
    userId = existingAcc[0].userId;
  } else {
    let linkedUserId: string | null = null;
    if (profile.email) {
      const u = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
      if (u.length > 0) linkedUserId = u[0].id;
    }

    if (linkedUserId) {
      userId = linkedUserId;
    } else {
      userId = newId();
      const email = profile.email ?? `vk-${profile.user_id}@vk.placeholder`;
      await db.insert(users).values({
        id: userId,
        email,
        name: fullName,
        image: profile.avatar,
      });
    }

    const expiresAt = tokens.expiresIn
      ? Math.floor(Date.now() / 1000) + tokens.expiresIn
      : null;
    await db.insert(accounts).values({
      userId,
      type: "oauth",
      provider: "vk",
      providerAccountId: profile.user_id,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: expiresAt,
      token_type: "Bearer",
      scope: "email",
      id_token: null,
      session_state: null,
    });
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.insert(sessions).values({ sessionToken, userId, expires });

  return { sessionToken, expires };
}
