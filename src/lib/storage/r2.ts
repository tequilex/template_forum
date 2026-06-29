import { S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

let _client: S3Client | null = null;

// Имя getR2Client/r2Bucket историческое (изначально планировалась Cloudflare R2);
// фактически используется Timeweb S3. Переименование идентификаторов — отдельный chore.
export function getR2Client(): S3Client {
  if (_client) return _client;
  const env = getEnv();
  if (!env.STORAGE_ENDPOINT || !env.STORAGE_ACCESS_KEY_ID || !env.STORAGE_SECRET_ACCESS_KEY) {
    throw new Error("Storage not configured");
  }
  _client = new S3Client({
    region: "ru-central1",
    endpoint: env.STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function r2Bucket(): string {
  const env = getEnv();
  if (!env.STORAGE_BUCKET) throw new Error("STORAGE_BUCKET not set");
  return env.STORAGE_BUCKET;
}

export function _resetR2ClientForTests(): void {
  _client = null;
}
