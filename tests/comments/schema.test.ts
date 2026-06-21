import { describe, it, expect, afterAll } from "vitest";
import { eq, like, or } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db";
import { comments, users, posts } from "@db/schema";
import { newId } from "@/lib/auth/id";

const db = getDb();

// Cleanup по паттерну, а не по конкретному id — чтобы упавший в середине
// assert не оставлял осиротевшие строки в dev-БД (видны как «анонимный пост»
// в /p/[slug]). Pattern self-healing: подберёт и старые утечки.
afterAll(async () => {
  await db.delete(posts).where(like(posts.slug, "t-%"));
  await db.delete(users).where(
    or(like(users.email, "t-%@x.io"), like(users.email, "a-%@x.io"), like(users.email, "b-%@x.io")),
  );
  await getPool().end();
});

describe("schema 0003 — comments + ban_reason + hidden_by_admin", () => {
  it("создаёт коммент с FK к existing post и юзеру", async () => {
    const userId = newId();
    await db.insert(users).values({ id: userId, email: `t-${userId}@x.io` });
    const postId = newId();
    await db.insert(posts).values({
      id: postId, authorId: userId, slug: `t-${postId}`, title: "t",
      content: { blocks: [] }, status: "draft",
    });

    const commentId = newId();
    await db.insert(comments).values({
      id: commentId, postId, authorId: userId, contentText: "привет",
    });

    const rows = await db.select().from(comments).where(eq(comments.id, commentId));
    expect(rows).toHaveLength(1);
    expect(rows[0].contentText).toBe("привет");
    expect(rows[0].parentId).toBeNull();
    expect(rows[0].deletedAt).toBeNull();
  });

  it("posts.hiddenByAdminAt и users.banReason доступны на запись", async () => {
    const adminId = newId();
    const authorId = newId();
    await db.insert(users).values({ id: adminId, email: `a-${adminId}@x.io`, banReason: null });
    await db.insert(users).values({ id: authorId, email: `b-${authorId}@x.io`, banReason: "spam" });
    const postId = newId();
    await db.insert(posts).values({
      id: postId, authorId, slug: `t-${postId}`, title: "t", content: { blocks: [] }, status: "published",
      hiddenByAdminAt: new Date(), hiddenByAdminId: adminId,
    });

    const post = (await db.select().from(posts).where(eq(posts.id, postId)))[0];
    expect(post.hiddenByAdminAt).toBeInstanceOf(Date);
    expect(post.hiddenByAdminId).toBe(adminId);

    const banned = (await db.select().from(users).where(eq(users.id, authorId)))[0];
    expect(banned.banReason).toBe("spam");
  });
});
