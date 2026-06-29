import { describe, it, expect } from "vitest";
import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd, buildWebSiteJsonLd } from "@/lib/jsonld";

describe("buildBlogPostingJsonLd", () => {
  it("содержит обязательные поля schema.org BlogPosting", () => {
    const ld = buildBlogPostingJsonLd({
      post: {
        slug: "test-post",
        title: "Тестовый пост",
        excerpt: "Краткое описание",
        pubAt: new Date("2026-06-29T10:00:00Z"),
        updatedAt: new Date("2026-06-30T12:00:00Z"),
        coverUrl: "https://example.ru/cover.webp",
        contentHtml: "<p>Body</p>",
      },
      author: { username: "alice", name: "Алиса" },
      tags: [{ name: "Тест" }, { name: "Skelet" }],
      siteUrl: "https://example.ru",
    });
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("BlogPosting");
    expect(ld.headline).toBe("Тестовый пост");
    expect(ld.url).toBe("https://example.ru/p/test-post");
    expect(ld.datePublished).toBe("2026-06-29T10:00:00.000Z");
    expect(ld.dateModified).toBe("2026-06-30T12:00:00.000Z");
    expect(ld.author).toMatchObject({ "@type": "Person", name: "Алиса", url: "https://example.ru/u/alice" });
    expect(ld.image).toBe("https://example.ru/cover.webp");
    expect(ld.keywords).toBe("Тест, Skelet");
  });

  it("если coverUrl отсутствует — использует динамический OG URL", () => {
    const ld = buildBlogPostingJsonLd({
      post: {
        slug: "no-cover", title: "X", excerpt: "", pubAt: new Date(),
        updatedAt: new Date(), coverUrl: null, contentHtml: "",
      },
      author: { username: null, name: null },
      tags: [],
      siteUrl: "https://example.ru",
    });
    expect(ld.image).toBe("https://example.ru/og/no-cover");
    expect(ld.author.name).toBe("Аноним");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("корректный itemListElement для трёх уровней", () => {
    const ld = buildBreadcrumbJsonLd([
      { name: "Главная", url: "https://example.ru/" },
      { name: "Темы", url: "https://example.ru/tags" },
      { name: "JS", url: "https://example.ru/t/js" },
    ]);
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[0]).toMatchObject({ "@type": "ListItem", position: 1, name: "Главная", item: "https://example.ru/" });
    expect(ld.itemListElement[2].position).toBe(3);
  });
});

describe("buildWebSiteJsonLd", () => {
  it("содержит url, name, inLanguage", () => {
    const ld = buildWebSiteJsonLd("https://example.ru");
    expect(ld["@type"]).toBe("WebSite");
    expect(ld.url).toBe("https://example.ru/");
    expect(ld.inLanguage).toBe("ru-RU");
  });
});
