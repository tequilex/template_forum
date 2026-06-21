"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BanUserDialog } from "./BanUserDialog";
import { adminHidePost, adminUnhidePost, adminDeletePost } from "@/server/actions/moderation";
import { content } from "@theme/content";

interface Props {
  postId: string;
  authorId: string;
  isHidden: boolean;
}

export function PostAdminMenu({ postId, authorId, isHidden }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  const onHideToggle = () => {
    startTransition(async () => {
      const r = isHidden ? await adminUnhidePost(postId) : await adminHidePost(postId);
      if (r.ok) router.refresh();
    });
  };

  const onDelete = async () => {
    const r = await adminDeletePost(postId);
    if (r.ok) router.refresh();
  };

  const deleteTrigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      {content.moderation.deletePost}
    </DropdownMenuItem>
  );
  const banTrigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      {content.moderation.banUser}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="p-2 rounded hover:bg-accent" aria-label={content.moderation.postMenuLabel}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onHideToggle}>
          {isHidden ? content.moderation.unhidePost : content.moderation.hidePost}
        </DropdownMenuItem>
        <ConfirmDialog
          trigger={deleteTrigger}
          title={content.moderation.deletePost}
          description={content.moderation.deletePostConfirm}
          confirmLabel={content.moderation.deletePost}
          destructive
          onConfirm={onDelete}
        />
        <BanUserDialog trigger={banTrigger} userId={authorId} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
