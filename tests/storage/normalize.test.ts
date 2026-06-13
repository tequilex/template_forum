import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { normalizeToWebp, MAX_SIDE } from "@/lib/images/normalize";

const fix = (name: string) =>
  readFileSync(join(process.cwd(), "tests/fixtures/images", name));

// TODO(plan-3+): добавить кейс с реальной фикстурой EXIF orientation=6
// — sharp().rotate() без аргументов читает EXIF и физически крутит пиксели
// перед .webp() (EXIF после encode уже не сохраняется). Поэтому если поменять
// порядок (.webp().rotate()) — тест должен сломаться. Сейчас покрыто
// риском §10.5 спеки; полноценного теста нет из-за отсутствия фикстуры.
describe("normalizeToWebp", () => {
  it("downscales 4000x3000 → fits inside 2560x2560 (width-bound)", async () => {
    const out = await normalizeToWebp(fix("large.jpg"));
    expect(out.width).toBeLessThanOrEqual(MAX_SIDE);
    expect(out.height).toBeLessThanOrEqual(MAX_SIDE);
    expect(out.width).toBe(MAX_SIDE);
    expect(out.height).toBe(1920);
  });

  it("does NOT upscale 200x200", async () => {
    const out = await normalizeToWebp(fix("small.jpg"));
    expect(out.width).toBe(200);
    expect(out.height).toBe(200);
  });

  it("encodes output as WebP regardless of input format", async () => {
    const out = await normalizeToWebp(fix("small.png"));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
  });

  it("returns width/height matching sharp(output).metadata()", async () => {
    const out = await normalizeToWebp(fix("large.jpg"));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.width).toBe(out.width);
    expect(meta.height).toBe(out.height);
  });

  it("size matches buffer.byteLength", async () => {
    const out = await normalizeToWebp(fix("small.jpg"));
    expect(out.size).toBe(out.buffer.byteLength);
  });

  it("flattens animated GIF to static WebP (first frame)", async () => {
    const out = await normalizeToWebp(fix("animated.gif"));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.pages === undefined || meta.pages === 1).toBe(true);
  });
});
