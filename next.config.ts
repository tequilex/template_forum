import type { NextConfig } from "next";

type Pattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

// Аватарки OAuth-провайдеров. Это не пользовательский контент —
// домены фиксированы для всего жизненного цикла приложения.
const oauthAvatarHosts: Pattern[] = [
  { protocol: "https", hostname: "avatars.yandex.net" },
  { protocol: "https", hostname: "sun*.userapi.com" },
  { protocol: "https", hostname: "*.vk.com" },
];

const storagePublic = process.env.STORAGE_PUBLIC_BASE;
const remotePatterns: Pattern[] = [...oauthAvatarHosts];

if (storagePublic) {
  try {
    const u = new URL(storagePublic);
    remotePatterns.push({
      protocol: u.protocol.replace(":", "") as "https" | "http",
      hostname: u.hostname,
    });
  } catch {
    // Игнорим невалидный STORAGE_PUBLIC_BASE — getEnv() в рантайме поймает.
  }
}

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  images: { remotePatterns },
};

export default config;
