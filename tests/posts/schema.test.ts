import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db";
import { posts, postTags, tags, uploads, users } from "@db/schema";
import { newId } from "@/lib/auth/id";

const db = getDb();

const TEST_USER_ID = "01J0TEST0000000000000USER01";
const TEST_POST_ID = "01J0TEST0000000000000POST01";

beforeAll(async () => {
  // Тест работает на той же БД, где живут plan-03 фикстуры. Создаём свой user.
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: `schema-test-${Date.now()}@example.test`,
  }).onConflictDoNothing();
});

afterAll(async () => {
  // Cleanup: каскад через FK уберёт post_tags и обнулит uploads.post_id.
  await db.delete(posts).where(eq(posts.id, TEST_POST_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
  await getPool().end();
});

describe("posts schema (миграция 0002)", () => {
  it("seed-тэги присутствуют (6 штук)", async () => {
    const rows = await db.select().from(tags);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const slugs = rows.map(r => r.slug);
    expect(slugs).toEqual(expect.arrayContaining([
      "experience", "question", "news", "review", "opinion", "lifehack",
    ]));
  });

  it("INSERT post с правильными полями работает", async () => {
    await db.insert(posts).values({
      id: TEST_POST_ID,
      authorId: TEST_USER_ID,
      slug: `test-slug-${TEST_POST_ID}`,
      title: "Test",
      content: { blocks: [] },
      status: "draft",
    });
    const found = await db.select().from(posts).where(eq(posts.id, TEST_POST_ID));
    expect(found).toHaveLength(1);
    expect(found[0].status).toBe("draft");
  });

  it("FK post_tags(post_id) → posts.id, cascade on delete", async () => {
    const tagId = "01J0SEED000000000000TAGEXP";
    await db.insert(postTags).values({ postId: TEST_POST_ID, tagId });
    let rows = await db.select().from(postTags).where(eq(postTags.postId, TEST_POST_ID));
    expect(rows).toHaveLength(1);

    await db.delete(posts).where(eq(posts.id, TEST_POST_ID));
    rows = await db.select().from(postTags).where(eq(postTags.postId, TEST_POST_ID));
    expect(rows).toHaveLength(0);

    // Восстанавливаем post для остальных тестов
    await db.insert(posts).values({
      id: TEST_POST_ID,
      authorId: TEST_USER_ID,
      slug: `test-slug-2-${TEST_POST_ID}`,
      title: "Test2",
      content: { blocks: [] },
      status: "draft",
    });
  });

  it("FK uploads.post_id → posts.id ON DELETE SET NULL", async () => {
    const uploadId = newId();
    await db.insert(uploads).values({
      id: uploadId,
      userId: TEST_USER_ID,
      postId: TEST_POST_ID,
      key: `uploads/${TEST_USER_ID}/${uploadId}.webp`,
      publicUrl: `https://example.test/uploads/${TEST_USER_ID}/${uploadId}.webp`,
      mime: "image/webp",
      size: 1,
      width: 1,
      height: 1,
    });

    await db.delete(posts).where(eq(posts.id, TEST_POST_ID));

    const found = await db.select().from(uploads).where(eq(uploads.id, uploadId));
    expect(found).toHaveLength(1);
    expect(found[0].postId).toBeNull();

    // Cleanup uploads row
    await db.delete(uploads).where(eq(uploads.id, uploadId));

    // Восстанавливаем post для afterAll-cleanup
    await db.insert(posts).values({
      id: TEST_POST_ID,
      authorId: TEST_USER_ID,
      slug: `test-slug-3-${TEST_POST_ID}`,
      title: "Test3",
      content: { blocks: [] },
      status: "draft",
    });
  });
});
