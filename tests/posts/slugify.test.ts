import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("latin lowercase passes through", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("RU → latin transliteration", () => {
    expect(slugify("Опыт работы")).toBe("opyt-raboty");
  });

  it("RU mixed with latin", () => {
    expect(slugify("Опыт с React")).toBe("opyt-s-react");
  });

  it("strips diacritics from latin (NFKD)", () => {
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
  });

  it("collapses multiple dashes and spaces", () => {
    expect(slugify("hello   ---   world")).toBe("hello-world");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("max length = 80, no trailing dash after truncate", () => {
    const long = "a".repeat(100);
    const out = slugify(long);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("-")).toBe(false);
  });

  it("digits preserved", () => {
    expect(slugify("React 19 features")).toBe("react-19-features");
  });

  it("empty input → empty string", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("only special chars → empty string", () => {
    expect(slugify("!!! ??? ...")).toBe("");
  });
});
