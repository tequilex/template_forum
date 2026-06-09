export const seo = {
  siteName: "Skelet",
  titleTemplate: (postTitle: string) => `${postTitle} — Skelet`,
  defaultTitle: "Skelet — сообщество",
  defaultDescription: "Тестовый инстанс блог-скелета.",
  themeColor: "#ffffff",
  locale: "ru_RU",
  ogDefault: "/og-default.png",
} as const;
