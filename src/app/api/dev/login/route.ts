import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, sessions } from "@db/schema";
import { getEnv } from "@/lib/env";
import { newId } from "@/lib/auth/id";
import { sessionCookieName, sessionTtlSeconds } from "@/lib/auth/oauth-vk";

// Dev-only быстрый логин тестовым юзером. В production route отвечает 404 —
// нет никакого секрета или дефолт-флага, который бы спас от случайного
// деплоя bypass'а в prod. Жёсткая kill-switch по NODE_ENV.
//
// GET /api/dev/login           → залогинить тестового user'а
// GET /api/dev/login?role=admin → залогинить тестового админа
//
// Юзеры создаются идемпотентно (lookup по email), сессия — новая cookie на
// каждый клик (старые сессии остаются в БД до expires, это ок для dev).

const TEST_USERS = {
  user: {
    email: "dev-user@local.test",
    username: "devuser",
    name: "Dev User",
    role: "user" as const,
  },
  admin: {
    email: "dev-admin@local.test",
    username: "devadmin",
    name: "Dev Admin",
    role: "admin" as const,
  },
};

export async function GET(req: NextRequest) {
  if (getEnv().NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const role = req.nextUrl.searchParams.get("role") === "admin" ? "admin" : "user";
  const profile = TEST_USERS[role];

  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);

  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
    await db.update(users)
      .set({ username: profile.username, name: profile.name, role: profile.role, bannedAt: null, banReason: null })
      .where(eq(users.id, userId));
  } else {
    userId = newId();
    await db.insert(users).values({
      id: userId,
      email: profile.email,
      username: profile.username,
      name: profile.name,
      role: profile.role,
    });
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + sessionTtlSeconds * 1000);
  await db.insert(sessions).values({ sessionToken, userId, expires });

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NEXTAUTH_URL.startsWith("https://"),
    path: "/",
    expires,
  });
  return res;
}
