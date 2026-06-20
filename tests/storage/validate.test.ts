// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectMime } from "@/lib/images/validate";

const fix = (name: string) =>
  readFileSync(join(process.cwd(), "tests/fixtures/images", name));

describe("detectMime", () => {
  it("recognizes jpeg by magic bytes", async () => {
    expect(await detectMime(fix("small.jpg"))).toBe("image/jpeg");
  });
  it("recognizes png", async () => {
    expect(await detectMime(fix("small.png"))).toBe("image/png");
  });
  it("recognizes webp", async () => {
    expect(await detectMime(fix("small.webp"))).toBe("image/webp");
  });
  it("recognizes gif", async () => {
    expect(await detectMime(fix("animated.gif"))).toBe("image/gif");
  });
  it("returns null for plain text", async () => {
    expect(await detectMime(fix("not-an-image.txt"))).toBeNull();
  });
  it("returns null for empty buffer", async () => {
    expect(await detectMime(Buffer.alloc(0))).toBeNull();
  });
});
