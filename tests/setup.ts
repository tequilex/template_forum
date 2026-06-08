process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://app:test@localhost:5432/app";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "x".repeat(32);
