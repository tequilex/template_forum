import type { Route } from "next";
import Link from "next/link";
import { content } from "@theme/content";

interface PaginatorProps {
  basePath: string;
  currentPage: number;
  totalPages: number;
}

function pageUrl(basePath: string, page: number): string {
  // Page=1 — без query: канонический URL не дублируется "/" vs "/?page=1".
  if (page === 1) return basePath;
  const sep = basePath.includes("?") ? "&" : "?";
  return `${basePath}${sep}page=${page}`;
}

export function Paginator({ basePath, currentPage, totalPages }: PaginatorProps) {
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Пагинация"
      className="flex items-center justify-between mt-8 pt-6 border-t border-border"
    >
      <div>
        {hasPrev && (
          <Link
            href={pageUrl(basePath, currentPage - 1) as Route}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {content.feed.prev}
          </Link>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {content.feed.page(currentPage)} / {totalPages}
      </div>
      <div>
        {hasNext && (
          <Link
            href={pageUrl(basePath, currentPage + 1) as Route}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {content.feed.next}
          </Link>
        )}
      </div>
    </nav>
  );
}
