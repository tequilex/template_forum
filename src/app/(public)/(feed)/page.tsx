import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { content } from "@theme/content";
import { seo } from "@theme/seo";
import { PostList } from "@/components/feed/PostList";
import { getFeedPage } from "@/server/feed";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildWebSiteJsonLd } from "@/lib/jsonld";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: seo.defaultTitle,
  description: seo.defaultDescription,
  openGraph: { type: "website" },
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  console.log("pipiska");
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const { items, currentPage, totalPages } = await getFeedPage(page);

  // ?page=N за пределами реального диапазона при наличии постов → 404.
  // Пустая лента целиком (totalPages=1, items=[]) — валидный EmptyFeed, не 404.
  if (page > totalPages && items.length === 0 && totalPages > 0) {
    notFound();
  }

  return (
    <>
      <JsonLd data={buildWebSiteJsonLd(getEnv().NEXTAUTH_URL)} />
      <PostList
        items={items}
        basePath="/"
        currentPage={currentPage}
        totalPages={totalPages}
        emptyMessage={content.empty.feed}
      />
    </>
  );
}
