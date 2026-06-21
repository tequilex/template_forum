import Link from "next/link";
import { auth } from "@/lib/auth";
import { getCommentsByPost } from "@/server/comments";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { content } from "@theme/content";

interface Props {
  postId: string;
  postSlug: string;
  page?: number;
}

export async function CommentThread({ postId, postSlug, page = 1 }: Props) {
  const [session, data] = await Promise.all([
    auth(),
    getCommentsByPost(postId, page),
  ]);

  const currentUserId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "admin";

  return (
    <section id="comments" className="mt-12">
      <h2 className="text-xl font-semibold mb-4">
        {content.comments.heading}
        {data.totalCount > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({content.comments.countLabel(data.totalCount)})
          </span>
        )}
      </h2>

      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{content.comments.empty}</p>
      ) : (
        <div className="divide-y divide-border">
          {data.items.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              postId={postId}
              currentUserId={currentUserId}
              currentUserIsAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {data.totalPages > 1 && (
        <nav className="flex gap-3 mt-6 text-sm">
          {page > 1 && (
            <Link href={`/p/${postSlug}?cpage=${page - 1}#comments`} className="hover:underline">
              ← Назад
            </Link>
          )}
          <span className="text-muted-foreground">
            Страница {page} из {data.totalPages}
          </span>
          {page < data.totalPages && (
            <Link href={`/p/${postSlug}?cpage=${page + 1}#comments`} className="hover:underline">
              Вперёд →
            </Link>
          )}
        </nav>
      )}

      <div className="mt-8">
        {session?.user ? (
          <CommentForm postId={postId} />
        ) : (
          <p className="text-sm">
            <Link href={`/login?from=/p/${postSlug}`} className="text-primary hover:underline">
              {content.comments.loginToComment}
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
