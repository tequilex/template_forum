import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";

// Не importActual: @/lib/auth тянет next-auth, который в Node-ESM падает на
// next/server. Page.tsx использует только auth() — полностью мокаем модуль.
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));

import { getDb, getPool } from "@/lib/db";
import { posts, users } from "@db/schema";
import PostPage from "@/app/(public)/p/[slug]/page";
import { auth } from "@/lib/auth";

const db = getDb();
const OWNER = "01J0TEST0000000000ROUTEOWN";
const OTHER = "01J0TEST0000000000ROUTEOTH";
const POST_PUBLIC = "01J0TEST0000000ROUTEPOSTPUB";
const POST_DRAFT = "01J0TEST0000000ROUTEPOSTDRF";
const POST_ARCH = "01J0TEST0000000ROUTEPOSTARC";
const POST_DEL = "01J0TEST0000000ROUTEPOSTDEL";

beforeAll(async () => {
  await db.insert(users).values([
    { id: OWNER, email: `route-owner-${Date.now()}@example.test` },
    { id: OTHER, email: `route-other-${Date.now()}@example.test` },
  ]).onConflictDoNothing();

  await db.insert(posts).values([
    { id: POST_PUBLIC, authorId: OWNER, slug: "route-pub", title: "Pub", content: { blocks: [] }, contentHtml: "<p>x</p>", status: "published", pubAt: new Date() },
    { id: POST_DRAFT, authorId: OWNER, slug: "route-drf", title: "Drf", content: { blocks: [] }, status: "draft" },
    { id: POST_ARCH, authorId: OWNER, slug: "route-arc", title: "Arc", content: { blocks: [] }, contentHtml: "<p>x</p>", status: "archived" },
    { id: POST_DEL, authorId: OWNER, slug: "route-del", title: "Del", content: { blocks: [] }, contentHtml: "<p>x</p>", status: "published", pubAt: new Date(), deletedAt: new Date() },
  ]).onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(posts).where(eq(posts.authorId, OWNER));
  await db.delete(users).where(eq(users.id, OWNER));
  await db.delete(users).where(eq(users.id, OTHER));
  await getPool().end();
});

beforeEach(() => {
  (auth as any).mockResolvedValue(null);
});

// Прямой вызов page-функции: обходим Next request lifecycle, но проверяем
// логику видимости без подъёма HTTP-сервера. JSX не ассертим — только
// факт notFound() (throws) vs обычный return.
const callPage = (slug: string) =>
  PostPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) } as any);

describe("/p/[slug] visibility matrix", () => {
  it("published, anon → render (no throw)", async () => {
    await expect(callPage("route-pub")).resolves.toBeTruthy();
  });

  it("published, owner → render", async () => {
    (auth as any).mockResolvedValue({ user: { id: OWNER } });
    await expect(callPage("route-pub")).resolves.toBeTruthy();
  });

  it("draft, anon → notFound", async () => {
    await expect(callPage("route-drf")).rejects.toThrow();
  });

  it("draft, owner → notFound (preview не поддерживается в plan-04)", async () => {
    (auth as any).mockResolvedValue({ user: { id: OWNER } });
    await expect(callPage("route-drf")).rejects.toThrow();
  });

  it("archived, anon → notFound", async () => {
    await expect(callPage("route-arc")).rejects.toThrow();
  });

  it("archived, owner → render", async () => {
    (auth as any).mockResolvedValue({ user: { id: OWNER } });
    await expect(callPage("route-arc")).resolves.toBeTruthy();
  });

  it("archived, other user → notFound", async () => {
    (auth as any).mockResolvedValue({ user: { id: OTHER } });
    await expect(callPage("route-arc")).rejects.toThrow();
  });

  it("deleted, anyone → notFound (unified 404 in plan-5b)", async () => {
    await expect(callPage("route-del")).rejects.toThrow();
  });

  it("bad slug → notFound", async () => {
    await expect(callPage("route-does-not-exist")).rejects.toThrow();
  });
});
