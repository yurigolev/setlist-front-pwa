# GitHub Actions → VPS

Workflow: `.github/workflows/frontend.yml`.

1. Pull Request: `npm ci`, тесты и production-сборка.
2. Push в `main`: те же проверки, затем Docker-сборка на GitHub runner.
3. Образ публикуется как `ghcr.io/yurigolev/setlist-front-pwa:<commit SHA>`.
4. Runner подключается к серверу по SSH и вызывает `sudo /usr/local/sbin/setlist-deploy frontend <commit SHA>`.

Ручной повтор: `Actions → Frontend → Run workflow`, ветка `main`. Старые релизы повторно запускать только как осознанный откат. Релизы во время выступления не запускать.

В репозитории `Settings → Secrets and variables → Actions`:

| Имя | Тип | Значение |
| --- | --- | --- |
| `DEPLOY_HOST` | Variable | IP или hostname VPS |
| `DEPLOY_USER` | Variable | SSH-пользователь CI |
| `DEPLOY_PORT` | Variable | SSH-порт, по умолчанию 22 |
| `DEPLOY_SSH_KEY` | Secret | Отдельный приватный SSH-ключ CI |
| `DEPLOY_KNOWN_HOSTS` | Secret | Проверенные SSH host keys сервера |

Пароли приложения, PostgreSQL и MinIO находятся в серверном `.env`; в Git и Docker-образ они не входят. Доступ к GHCR нужен серверу, если пакеты приватные. Для публичных пакетов чтение возможно без авторизации.

Production Compose и серверный deploy-скрипт находятся в backend-репозитории. Сервер использует готовый образ; установка npm-зависимостей и сборка выполняются на GitHub runner. `VITE_API_BASE_URL` пустой: браузер обращается к `/v1` на том же origin, Nginx проксирует запросы в `api:3000`. `/health` проверяет также доступность API.

Сейчас предусмотрен HTTP по IP. Полноценная установка PWA, service worker и офлайн-оболочка на телефоне требуют HTTPS. После появления домена нужно включить HTTPS и синхронизировать песни на новом origin: IndexedDB привязан к адресу сайта.

Локальные проверки с production-origin:

```bash
VITE_API_BASE_URL= npm test
VITE_API_BASE_URL= npm run build
```

Пустая переменная исключает влияние локального `.env.local` на тесты относительных API URL.
