import { sql } from "drizzle-orm";
import type { db as Db } from "@/lib/db";

export interface HealthResult {
  status: "ok" | "degraded";
  db: "ok" | "error";
}

export async function checkHealth(db: typeof Db): Promise<HealthResult> {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "ok", db: "ok" };
  } catch {
    return { status: "degraded", db: "error" };
  }
}
