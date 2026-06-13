// Usage:
//   pnpm cleanup:orphans                      — реально удаляет
//   pnpm cleanup:orphans --dry-run            — только логи
//   pnpm cleanup:orphans --older-than-days=3  — переопределить порог
//
// TODO(plan-6): обвязать cron в docker-compose (отдельный sidecar контейнер
// `node --loader tsx scripts/cleanup-orphan-uploads.ts` по расписанию).

import { and, isNull, lt, eq } from "drizzle-orm";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { getDb } from "@/lib/db";
import { uploads } from "@db/schema";
import { getR2Client, r2Bucket } from "@/lib/storage/r2";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const olderArg = argv.find(a => a.startsWith("--older-than-days="));
const olderDays = olderArg ? Number(olderArg.split("=")[1]) : 7;

if (!Number.isFinite(olderDays) || olderDays < 0) {
  console.error("[cleanup] invalid --older-than-days");
  process.exit(1);
}

async function main() {
  const cutoff = new Date(Date.now() - olderDays * 24 * 60 * 60 * 1000);
  const db = getDb();

  const rows = await db
    .select({ id: uploads.id, key: uploads.key })
    .from(uploads)
    .where(and(isNull(uploads.postId), lt(uploads.createdAt, cutoff)));

  console.log(`[cleanup] found ${rows.length} orphan(s) older than ${olderDays}d`);

  if (dryRun) {
    for (const r of rows) console.log(`  DRY  ${r.id}  ${r.key}`);
    console.log("[cleanup] dry-run: no changes");
    return;
  }

  // R2 client init только в реальной ветке — чтобы --dry-run работал без R2 credentials.
  const r2 = getR2Client();
  const bucket = r2Bucket();

  let deleted = 0;
  const errors: Array<{ id: string; err: string }> = [];

  for (const r of rows) {
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: r.key }));
      await db.delete(uploads).where(eq(uploads.id, r.id));
      deleted += 1;
      console.log(`  DEL  ${r.id}  ${r.key}`);
    } catch (e) {
      errors.push({ id: r.id, err: String(e) });
      console.error(`  ERR  ${r.id}  ${r.key}  →  ${String(e)}`);
    }
  }

  console.log(JSON.stringify({ found: rows.length, deleted, errors: errors.length }));
}

main().then(() => process.exit(0)).catch(e => {
  console.error("[cleanup] fatal:", e);
  process.exit(1);
});
