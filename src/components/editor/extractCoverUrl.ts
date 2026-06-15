import type { OutputData } from "@editorjs/editorjs";

type AnyBlock = { type: string; data: any };

// Cover поста = url первого image-блока в content.
// Plan-04 решение §2 #6: не делаем отдельный uploader для cover —
// автор всё равно использует ту же картинку в начале поста.

export function extractCoverUrl(doc: OutputData): string | null {
  const blocks = (doc?.blocks ?? []) as AnyBlock[];
  for (const b of blocks) {
    if (b.type === "image" && typeof b.data?.file?.url === "string" && b.data.file.url.length > 0) {
      return b.data.file.url;
    }
  }
  return null;
}
