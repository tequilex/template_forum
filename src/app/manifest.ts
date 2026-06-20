import type { MetadataRoute } from "next";
import { content } from "@theme/content";
import { seo } from "@theme/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: content.site.name,
    short_name: content.site.shortName ?? content.site.name,
    description: content.site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: seo.themeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
