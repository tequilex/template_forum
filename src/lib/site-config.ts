import { seo } from "@theme/seo";

export const siteConfig = {
  name: seo.siteName,
  url: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
} as const;
