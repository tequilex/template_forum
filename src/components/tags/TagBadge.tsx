import type { Route } from "next";
import Link from "next/link";

interface TagBadgeProps {
  slug: string;
  name: string;
  className?: string;
}

export function TagBadge({ slug, name, className = "" }: TagBadgeProps) {
  // stopPropagation: TagBadge живёт внутри PostCard, который сам обёрнут в <Link>.
  // Без него клик по тэгу уйдёт обоим Link'ам и сработает только outer.
  return (
    <Link
      href={`/t/${slug}` as Route}
      onClick={(e) => e.stopPropagation()}
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
