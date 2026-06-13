import type { NextConfig } from "next";

const r2Public = process.env.R2_PUBLIC_BASE;
let remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

if (r2Public) {
  try {
    const u = new URL(r2Public);
    remotePatterns = [{
      protocol: u.protocol.replace(":", "") as "https" | "http",
      hostname: u.hostname,
    }];
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
