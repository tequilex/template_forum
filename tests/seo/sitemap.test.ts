import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import sitemap from "@/app/sitemap";
import { getDb } from "@/lib/db";
import { posts, users, tags, postTags } from "@db/schema";
import { newId } from "@/lib/auth/id";

const RUN = `sm-${newId().slice(-8)}`;

const ids = {
  author: `${RUN}-author`,
  bannedAuthor: `${RUN}-banned`,
  postPublished: `${RUN}-pub`,
  postDraft: `${RUN}-draft`,
  postDeleted: `${RUN}-deleted`,
  postHidden: `${RUN}-hidden`,
  postOfBanned: `${RUN}-pubBan`,
  tagA: `${RUN}-tag-a`,
};

describe("sitemap()", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values([
      { id: ids.author, email: `a-${RUN}@x.io`, username: `u_${RUN}_a` },
      { id: ids.bannedAuthor, email: `b-${RUN}@x.io`, username: `u_${RUN}_b`, bannedAt: new Date(), banReason: "test" },
    ]);
    await db.insert(tags).values([{ id: ids.tagA, slug: `tag-${RUN}-a`, name: "TagA" }]);
    await db.insert(posts).values([
      { id: ids.postPublished, authorId: ids.author, slug: `p-${RUN}-pub`, title: "Pub", content: { blocks: [] }, status: "published", pubAt: new Date() },
      { id: ids.postDraft, authorId: ids.author, slug: `p-${RUN}-draft`, title: "Draft", content: { blocks: [] }, status: "draft" },
      { id: ids.postDeleted, authorId: ids.author, slug: `p-${RUN}-del`, title: "Del", content: { blocks: [] }, status: "published", pubAt: new Date(), deletedAt: new Date() },
      { id: ids.postHidden, authorId: ids.author, slug: `p-${RUN}-hid`, title: "Hid", content: { blocks: [] }, status: "published", pubAt: new Date(), hiddenByAdminAt: new Date(), hiddenByAdminId: ids.author },
      { id: ids.postOfBanned, authorId: ids.bannedAuthor, slug: `p-${RUN}-ban`, title: "Ban", content: { blocks: [] }, status: "published", pubAt: new Date() },
    ]);
    await db.insert(postTags).values([{ postId: ids.postPublished, tagId: ids.tagA }]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(postTags).where(eq(postTags.tagId, ids.tagA));
    for (const p of [ids.postPublished, ids.postDraft, ids.postDeleted, ids.postHidden, ids.postOfBanned]) {
      await db.delete(posts).where(eq(posts.id, p));
    }
    await db.delete(tags).where(eq(tags.id, ids.tagA));
    for (const u of [ids.author, ids.bannedAuthor]) {
      await db.delete(users).where(eq(users.id, u));
    }
  });

  it("включает только published + не-deleted + не-hidden", async () => {
    const rows = await sitemap();
    const urls = rows.map((r) => r.url);
    expect(urls.some((u) => u.endsWith(`/p/p-${RUN}-pub`))).toBe(true);
    expect(urls.some((u) => u.endsWith(`/p/p-${RUN}-draft`))).toBe(false);
    expect(urls.some((u) => u.endsWith(`/p/p-${RUN}-del`))).toBe(false);
    expect(urls.some((u) => u.endsWith(`/p/p-${RUN}-hid`))).toBe(false);
  });

  it("исключает /u/ забаненных авторов; их посты в /p/ остаются", async () => {
    const rows = await sitemap();
    const urls = rows.map((r) => r.url);
    expect(urls.some((u) => u.endsWith(`/p/p-${RUN}-ban`))).toBe(true);
    expect(urls.some((u) => u.endsWith(`/u/u_${RUN}_b`))).toBe(false);
  });

  it("/u/* содержит только не-banned юзеров с published-постами", async () => {
    const rows = await sitemap();
    const urls = rows.map((r) => r.url);
    expect(urls.some((u) => u.endsWith(`/u/u_${RUN}_a`))).toBe(true);
  });

  it("содержит /, /tags и /t/<наш-тег>", async () => {
    const rows = await sitemap();
    const urls = rows.map((r) => r.url);
    expect(urls.some((u) => u === u.replace(/\/$/, "") + "/" || u.endsWith("/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/tags"))).toBe(true);
    expect(urls.some((u) => u.endsWith(`/t/tag-${RUN}-a`))).toBe(true);
  });
});
