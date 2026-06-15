import sanitizeHtml from "sanitize-html";

// Whitelist начат с минимума, расширяется по реальным кейсам из тестов и постов.
// Любые <script>, <iframe>, <style>, on*= атрибуты, javascript:/data: схемы
// — режутся by default. transformTags для <a> навязывает rel/target.
//
// `text` от Editor.js приходит с уже-валидной inline-разметкой; renderBlock
// делает компоновку, sanitize — последняя линия защиты на сервере перед
// записью в content_html (читается public-страницей напрямую).

export function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "h2", "h3", "h4",
      "strong", "em", "b", "i", "u", "code", "mark",
      "ul", "ol", "li",
      "blockquote", "cite",
      "figure", "figcaption",
      "img", "hr", "a", "br",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "width", "height", "loading"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          rel: "nofollow noopener noreferrer",
          target: "_blank",
        },
      }),
    },
  });
}
