import { S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_client) return _client;
  const env = getEnv();
  if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 not configured");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function r2Bucket(): string {
  const env = getEnv();
  if (!env.R2_BUCKET) throw new Error("R2_BUCKET not set");
  return env.R2_BUCKET;
}

export function _resetR2ClientForTests(): void {
  _client = null;
}
