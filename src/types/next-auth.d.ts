import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    username?: string | null;
    role?: "user" | "moderator" | "admin";
    bannedAt?: Date | null;
    banReason?: string | null;
    bio?: string | null;
  }

  interface Session {
    user: {
      id: string;
      username: string | null;
      role: "user" | "moderator" | "admin";
      bannedAt: Date | null;
      banReason: string | null;
    } & DefaultSession["user"];
  }
}
