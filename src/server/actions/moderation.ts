"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { comments, posts, users } from "@db/schema";
import { assertAdmin } from "@/lib/auth/assert-admin";
import { pingIndexNow } from "@/lib/indexnow";
import { getEnv } from "@/lib/env";

function indexNowPostUrl(slug: string): string {
  const base = getEnv().NEXTAUTH_URL.replace(/\/$/, "");
  return `${base}/p/${slug}`;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MIN_BAN_REASON = 5;

async function getPostSlugByComment(commentId: string): Promise<string | null> {
  const r = await getDb()
    .select({ slug: posts.slug })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, commentId))
    .limit(1);
  return r[0]?.slug ?? null;
}

export async function adminDeleteComment(commentId: string): Promise<ActionResult> {
  const { userId } = await assertAdmin();
  await getDb().update(comments)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(eq(comments.id, commentId));
  const slug = await getPostSlugByComment(commentId);
  if (slug) revalidatePath(`/p/${slug}`);
  return { ok: true, data: undefined };
}

export async function adminRestoreComment(commentId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(comments)
    .set({ deletedAt: null, deletedBy: null })
    .where(eq(comments.id, commentId));
  const slug = await getPostSlugByComment(commentId);
  if (slug) revalidatePath(`/p/${slug}`);
  return { ok: true, data: undefined };
}

export async function adminBanUser(userId: string, reason: string): Promise<ActionResult> {
  await assertAdmin();
  const trimmed = reason.trim();
  if (trimmed.length < MIN_BAN_REASON) {
    return { ok: false, error: `Минимум ${MIN_BAN_REASON} символов причины` };
  }
  await getDb().update(users)
    .set({ bannedAt: new Date(), banReason: trimmed })
    .where(eq(users.id, userId));
  const [u] = await getDb().select({ username: users.username })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (u?.username) {
    const base = getEnv().NEXTAUTH_URL.replace(/\/$/, "");
    void pingIndexNow([`${base}/u/${u.username}`]);
  }
  return { ok: true, data: undefined };
}

export async function adminUnbanUser(userId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(users)
    .set({ bannedAt: null, banReason: null })
    .where(eq(users.id, userId));
  return { ok: true, data: undefined };
}

export async function adminHidePost(postId: string): Promise<ActionResult> {
  const { userId } = await assertAdmin();
  await getDb().update(posts)
    .set({ hiddenByAdminAt: new Date(), hiddenByAdminId: userId })
    .where(eq(posts.id, postId));
  const slug = (await getDb().select({ slug: posts.slug }).from(posts).where(eq(posts.id, postId)))[0]?.slug;
  if (slug) {
    revalidatePath(`/p/${slug}`);
    void pingIndexNow([indexNowPostUrl(slug)]);
  }
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function adminUnhidePost(postId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(posts)
    .set({ hiddenByAdminAt: null, hiddenByAdminId: null })
    .where(eq(posts.id, postId));
  const slug = (await getDb().select({ slug: posts.slug }).from(posts).where(eq(posts.id, postId)))[0]?.slug;
  if (slug) revalidatePath(`/p/${slug}`);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function adminDeletePost(postId: string): Promise<ActionResult> {
  await assertAdmin();
  const slug = (await getDb().select({ slug: posts.slug }).from(posts).where(eq(posts.id, postId)))[0]?.slug;
  await getDb().update(posts)
    .set({ deletedAt: new Date() })
    .where(eq(posts.id, postId));
  if (slug) void pingIndexNow([indexNowPostUrl(slug)]);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function adminRestorePost(postId: string): Promise<ActionResult> {
  await assertAdmin();
  await getDb().update(posts)
    .set({ deletedAt: null })
    .where(eq(posts.id, postId));
  revalidatePath("/");
  return { ok: true, data: undefined };
}
