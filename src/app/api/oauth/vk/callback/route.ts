import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import {
  COOKIE_CALLBACK,
  COOKIE_STATE,
  COOKIE_VERIFIER,
  exchangeCode,
  fetchUserInfo,
  sessionCookieName,
  sessionTtlSeconds,
  upsertUserAndSession,
} from "@/lib/auth/oauth-vk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeCallback(input: string | null): string {
  if (!input) return "/";
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}

function fail(_req: NextRequest, code: string): NextResponse {
  const url = new URL("/login", getEnv().NEXTAUTH_URL);
  url.searchParams.set("error", code);
  const res = NextResponse.redirect(url);
  res.cookies.delete(COOKIE_VERIFIER);
  res.cookies.delete(COOKIE_STATE);
  res.cookies.delete(COOKIE_CALLBACK);
  return res;
}

export async function GET(req: NextRequest) {
  const env = getEnv();
  if (!env.VK_CLIENT_ID || !env.VK_CLIENT_SECRET) return fail(req, "vk_disabled");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const deviceId = req.nextUrl.searchParams.get("device_id");
  if (!code || !state || !deviceId) return fail(req, "vk_missing_params");

  const expectedState = req.cookies.get(COOKIE_STATE)?.value;
  const verifier = req.cookies.get(COOKIE_VERIFIER)?.value;
  if (!expectedState || !verifier) return fail(req, "vk_no_session");
  if (state !== expectedState) return fail(req, "vk_bad_state");

  const callbackUrl = safeCallback(req.cookies.get(COOKIE_CALLBACK)?.value ?? null);

  let tokens, profile;
  try {
    tokens = await exchangeCode({ code, codeVerifier: verifier, deviceId, state });
    profile = await fetchUserInfo(tokens.accessToken);
  } catch (e) {
    console.error("[vk-oauth] token/userinfo failed:", e);
    return fail(req, "vk_exchange_failed");
  }

  let session;
  try {
    session = await upsertUserAndSession({ profile, tokens });
  } catch (e) {
    console.error("[vk-oauth] db upsert failed:", e);
    return fail(req, "vk_db_failed");
  }

  const res = NextResponse.redirect(new URL(callbackUrl, env.NEXTAUTH_URL));
  res.cookies.delete(COOKIE_VERIFIER);
  res.cookies.delete(COOKIE_STATE);
  res.cookies.delete(COOKIE_CALLBACK);

  const secure = env.NEXTAUTH_URL.startsWith("https://");
  res.cookies.set(sessionCookieName(), session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: session.expires,
    maxAge: sessionTtlSeconds,
  });
  return res;
}
