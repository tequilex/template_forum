import type { OutputData } from "@editorjs/editorjs";

type AnyBlock = { type: string; data: any };

// Per-block рендер content_json → HTML-строка.
// Унаследовано: безопасность ВНЕ ответственности этого модуля.
// `text` приходит от Editor.js с inline-разметкой (<b>, <i>, <a>, <code>, <mark>),
// которая после рендера прогоняется через sanitize-html (см. ./sanitize.ts).
// renderBlock сам по себе НЕ экранирует — это слой компоновки, а не санитизации.
// Если в будущем добавите ввод от untrusted источника (например, импорт JSON
// со стороны) — sanitize обязателен.

export function renderBlock(doc: OutputData): string {
  const blocks = (doc?.blocks ?? []) as AnyBlock[];
  return blocks.map(renderOne).join("");
}

function renderOne(block: AnyBlock): string {
  switch (block.type) {
    case "paragraph": return paragraph(block.data);
    case "header":    return header(block.data);
    case "image":     return image(block.data);
    case "list":      return list(block.data);
    case "quote":     return quote(block.data);
    case "delimiter": return "<hr/>";
    default:          return ""; // unknown block — graceful degrade
  }
}

function paragraph(data: { text?: string }): string {
  return `<p>${data.text ?? ""}</p>`;
}

function header(data: { text?: string; level?: number }): string {
  const lvl = data.level === 2 || data.level === 3 || data.level === 4
    ? data.level
    : (data.level === 1 ? 2 : 4); // h1 → h2 (title уже h1); h5+ → h4
  return `<h${lvl}>${data.text ?? ""}</h${lvl}>`;
}

function image(data: { file?: { url?: string; width?: number; height?: number }; caption?: string }): string {
  const url = data.file?.url ?? "";
  const w = data.file?.width;
  const h = data.file?.height;
  const cap = data.caption ?? "";
  const dims = (w && h) ? ` width="${w}" height="${h}"` : "";
  const figcap = cap ? `<figcaption>${cap}</figcaption>` : "";
  return `<figure><img src="${url}" alt="${cap}"${dims} loading="lazy"/>${figcap}</figure>`;
}

function list(data: { style?: "ordered" | "unordered"; items?: string[] }): string {
  const tag = data.style === "ordered" ? "ol" : "ul";
  const items = (data.items ?? []).map(i => `<li>${i}</li>`).join("");
  return `<${tag}>${items}</${tag}>`;
}

function quote(data: { text?: string; caption?: string }): string {
  const cite = data.caption ? `<cite>${data.caption}</cite>` : "";
  return `<blockquote>${data.text ?? ""}${cite}</blockquote>`;
}
