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
  auth: {
    loginTitle: "Войти",
    loginSubtitle: "Выберите сервис для входа",
    noProviders: "OAuth-провайдеры не настроены. Заполните CLIENT_ID/SECRET в .env.",
    signOut: "Выйти",
    chooseUsername: "Выбери ник",
    welcomeTitle: "Придумайте username",
    welcomeHint: "3–20 символов: латиница, цифры, _ и -. Это часть адреса вашего профиля.",
    welcomeSubmit: "Сохранить",
    errorFormat: "Неправильный формат username",
    errorReserved: "Этот username зарезервирован",
    errorTaken: "Этот username уже занят",
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
