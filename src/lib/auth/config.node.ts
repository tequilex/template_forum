import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@db/schema";
import { buildEdgeConfig } from "@/lib/auth/config.edge";

export function buildNodeConfig(): NextAuthConfig {
  return {
    ...buildEdgeConfig(),
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
  };
}
