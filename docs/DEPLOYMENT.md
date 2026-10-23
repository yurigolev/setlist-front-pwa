# GitHub Actions → VPS

Workflow: `.github/workflows/frontend.yml`.

1. Pull Request: `npm ci`, тесты и production-сборка.
2. Push в `main`: те же проверки, затем Docker-сборка на GitHub runner.
3. Образ публикуется как `ghcr.io/yurigolev/setlist-front-pwa:<commit SHA>`.
4. Runner подключается к серверу по SSH и вызывает `sudo /usr/local/sbin/setlist-deploy frontend <commit SHA>`.

Ручной повтор: `Actions → Frontend → Run workflow`, ветка `main`. Старые релизы повторно запускать только как осознанный откат. Релизы во время выступления не запускать.

В репозитории `Settings → Secrets and variables → Actions`:

| Имя                  | Тип      | Значение                          |
| -------------------- | -------- | --------------------------------- |
| `DEPLOY_HOST`        | Variable | IP или hostname VPS               |
| `DEPLOY_USER`        | Variable | SSH-пользователь CI               |
| `DEPLOY_PORT`        | Variable | SSH-порт, по умолчанию 22         |
| `DEPLOY_SSH_KEY`     | Secret   | Отдельный приватный SSH-ключ CI   |
| `DEPLOY_KNOWN_HOSTS` | Secret   | Проверенные SSH host keys сервера |

Пароли приложения, PostgreSQL и MinIO находятся в серверном `.env`; в Git и Docker-образ они не входят. Доступ к GHCR нужен серверу, если пакеты приватные. Для публичных пакетов чтение возможно без авторизации.

Production Compose и серверный deploy-скрипт находятся в backend-репозитории. Сервер использует готовый образ; установка npm-зависимостей и сборка выполняются на GitHub runner. `VITE_API_BASE_URL` пустой: браузер обращается к `/v1` на том же origin, Nginx проксирует запросы в `api:3000`. `/health` проверяет также доступность API.

Production доступен по `https://setlivo.ru`. Caddy принимает порты 80/443, перенаправляет HTTP на HTTPS и автоматически обновляет сертификат. Nginx доступен с хоста только на `127.0.0.1:8080`, API и хранилища — внутри Docker-сети. `PWA_ORIGIN=https://setlivo.ru`. После перехода с IP нужно синхронизировать песни на новом origin: IndexedDB привязан к адресу сайта. HTTPS позволяет установку PWA, service worker и офлайн-оболочку на телефоне.

Локальные проверки с production-origin:

```bash
VITE_API_BASE_URL= npm test
VITE_API_BASE_URL= npm run build
```

Пустая переменная исключает влияние локального `.env.local` на тесты относительных API URL.

## Авторизация с refresh

Первый выпуск Яндекс/сет-листов требует подготовки production credentials и явного назначения владельца старой библиотеки. Проверка копии данных, план назначения и порядок выпуска описаны в backend `docs/SAFE_RELEASE.md`. Deploy обновляет только image: новый production Compose и deploy-скрипт устанавливаются отдельно. Frontend выпускается после backend, назначения владельца и проверки его доступа к старым песням/файлам.

Сначала backend с миграцией `0007_refresh_sessions.sql`, затем frontend. Миграция добавляет семейства refresh и nullable связь с существующими access-сессиями; уже выданные cookies сохраняют исходный срок. Действующий legacy access обновлённый клиент преобразует в пару через защищённый backend bootstrap.

Backend defaults: access (`AUTH_SESSION_TTL_SECONDS`) — 900 секунд, refresh (`AUTH_REFRESH_TTL_SECONDS`) — 7776000 секунд. Refresh ротируется с продлением на 90 дней; параметры задаются на сервере. Клиент использует один `useAuthSession`, HttpOnly cookies и CSRF в памяти. При истечении refresh пользователь снова входит через Яндекс, а скачанные файлы сохраняются для того же аккаунта. Logout и подтверждённый отзыв доступа очищают приватные данные.

Реализация и disposable QA не означают deployment или миграцию существующих production/local данных. Выпуск выполняется отдельно в выбранной среде по её штатной процедуре.
