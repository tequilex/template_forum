"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { comments, posts } from "@db/schema";
import { newId } from "@/lib/auth/id";
import { checkLimit } from "@/lib/rate-limit";

const MAX_LEN = 2000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getPostSlug(postId: string): Promise<string | null> {
  const r = await getDb().select({ slug: posts.slug }).from(posts).where(eq(posts.id, postId)).limit(1);
  return r[0]?.slug ?? null;
}

export async function createComment(postId: string, text: string): Promise<ActionResult<{ commentId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Не авторизован" };
  if (session.user.bannedAt) return { ok: false, error: "Аккаунт заблокирован" };

  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: "Пустой комментарий" };
  if (trimmed.length > MAX_LEN) return { ok: false, error: `Максимум ${MAX_LEN} символов` };

  if (session.user.role !== "admin") {
    const limit = checkLimit(session.user.id, "comment");
    if (!limit.ok) return { ok: false, error: `Слишком часто. Попробуйте через ${limit.retryAfterSec} с.` };
  }

  const slug = await getPostSlug(postId);
  if (!slug) return { ok: false, error: "Пост не найден" };

  const commentId = newId();
  await getDb().insert(comments).values({
    id: commentId, postId, authorId: session.user.id, contentText: trimmed,
  });

  revalidatePath(`/p/${slug}`);
  return { ok: true, data: { commentId } };
}

export async function updateComment(commentId: string, text: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Не авторизован" };

  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LEN) return { ok: false, error: "Длина 1..2000 символов" };

  const rows = await getDb().select().from(comments).where(eq(comments.id, commentId)).limit(1);
  const c = rows[0];
  if (!c) return { ok: false, error: "Комментарий не найден" };
  if (c.authorId !== session.user.id) return { ok: false, error: "Можно редактировать только свои" };
  if (c.deletedAt) return { ok: false, error: "Удалённый комментарий нельзя править" };

  const ageMs = Date.now() - c.createdAt.getTime();
  if (ageMs > EDIT_WINDOW_MS) return { ok: false, error: "Окно редактирования (15 минут) закрыто" };

  await getDb().update(comments)
    .set({ contentText: trimmed, editedAt: new Date() })
    .where(eq(comments.id, commentId));

  const slug = await getPostSlug(c.postId);
  if (slug) revalidatePath(`/p/${slug}`);
  return { ok: true, data: undefined };
}

export async function deleteOwnComment(commentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Не авторизован" };

  const rows = await getDb().select().from(comments).where(eq(comments.id, commentId)).limit(1);
  const c = rows[0];
  if (!c) return { ok: false, error: "Комментарий не найден" };
  if (c.authorId !== session.user.id) return { ok: false, error: "Можно удалять только свои" };
  if (c.deletedAt) return { ok: false, error: "Уже удалён" };

  await getDb().update(comments)
    .set({ deletedAt: new Date(), deletedBy: session.user.id })
    .where(eq(comments.id, commentId));

  const slug = await getPostSlug(c.postId);
  if (slug) revalidatePath(`/p/${slug}`);
  return { ok: true, data: undefined };
}
