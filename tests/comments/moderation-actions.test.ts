import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { getDb, getPool } from "@/lib/db";
import { users, posts, comments } from "@db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/auth/id";
import { adminDeleteComment, adminBanUser, adminHidePost } from "@/server/actions/moderation";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async () => {
  const real = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return { ...real, redirect: vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); }) };
});

const ids = { admin: newId(), user: newId(), post: newId(), comment: newId() };

async function seed() {
  const db = getDb();
  await db.insert(users).values({ id: ids.admin, email: `adm-${ids.admin}@x.io`, role: "admin" });
  await db.insert(users).values({ id: ids.user, email: `usr-${ids.user}@x.io`, role: "user" });
  await db.insert(posts).values({
    id: ids.post, authorId: ids.user, slug: `m-${ids.post}`, title: "m",
    content: { blocks: [] }, status: "published", pubAt: new Date(),
  });
  await db.insert(comments).values({
    id: ids.comment, postId: ids.post, authorId: ids.user, contentText: "spam",
  });
}

async function cleanup() {
  const db = getDb();
  await db.delete(comments).where(eq(comments.postId, ids.post));
  await db.delete(posts).where(eq(posts.id, ids.post));
  await db.delete(users).where(eq(users.id, ids.user));
  await db.delete(users).where(eq(users.id, ids.admin));
}

describe("moderation actions", () => {
  beforeEach(async () => { await cleanup(); await seed(); });
  afterAll(async () => {
    await cleanup();
    await getPool().end();
  });

  it("adminDeleteComment не-админом → redirect (через assertAdmin)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: ids.user, role: "user" } } as never);
    await expect(adminDeleteComment(ids.comment)).rejects.toThrow(/REDIRECT:/);
  });

  it("adminBanUser без причины → reject", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: ids.admin, role: "admin" } } as never);
    const r = await adminBanUser(ids.user, "abc");
    expect(r.ok).toBe(false);
  });

  it("adminHidePost ставит hiddenByAdminAt + hiddenByAdminId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: ids.admin, role: "admin" } } as never);
    const r = await adminHidePost(ids.post);
    expect(r.ok).toBe(true);
    const post = (await getDb().select().from(posts).where(eq(posts.id, ids.post)))[0];
    expect(post.hiddenByAdminAt).toBeInstanceOf(Date);
    expect(post.hiddenByAdminId).toBe(ids.admin);
  });
});
