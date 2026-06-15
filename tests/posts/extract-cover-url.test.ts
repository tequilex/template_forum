import { describe, it, expect } from "vitest";
import { extractCoverUrl } from "@/components/editor/extractCoverUrl";

const wrap = (blocks: unknown[]) => ({ blocks }) as any;

describe("extractCoverUrl", () => {
  it("первый image-блок → его url", () => {
    const url = extractCoverUrl(wrap([
      { type: "paragraph", data: { text: "intro" } },
      { type: "image", data: { file: { url: "https://e/cover.webp" } } },
      { type: "image", data: { file: { url: "https://e/other.webp" } } },
    ]));
    expect(url).toBe("https://e/cover.webp");
  });

  it("нет image-блоков → null", () => {
    const url = extractCoverUrl(wrap([
      { type: "paragraph", data: { text: "x" } },
      { type: "header", data: { text: "y" } },
    ]));
    expect(url).toBeNull();
  });

  it("image-блок без file.url → null", () => {
    const url = extractCoverUrl(wrap([
      { type: "image", data: { file: {} } },
    ]));
    expect(url).toBeNull();
  });
});
