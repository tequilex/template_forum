import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Yandex from "next-auth/providers/yandex";
import GitHub from "next-auth/providers/github";
import { getEnv } from "@/lib/env";
import VK from "@/lib/auth/providers/vk";

export function buildEdgeConfig(): NextAuthConfig {
  const env = getEnv();
  const providers: NextAuthConfig["providers"] = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push(Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }));
  }
  if (env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET) {
    providers.push(Yandex({ clientId: env.YANDEX_CLIENT_ID, clientSecret: env.YANDEX_CLIENT_SECRET }));
  }
  if (env.VK_CLIENT_ID && env.VK_CLIENT_SECRET) {
    providers.push(VK({ clientId: env.VK_CLIENT_ID, clientSecret: env.VK_CLIENT_SECRET }));
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.push(GitHub({ clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }));
  }

  return {
    providers,
    session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
    secret: env.NEXTAUTH_SECRET,
    pages: { signIn: "/login" },
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        session.user.username = user.username ?? null;
        session.user.role = user.role ?? "user";
        session.user.bannedAt = user.bannedAt ?? null;
        return session;
      },
    },
  };
}
