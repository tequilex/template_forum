import { content } from "@theme/content";

export function CommentDeletedPlaceholder({ byAuthor }: { byAuthor: boolean }) {
  return (
    <p className="text-sm italic text-muted-foreground py-3">
      {byAuthor ? content.comments.deletedByAuthor : content.comments.deletedByAdmin}
    </p>
  );
}
