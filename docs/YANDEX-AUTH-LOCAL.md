# Local Yandex authentication

The SPA opens `/v1/auth/yandex/start?returnTo=<internal path>` in the browser. The backend handles Yandex OAuth Authorization Code flow with PKCE and returns HttpOnly access (`setlist_session`, 15 minutes) and refresh (`setlist_refresh`, 90 days, `/v1/auth` path) cookies. Each successful refresh rotates both tokens and renews the refresh lifetime for 90 days. The SPA gets the user and an in-memory CSRF token from `/v1/auth/session` or `/v1/auth/refresh-context` after access expires. API requests include cookies; writes include `X-CSRF-Token`. No Yandex tokens or secrets belong in Vite variables or browser storage.

For the current local Yandex stack at `http://127.0.0.1:46544`, set `VITE_API_BASE_URL=` and `VITE_API_PROXY_TARGET=http://127.0.0.1:46543` in local Vite configuration, then restart Vite. This uses Vite's `/v1` proxy to the local backend. This keeps SPA and cookie requests on one origin. `vite preview` also configures this proxy when its backend target is configured. The production service worker excludes `/v1`, `/health` and `/openapi.yaml` navigation from its SPA fallback, so browser redirects to authentication reach the backend. A built static bundle has no proxy: its serving reverse proxy must forward `/v1` to the backend. An explicit `VITE_API_BASE_URL` uses credentialed cross-origin requests and requires the backend's exact allowed frontend origin and compatible cookie settings. Do not expose provider credentials in Vite variables, browser storage, logs or committed files.

Register `https://setlivo.ru/v1/auth/yandex/callback` and `http://127.0.0.1:46544/v1/auth/yandex/callback` in the Yandex OAuth application. Request only `login:info`. Keep Client ID and Client Secret in backend-only configuration. Login displays an availability message when the backend returns `authError=unavailable`.

## Offline and logout behavior

Only the last successfully verified user's public identity is remembered locally. If a session check fails because of a network error, that user can view their previously downloaded selected setlist. Writes stay disabled until the server verifies the session again. The shared `src/composables/useAuthSession.ts` handles session verification, refresh recovery, CSRF, one retry after a confirmed 401, generation guards, and login/logout. Pinia is a thin facade; API services contain no refresh logic. Concurrent requests share one pending refresh and supported browsers coordinate tabs via Web Locks. Network/5xx failures never automatically repeat mutations with an unknown result. A concurrent refresh 409 rechecks the shared access cookie without another rotation. A scoped `403 SETLIST_ACCESS_DENIED` or `404 SETLIST_NOT_FOUND` clears only that setlist's cache and RAM/media. Other accessible setlists remain available. `403 SETLIST_ROLE_REQUIRED` triggers a membership refresh and preserves permitted reads; `CSRF_INVALID` does not revoke membership. Access 401 first attempts refresh. Confirmed refresh expiry sets `reauthRequired`: identity, selected scope, snapshots and files remain available for local reading, while network writes and synchronization are blocked. The interface asks for Yandex login; signing in as the same user reuses the files after current scope permissions are checked. A different user cannot read the previous user’s data. Offline mode and reauthentication are separate states. A temporary online verification failure on cold start uses `verificationPending`: remembered identity and files remain readable, writes stay disabled, and the UI offers a retry without asking for Yandex login. Neither token expiry nor a network failure deletes the private library. Anonymous legacy caches are never imported into authenticated user caches.

Snapshots and downloaded files use a separate database for each verified user and setlist. Existing anonymous or user-only legacy caches are not imported. In-flight loads, downloads, publications and mutations capture the user, setlist and request generation; late results cannot enter another context. Reconnect reconciles accessible setlists and removes caches of deleted or revoked scopes, including scopes that are not currently selected. A detected scope revocation is broadcast to other tabs for that user and scope. Other scopes remain available. Logout clears local identity and RAM immediately, unmounts media, and removes private IndexedDB databases. Other tabs receive a storage event and clear their RAM/media too. Open database connections close before deletion; a blocked deletion displays an instruction to close other Setlist tabs.

Logout also requests server-side session revocation. A failed request leaves a retry button and a persistent logout-pending marker, so a reload does not restore access before logout is completed. Retry verifies the current server identity through access or refresh context, fetches a fresh CSRF token and refuses to revoke a different user's session. Logout waits for pending refresh, shares the cross-tab auth lock and revokes the whole refresh family even when access has expired. If that request fails, local private data still clears and the UI reports the failure. The HttpOnly cookie cannot be removed by the SPA, so the user must retry logout while connected to revoke that server session.

## Verification

Run unit tests with a relative API base so local Vite configuration cannot change contract assertions:

```sh
VITE_API_BASE_URL='' npm test
VITE_API_BASE_URL='' npm run build
```

Real Yandex completion requires a configured local backend, an allowed callback URL and a Yandex account. Server-only configuration lives in ignored local environment files. The legacy setlist is adopted by an explicit local `npm run db:bootstrap-legacy` action after its configured issuer/sub has completed verified login; it is not granted to the first visitor. Membership rows grant subsequent access independently of the bootstrap environment.

The client provides setlist selection and creation, owner settings and member roles, one-use editor/viewer invitation links, and independent song/media copies to another writable setlist. Owner and editor can change and delete content; only owner can administer members, invitations or delete the setlist. The last owner cannot be removed or demoted.

Automated local QA uses a disposable database/object store and mock Yandex OAuth responses and profiles. Provider consent with real accounts is reported separately. Browser checks cover roles, scoped caches, invite/login/acceptance, two-tab logout, offline read-only reopening, and late requests.

## Current real local stack

Open `http://127.0.0.1:46544/login`. This origin uses the real Yandex provider and the API on `127.0.0.1:46543`. The database/object store are separate local services on ports 46641/46642. The Docker stack uses `docker-compose.yandex.yml` and dedicated `setlist-yandex-pgdata` / `setlist-yandex-miniadata` volumes; old Telegram volumes are retained separately. Yandex and Telegram identify different accounts. A Yandex login must not inherit Telegram membership by matching a name, email or browser cache. Assign the intended owner explicitly after a verified Yandex login. Local checks do not alter production data.

Server settings are saved in backend `.env.yandex.runtime.local` (ignored by Git, private permissions). With the local containers still running, rebuild the backend and start it using `npm run build` followed by `npm run start:yandex:local`. The launcher binds only to loopback, rejects shared/default database/storage ports, and does not migrate data or assign owners automatically. Do not run it while another API process occupies port 46543.

Build and serve this frontend with the matching local proxy:

```sh
VITE_API_BASE_URL= VITE_API_PROXY_TARGET=http://127.0.0.1:46543 npm run build
VITE_API_BASE_URL= VITE_API_PROXY_TARGET=http://127.0.0.1:46543 npm run preview -- --host 127.0.0.1 --port 46544 --strictPort
```

Keep a local database and object-store backup before changing ownership. Existing Telegram memberships remain attached to their original account IDs. Disposable QA uses independent services and synthetic identities.

## Upgrade to refresh sessions

Apply backend migration `0007_refresh_sessions.sql` before running the new backend; run migration through the existing migration command in the intended environment. The migration is additive: existing access rows keep their expiry and a nullable family relation. An unexpired legacy session can be upgraded by a CSRF/Origin-protected refresh request without another Yandex login; an expired legacy session cannot. Release the compatible backend before the client. Defaults are `AUTH_SESSION_TTL_SECONDS=900` and `AUTH_REFRESH_TTL_SECONDS=7776000`; configure the backend only, never Vite. New frontend bundles need no token storage.

This change was developed against disposable QA infrastructure. Existing real local/production databases are not automatically migrated or deployed. Real Yandex consent and physical phone behavior must be recorded separately from mock-provider browser checks.
