import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import {
  COOKIE_CALLBACK,
  COOKIE_STATE,
  COOKIE_VERIFIER,
  buildAuthorizeUrl,
  generatePkce,
  generateState,
  isVkSubProvider,
  pkceTtlSeconds,
} from "@/lib/auth/oauth-vk";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const env = getEnv();
  if (!env.VK_CLIENT_ID || !env.VK_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=vk_disabled", env.NEXTAUTH_URL));
  }

  const subRaw = req.nextUrl.searchParams.get("provider");
  const subProvider = isVkSubProvider(subRaw) ? subRaw : "vkid";
  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") ?? "/";

  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const url = buildAuthorizeUrl({ state, codeChallenge: challenge, subProvider });

  const res = NextResponse.redirect(url);
  const secure = env.NEXTAUTH_URL.startsWith("https://");
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: pkceTtlSeconds,
  };
  res.cookies.set(COOKIE_VERIFIER, verifier, base);
  res.cookies.set(COOKIE_STATE, state, base);
  res.cookies.set(COOKIE_CALLBACK, callbackUrl, base);
  return res;
}
