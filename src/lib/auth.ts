import NextAuth from "next-auth";
import { buildNodeConfig } from "@/lib/auth/config.node";

export const { handlers, signIn, signOut, auth } = NextAuth(buildNodeConfig);
