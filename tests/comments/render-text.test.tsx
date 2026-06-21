import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderCommentText } from "@/components/comments/render-text";

function html(text: string): string {
  const { container } = render(<>{renderCommentText(text)}</>);
  return container.innerHTML;
}

describe("renderCommentText", () => {
  it("plain без URL → один <p>", () => {
    const out = html("Привет, мир.");
    expect(out).toContain("<p");
    expect(out).toContain("Привет, мир.");
    expect(out).not.toContain("<a ");
  });

  it("один URL в середине параграфа → <a> с правильным rel/target", () => {
    const out = html("Смотри https://example.com — круто.");
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it("несколько URL в одном параграфе", () => {
    const out = html("https://a.com и https://b.com");
    expect(out.match(/<a /g)?.length).toBe(2);
  });

  it("URL с trailing-пунктуацией → знак НЕ попадает в href", () => {
    const out = html("Зайди на https://example.com, пожалуйста.");
    expect(out).toContain('href="https://example.com"');
    expect(out).not.toContain('href="https://example.com,"');
  });
});
