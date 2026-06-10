import { NextResponse, type NextRequest } from "next/server";

// Edge middleware без auth-логики: только пропихивает pathname в request-headers,
// чтобы RSC-layout (Node-runtime, с DrizzleAdapter) мог корректно делать auth-guard.
// БД-сессии нельзя читать из edge (postgres-driver не запускается).
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/.*|manifest\\.webmanifest).*)",
  ],
};
