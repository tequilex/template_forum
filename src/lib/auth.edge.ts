import NextAuth from "next-auth";
import { buildEdgeConfig } from "@/lib/auth/config.edge";

export const { auth } = NextAuth(buildEdgeConfig);
