import type { NextConfig } from "next";

type Pattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

// Аватарки OAuth-провайдеров. Это не пользовательский контент —
// домены фиксированы для всего жизненного цикла приложения.
const oauthAvatarHosts: Pattern[] = [
  { protocol: "https", hostname: "avatars.yandex.net" },
  { protocol: "https", hostname: "sun*.userapi.com" },
  { protocol: "https", hostname: "*.vk.com" },
];

// Демо-сид (scripts/seed-demo.ts) кладёт picsum.photos URL'ы в coverUrl и в
// inline-картинки внутри content. Только для dev/демо — реальные посты
// обязаны хранить картинки в R2 через /api/upload. Убрать при чистке prod-конфига.
const demoImageHosts: Pattern[] = [
  { protocol: "https", hostname: "picsum.photos" },
  { protocol: "https", hostname: "fastly.picsum.photos" },
];

const r2Public = process.env.R2_PUBLIC_BASE;
const remotePatterns: Pattern[] = [...oauthAvatarHosts, ...demoImageHosts];

if (r2Public) {
  try {
    const u = new URL(r2Public);
    remotePatterns.push({
      protocol: u.protocol.replace(":", "") as "https" | "http",
      hostname: u.hostname,
    });
  } catch {
    // Игнорим невалидный R2_PUBLIC_BASE — getEnv() в рантайме поймает.
  }
}

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  images: { remotePatterns },
};

export default config;
