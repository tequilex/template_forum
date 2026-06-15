"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { posts, postTags, tags, uploads } from "@db/schema";
import { newId } from "@/lib/auth/id";
import { requireOwnPost } from "@/lib/auth/guard";
import { slugify, uniqueSlug } from "@/lib/slugify";
import { renderBlock } from "@/components/editor/renderBlock";
import { sanitize } from "@/components/editor/sanitize";
import { extractPlainText } from "@/components/editor/extractPlainText";
import { extractCoverUrl } from "@/components/editor/extractCoverUrl";

// Zod-схема Editor.js OutputData. Намеренно расслабленная (data: any) —
// per-block-валидация живёт в renderBlock/extract*, которые graceful degrade.
const blockSchema = z.object({ type: z.string(), data: z.record(z.any()) });
const outputDataSchema = z.object({
  time: z.number().optional(),
  version: z.string().optional(),
  blocks: z.array(blockSchema),
});
const titleSchema = z.string().min(0).max(200);

async function requireSessionUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthenticated");
  return session.user.id;
}

export async function saveDraft(
  postId: string | null,
  title: string,
  content: unknown,
): Promise<{ postId: string; updatedAt: Date }> {
  const userId = await requireSessionUserId();
  const parsedTitle = titleSchema.parse(title);
  const parsedContent = outputDataSchema.parse(content);
  const db = getDb();
  const now = new Date();

  if (postId !== null) {
    await requireOwnPost(postId);
    await db.update(posts).set({
      title: parsedTitle,
      content: parsedContent,
      updatedAt: now,
    }).where(eq(posts.id, postId));
    return { postId, updatedAt: now };
  }

  const id = newId();
  await db.insert(posts).values({
    id,
    authorId: userId,
    slug: `draft-${id}`,
    title: parsedTitle,
    content: parsedContent,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  return { postId: id, updatedAt: now };
}

export async function publishPost(
  postId: string,
  tagIds: string[],
): Promise<{ slug: string }> {
  await requireSessionUserId();
  const post = await requireOwnPost(postId);

  if (post.status !== "draft") throw new Error("not_draft");
  if (post.title.trim().length === 0) throw new Error("title_empty");

  const content = post.content as { blocks: { type: string; data: { text?: string } }[] };
  const blocks = content.blocks ?? [];
  const hasText = blocks.some(b =>
    (b.type === "paragraph" || b.type === "header") &&
    typeof b.data?.text === "string" &&
    b.data.text.trim().length > 0
  );
  if (!hasText) throw new Error("content_empty");

  if (tagIds.length === 0) throw new Error("tags_required");

  const db = getDb();

  const existingTags = await db.select({ id: tags.id }).from(tags).where(inArray(tags.id, tagIds));
  if (existingTags.length !== tagIds.length) throw new Error("bad_tags");

  const base = slugify(post.title);
  if (base.length === 0) throw new Error("title_unslugifiable");
  const slug = await uniqueSlug(base);

  const excerpt = extractPlainText(post.content as never).slice(0, 200);
  const coverUrl = extractCoverUrl(post.content as never);
  const contentHtml = sanitize(renderBlock(post.content as never));
  const now = new Date();

  const imageUrls = (blocks as { type: string; data: { file?: { url?: string } } }[])
    .filter(b => b.type === "image")
    .map(b => b.data?.file?.url)
    .filter((u): u is string => Boolean(u));

  await db.transaction(async (tx) => {
    await tx.update(posts).set({
      slug,
      excerpt,
      coverUrl,
      contentHtml,
      status: "published",
      pubAt: now,
      updatedAt: now,
    }).where(eq(posts.id, postId));

    await tx.insert(postTags).values(tagIds.map(tagId => ({ postId, tagId })));

    if (imageUrls.length > 0) {
      await tx.update(uploads).set({ postId })
        .where(and(
          inArray(uploads.publicUrl, imageUrls),
          eq(uploads.userId, post.authorId),
        ));
    }
  });

  return { slug };
}

export async function republishPost(postId: string): Promise<void> {
  await requireSessionUserId();
  const post = await requireOwnPost(postId);

  if (post.status !== "published") throw new Error("not_published");

  const excerpt = extractPlainText(post.content as never).slice(0, 200);
  const coverUrl = extractCoverUrl(post.content as never);
  const contentHtml = sanitize(renderBlock(post.content as never));
  const now = new Date();

  const db = getDb();

  // TODO(plan-5): diff-линкер — отвязывать post_id от uploads, чьи url'ы
  // больше не присутствуют в content (сейчас они остаются приписанными,
  // cleanup-script не подхватит, т.к. он работает только по post_id IS NULL).
  const blocks = ((post.content as { blocks?: { type: string; data: { file?: { url?: string } } }[] }).blocks) ?? [];
  const imageUrls = blocks
    .filter(b => b.type === "image")
    .map(b => b.data?.file?.url)
    .filter((u): u is string => Boolean(u));

  await db.transaction(async (tx) => {
    await tx.update(posts).set({
      excerpt,
      coverUrl,
      contentHtml,
      updatedAt: now,
    }).where(eq(posts.id, postId));

    if (imageUrls.length > 0) {
      await tx.update(uploads).set({ postId })
        .where(and(
          inArray(uploads.publicUrl, imageUrls),
          eq(uploads.userId, post.authorId),
        ));
    }
  });
}

export async function archivePost(postId: string): Promise<void> {
  await requireSessionUserId();
  const post = await requireOwnPost(postId);
  if (post.status !== "published") throw new Error("cannot_archive");
  await getDb().update(posts).set({ status: "archived", updatedAt: new Date() })
    .where(eq(posts.id, postId));
}

export async function unarchivePost(postId: string): Promise<void> {
  await requireSessionUserId();
  const post = await requireOwnPost(postId);
  if (post.status !== "archived") throw new Error("cannot_unarchive");
  // archived → draft напрямую не идём (V1 ограничение). unarchive = всегда published.
  await getDb().update(posts).set({ status: "published", updatedAt: new Date() })
    .where(eq(posts.id, postId));
}

export async function softDeletePost(postId: string): Promise<void> {
  await requireSessionUserId();
  await requireOwnPost(postId);                // фильтрует уже-deleted → notFound
  // content_html НЕ зануляется — для возможного admin-restore в plan-05.
  await getDb().update(posts).set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(posts.id, postId));
}
