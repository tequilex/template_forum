import React from "react";

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCT = /[.,;:!?)\]}»"']+$/;

function renderParagraph(text: string, keyPrefix: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;

  while ((m = URL_RE.exec(text)) !== null) {
    let url = m[0];
    let matchEnd = m.index + url.length;
    const trail = url.match(TRAILING_PUNCT);
    if (trail) {
      url = url.slice(0, -trail[0].length);
      matchEnd -= trail[0].length;
      URL_RE.lastIndex = matchEnd;
    }
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    parts.push(
      <a key={`${keyPrefix}-${m.index}`} href={url} target="_blank" rel="noopener noreferrer nofollow">
        {url}
      </a>
    );
    lastIdx = matchEnd;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  const withBreaks: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    if (typeof p !== "string") { withBreaks.push(p); return; }
    const lines = p.split("\n");
    lines.forEach((ln, j) => {
      withBreaks.push(ln);
      if (j < lines.length - 1) withBreaks.push(<br key={`${keyPrefix}-br-${i}-${j}`} />);
    });
  });

  return withBreaks;
}

// text → ReactNode[]: разбиение по \n\n на параграфы, внутри — авто-линки и <br/>.
// React сам экранирует строковые children — XSS невозможен.
export function renderCommentText(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((p, i) => (
    <p key={`p-${i}`} className="whitespace-pre-wrap">
      {renderParagraph(p, `p-${i}`)}
    </p>
  ));
}
