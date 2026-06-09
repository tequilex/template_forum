import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";

let _pool: Pool | null = null;
let _db: NodePgDatabase | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  _pool = new Pool({ connectionString: getEnv().DATABASE_URL });
  return _pool;
}

export function getDb(): NodePgDatabase {
  if (_db) return _db;
  _db = drizzle(getPool());
  return _db;
}
