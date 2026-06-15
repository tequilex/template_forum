import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, like } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db";
import { posts, users } from "@db/schema";
import { uniqueSlug } from "@/lib/slugify";

const db = getDb();
const TEST_USER_ID = "01J0TEST0000000000000UNIQ01";

beforeAll(async () => {
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: `unique-slug-test-${Date.now()}@example.test`,
  }).onConflictDoNothing();
});

beforeEach(async () => {
  // Подчищаем тестовые посты с базой "uniq-test" между кейсами
  await db.delete(posts).where(like(posts.slug, "uniq-test%"));
});

afterAll(async () => {
  await db.delete(posts).where(like(posts.slug, "uniq-test%"));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
  await getPool().end();
});

describe("uniqueSlug", () => {
  it("возвращает base, если коллизий нет", async () => {
    const got = await uniqueSlug("uniq-test-fresh");
    expect(got).toBe("uniq-test-fresh");
  });

  it("добавляет -2 при первом конфликте", async () => {
    await db.insert(posts).values({
      id: "01J0POST00000000000000COLA01",
      authorId: TEST_USER_ID,
      slug: "uniq-test-col",
      title: "x",
      content: { blocks: [] },
      status: "draft",
    });
    const got = await uniqueSlug("uniq-test-col");
    expect(got).toBe("uniq-test-col-2");
  });

  it("идёт дальше: -2 занят → -3", async () => {
    for (let i = 0; i < 2; i++) {
      const id = `01J0POST00000000000000COL${i}02`;
      const slug = i === 0 ? "uniq-test-multi" : "uniq-test-multi-2";
      await db.insert(posts).values({
        id, authorId: TEST_USER_ID, slug, title: "x", content: { blocks: [] }, status: "draft",
      });
    }
    const got = await uniqueSlug("uniq-test-multi");
    expect(got).toBe("uniq-test-multi-3");
  });
});
