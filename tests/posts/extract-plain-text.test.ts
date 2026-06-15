import { describe, it, expect } from "vitest";
import { extractPlainText } from "@/components/editor/extractPlainText";

const wrap = (blocks: unknown[]) => ({ blocks }) as any;

describe("extractPlainText", () => {
  it("paragraph и header — конкатенация текста через пробел", () => {
    const out = extractPlainText(wrap([
      { type: "header", data: { text: "Заголовок", level: 2 } },
      { type: "paragraph", data: { text: "Текст" } },
    ]));
    expect(out).toBe("Заголовок Текст");
  });

  it("strip HTML из text", () => {
    const out = extractPlainText(wrap([
      { type: "paragraph", data: { text: "<b>жирный</b> и <i>курсив</i>" } },
    ]));
    expect(out).toBe("жирный и курсив");
  });

  it("list — items объединяются пробелом", () => {
    const out = extractPlainText(wrap([
      { type: "list", data: { items: ["раз", "<b>два</b>", "три"] } },
    ]));
    expect(out).toBe("раз два три");
  });

  it("quote — text + caption", () => {
    const out = extractPlainText(wrap([
      { type: "quote", data: { text: "Будь как вода", caption: "Брюс" } },
    ]));
    expect(out).toBe("Будь как вода Брюс");
  });

  it("image — только caption (url не идёт в excerpt)", () => {
    const out = extractPlainText(wrap([
      { type: "image", data: { file: { url: "https://e/u.webp" }, caption: "Кот" } },
      { type: "paragraph", data: { text: "хвост" } },
    ]));
    expect(out).toBe("Кот хвост");
  });

  it("delimiter и unknown игнорируются", () => {
    const out = extractPlainText(wrap([
      { type: "paragraph", data: { text: "до" } },
      { type: "delimiter", data: {} },
      { type: "code", data: { code: "пропустить" } },
      { type: "paragraph", data: { text: "после" } },
    ]));
    expect(out).toBe("до после");
  });

  it("пустой doc → пустая строка", () => {
    expect(extractPlainText(wrap([]))).toBe("");
  });
});
