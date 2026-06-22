import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { comments, users } from "@db/schema";

export const COMMENTS_PER_PAGE = 50;

export interface CommentItem {
  id: string;
  parentId: string | null;
  authorId: string;
  authorUsername: string | null;
  authorName: string | null;
  authorImage: string | null;
  authorBannedAt: Date | null;
  contentText: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  deletedByAuthor: boolean;
}

export interface CommentsPage {
  items: CommentItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export async function getCommentsByPost(postId: string, page: number): Promise<CommentsPage> {
  const db = getDb();
  const offset = (page - 1) * COMMENTS_PER_PAGE;

  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      authorId: comments.authorId,
      authorUsername: users.username,
      authorName: users.name,
      authorImage: users.image,
      authorBannedAt: users.bannedAt,
      contentText: comments.contentText,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      deletedBy: comments.deletedBy,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt))
    .limit(COMMENTS_PER_PAGE)
    .offset(offset);

  const totalCount = await getCommentCount(postId);
  const totalPages = Math.max(1, Math.ceil(totalCount / COMMENTS_PER_PAGE));

  return {
    items: rows.map((r) => ({ ...r, deletedByAuthor: r.deletedBy === r.authorId })),
    currentPage: page,
    totalPages,
    totalCount,
  };
}

export async function getCommentCount(postId: string): Promise<number> {
  const db = getDb();
  // TODO(phase-2): threading — пока считаем плоско.
  const [{ n }] = await db
    .select({ n: count() })
    .from(comments)
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt)));
  return Number(n);
}

// Batch-вариант для feed/PostCard: одним запросом получаем счётчики для всех
// постов на странице. Возвращаем Map (а не объект) — постов в map'е может не
// быть, если ни одного коммента нет; вызывающий делает `map.get(id) ?? 0`.
export async function getCommentCountByPosts(postIds: string[]): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({ postId: comments.postId, n: count() })
    .from(comments)
    .where(and(inArray(comments.postId, postIds), isNull(comments.deletedAt)))
    .groupBy(comments.postId);
  return new Map(rows.map((r) => [r.postId, Number(r.n)]));
}
