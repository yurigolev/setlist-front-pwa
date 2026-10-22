## 1. Серверный контракт и согласование

- [x] 1.1 Подготовить companion change `persistent-refresh-auth` в `/Users/1g/WebstormProjects/setlist-back`, согласовать с этим design/spec и получать apply-инструкции отдельно для каждого root. Согласовать новые требования с неархивированным `telegram-setlists`, не меняя несвязанные изменения.
- [x] 1.2 Добавить на backend конфигурацию access TTL 900 секунд и refresh TTL 7776000 секунд, nullable familyId access-сессии, семейства refresh и историю хэшей через новую миграцию Drizzle; проверить чистую миграцию и обновление существующих сессий на disposable БД.
- [x] 1.3 Реализовать атомарную выдачу пары при Telegram-входе, refresh-context, защищённый refresh с ротацией, скользящим сроком, 409 в десятисекундном окне конкуренции и отзывом семейства при позднем replay. Проверять серверные сроки, Origin и CSRF; приватные API принимают только access.
- [x] 1.4 Реализовать защищённый bootstrap действующей legacy session и logout, отзывающий всё семейство при действующем access либо refresh. Просроченная legacy session не получает refresh. Обновить OpenAPI, env examples и документацию без production запуска.

## 2. Единый клиентский composable

- [x] 2.1 Перенести состояние и транспорт авторизации в `src/composables/useAuthSession.ts`: initialize/login/logout, access/refresh, CSRF, single-flight, поколение пользователя, события вкладок. Оставить `auth.ts` тонким Pinia facade; удалить логику из `sessionTransport.ts`, допустим только совместимый re-export.
- [x] 2.2 Реализовать authFetch с одним refresh и одним повтором после подтверждённого 401, обновлённым CSRF и проверками контекста; network/5xx не повторяют mutation. Подключить все приватные library/setlist/media запросы, убрать собственную обработку токенов и 401 из API-сервисов.
- [x] 2.3 Координировать refresh и logout через Web Locks, перепроверять access после получения lock; поддержать серверный 409 recovery для браузеров без Web Locks и исключить восстановление после logout/account change. Reconnect/focus вызывают только публичные действия composable через facade.

## 3. Долгий оффлайн и интерфейс

- [x] 3.1 Разделить сетевой offline и подтверждённый reauthRequired; сохранить remembered identity, выбранный scope, снимки и файлы при окончательном отказе refresh. Заблокировать запись, управление и синхронизацию, сохраняя локальное чтение.
- [x] 3.2 Добавить понятное уведомление и действие повторного Telegram-входа при reauthRequired, даже когда remembered user присутствует. Подключить состояние к SessionHeader/Profile/Login и существующим проверкам разрешённых действий без дублирования refresh-логики.
- [x] 3.3 После повторного входа тем же userId переиспользовать сохранённые файлы и перепроверить доступные scope; другой userId очищает прежний контекст. Сохранить очистку при явном logout и подтверждённом отзыве scope, защиту от stale responses и уведомления вкладок.

## 4. Проверки

- [x] 4.1 Backend: security/integration tests выдачи, истечения access, продления через refresh, холодного refresh-context/CSRF, Origin, replay, конкурентной ротации, logout при истёкшем access, legacy bootstrap и серверного отзыва прав; запустить build/typecheck и disposable QA.
- [x] 4.2 Frontend: тесты одного composable на параллельные 401, один retry, обновлённый CSRF, отсутствие циклов, network/5xx, logout во время refresh, смену пользователя и поздние ответы. Проверить отсутствие самостоятельной refresh-логики вне composable.
- [x] 4.3 Проверить сохранность IndexedDB/blob после 100 дней оффлайна и отказа refresh на reconnect, восстановление того же пользователя без повторной загрузки файлов, изоляцию другого пользователя, logout и отзыв scope; выполнить frontend tests/build.
- [x] 4.4 Browser QA на disposable окружении: холодный старт установленной PWA, две вкладки с истёкшим access, offline/reconnect, повторный вход с сохранёнными файлами и logout; отдельно зафиксировать недоступные проверки реального Telegram/телефона. Проверить итоговый diff и согласованность документации.
