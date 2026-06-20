import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Paginator } from "@/components/feed/Paginator";

describe("Paginator", () => {
  it("на первой странице кнопка «Назад» disabled (отсутствует)", () => {
    render(<Paginator basePath="/" currentPage={1} totalPages={5} />);
    expect(screen.queryByRole("link", { name: /Назад/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Вперёд/ })).toBeInTheDocument();
  });

  it("на средней странице видны обе кнопки", () => {
    render(<Paginator basePath="/" currentPage={3} totalPages={5} />);
    expect(screen.getByRole("link", { name: /Назад/ })).toHaveAttribute("href", "/?page=2");
    expect(screen.getByRole("link", { name: /Вперёд/ })).toHaveAttribute("href", "/?page=4");
  });

  it("на последней странице кнопка «Вперёд» disabled (отсутствует)", () => {
    render(<Paginator basePath="/" currentPage={5} totalPages={5} />);
    expect(screen.getByRole("link", { name: /Назад/ })).toHaveAttribute("href", "/?page=4");
    expect(screen.queryByRole("link", { name: /Вперёд/ })).toBeNull();
  });

  it("при totalPages=1 ничего не рендерит", () => {
    const { container } = render(<Paginator basePath="/" currentPage={1} totalPages={1} />);
    expect(container.firstChild).toBeNull();
  });
});
