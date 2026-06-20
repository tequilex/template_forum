import type { Route } from "next";
import Link from "next/link";

interface TagBadgeProps {
  slug: string;
  name: string;
  className?: string;
}

// TagBadge — Server Component. PostCard использует overlay-Link на z-0,
// тэги поднимаются над ним через pointer-events-auto + z-10, поэтому
// обработчик клика здесь не нужен (overlay просто не получает событие).
export function TagBadge({ slug, name, className = "" }: TagBadgeProps) {
  return (
    <Link
      href={`/t/${slug}` as Route}
      className={
        "inline-flex items-center px-2 py-0.5 text-xs rounded-full " +
        "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors " +
        className
      }
    >
      #{name}
    </Link>
  );
}
