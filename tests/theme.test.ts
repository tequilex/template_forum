import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateTokensCss, REQUIRED_TOKENS } from "../scripts/check-theme";

describe("theme tokens contract", () => {
  it("detects missing tokens in :root and .dark blocks", () => {
    const css = `:root { --color-background: 0 0% 100%; }`;
    const result = validateTokensCss(css);
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("accepts a complete tokens.css", () => {
    const fullCss = buildFullCss();
    const result = validateTokensCss(fullCss);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("validates actual theme/tokens.css from the repo", () => {
    const css = readFileSync(join(__dirname, "..", "theme", "tokens.css"), "utf8");
    const result = validateTokensCss(css);
    expect(result.ok, `missing tokens: ${result.missing.join(", ")}`).toBe(true);
  });
});

function buildFullCss() {
  const lightVars = REQUIRED_TOKENS.map(t => `  ${t}: 0 0% 0%;`).join("\n");
  const darkVars = lightVars;
  return `:root {\n${lightVars}\n}\n.dark {\n${darkVars}\n}`;
}
