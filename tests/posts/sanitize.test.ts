import { describe, it, expect } from "vitest";
import { sanitize } from "@/components/editor/sanitize";

describe("sanitize", () => {
  it("strips <script>", () => {
    expect(sanitize("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
  });

  it("strips <iframe>", () => {
    expect(sanitize("<p>ok</p><iframe src='https://evil/'></iframe>")).toBe("<p>ok</p>");
  });

  it("strips inline event handlers (onerror, onclick)", () => {
    const out = sanitize('<img src="https://e/u.webp" onerror="alert(1)" onclick="x()"/>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onclick");
    expect(out).toContain('src="https://e/u.webp"');
  });

  it("strips javascript: scheme in href", () => {
    const out = sanitize('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips data: scheme in src", () => {
    const out = sanitize('<img src="data:image/svg+xml;base64,PHN2Zw=="/>');
    expect(out).not.toContain("data:");
  });

  it("strips <style> блок", () => {
    expect(sanitize("<style>body{display:none}</style><p>ok</p>")).toBe("<p>ok</p>");
  });

  it("оставляет http/https в <a href>", () => {
    const out = sanitize('<a href="https://example.com">x</a>');
    expect(out).toContain('href="https://example.com"');
  });

  it("оставляет mailto:", () => {
    const out = sanitize('<a href="mailto:a@b.c">x</a>');
    expect(out).toContain('href="mailto:a@b.c"');
  });

  it("transformTags для <a>: добавляет rel + target", () => {
    const out = sanitize('<a href="https://e">x</a>');
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("пропускает <figure>/<img>/<figcaption>", () => {
    const html = '<figure><img src="https://e/u.webp" alt="A" width="100" height="50" loading="lazy"/><figcaption>A</figcaption></figure>';
    const out = sanitize(html);
    expect(out).toContain("<figure>");
    expect(out).toContain("<img");
    expect(out).toContain("<figcaption>A</figcaption>");
    expect(out).toContain('width="100"');
    expect(out).toContain('height="50"');
  });

  it("пропускает inline: b/i/strong/em/code/mark", () => {
    const out = sanitize("<p>a <b>b</b> <i>i</i> <strong>s</strong> <code>c</code> <mark>m</mark></p>");
    expect(out).toBe("<p>a <b>b</b> <i>i</i> <strong>s</strong> <code>c</code> <mark>m</mark></p>");
  });

  it("пропускает <hr/>, <br/> (теги остались)", () => {
    const out = sanitize("<p>a<br/>b</p><hr/>");
    expect(out).toContain("<br");
    expect(out).toContain("<hr");
    expect(out).toContain("<p>");
  });
});
