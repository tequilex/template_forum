import { auth } from "@/lib/auth.edge";
import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/api", "/u/", "/_next", "/favicon", "/icons", "/manifest"];

// TODO(plan-3+): rate-limit на /api/auth/callback/* (спека §7.6).
// TODO(plan-5): admin-role gating для /admin/* (спека §7.5).

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (!session?.user) return NextResponse.next();

  if (session.user.bannedAt) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    const res = NextResponse.redirect(url);
    for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) {
      res.cookies.set(name, "", { maxAge: 0, path: "/" });
    }
    return res;
  }

  if (!session.user.username) {
    if (pathname === "/welcome") return NextResponse.next();
    if (PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p))) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/.*|manifest\\.webmanifest).*)",
  ],
};
