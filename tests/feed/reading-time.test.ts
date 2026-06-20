import { describe, it, expect } from "vitest";
import { readingTimeMinutes } from "@/components/feed/readingTime";

describe("readingTimeMinutes", () => {
  it("пустая строка → 1 (минимум)", () => {
    expect(readingTimeMinutes("")).toBe(1);
  });

  it("одно слово → 1", () => {
    expect(readingTimeMinutes("Привет")).toBe(1);
  });

  it("200 слов ≈ 1 минута (читаем 200 wpm)", () => {
    const text = Array.from({ length: 200 }, () => "слово").join(" ");
    expect(readingTimeMinutes(text)).toBe(1);
  });

  it("1000 слов → 5 минут", () => {
    const text = Array.from({ length: 1000 }, () => "слово").join(" ");
    expect(readingTimeMinutes(text)).toBe(5);
  });
});
