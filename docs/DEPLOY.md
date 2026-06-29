# Skelet — Deployment Guide

> Целевая платформа: **Timeweb Cloud VPS** 1×5GHz / 1GB / 15GB. Один сервер,
> docker-compose (caddy + app + db + backup), Let's Encrypt автоматически.

## 0. Pre-deploy smoke (на локальной машине)

Перед первым деплоем и перед каждым релизом:

1. `pnpm test` — зелёно
2. `pnpm tsc --noEmit` — зелёно
3. `pnpm build` — production-сборка локально прошла
4. `docker compose build app` — Docker-сборка локально проходит
5. (Опционально) Создать `.env.prod-test` с реальными prod-кредами Timeweb S3 + локальной БД, запустить `docker compose --env-file .env.prod-test up -d` и проверить:
   - `/` открывается, видны посты
   - `/p/[slug]` → JSON-LD в DOM, OG-meta в head
   - Upload через `/new` идёт в Timeweb
   - `/sitemap.xml`, `/robots.txt`, `/api/health`, `/og/[slug]`, `/privacy` отвечают корректно
   - Метрика в DOM (если `YANDEX_METRIKA_ID` указан и `NODE_ENV=production`)

Только после зелёного — деплой.

## 1. Создаём VPS на Timeweb

1. timeweb.cloud → Cloud Servers → Create
2. Образ: Ubuntu 22.04 LTS / 24.04 LTS
3. Тариф: **1×5GHz / 1GB / 15GB / 200 Мбит** (825 ₽/мес)
4. Сеть: IPv4 (+ 180 ₽/мес) + IPv6, **без приватной сети**
5. SSH-ключ: загрузить свой публичный ключ заранее (Profile → SSH keys)
6. Нажать Create. Через ~60 секунд VPS готов; запиши публичный IPv4.

## 2. DNS

У регистратора домена создать:

- A-запись `example.ru` → `<IPv4>`
- A-запись `www.example.ru` → `<IPv4>`
- (опц.) AAAA-записи на IPv6

TTL — оставить дефолтным. DNS пропагируется 5–60 минут; проверка:
```bash
dig +short example.ru
```

## 3. Первый вход на VPS

```bash
ssh root@<IP>
```

### 3.1. Базовая настройка

```bash
# Обновить пакеты
apt update && apt upgrade -y

# Создать non-root юзера
adduser skelet
usermod -aG sudo skelet
mkdir -p /home/skelet/.ssh
cp /root/.ssh/authorized_keys /home/skelet/.ssh/
chown -R skelet:skelet /home/skelet/.ssh
chmod 700 /home/skelet/.ssh
chmod 600 /home/skelet/.ssh/authorized_keys

# Запретить root-вход и пароли (по желанию, после проверки что skelet логинится)
# Редактировать /etc/ssh/sshd_config:
#   PermitRootLogin no
#   PasswordAuthentication no
# systemctl reload ssh
```

### 3.2. Установить Docker + compose plugin

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker skelet
# logout / login заново
```

Проверка:
```bash
docker version
docker compose version
```

### 3.3. Firewall (по желанию — UFW)

```bash
sudo apt install ufw
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 4. Деплой кода

```bash
ssh skelet@<IP>
git clone https://github.com/<you>/skelet.git
cd skelet
```

Создать `.env` на VPS (НЕ коммитим в git):

```bash
nano .env
```

Заполнить по `.env.example`. Сгенерировать секреты заранее на локалке:

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -base64 24   # DB_PASSWORD
openssl rand -hex 16      # INDEXNOW_KEY
```

`DOMAIN=example.ru`, `LETSENCRYPT_EMAIL=<твой email>`, `NEXTAUTH_URL=https://example.ru`,
`STORAGE_ENDPOINT=https://s3.timeweb.cloud`, `STORAGE_BUCKET=skelet-images`, ...

## 5. Создать S3-buckets в Timeweb

### 5.1. `skelet-images` (Standard)

1. Timeweb → S3 Storage → Create bucket
2. Name: `skelet-images`, Type: Standard, Public read: yes
3. CORS — разрешить `PUT` от `https://example.ru`:
   ```json
   [{
     "AllowedOrigins": ["https://example.ru"],
     "AllowedMethods": ["PUT", "GET", "HEAD"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }]
   ```
4. Service users → Create → права на bucket → запиши access/secret в `.env`
   (`STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`)
5. `STORAGE_PUBLIC_BASE=https://skelet-images.s3.timeweb.cloud`

### 5.2. `skelet-backups` (Cold)

1. Create bucket → name: `skelet-backups`, Type: **Cold**
2. Lifecycle policy: delete objects older than **30 days**
3. Service users → отдельный (минимальные права: только `s3:PutObject` на этот bucket)
4. Запиши access/secret в `.env` (`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`)

## 6. Создать OAuth-приложения (prod)

Для каждого провайдера (Yandex, VK) создать prod-приложение с redirect URI:
- `https://example.ru/api/auth/callback/yandex`
- `https://example.ru/api/auth/callback/vk`

Записать `CLIENT_ID` / `CLIENT_SECRET` в `.env`.

## 7. Запуск

```bash
docker compose up -d
docker compose ps
docker compose logs -f caddy   # увидеть процесс получения сертификата
```

Сертификат получается автоматически ~30–60 секунд после первого запроса. Если в логах
`acme: error...` — проверь:
- DNS уже указывает на VPS (`dig +short example.ru`)
- 80/443 открыты на firewall'е (`curl -I http://example.ru` снаружи)

Применить миграции БД:
```bash
docker compose exec app pnpm db:migrate
```

(или они применяются автоматически — зависит от Dockerfile entrypoint; см. `scripts/entrypoint.sh`).

Открыть `https://example.ru` — должен открыться сайт.

## 8. Post-deploy ручные шаги

### 8.1. IndexNow verification file

На VPS:
```bash
cd skelet
echo "$INDEXNOW_KEY" > "public/${INDEXNOW_KEY}.txt"
git add "public/${INDEXNOW_KEY}.txt"
git commit -m "chore: add IndexNow verification file"
# Перезапустить app, чтобы файл попал в next-сборку
docker compose up -d --build app
```

Проверить:
```bash
curl https://example.ru/${INDEXNOW_KEY}.txt
# Ожидание: значение того же ключа
```

### 8.2. Yandex.Metrika

1. metrica.yandex.ru → создать счётчик
2. Записать ID в `.env` (`YANDEX_METRIKA_ID=...`)
3. `docker compose up -d --build app`
4. В DevTools Network на любой странице должен загружаться `mc.yandex.ru/metrika/tag.js`

### 8.3. Yandex Webmaster

1. webmaster.yandex.ru → Add site → `example.ru`
2. Verify: метод HTML-file → дают файл `yandex_<hash>.html` → положить в `public/` → redeploy
3. Submit sitemap: `https://example.ru/sitemap.xml`

### 8.4. Google Search Console

1. search.google.com/search-console → Add property → URL prefix → `https://example.ru`
2. Verify: метод HTML-file → положить файл в `public/` → redeploy
3. Submit sitemap: `https://example.ru/sitemap.xml`

### 8.5. UptimeRobot + Telegram

1. uptimerobot.com → регистрация (free)
2. Telegram: `/newbot` у @BotFather → имя `skelet_status_bot` → токен
3. У `@userinfobot` `/start` → твой `chat_id`
4. UptimeRobot → My Settings → Add Alert Contact → **Webhook**
   - Friendly name: `Telegram`
   - URL: `https://api.telegram.org/bot<BOT_TOKEN>/sendMessage`
   - POST body type: `JSON`
   - POST value: `{"chat_id":"<CHAT_ID>","text":"*alertTypeFriendlyName* - *monitorFriendlyName* (*alertDetails*)"}`
5. Add Monitor → HTTP(s)
   - Friendly name: `skelet`
   - URL: `https://example.ru/api/health`
   - Monitoring interval: 5 min, Timeout: 30s
   - Alert when: 2 consecutive failures
   - Alert Contacts: только что созданный Webhook
6. Test alert: pause monitor → ждать 5 минут → должен прилететь в Telegram.

## 9. Регулярные операции

### Обновление кода

```bash
ssh skelet@<IP>
cd skelet
git pull
docker compose up -d --build app
# Если изменялась схема:
docker compose exec app pnpm db:migrate
```

### Просмотр логов

```bash
docker compose logs -f --tail=200 app
docker compose logs -f --tail=200 caddy
docker compose logs -f --tail=200 backup
```

### Проверка бэкапов

В Timeweb S3 Cold кабинете → `skelet-backups/db/` → должен появляться новый файл каждое утро ~03:00 MSK.

## 10. Что делать при OOM на сборке

`pnpm build` на 1GB VPS может упасть в OOM. Добавить swap:

```bash
sudo fallocate -l 3G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

После этого `docker compose up -d --build app` должно проходить. Если и со swap не идёт — апгрейд тарифа Timeweb до 2GB.

## 11. Troubleshooting

| Симптом | Возможная причина | Действие |
|---|---|---|
| `acme: 404` в Caddy | DNS не указывает на VPS | `dig +short example.ru` → должен быть IP VPS |
| Сайт открывается по HTTP, но не по HTTPS | 443 закрыт firewall'ом | `sudo ufw status` → разрешить 443 |
| Upload в admin падает 503 | `STORAGE_*` пустые / неправильные | `docker compose exec app printenv \| grep STORAGE` |
| Бэкапы не появляются в S3 | Не настроен `BACKUP_S3_*` или нет прав на bucket | `docker compose logs backup` |
| OG-картинка не рендерится | `next/og` падает в standalone | Smoke `curl -I https://example.ru/og/<slug>` — если 500, см. plan-06 risk #5 |

## 12. Восстановление из бэкапа

См. отдельный документ: [`docs/RECOVERY.md`](./RECOVERY.md).
