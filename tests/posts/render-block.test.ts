import { describe, it, expect } from "vitest";
import { renderBlock } from "@/components/editor/renderBlock";

const wrap = (blocks: unknown[]) => ({ blocks }) as any;

describe("renderBlock", () => {
  it("paragraph → <p>", () => {
    expect(renderBlock(wrap([{ type: "paragraph", data: { text: "hello" } }])))
      .toBe("<p>hello</p>");
  });

  it("paragraph preserves inline HTML (b/i/a) — sanitize позже почистит", () => {
    expect(renderBlock(wrap([{ type: "paragraph", data: { text: "<b>bold</b> and <i>it</i>" } }])))
      .toBe("<p><b>bold</b> and <i>it</i></p>");
  });

  it("header level 2/3/4 → h2/h3/h4", () => {
    expect(renderBlock(wrap([{ type: "header", data: { text: "T", level: 2 } }]))).toBe("<h2>T</h2>");
    expect(renderBlock(wrap([{ type: "header", data: { text: "T", level: 3 } }]))).toBe("<h3>T</h3>");
    expect(renderBlock(wrap([{ type: "header", data: { text: "T", level: 4 } }]))).toBe("<h4>T</h4>");
  });

  it("header level 1 → fallback h2 (h1 = post title)", () => {
    expect(renderBlock(wrap([{ type: "header", data: { text: "T", level: 1 } }]))).toBe("<h2>T</h2>");
  });

  it("header level 5/6 → fallback h4", () => {
    expect(renderBlock(wrap([{ type: "header", data: { text: "T", level: 5 } }]))).toBe("<h4>T</h4>");
  });

  it("image with width/height + caption → figure", () => {
    const html = renderBlock(wrap([{
      type: "image",
      data: { file: { url: "https://e/u.webp", width: 800, height: 600 }, caption: "Alt" },
    }]));
    expect(html).toContain('<img src="https://e/u.webp"');
    expect(html).toContain('alt="Alt"');
    expect(html).toContain('width="800"');
    expect(html).toContain('height="600"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("<figcaption>Alt</figcaption>");
  });

  it("image без width/height — рендерится без атрибутов размеров", () => {
    const html = renderBlock(wrap([{
      type: "image",
      data: { file: { url: "https://e/u.webp" } },
    }]));
    expect(html).toContain('<img src="https://e/u.webp"');
    expect(html).not.toContain("width=");
    expect(html).not.toContain("height=");
    expect(html).not.toContain("<figcaption>");
  });

  it("image без caption — alt пустой", () => {
    const html = renderBlock(wrap([{
      type: "image",
      data: { file: { url: "https://e/u.webp", width: 1, height: 1 } },
    }]));
    expect(html).toContain('alt=""');
  });

  it("list ordered → <ol><li>", () => {
    const html = renderBlock(wrap([{ type: "list", data: { style: "ordered", items: ["a", "b"] } }]));
    expect(html).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("list unordered → <ul><li>", () => {
    const html = renderBlock(wrap([{ type: "list", data: { style: "unordered", items: ["a"] } }]));
    expect(html).toBe("<ul><li>a</li></ul>");
  });

  it("quote с caption → blockquote+cite", () => {
    const html = renderBlock(wrap([{ type: "quote", data: { text: "Q", caption: "Author" } }]));
    expect(html).toBe("<blockquote>Q<cite>Author</cite></blockquote>");
  });

  it("quote без caption", () => {
    const html = renderBlock(wrap([{ type: "quote", data: { text: "Q" } }]));
    expect(html).toBe("<blockquote>Q</blockquote>");
  });

  it("delimiter → <hr/>", () => {
    expect(renderBlock(wrap([{ type: "delimiter", data: {} }]))).toBe("<hr/>");
  });

  it("unknown block type → пустая строка (graceful)", () => {
    expect(renderBlock(wrap([{ type: "code", data: { code: "x" } }]))).toBe("");
  });

  it("несколько блоков склеиваются по порядку", () => {
    const html = renderBlock(wrap([
      { type: "header", data: { text: "H", level: 2 } },
      { type: "paragraph", data: { text: "P" } },
      { type: "delimiter", data: {} },
    ]));
    expect(html).toBe("<h2>H</h2><p>P</p><hr/>");
  });

  it("пустой doc → пустая строка", () => {
    expect(renderBlock(wrap([]))).toBe("");
  });
});
