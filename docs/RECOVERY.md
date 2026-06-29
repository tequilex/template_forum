# Skelet — Disaster Recovery

> Восстановление БД из бэкапа в S3 Cold (`skelet-backups`).

## 1. Получить последний дамп

На VPS (или с локалки, если у тебя есть credentials):

```bash
# Установить aws-cli если ещё нет
sudo apt install awscli

# Указать credentials BACKUP_S3_*
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=ru-central1

# Список доступных дампов
aws --endpoint-url=https://s3.timeweb.cloud s3 ls s3://skelet-backups/db/

# Скачать нужный
aws --endpoint-url=https://s3.timeweb.cloud s3 cp \
  s3://skelet-backups/db/backup-2026-06-29-0300.sql.gz /tmp/restore.sql.gz
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

# Применить миграции (если дамп старше последней миграции — есть шанс что они захардкодены в дампе; если нет — pnpm db:migrate)
docker compose exec app pnpm db:migrate

docker compose start app
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
| _(в первый прогон вписать)_ |  |  |  |  |
