import { redirect, notFound } from "next/navigation";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { posts } from "@db/schema";

// Page-level guard. Page-компонент гарантированно перерендеривается на любой
// навигации (Link, прямой URL, refresh). Layout/template — нет (Next кэширует
// shared-сегменты), поэтому проверка должна жить в самих страницах.
export async function requireAuthState() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.bannedAt) redirect("/banned");
  if (!session.user.username) redirect("/welcome");
  return session;
}

// Возвращает пост, если: (а) автор поста = текущий юзер И (б) пост не soft-deleted.
// Иначе — notFound() (404). НЕ 403 — скрываем существование чужих постов.
// Используется в (app)/edit/[id]/page.tsx и в server actions перед мутацией.
export async function requireOwnPost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const rows = await getDb()
    .select()
    .from(posts)
    .where(and(
      eq(posts.id, postId),
      eq(posts.authorId, session.user.id),
      isNull(posts.deletedAt),
      isNull(posts.hiddenByAdminAt),
    ))
    .limit(1);

  if (rows.length === 0) notFound();
  return rows[0];
}
