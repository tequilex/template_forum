import type { MetadataRoute } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { posts, tags, users } from "@db/schema";
import { siteConfig } from "@/lib/site-config";

// Sitemap читает БД через `getDb()` (runtime-singleton с pg-пулом).
// Без force-dynamic Next пробует prerender'ить во время build, валится на
// отсутствии БД/env и фолбэчит на pages-router `_error`, который тянет
// `<Html>` — это ломает App Router build.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const base = siteConfig.url;

  const publishedPosts = await db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(and(
      eq(posts.status, "published"),
      isNull(posts.deletedAt),
      isNull(posts.hiddenByAdminAt),
    ));

  const allTags = await db.select({ slug: tags.slug }).from(tags);

  const usersWithPosts = await db
    .selectDistinct({ username: users.username })
    .from(users)
    .innerJoin(
      posts,
      and(
        eq(posts.authorId, users.id),
        eq(posts.status, "published"),
        isNull(posts.deletedAt),
        isNull(posts.hiddenByAdminAt),
      ),
    )
    .where(isNull(users.bannedAt));

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/tags`, changeFrequency: "weekly", priority: 0.6 },
    ...publishedPosts.map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...allTags.map((t) => ({
      url: `${base}/t/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...usersWithPosts
      .filter((u): u is { username: string } => Boolean(u.username))
      .map((u) => ({
        url: `${base}/u/${u.username}`,
        changeFrequency: "weekly" as const,
        priority: 0.4,
      })),
  ];
}
