# Скелет блог-платформы

Документ-точка-входа. Полная спецификация дизайна — в [docs/superpowers/specs/2026-06-05-skelet-blog-design.md](superpowers/specs/2026-06-05-skelet-blog-design.md).

## Кратко

Переиспользуемый скелет блог/форум-платформы (vc.ru / drive2.ru стиль) под несколько ниш. Каждая ниша = отдельный git-репо + VPS + БД. Кастомизация через папку `theme/` + `.env`.

## Стек

- **Frontend + Backend:** Next.js 15 (App Router, Server Components, Server Actions)
- **БД:** Postgres 16 (self-hosted в docker-compose) + Drizzle ORM
- **Auth:** Auth.js v5, OAuth-only (Google, Yandex, VK, GitHub)
- **Storage:** Cloudflare R2 (S3-совместимый)
- **Дизайн-система:** Tailwind + CSS-переменные (shadcn/ui-стиль)
- **Редактор:** Editor.js (тот же, что у vc.ru)
- **Хостинг:** Hetzner VPS + Caddy + Docker Compose
- **Аналитика:** Yandex.Metrika
- **SEO:** SSR/ISR + IndexNow + sitemap + JSON-LD

## Фазы

- **Фаза 1 (MVP):** регистрация, посты, лента, страница поста (SEO), теги, профиль, картинки, лёгкая модерация, плоские комменты
- **Фаза 2:** лайки, треды в комментах, поиск, RSS
- **Фаза 3:** подписки, персональная лента, email-дайджесты, расширенная модерация, уведомления

## Следующие шаги

1. Прогнать дизайн через ревьюер-агента (выявить дыры в спеке).
2. Ты сам проверишь итоговый документ.
3. Написать implementation plan фазы 1 (через skill `writing-plans`) — пошаговый план задач.
4. Приступать к реализации.

## Контракт переиспользования (главное правило)

Код в `src/` **не знает о нише**. Все строки и стили берутся из `theme/`. Правки кода — только в upstream-репо скелета, дальше `git merge upstream/main` во все ниши.
