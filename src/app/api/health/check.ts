import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export interface HealthResult {
  status: "ok" | "degraded";
  db: "ok" | "error";
}

export async function checkHealth(db: NodePgDatabase): Promise<HealthResult> {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "ok", db: "ok" };
  } catch {
    return { status: "degraded", db: "error" };
  }
}
