import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { getDb, getPool } from "@/lib/db";
import { users, posts, comments } from "@db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/auth/id";
import { _resetForTests as resetRateLimit } from "@/lib/rate-limit";
import { createComment, updateComment, deleteOwnComment } from "@/server/actions/comments";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ids = { user: newId(), post: newId() };

async function seed() {
  const db = getDb();
  await db.insert(users).values({ id: ids.user, email: `a-${ids.user}@x.io`, username: `ac${ids.user.slice(0, 6)}`, role: "user" });
  await db.insert(posts).values({
    id: ids.post, authorId: ids.user, slug: `a-${ids.post}`, title: "a",
    content: { blocks: [] }, status: "published", pubAt: new Date(),
  });
}

async function cleanup() {
  const db = getDb();
  await db.delete(comments).where(eq(comments.postId, ids.post));
  await db.delete(posts).where(eq(posts.id, ids.post));
  await db.delete(users).where(eq(users.id, ids.user));
}

describe("comment actions", () => {
  beforeEach(async () => {
    resetRateLimit();
    vi.mocked(auth).mockResolvedValue({ user: { id: ids.user, role: "user" } } as never);
    await cleanup();
    await seed();
  });
  afterAll(async () => {
    await cleanup();
    await getPool().end();
  });

  it("createComment без session → reject", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const r = await createComment(ids.post, "test");
    expect(r.ok).toBe(false);
  });

  it("updateComment по истечении 15 минут → reject", async () => {
    const r1 = await createComment(ids.post, "hello");
    expect(r1.ok).toBe(true);
    const cid = (r1 as { ok: true; data: { commentId: string } }).data.commentId;

    await getDb().update(comments)
      .set({ createdAt: new Date(Date.now() - 16 * 60 * 1000) })
      .where(eq(comments.id, cid));

    const r2 = await updateComment(cid, "hello edited");
    expect(r2.ok).toBe(false);
  });

  it("deleteOwnComment чужого коммента → reject", async () => {
    const r1 = await createComment(ids.post, "mine");
    const cid = (r1 as { ok: true; data: { commentId: string } }).data.commentId;

    const otherId = newId();
    await getDb().insert(users).values({ id: otherId, email: `o-${otherId}@x.io`, role: "user" });
    vi.mocked(auth).mockResolvedValue({ user: { id: otherId, role: "user" } } as never);

    const r2 = await deleteOwnComment(cid);
    expect(r2.ok).toBe(false);

    await getDb().delete(users).where(eq(users.id, otherId));
  });
});
