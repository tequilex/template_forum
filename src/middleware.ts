import { NextResponse, type NextRequest } from "next/server";

// Маршруты, на которые анон не должен попадать вообще.
// Префикс-match: '/drafts' покрывает '/drafts', '/drafts?tab=archived' и т.д.
const PROTECTED_PREFIXES = ["/drafts", "/new", "/edit/"];

// Auth.js v5 в production использует префикс `__Secure-`, в dev — голый.
// Имя самой cookie — `authjs.session-token` (NextAuth v5 переименовал из next-auth).
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));
}

// Edge middleware без обращения к БД. Делает два дела:
// 1) Прокидывает x-pathname в RSC (для layout'ов, которым нужен текущий URL).
// 2) Проверяет ПРИСУТСТВИЕ session-cookie на protected-роутах — это убирает
//    вспышку UI при анонимном заходе на /drafts. Валидность cookie проверит
//    page-level requireAuthState() (defence-in-depth для протухших сессий).
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isProtected(pathname) && !hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?from=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/.*|manifest\\.webmanifest).*)",
  ],
};
