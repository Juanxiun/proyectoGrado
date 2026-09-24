# AGENTS.md

## Repository layout
- This repository is a set of independent projects, not a root workspace: `Frontend/` is Expo, `RestApi/` is the ASP.NET Core gateway, and `ServiceUser/`, `ServiceAcademic/`, `ServiceEnrollment/`, and `ServiceHomework/` are Deno/Oak services. Run each tool from its own directory.
- `ServiceBilling/` is ignored by the root `.gitignore` and has no tracked files; it is not part of the application. No Dockerfile or Compose configuration is checked in, so infrastructure is provisioned externally.
- Deno routes are registered in each `Service*/server.ts`; handlers are under `Controller`/`controllers`, business logic under `services`, and database access under `connects/Database`. The frontend entry is `Frontend/index.ts` → `App.tsx`; the gateway entry is `RestApi/Program.cs`.
- NativeWind is wired through `Frontend/babel.config.js`, `metro.config.js`, `tailwind.config.js`, and `global.css`; preserve that chain when changing styling or bundler configuration.
- `Esquems/BDmain.sql` is the bootstrap schema; `Esquems/migrations/20260923_gestion_academica.sql` upgrades existing databases. There is no migration runner, so apply the migration explicitly before using the new academic features.

## Local development
- Required tooling/services are Deno, the .NET 10 SDK, Node/npm, PostgreSQL, and Redis. MinIO is needed for User/Homework file routes; User email and 2FA use Brevo (`BREVO_API_KEY`, `EMAIL_FROM`).
- Start infrastructure first, then run these as separate processes (commands are from the repository root):

  | Process | Command | Default port |
  | --- | --- | ---: |
  | User service | `cd ServiceUser; deno task dev` | 8880 |
  | Academic service | `cd ServiceAcademic; deno task dev` | 8881 |
  | Enrollment service | `cd ServiceEnrollment; deno task dev` | 8882 |
  | Homework service | `cd ServiceHomework; deno task dev` | 8883 |
  | REST gateway | `dotnet run --project RestApi/RestApi.csproj --launch-profile http` | 5141 |
  | Frontend | `cd Frontend; npm ci; npm run start` | Expo dev server |

  Use `npm run web`, `npm run android`, or `npm run ios` for the other Expo targets.
- `deno task start` exists only in Academic, Enrollment, and Homework; User has `dev` and `test` only. The Deno test task is `deno test --allow-env --allow-net --allow-read`; Academic includes focused validation and timetable tests.

## Focused verification
- There is no solution file, lint task, or CI/pre-commit workflow. Build the gateway directly with `dotnet build RestApi/RestApi.csproj`.
- From `Frontend/` after `npm ci`, use `npx tsc --noEmit`; `package.json` defines no test, lint, or typecheck script.
- From an individual Deno service directory, use `deno check server.ts`; run Academic's focused tests with `deno test --allow-env --allow-net --allow-read utils/gestionValidation_test.ts utils/horarioAlgoritmo_test.ts`.
- After startup, smoke-test each Deno `/health` endpoint and the gateway `/health`; the gateway health route is a liveness check, not a dependency check.

## Configuration and contracts
- Each Deno service loads its own `.env` through `config/env.config.ts`; there is no shared root environment file. The only tracked example, `ServiceAcademic/.env.example`, uses `PORT=8001` and omits current MinIO/mail settings, so use it only as a variable-name reference.
- Keep `JWT_SECRET` identical across all four services: User issues the HS256 token and the other services verify it. They must also use the same Redis instance because authorization checks the active `session:<sessionId>` record; the configs special-case `REDIS_URL=redis_cache` to `127.0.0.1`.
- Keep the services' `DB_*` settings compatible with the shared schema. `RestApi/appsettings.json` contains the service URLs and `Gateway:PublicUrl`; the latter is used for webhook callbacks, so update it whenever the gateway is not reachable at `http://localhost:5141`. Set `GATEWAY_PUBLIC_URL` in each Deno service to the same public gateway origin when the callback allowlist cannot use the local defaults. The HTTPS launch profile also uses port 7064.
- `Frontend/src/constants/config.ts` hardcodes `http://localhost:5141` in both development and production, and the WebSocket URL derives from it; physical devices or emulators need a reachable gateway host or tunnel.
- `ServiceHomework/config/env.config.ts` is the Windows outlier: unlike the other services, it neither catches a missing `.env` nor strips the leading slash from its URL. Ensure that file exists and loads correctly on Windows.

## Architecture and change points
- The public flow is `Frontend` → `RestApi` (`/api`, port 5141) → one Deno service → PostgreSQL. Redis supplies sessions/2FA/cache state, and MinIO supplies user/homework files. Deno routes are unprefixed (for example `/cursos`); the gateway adds `/api`.
- Ownership is split as follows: User handles users, auth, 2FA, sessions, and first-login onboarding; Academic handles periodos, cursos, materias, mallas, activation, schedules, and payment-plan templates; Enrollment handles cursos-periodo, inscripciones, requests, asignaciones, and asesores; Homework handles materiales, encargos, entregas, calificaciones, asistencia, and notificaciones.
- The only client-facing realtime endpoint is the gateway SignalR hub at `/hub`; ServiceUser's `/ws` and each service's `/webhook` are internal. The frontend uses the raw SignalR handshake and `0x1e` record separator. Do not point the client at a Deno service port.
- HTTP forwarding and hub actions are separate paths. HTTP uses `RestApi/Controllers` plus `RestApi/Services/*Client.cs`; `AppHub.ExecuteAction` dispatches to each service's `*webhookHandler.ts` event map and waits for an asynchronous callback. For an operation exposed through both paths, keep the gateway route/client, Deno route/event map, authorization, and frontend API in sync.
- Successful non-GET/non-HEAD `/api` writes are broadcast by `RestApi/Program.cs` as `DataChanged` with the resource name. Multipart uploads are special: the gateway allows a 160 MB request, Homework enforces 150 MB and PDF/Word/Excel only, and the frontend deliberately omits `Content-Type` for `FormData` so the multipart boundary is generated.

## Repository hygiene
- Do not commit or quote local `.env` values. Per-service `.env` files and Deno `deno.lock` files are ignored; `RestApi/bin`, `RestApi/obj`, `.vs`, and generated Expo/native output are also ignored. `Frontend/.gitignore` ignores `.env*.local` but not a plain frontend `.env`, so do not create one.
- There is no root formatter or test runner; use the focused checks above for this multi-service system.
