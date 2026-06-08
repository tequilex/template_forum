import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: "./drizzle/migrations" });
await pool.end();
console.log("Migrations applied");
