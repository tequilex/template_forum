"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BanUserDialog } from "./BanUserDialog";
import { adminUnbanUser } from "@/server/actions/moderation";
import { content } from "@theme/content";

interface Props {
  userId: string;
  isBanned: boolean;
}

export function UserAdminMenu({ userId, isBanned }: Props) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  const onUnban = async () => {
    startTransition(async () => {
      const r = await adminUnbanUser(userId);
      if (r.ok) router.refresh();
    });
  };

  const banTrigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      {content.moderation.banUser}
    </DropdownMenuItem>
  );
  const unbanTrigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      {content.moderation.unbanUser}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="p-2 rounded hover:bg-accent" aria-label={content.moderation.userMenuLabel}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isBanned ? (
          <ConfirmDialog
            trigger={unbanTrigger}
            title={content.moderation.unbanUser}
            description={content.moderation.unbanUserConfirm}
            confirmLabel={content.moderation.unbanUser}
            onConfirm={onUnban}
          />
        ) : (
          <BanUserDialog trigger={banTrigger} userId={userId} />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
