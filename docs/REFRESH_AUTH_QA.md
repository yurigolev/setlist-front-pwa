# Refresh authentication QA — 12 октября 2026

## Реализация

Собственные access/refresh tokens в HttpOnly cookies. Access по умолчанию 15 минут; refresh — 90 дней от последнего успешного обновления. PostgreSQL хранит только хэши, семейства и историю использованных refresh. Ротация атомарная; повтор в течение 10 секунд возвращает 409 без новой пары, более поздний replay отзывает семейство. Origin/CSRF обязательны. Refresh cookie ограничена `/v1/auth`, приватный API принимает только access.

Клиентская логика сосредоточена в `src/composables/useAuthSession.ts`: состояние, CSRF, single-flight, Web Locks, login/logout, один retry после подтверждённого 401 и защита поколения/пользователя. `auth.ts` — Pinia facade; `sessionTransport.ts` — совместимый re-export. Доменные stores и сервисы не обновляют токены самостоятельно.

## Автоматические проверки

- Backend disposable QA: 26/26 node tests и 13 групп API-сценариев прошли. После добавления проверки отсутствующего/просроченного refresh auth-route security suite прошёл 8/8. Build, typecheck, lint, Drizzle check прошли.
- PostgreSQL migration/refresh tests повторены пять раз после устранения гонки тестового teardown: закрытие соединений проверяется до DROP DATABASE без FORCE. Проверены legacy upgrade, единственный победитель конкурирующей ротации, срок после ожидания блокировки и logout race.
- Финальный объединённый frontend auth/store/cache/UI набор: 80/80 тестов прошли. Frontend auth/composable/library: 41 тест прошёл. Дополнительно store/cache тесты проверяют 100 дней оффлайна, сохранение blob после отказа refresh, повторный вход того же пользователя и отсутствие media-загрузок.
- Production build и проверка TypeScript прошли. ESLint изменённых auth/store/UI файлов прошёл. OpenSpec strict validation выполнена для обоих changes.
- Общий frontend suite: 105 passed, 2 failed (107 tests). Оставшиеся ошибки относятся к существующему изменению AttachmentList: пробел перед `+5` в текстовом assertion и отсутствующий прежний selector `.attachments__downloads a`. Auth-изменение не редактирует AttachmentList; эти сбои воспроизводились отдельно.

## Браузерная проверка

Использован отдельный disposable PostgreSQL/MinIO/API и production `vite preview`, localhost browser profile `refresh-auth`, подписанный mock Telegram provider. Реальный Telegram не вызывался. Тестовая песня `Offline refresh QA` с PNG создана через интерфейс; сохранялась в IndexedDB и отображалась из blob URL.

1. Две вкладки одновременно перезагружены после серверного истечения access: обе восстановились онлайн; зарегистрирован ровно один POST refresh. Cookie HttpOnly, refresh path `/v1/auth`. Service worker контролировал страницу.
2. Холодная перезагрузка страницы с отключённой сетью: песня, заметки и изображение доступны; действий редактирования нет. Последний профиль и приватная база сохранились.
3. Истечение access и refresh на сервере, затем reconnect: UI предлагает повторный Telegram-вход, изображение продолжает отображаться, запись недоступна. Desktop header имеет ненулевую ширину; mobile viewport 390px без горизонтального overflow.
4. Повторный mock-вход тем же аккаунтом: изображение читается из сохранённой базы; число сетевых запросов media `/content` — 0. Запись снова доступна.
5. Выход: обе вкладки переходят на login; auth cookies отсутствуют, remembered user отсутствует, зарегистрированных private databases — 0, старое изображение во второй вкладке отсутствует. Активных refresh families этого пользователя в QA БД — 0.

Снимки: `output/playwright/refresh-offline.png`, `refresh-expired.png`, `refresh-expired-mobile.png`. Они не содержат токенов и показывают синтетические QA-данные.

## Ограничения

Проверена production PWA с активным service worker в настольном браузере. OS-установка PWA и поведение физического телефона, реальный Telegram consent не проверялись. Потерянный ответ ротации может потребовать повторного входа после короткого grace window; локальная библиотека сохраняется. Производственный deployment и миграция существующих локальных/production данных не выполнялись; сначала должен быть выпущен backend с миграцией `0007_refresh_sessions.sql`, затем frontend.
