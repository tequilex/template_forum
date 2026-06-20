import type { Metadata } from "next";
import { content } from "@theme/content";
import { siteConfig } from "@/lib/site-config";
import { TagListRow } from "@/components/tags/TagListRow";
import { getTagsIndex } from "@/server/feed";

export const metadata: Metadata = {
  title: `${content.tags.indexTitle} — ${siteConfig.name}`,
  description: "Список всех тэгов на сайте",
};

export default async function TagsIndexPage() {
  const rows = await getTagsIndex();

  return (
    <>
      <header className="mb-6 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold">{content.tags.indexTitle}</h1>
      </header>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">{content.tags.indexEmpty}</p>
      ) : (
        <div>
          {rows.map((t) => (
            <TagListRow
              key={t.id}
              slug={t.slug}
              name={t.name}
              description={t.description}
              postCount={t.postCount}
            />
          ))}
        </div>
      )}
    </>
  );
}
