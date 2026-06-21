import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Route } from "next";
import { render, screen } from "@testing-library/react";
import { LeftNav } from "@/components/layout/LeftNav";

const aliceHref = "/u/alice" as Route;
const welcomeHref = "/welcome" as Route;

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

describe("LeftNav", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReset();
  });

  it("отмечает «Лента» active на /", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<LeftNav profileHref={aliceHref} isAuthed={false} />);
    const feedLink = screen.getByRole("link", { name: /Лента/ });
    expect(feedLink.getAttribute("aria-current")).toBe("page");
  });

  it("отмечает «Темы» active на /tags и /t/[slug]", () => {
    vi.mocked(usePathname).mockReturnValue("/t/design");
    render(<LeftNav profileHref={aliceHref} isAuthed={false} />);
    const tagsLink = screen.getByRole("link", { name: /Темы/ });
    expect(tagsLink.getAttribute("aria-current")).toBe("page");
  });

  it("отмечает «Драфты» active на /drafts", () => {
    vi.mocked(usePathname).mockReturnValue("/drafts");
    render(<LeftNav profileHref={aliceHref} isAuthed={false} />);
    const draftsLink = screen.getByRole("link", { name: /Драфты/ });
    expect(draftsLink.getAttribute("aria-current")).toBe("page");
  });

  it("при profileHref=/welcome ведёт на welcome (юзер без username)", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<LeftNav profileHref={welcomeHref} isAuthed={false} />);
    const profileLink = screen.getByRole("link", { name: /Профиль/ });
    expect(profileLink.getAttribute("href")).toBe("/welcome");
  });
});
