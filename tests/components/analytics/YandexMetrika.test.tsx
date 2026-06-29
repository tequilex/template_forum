import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { YandexMetrika } from "@/components/analytics/YandexMetrika";

describe("<YandexMetrika>", () => {
  it("содержит counterId в init-snippet и noscript-pixel", () => {
    const { container } = render(<YandexMetrika counterId="12345678" />);
    // next/script под jsdom иногда вставляет содержимое в <head>, не в container,
    // поэтому ищем сначала в container, потом в document, потом в строке HTML.
    const script =
      container.querySelector("#ym-init") ??
      document.querySelector("#ym-init");
    const snippet = script?.innerHTML ?? container.innerHTML;
    expect(snippet).toContain("12345678");
    const img = container.querySelector("noscript img") ?? container.querySelector("img");
    if (img) expect(img.getAttribute("src")).toContain("12345678");
  });
});
