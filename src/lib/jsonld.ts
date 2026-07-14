// Конструкторы schema.org объектов для встраивания через
// <script type="application/ld+json"> на публичных страницах.
// Возвращают plain objects; сериализуются вызывающим через JSON.stringify.

export interface JsonLd {
  "@context": "https://schema.org";
  "@type": string;
  // Индекс намеренно `any`: schema.org-объекты имеют разную форму
  // (BlogPosting / BreadcrumbList / WebSite), а тесты ходят по полям
  // напрямую (ld.author.name, ld.itemListElement[0].position).
  [k: string]: any;
}

const stripSlash = (s: string) => s.replace(/\/$/, "");

export function buildBlogPostingJsonLd(input: {
  post: {
    slug: string;
    title: string;
    excerpt: string;
    pubAt: Date | null;
    updatedAt: Date | null;
    coverUrl: string | null;
    contentHtml: string;
  };
  author: { username: string | null; name: string | null };
  tags: { name: string }[];
  siteUrl: string;
}): JsonLd {
  const base = stripSlash(input.siteUrl);
  const postUrl = `${base}/p/${input.post.slug}`;
  const authorName = input.author.name ?? input.author.username ?? "Аноним";
  const authorUrl = input.author.username ? `${base}/u/${input.author.username}` : undefined;
  const image = input.post.coverUrl ?? `${base}/og/${input.post.slug}`;
  const datePublished = (input.post.pubAt ?? new Date()).toISOString();
  const dateModified = (input.post.updatedAt ?? input.post.pubAt ?? new Date()).toISOString();
  const keywords = input.tags.map(t => t.name).join(", ");

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.post.title,
    description: input.post.excerpt,
    url: postUrl,
    mainEntityOfPage: postUrl,
    datePublished,
    dateModified,
    image,
    author: { "@type": "Person", name: authorName, ...(authorUrl ? { url: authorUrl } : {}) },
    inLanguage: "ru-RU",
    ...(keywords ? { keywords } : {}),
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function buildWebSiteJsonLd(siteUrl: string): JsonLd {
  const base = `${stripSlash(siteUrl)}/`;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: base,
    name: "foxgeek",
    inLanguage: "ru-RU",
  };
}
