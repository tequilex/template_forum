import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions } from "@db/schema";
import { getEnv } from "@/lib/env";

const COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

export async function GET() {
  const store = await cookies();
  const tokenCookie = COOKIE_NAMES.map(n => store.get(n)).find(Boolean);

  if (tokenCookie?.value) {
    await getDb().delete(sessions).where(eq(sessions.sessionToken, tokenCookie.value));
  }

  const res = NextResponse.redirect(new URL("/", getEnv().NEXTAUTH_URL));
  for (const name of COOKIE_NAMES) {
    res.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
  return res;
}
