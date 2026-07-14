# foxgeek — Disaster Recovery

> Восстановление БД из бэкапа в Timeweb S3 Cold (bucket из `BACKUP_S3_BUCKET`).

## 1. Получить последний дамп

На VPS (или с локалки, если у тебя есть credentials):

```bash
# Установить aws-cli если ещё нет
sudo apt install awscli

# Указать credentials BACKUP_S3_* (значения — из .env)
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=ru-1

# Список доступных дампов
aws --endpoint-url=https://s3.twcstorage.ru s3 ls s3://<cold-bucket-uuid>/db/

# Скачать нужный
aws --endpoint-url=https://s3.twcstorage.ru s3 cp \
  s3://<cold-bucket-uuid>/db/backup-2026-06-29-0300.sql.gz /tmp/restore.sql.gz
```

## 2. Восстановление в **новую** БД (рекомендуемый дрилл)

Никогда не накатывайте дамп поверх живой БД без проверки. Сначала восстанавливайте в отдельную:

```bash
# Поднять только db-контейнер
docker compose up -d db
docker compose exec db psql -U app -d postgres -c "CREATE DATABASE restore_test;"

gunzip -c /tmp/restore.sql.gz | docker compose exec -T db psql -U app -d restore_test

# Проверить counts
docker compose exec db psql -U app -d restore_test -c "
  SELECT 'users' AS table, count(*) FROM users
  UNION ALL SELECT 'posts', count(*) FROM posts
  UNION ALL SELECT 'comments', count(*) FROM comments;
"
```

Counts должны быть близки к prod (учитывая ~24h окно с момента дампа).

## 3. Восстановление поверх боевой БД

**ВНИМАНИЕ:** деструктивно. Делай только если живая БД корраптнута и/или потеряна.

```bash
docker compose stop app

# Дроп текущей БД
docker compose exec db psql -U app -d postgres -c "DROP DATABASE app;"
docker compose exec db psql -U app -d postgres -c "CREATE DATABASE app;"

gunzip -c /tmp/restore.sql.gz | docker compose exec -T db psql -U app -d app

docker compose start app
# Миграции применятся автоматически при старте app (entrypoint),
# если дамп старше последней миграции.
```

## 4. Recovery drill (раз в квартал)

Минимум раз в 3 месяца:

1. Скачать последний дамп из S3
2. Восстановить в отдельную БД (`restore_test`) по §2
3. Сравнить counts с production
4. Дропнуть `restore_test`
5. Записать дату/результат в `docs/RECOVERY.md` (этот же файл, секция «История drill'ов» ниже)

## История drill'ов

| Дата | Дамп | Counts (restore vs prod) | Кто | Заметки |
|---|---|---|---|---|
| 2026-06-29 | local-drill (synthetic) | users=4, posts=84, comments=354 — совпали | tequilex | первый прогон в plan-06 |
