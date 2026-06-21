import Link from "next/link";
import type { Route } from "next";
import { Home, Hash, FileText, User } from "lucide-react";
import { content } from "@theme/content";
import { WriteButton } from "@/components/post/WriteButton";

interface BottomNavProps {
  profileHref: Route;
  isAuthed: boolean;
  className?: string;
}

export function BottomNav({ profileHref, isAuthed, className = "" }: BottomNavProps) {
  const linkClass =
    "flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground";
  return (
    <>
      <nav
        aria-label="Главная навигация"
        className={`flex justify-around items-stretch border-t border-border bg-background ${className}`}
      >
        <Link href="/" className={linkClass}>
          <Home className="h-5 w-5 mb-1" />
          {content.nav.home}
        </Link>
        <Link href="/tags" className={linkClass}>
          <Hash className="h-5 w-5 mb-1" />
          {content.nav.tags}
        </Link>
        <Link href="/drafts" className={linkClass}>
          <FileText className="h-5 w-5 mb-1" />
          {content.nav.drafts}
        </Link>
        <Link href={profileHref} className={linkClass}>
          <User className="h-5 w-5 mb-1" />
          {content.nav.profile}
        </Link>
      </nav>
      {isAuthed && (
        <WriteButton
          variant="fab"
          className="fixed bottom-20 right-4 z-40"
        />
      )}
    </>
  );
}
