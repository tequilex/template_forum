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
      href: "/tags",
      label: content.nav.tags,
      icon: Hash,
      isActive: (p) => p === "/tags" || p.startsWith("/t/"),
    },
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

  return (
    <nav className={`flex flex-col gap-1 text-sm ${className}`} aria-label="Главная навигация">
      {items.map((item) => {
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
