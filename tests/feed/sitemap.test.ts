import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db";
import { posts, users } from "@db/schema";
import sitemap from "@/app/sitemap";

const db = getDb();
const TEST_USER_ID = "01J0SMAP0000000000000USER01";
const TEST_USERNAME = "smaptester";
const TEST_POST_ID = "01J0SMAP0000000000000POST01";
const TEST_SLUG = `smap-test-${TEST_POST_ID}`;

beforeAll(async () => {
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      email: `smap-${Date.now()}@example.test`,
      username: TEST_USERNAME,
    })
    .onConflictDoNothing();
  await db.insert(posts).values({
    id: TEST_POST_ID,
    authorId: TEST_USER_ID,
    slug: TEST_SLUG,
    title: "Sitemap test",
    content: { blocks: [] },
    status: "published",
    pubAt: new Date(),
  });
});

afterAll(async () => {
  await db.delete(posts).where(eq(posts.id, TEST_POST_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
  await getPool().end();
});

describe("sitemap", () => {
  it("содержит корневой URL", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/"))).toBe(true);
  });

  it("содержит /tags", async () => {
    const entries = await sitemap();
    expect(entries.some((e) => e.url.endsWith("/tags"))).toBe(true);
  });

  it("содержит /p/<slug> для опубликованного поста", async () => {
    const entries = await sitemap();
    expect(entries.some((e) => e.url.endsWith(`/p/${TEST_SLUG}`))).toBe(true);
  });

  it("содержит /u/<username> для юзера с публикациями", async () => {
    const entries = await sitemap();
    expect(entries.some((e) => e.url.endsWith(`/u/${TEST_USERNAME}`))).toBe(true);
  });

  it("содержит /t/<slug> для всех seed-тэгов", async () => {
    const entries = await sitemap();
    expect(entries.some((e) => e.url.endsWith("/t/experience"))).toBe(true);
    expect(entries.some((e) => e.url.endsWith("/t/lifehack"))).toBe(true);
  });
});
