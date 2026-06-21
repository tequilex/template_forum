"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditCommentForm } from "./EditCommentForm";
import { deleteOwnComment } from "@/server/actions/comments";
import { adminDeleteComment, adminRestoreComment } from "@/server/actions/moderation";
import { content } from "@theme/content";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

interface Props {
  commentId: string;
  authorId: string;
  createdAt: Date;
  currentUserId: string | null;
  currentUserIsAdmin: boolean;
  initialText: string;
  postId: string;
  isDeleted?: boolean;
}

export function CommentItemActions(props: Props) {
  const {
    commentId, authorId, createdAt, currentUserId, currentUserIsAdmin,
    initialText, isDeleted,
  } = props;

  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const isOwn = currentUserId === authorId;
  const canEdit = isOwn && !isDeleted && Date.now() - createdAt.getTime() < EDIT_WINDOW_MS;
  const canDelete = (isOwn && !isDeleted) || (currentUserIsAdmin && !isDeleted);
  const canRestore = currentUserIsAdmin && isDeleted;

  if (!canEdit && !canDelete && !canRestore) return null;

  const onDelete = async () => {
    const r = isOwn
      ? await deleteOwnComment(commentId)
      : await adminDeleteComment(commentId);
    if (r.ok) router.refresh();
  };

  const onRestore = () => {
    startTransition(async () => {
      const r = await adminRestoreComment(commentId);
      if (r.ok) router.refresh();
    });
  };

  if (editing) {
    return <EditCommentForm commentId={commentId} initialText={initialText} onCancel={() => setEditing(false)} />;
  }

  const deleteTrigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      {isOwn ? content.comments.delete : content.moderation.adminDeleteComment}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="p-1 rounded hover:bg-accent">
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Действия</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            {content.comments.edit}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <ConfirmDialog
            trigger={deleteTrigger}
            title={content.comments.deleteConfirm}
            description={isOwn ? content.comments.deleteConfirm : content.moderation.adminDeleteComment}
            confirmLabel={content.comments.delete}
            destructive
            onConfirm={onDelete}
          />
        )}
        {canRestore && (
          <DropdownMenuItem onSelect={onRestore}>
            {content.moderation.adminRestoreComment}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
