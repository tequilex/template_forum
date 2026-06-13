import { fileTypeFromBuffer } from "file-type";

// TODO(plan-3+): добавить "image/heic"/"image/heif" если в проде поедут iPhone-юзеры,
// которым автоконверсия Safari не помогла. Подключение через `heic-convert` — аддитивно.
export const ACCEPTED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
] as const;

export type AcceptedMime = typeof ACCEPTED_MIME[number];

export async function detectMime(buf: Buffer): Promise<AcceptedMime | null> {
  if (buf.byteLength === 0) return null;
  const result = await fileTypeFromBuffer(buf);
  if (!result) return null;
  return (ACCEPTED_MIME as readonly string[]).includes(result.mime)
    ? (result.mime as AcceptedMime)
    : null;
}
