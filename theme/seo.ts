export const seo = {
  siteName: "foxgeek",
  titleTemplate: (postTitle: string) => `${postTitle} — foxgeek`,
  defaultTitle: "foxgeek — сообщество",
  defaultDescription: "Тестовый инстанс блог-скелета.",
  themeColor: "#ffffff",
  locale: "ru_RU",
  ogDefault: "/og-default.png",
} as const;
