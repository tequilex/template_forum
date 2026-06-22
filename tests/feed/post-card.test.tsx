import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "@/components/feed/PostCard";

const baseProps = {
  post: {
    id: "p1",
    slug: "opyt-raboty",
    title: "Опыт работы",
    excerpt: "Краткое описание поста",
    coverUrl: "https://example.test/cover.webp",
    pubAt: new Date("2026-06-15T10:00:00Z"),
    readingMinutes: 3,
    commentCount: 0,
  },
  author: {
    id: "u1",
    username: "alice",
    name: "Alice",
    image: "https://example.test/alice.webp",
  },
  tags: [
    { id: "t1", slug: "experience", name: "Опыт" },
    { id: "t2", slug: "lifehack", name: "Лайфхаки" },
  ],
};

describe("PostCard", () => {
  it("рендерит заголовок, excerpt и автора", () => {
    render(<PostCard {...baseProps} />);
    expect(screen.getByText("Опыт работы")).toBeInTheDocument();
    expect(screen.getByText("Краткое описание поста")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("ведёт на /p/[slug] при клике в карточку", () => {
    render(<PostCard {...baseProps} />);
    const cardLink = screen.getByRole("link", { name: /Опыт работы/ });
    expect(cardLink.getAttribute("href")).toBe("/p/opyt-raboty");
  });

  it("без обложки не рендерит <img>", () => {
    const noCover = { ...baseProps, post: { ...baseProps.post, coverUrl: null } };
    render(<PostCard {...noCover} />);
    expect(screen.queryByRole("img", { name: /cover/i })).toBeNull();
  });

  it("без тэгов не рендерит TagBadge'ы", () => {
    const noTags = { ...baseProps, tags: [] };
    render(<PostCard {...noTags} />);
    expect(screen.queryByText("#Опыт")).toBeNull();
  });
});
