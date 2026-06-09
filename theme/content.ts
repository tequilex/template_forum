export const content = {
  site: {
    name: "Skelet",
    shortName: "Skelet",
    tagline: "Сообщество (тестовая ниша)",
    description: "Тестовый инстанс скелета. Замените текстами своей ниши в theme/content.ts.",
  },
  nav: {
    home: "Лента",
    new: "Написать пост",
    tags: "Темы",
    login: "Войти",
  },
  empty: {
    feed: "Пока нет постов. Будьте первым!",
    drafts: "У вас нет черновиков",
    tag: "Постов по этой теме пока нет",
  },
  footer: {
    about: "О проекте",
    rules: "Правила",
    contacts: "Контакты",
  },
  consent: {
    text: "Сайт использует cookies для аналитики.",
    accept: "Принять",
    decline: "Только необходимые",
  },
  copyright: `© ${new Date().getFullYear()} Skelet`,
} as const;

export type ContentSchema = typeof content;
