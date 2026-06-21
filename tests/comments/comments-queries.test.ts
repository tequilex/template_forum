import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, getPool } from "@/lib/db";
import { users, posts, comments } from "@db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/auth/id";
import { getCommentsByPost, getCommentCount } from "@/server/comments";

const ids = { user: newId(), post: newId(), c1: newId(), c2: newId(), c3: newId() };

beforeAll(async () => {
  const db = getDb();
  await db.insert(users).values({ id: ids.user, email: `q-${ids.user}@x.io`, username: `qa${ids.user.slice(-8)}` });
  await db.insert(posts).values({
    id: ids.post, authorId: ids.user, slug: `q-${ids.post}`, title: "q",
    content: { blocks: [] }, status: "published", pubAt: new Date(),
  });
  await db.insert(comments).values({ id: ids.c1, postId: ids.post, authorId: ids.user, contentText: "first" });
  await new Promise((r) => setTimeout(r, 10));
  await db.insert(comments).values({
    id: ids.c2, postId: ids.post, authorId: ids.user, contentText: "second-deleted",
    deletedAt: new Date(), deletedBy: ids.user,
  });
  await new Promise((r) => setTimeout(r, 10));
  await db.insert(comments).values({ id: ids.c3, postId: ids.post, authorId: ids.user, contentText: "third" });
});

afterAll(async () => {
  const db = getDb();
  await db.delete(comments).where(eq(comments.postId, ids.post));
  await db.delete(posts).where(eq(posts.id, ids.post));
  await db.delete(users).where(eq(users.id, ids.user));
  await getPool().end();
});

describe("getCommentsByPost", () => {
  it("возвращает ВСЕ комменты включая deleted, ordered by createdAt ASC", async () => {
    const page = await getCommentsByPost(ids.post, 1);
    expect(page.items).toHaveLength(3);
    expect(page.items.map((c) => c.id)).toEqual([ids.c1, ids.c2, ids.c3]);
  });

  it("у deleted-коммента поле deletedAt != null", async () => {
    const page = await getCommentsByPost(ids.post, 1);
    const deleted = page.items.find((c) => c.id === ids.c2);
    expect(deleted?.deletedAt).toBeInstanceOf(Date);
  });

  it("totalCount — только не-deleted (2 из 3)", async () => {
    const page = await getCommentsByPost(ids.post, 1);
    expect(page.totalCount).toBe(2);
  });
});

describe("getCommentCount", () => {
  it("считает только не-deleted (2)", async () => {
    const n = await getCommentCount(ids.post);
    expect(n).toBe(2);
  });
});
