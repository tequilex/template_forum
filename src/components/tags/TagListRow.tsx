import Link from "next/link";
import type { Route } from "next";
import { content } from "@theme/content";

interface TagListRowProps {
  slug: string;
  name: string;
  description: string | null;
  postCount: number;
}

export function TagListRow({ slug, name, description, postCount }: TagListRowProps) {
  return (
    <Link
      href={`/t/${slug}` as Route}
      className="flex items-baseline justify-between gap-4 py-3 border-b border-border last:border-b-0 hover:bg-accent/30 -mx-2 px-2 rounded-md transition-colors"
    >
      <div className="min-w-0">
        <h3 className="font-semibold text-base mb-0.5">#{name}</h3>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {content.tags.postCount(postCount)}
      </span>
    </Link>
  );
}
