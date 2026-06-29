import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content } from "@theme/content";
import { siteConfig } from "@/lib/site-config";
import { PostList } from "@/components/feed/PostList";
import { getTagBySlug, getTagFeedPage } from "@/server/feed";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbJsonLd } from "@/lib/jsonld";
import { getEnv } from "@/lib/env";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return {};
  return {
    title: `#${tag.name} — ${siteConfig.name}`,
    description: tag.description ?? `Посты по тэгу ${tag.name}`,
  };
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const { items, currentPage, totalPages, totalCount } = await getTagFeedPage(tag.id, page);

  if (page > totalPages && items.length === 0 && totalPages > 0) {
    notFound();
  }

  const siteUrl = getEnv().NEXTAUTH_URL.replace(/\/$/, "");

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Главная", url: `${siteUrl}/` },
          { name: "Темы", url: `${siteUrl}/tags` },
          { name: tag.name, url: `${siteUrl}/t/${tag.slug}` },
        ])}
      />
      <header className="mb-6 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold mb-1">#{tag.name}</h1>
        <p className="text-sm text-muted-foreground">{content.tags.postCount(totalCount)}</p>
      </header>
      <PostList
        items={items}
        basePath={`/t/${tag.slug}`}
        currentPage={currentPage}
        totalPages={totalPages}
        emptyMessage={content.empty.tag}
      />
    </>
  );
}
