"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Home, Hash, FileText, User } from "lucide-react";
import { content } from "@theme/content";

interface LeftNavProps {
  profileHref: Route;
  className?: string;
}

interface NavItem {
  href: Route;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
}

export function LeftNav({ profileHref, className = "" }: LeftNavProps) {
  const pathname = usePathname() ?? "/";

  const items: NavItem[] = [
    { href: "/", label: content.nav.home, icon: Home, isActive: (p) => p === "/" },
    {
      href: "/drafts",
      label: content.nav.drafts,
      icon: FileText,
      isActive: (p) => p.startsWith("/drafts"),
    },
    {
      href: profileHref,
      label: content.nav.profile,
      icon: User,
      isActive: (p) => p.startsWith("/u/") || p === "/welcome",
    },
  ];

  // TODO(plan-5a Task 10): /tags переключить с <a> на <Link> когда появится список тегов.
  const tagsActive = pathname === "/tags" || pathname.startsWith("/t/");

  return (
    <nav className={`flex flex-col gap-1 text-sm ${className}`} aria-label="Главная навигация">
      <Link
        href="/"
        aria-current={items[0].isActive(pathname) ? "page" : undefined}
        className={navItemClass(items[0].isActive(pathname))}
      >
        <Home className="h-4 w-4" />
        {content.nav.home}
      </Link>
      <a
        href="/tags"
        aria-current={tagsActive ? "page" : undefined}
        className={navItemClass(tagsActive)}
      >
        <Hash className="h-4 w-4" />
        {content.nav.tags}
      </a>
      {items.slice(1).map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={navItemClass(active)}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function navItemClass(active: boolean): string {
  return (
    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors " +
    (active
      ? "bg-accent text-foreground"
      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
  );
}
