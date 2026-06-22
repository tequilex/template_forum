// Read-only-запросы для discovery-страниц (RSC). Никаких мутаций — поэтому НЕ "use server".
// Вызывать из page.tsx / generateMetadata.

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { posts, postTags, tags, users } from "@db/schema";
import { extractPlainText } from "@/components/editor/extractPlainText";
import { readingTimeMinutes } from "@/components/feed/readingTime";
import type { PostCardData } from "@/components/feed/PostCard";
import { getCommentCountByPosts } from "@/server/comments";

export const FEED_PAGE_SIZE = 20;

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  pubAt: Date | null;
  content: unknown;
  authorId: string;
  authorUsername: string | null;
  authorName: string | null;
  authorImage: string | null;
}

interface TagPair {
  postId: string;
  tag: { id: string; slug: string; name: string };
}

async function hydrateCards(rows: PostRow[]): Promise<PostCardData[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((r) => r.id);

  // Один доп. запрос на тэги. На V1 (≤20 постов × ≤5 тэгов) — десятки строк.
  // Альтернатива LATERAL/array_agg — over-engineering для V1.
  const [rawTags, commentCounts] = await Promise.all([
    getDb()
      .select({
        postId: postTags.postId,
        id: tags.id,
        slug: tags.slug,
        name: tags.name,
      })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .where(inArray(postTags.postId, postIds)),
    getCommentCountByPosts(postIds),
  ]);

  const tagsByPost = new Map<string, TagPair["tag"][]>();
  for (const t of rawTags) {
    const arr = tagsByPost.get(t.postId) ?? [];
    arr.push({ id: t.id, slug: t.slug, name: t.name });
    tagsByPost.set(t.postId, arr);
  }

  return rows.map((r) => {
    // r.content имеет тип Editor.js OutputData; extractPlainText его принимает.
    const plain = extractPlainText(r.content as Parameters<typeof extractPlainText>[0]);
    return {
      post: {
        id: r.id,
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        coverUrl: r.coverUrl,
        pubAt: r.pubAt,
        readingMinutes: readingTimeMinutes(plain),
        commentCount: commentCounts.get(r.id) ?? 0,
      },
      author: {
        id: r.authorId,
        username: r.authorUsername,
        name: r.authorName,
        image: r.authorImage,
      },
      tags: tagsByPost.get(r.id) ?? [],
    };
  });
}

const PUBLISHED_PUBLIC = and(
  eq(posts.status, "published"),
  isNull(posts.deletedAt),
  isNull(posts.hiddenByAdminAt),
);

// ─── /  главная лента ──────────────────────────────────────────────────────

export async function getFeedPage(page: number): Promise<{
  items: PostCardData[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}> {
  const db = getDb();
  const safePage = Math.max(1, Math.floor(page));

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      coverUrl: posts.coverUrl,
      pubAt: posts.pubAt,
      content: posts.content,
      authorId: posts.authorId,
      authorUsername: users.username,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(PUBLISHED_PUBLIC)
    .orderBy(desc(posts.pubAt))
    .limit(FEED_PAGE_SIZE)
    .offset((safePage - 1) * FEED_PAGE_SIZE);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(PUBLISHED_PUBLIC);

  const totalPages = Math.max(1, Math.ceil(count / FEED_PAGE_SIZE));
  const items = await hydrateCards(rows);
  return { items, currentPage: safePage, totalPages, totalCount: count };
}

// ─── /t/[slug]  лента тэга ─────────────────────────────────────────────────

export async function getTagBySlug(slug: string) {
  const [t] = await getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return t ?? null;
}

export async function getTagFeedPage(
  tagId: string,
  page: number,
): Promise<{
  items: PostCardData[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}> {
  const db = getDb();
  const safePage = Math.max(1, Math.floor(page));

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      coverUrl: posts.coverUrl,
      pubAt: posts.pubAt,
      content: posts.content,
      authorId: posts.authorId,
      authorUsername: users.username,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(postTags.tagId, tagId), PUBLISHED_PUBLIC))
    .orderBy(desc(posts.pubAt))
    .limit(FEED_PAGE_SIZE)
    .offset((safePage - 1) * FEED_PAGE_SIZE);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .where(and(eq(postTags.tagId, tagId), PUBLISHED_PUBLIC));

  const totalPages = Math.max(1, Math.ceil(count / FEED_PAGE_SIZE));
  const items = await hydrateCards(rows);
  return { items, currentPage: safePage, totalPages, totalCount: count };
}

// ─── /tags  индекс ─────────────────────────────────────────────────────────

export async function getTagsIndex() {
  const db = getDb();
  return db
    .select({
      id: tags.id,
      slug: tags.slug,
      name: tags.name,
      description: tags.description,
      postCount: sql<number>`count(${posts.id})::int`,
    })
    .from(tags)
    .leftJoin(postTags, eq(postTags.tagId, tags.id))
    .leftJoin(posts, and(eq(posts.id, postTags.postId), PUBLISHED_PUBLIC))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${posts.id})`), tags.name);
}

// ─── /u/[username]  профиль ────────────────────────────────────────────────

export async function getUserByUsername(username: string) {
  const [u] = await getDb()
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return u ?? null;
}

export async function getUserProfile(userId: string) {
  const db = getDb();

  const [{ count: postsCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), PUBLISHED_PUBLIC));

  const topTags = await db
    .select({
      slug: tags.slug,
      name: tags.name,
      count: sql<number>`count(*)::int`,
    })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(and(eq(posts.authorId, userId), PUBLISHED_PUBLIC))
    .groupBy(tags.id, tags.slug, tags.name)
    .orderBy(desc(sql`count(*)`))
    .limit(3);

  return { postsCount, topTags };
}

export async function getUserFeedPage(
  userId: string,
  page: number,
): Promise<{
  items: PostCardData[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}> {
  const db = getDb();
  const safePage = Math.max(1, Math.floor(page));

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      coverUrl: posts.coverUrl,
      pubAt: posts.pubAt,
      content: posts.content,
      authorId: posts.authorId,
      authorUsername: users.username,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.authorId, userId), PUBLISHED_PUBLIC))
    .orderBy(desc(posts.pubAt))
    .limit(FEED_PAGE_SIZE)
    .offset((safePage - 1) * FEED_PAGE_SIZE);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), PUBLISHED_PUBLIC));

  const totalPages = Math.max(1, Math.ceil(count / FEED_PAGE_SIZE));
  const items = await hydrateCards(rows);
  return { items, currentPage: safePage, totalPages, totalCount: count };
}
