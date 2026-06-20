import Link from "next/link";
import type { Route } from "next";
import { Home, Hash, FileText, User } from "lucide-react";
import { content } from "@theme/content";

interface BottomNavProps {
  profileHref: Route;
  className?: string;
}

export function BottomNav({ profileHref, className = "" }: BottomNavProps) {
  // TODO(plan-5a Task 10): /tags переключить на <Link> когда появится список тегов.
  return (
    <nav
      aria-label="Главная навигация"
      className={`flex justify-around items-stretch border-t border-border bg-background ${className}`}
    >
      <Link
        href="/"
        className="flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Home className="h-5 w-5 mb-1" />
        {content.nav.home}
      </Link>
      <a
        href="/tags"
        className="flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Hash className="h-5 w-5 mb-1" />
        {content.nav.tags}
      </a>
      <Link
        href="/drafts"
        className="flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <FileText className="h-5 w-5 mb-1" />
        {content.nav.drafts}
      </Link>
      <Link
        href={profileHref}
        className="flex flex-col items-center justify-center flex-1 min-h-12 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <User className="h-5 w-5 mb-1" />
        {content.nav.profile}
      </Link>
    </nav>
  );
}
