import type { OutputData } from "@editorjs/editorjs";

type AnyBlock = { type: string; data: any };

// Используется в server actions для построения excerpt'а перед публикацией.
// Не sanitize и не renderBlock — просто плоский текст для меты/превью.

const stripHtml = (s: string): string => s.replace(/<[^>]*>/g, "");

export function extractPlainText(doc: OutputData): string {
  const blocks = (doc?.blocks ?? []) as AnyBlock[];
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "paragraph":
      case "header":
        if (b.data?.text) parts.push(stripHtml(b.data.text));
        break;
      case "list":
        if (Array.isArray(b.data?.items)) {
          for (const it of b.data.items) parts.push(stripHtml(String(it)));
        }
        break;
      case "quote":
        if (b.data?.text) parts.push(stripHtml(b.data.text));
        if (b.data?.caption) parts.push(stripHtml(b.data.caption));
        break;
      case "image":
        if (b.data?.caption) parts.push(stripHtml(b.data.caption));
        break;
      // delimiter, unknown — игнор
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
