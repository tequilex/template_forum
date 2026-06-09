"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { content } from "@/theme/content";

type Props = {
  username: string;
  name: string | null;
  image: string | null;
};

export function UserMenu({ username, name, image }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
        {image
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={image} alt="" className="h-9 w-9 rounded-full" />
          : <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              {(name ?? username).charAt(0).toUpperCase()}
            </div>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem asChild>
          <Link href={`/u/${username}`}>@{username}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
          {content.auth.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
