import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";
import { getR2Client, r2Bucket } from "./r2";

export function buildKey(userId: string, ulid: string): string {
  return `uploads/${userId}/${ulid}.webp`;
}

export function buildPublicUrl(key: string): string {
  const env = getEnv();
  if (!env.STORAGE_PUBLIC_BASE) throw new Error("STORAGE_PUBLIC_BASE not set");
  const base = env.STORAGE_PUBLIC_BASE.replace(/\/$/, "");
  return `${base}/${key}`;
}

export async function putObject(opts: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await getR2Client().send(new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: opts.key,
    Body: opts.body,
    ContentType: opts.contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
}
