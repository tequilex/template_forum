import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";
import { content } from "@theme/content";

describe("<Footer>", () => {
  it("содержит disclaimer и ссылку на /privacy", () => {
    const { container, getByText } = render(<Footer />);
    expect(container.textContent).toContain(content.footer.disclaimer);
    const link = getByText(content.footer.privacyLink) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/privacy");
  });
});
