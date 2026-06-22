"use client";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/Avatar";
import { content } from "@theme/content";

type Props = {
  username: string;
  name: string | null;
  image: string | null;
};

export function UserMenu({ username, name, image }: Props) {
  // signOut делает XHR + redirect, без feedback'а пункт меню «зависает».
  // useTransition держит pending до окончания навигации.
  const [isSigningOut, startSignOut] = useTransition();

  return (
    // modal=false: dropdown не должен включать react-remove-scroll. Иначе Radix
    // добавляет padding-right на <body> для компенсации скроллбара, и хедер
    // прыгает (вдвойне — с нашим scrollbar-gutter: stable место уже занято).
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
        <Avatar src={image} name={name} username={username} size={36} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem asChild>
          <Link href={`/u/${username}`}>@{username}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          onSelect={(e) => {
            // preventDefault — иначе Radix закроет меню сразу, и spinner не успеет
            // мигнуть. startTransition отметит pending до завершения redirect'а.
            e.preventDefault();
            startSignOut(() => { signOut({ callbackUrl: "/" }); });
          }}
        >
          {isSigningOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {content.auth.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
