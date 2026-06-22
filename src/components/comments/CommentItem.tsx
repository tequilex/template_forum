import Link from "next/link";
import type { CommentItem as CommentItemData } from "@/server/comments";
import { renderCommentText } from "./render-text";
import { CommentDeletedPlaceholder } from "./CommentDeletedPlaceholder";
import { CommentItemActions } from "./CommentItemActions";
import { Avatar } from "@/components/ui/Avatar";
import { content } from "@theme/content";

interface Props {
  comment: CommentItemData;
  postId: string;
  currentUserId: string | null;
  currentUserIsAdmin: boolean;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function CommentItem({ comment, postId, currentUserId, currentUserIsAdmin }: Props) {
  const isDeleted = comment.deletedAt != null;
  const isAuthorBanned = comment.authorBannedAt != null && !isDeleted;

  return (
    <article id={`comment-${comment.id}`} className="border-b border-border py-4">
      <header className="flex items-center gap-2 text-sm mb-2">
        <Avatar
          src={comment.authorImage}
          name={comment.authorName}
          username={comment.authorUsername}
          size={24}
        />
        {isAuthorBanned || !comment.authorUsername ? (
          <span className="font-medium text-muted-foreground">
            {comment.authorName ?? "—"}
          </span>
        ) : (
          <Link href={`/u/${comment.authorUsername}`} className="font-medium hover:underline">
            {comment.authorName ?? comment.authorUsername}
          </Link>
        )}
        <span className="text-muted-foreground">·</span>
        <time className="text-muted-foreground" dateTime={comment.createdAt.toISOString()}>
          {formatDate(comment.createdAt)}
        </time>
        {comment.editedAt && (
          <span className="text-xs text-muted-foreground italic">(изменено)</span>
        )}
        {isAuthorBanned && (
          <span className="text-xs text-destructive ml-2">{content.comments.bannedAuthor}</span>
        )}
        <div className="ml-auto">
          {!isDeleted && (
            <CommentItemActions
              commentId={comment.id}
              authorId={comment.authorId}
              createdAt={comment.createdAt}
              currentUserId={currentUserId}
              currentUserIsAdmin={currentUserIsAdmin}
              initialText={comment.contentText}
              postId={postId}
            />
          )}
          {isDeleted && currentUserIsAdmin && (
            <CommentItemActions
              commentId={comment.id}
              authorId={comment.authorId}
              createdAt={comment.createdAt}
              currentUserId={currentUserId}
              currentUserIsAdmin={currentUserIsAdmin}
              initialText={comment.contentText}
              postId={postId}
              isDeleted
            />
          )}
        </div>
      </header>

      {isDeleted ? (
        <CommentDeletedPlaceholder byAuthor={comment.deletedByAuthor} />
      ) : (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {renderCommentText(comment.contentText)}
        </div>
      )}
    </article>
  );
}
