import sharp from "sharp";

export const MAX_SIDE = 2560;
export const WEBP_QUALITY = 85;

export type NormalizedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
};

// Порядок важен:
//   .rotate() — читает EXIF orientation, физически крутит пиксели, потом EXIF дропается.
//   .resize(... fit: "inside") — сохраняет пропорции, не выходит за MAX_SIDE x MAX_SIDE.
//   .withoutEnlargement — мелкие картинки не апскейлятся.
//   .webp({ quality: 85 }) — без { animated: true } берёт первый кадр у animated GIF.
export async function normalizeToWebp(input: Buffer): Promise<NormalizedImage> {
  const buffer = await sharp(input)
    .rotate()
    .resize({
      width: MAX_SIDE,
      height: MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("normalizeToWebp: missing dimensions in output");
  }
  return {
    buffer,
    width: meta.width,
    height: meta.height,
    size: buffer.byteLength,
  };
}
