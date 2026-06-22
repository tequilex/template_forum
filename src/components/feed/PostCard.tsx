import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { MessageSquare } from "lucide-react";
import { content } from "@theme/content";
import { TagBadge } from "@/components/tags/TagBadge";
import { Avatar } from "@/components/ui/Avatar";

export interface PostCardData {
  post: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    coverUrl: string | null;
    pubAt: Date | null;
    readingMinutes: number;
    commentCount: number;
  };
  author: {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
  };
  tags: { id: string; slug: string; name: string }[];
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

// Overlay-паттерн: основная ссылка на пост — абсолютно позиционированный <a>
// поверх всей карточки. Тэги — обычные <Link>, поднятые z-index'ом над ним.
// Так избегаем nested <a> и сохраняем кликабельность тэгов.
export function PostCard({ post, author, tags }: PostCardData) {
  const href = `/p/${post.slug}` as Route;
  const authorName = author.name ?? author.username ?? "Аноним";
  const dateLabel = post.pubAt ? dateFmt.format(post.pubAt) : "";

  return (
    <article className="relative rounded-lg border border-border bg-card overflow-hidden hover:border-foreground/20 transition-colors">
      <Link
        href={href}
        aria-label={post.title}
        className="absolute inset-0 z-0"
      />
      {post.coverUrl && (
        <div className="relative aspect-[16/9] w-full bg-muted">
          <Image
            src={post.coverUrl}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 640px"
            className="object-cover"
          />
        </div>
      )}
      <div className="relative p-4 lg:p-5 pointer-events-none">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 pointer-events-auto relative z-10">
            {tags.map((t) => (
              <TagBadge key={t.id} slug={t.slug} name={t.name} />
            ))}
          </div>
        )}
        <h3 className="text-lg font-semibold leading-tight mb-2 line-clamp-2">{post.title}</h3>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar src={author.image} name={author.name} username={author.username} size={20} />
          <span>{authorName}</span>
          {dateLabel && (
            <>
              <span>·</span>
              <span>{dateLabel}</span>
            </>
          )}
          <span>·</span>
          <span>{content.feed.readingTime(post.readingMinutes)}</span>
          <span>·</span>
          <span
            className="inline-flex items-center gap-1"
            aria-label={content.comments.countLabel(post.commentCount)}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {post.commentCount}
          </span>
        </div>
      </div>
    </article>
  );
}
