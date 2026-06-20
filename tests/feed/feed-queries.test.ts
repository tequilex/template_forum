import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db";
import { posts, postTags, users } from "@db/schema";
import {
  getFeedPage,
  getTagBySlug,
  getTagFeedPage,
  getTagsIndex,
  getUserByUsername,
  getUserProfile,
  getUserFeedPage,
  FEED_PAGE_SIZE,
} from "@/server/feed";

const db = getDb();
const TEST_USER_ID = "01J0FEED0000000000000USER01";
const TEST_USERNAME = "feedtester";
const TEST_POST_ID = "01J0FEED0000000000000POST01";
const SEED_TAG_EXPERIENCE = "01J0SEED000000000000TAGEXP";

beforeAll(async () => {
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      email: `feed-test-${Date.now()}@example.test`,
      username: TEST_USERNAME,
      name: "Feed Tester",
    })
    .onConflictDoNothing();

  await db.insert(posts).values({
    id: TEST_POST_ID,
    authorId: TEST_USER_ID,
    slug: `feed-test-${TEST_POST_ID}`,
    title: "Feed Test Post",
    excerpt: "Test excerpt",
    content: { blocks: [{ type: "paragraph", data: { text: "hello world" } }] },
    status: "published",
    pubAt: new Date(),
  });

  await db
    .insert(postTags)
    .values({ postId: TEST_POST_ID, tagId: SEED_TAG_EXPERIENCE })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(posts).where(eq(posts.id, TEST_POST_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
  await getPool().end();
});

describe("getFeedPage", () => {
  it("первая страница содержит наш тестовый пост", async () => {
    const { items, currentPage, totalPages } = await getFeedPage(1);
    expect(currentPage).toBe(1);
    expect(totalPages).toBeGreaterThanOrEqual(1);
    expect(items.some((c) => c.post.id === TEST_POST_ID)).toBe(true);
  });

  it("hydrate включает тэги для PostCard", async () => {
    const { items } = await getFeedPage(1);
    const card = items.find((c) => c.post.id === TEST_POST_ID);
    expect(card?.tags.map((t) => t.slug)).toContain("experience");
  });

  it("страница за пределами totalPages даёт пустой items", async () => {
    const { items } = await getFeedPage(999);
    expect(items).toHaveLength(0);
  });

  it("PAGE_SIZE = 20", () => {
    expect(FEED_PAGE_SIZE).toBe(20);
  });
});

describe("getTagBySlug + getTagFeedPage", () => {
  it("seed-тэг experience найден", async () => {
    const tag = await getTagBySlug("experience");
    expect(tag).not.toBeNull();
    expect(tag?.name).toBe("Опыт");
  });

  it("несуществующий тэг → null", async () => {
    expect(await getTagBySlug("nonexistent")).toBeNull();
  });

  it("getTagFeedPage возвращает наш пост по seed-тэгу", async () => {
    const tag = await getTagBySlug("experience");
    const { items } = await getTagFeedPage(tag!.id, 1);
    expect(items.some((c) => c.post.id === TEST_POST_ID)).toBe(true);
  });
});

describe("getTagsIndex", () => {
  it("содержит все 6 seed-тэгов", async () => {
    const rows = await getTagsIndex();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.map((r) => r.slug)).toEqual(
      expect.arrayContaining([
        "experience",
        "lifehack",
        "news",
        "opinion",
        "question",
        "review",
      ]),
    );
  });

  it("отсортирован по count DESC", async () => {
    const rows = await getTagsIndex();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].postCount).toBeGreaterThanOrEqual(rows[i].postCount);
    }
  });
});

describe("getUserByUsername + getUserProfile + getUserFeedPage", () => {
  it("username case-insensitive: верхний регистр резолвится", async () => {
    const u = await getUserByUsername(TEST_USERNAME.toUpperCase());
    expect(u?.id).toBe(TEST_USER_ID);
  });

  it("несуществующий username → null", async () => {
    expect(await getUserByUsername("noone")).toBeNull();
  });

  it("getUserProfile считает postsCount ≥1 (наш тест-пост)", async () => {
    const profile = await getUserProfile(TEST_USER_ID);
    expect(profile.postsCount).toBeGreaterThanOrEqual(1);
  });

  it("getUserProfile топ-тэги содержат experience", async () => {
    const profile = await getUserProfile(TEST_USER_ID);
    expect(profile.topTags.map((t) => t.slug)).toContain("experience");
  });

  it("getUserFeedPage возвращает только посты этого автора", async () => {
    const { items } = await getUserFeedPage(TEST_USER_ID, 1);
    items.forEach((c) => expect(c.author.id).toBe(TEST_USER_ID));
  });
});
