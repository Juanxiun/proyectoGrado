# RestApi (gateway)

![C#](https://img.shields.io/badge/C%23-239120?logo=csharp&logoColor=white)
![ASP.NET Core](https://img.shields.io/badge/ASP.NET%20Core-512BD4?logo=dotnet&logoColor=white)
![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet&logoColor=white)
![SignalR](https://img.shields.io/badge/SignalR-0078D4)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** único punto de entrada HTTP del backend (puerto 5141). Expone todo bajo `/api/**` como proxy hacia los 7 servicios Deno (`Services/*Service` en `appsettings.json`), aloja el hub SignalR `/hub` que notifica a los clientes (`DataChanged` se emite automáticamente tras toda escritura exitosa en `/api/**`) y despacha eventos de dominio hacia los servicios vía `WebhookDispatcherService` (callbacks en `/api/webhooks/*-service`). Limita el cuerpo subido a 160 MB. **No tiene acceso directo a la base de datos.**
- **Puerto:** 5141 (perfil `http`; el perfil `https` añade 7064).
- **Tablas que usa:** ninguna — toda la persistencia vive en los servicios.

## Roles permitidos

El gateway **no valida JWT en las rutas REST**: los controladores son proxies passthrough que reenvían el header `Authorization` y el servicio destino aplica su `requireAuth`. Solo `Hubs/AppHub.cs` valida tokens con `JwtTokenValidator`.

| Capa | Quién puede llamar | Rutas |
| --- | --- | --- |
| Pública | cualquiera | `GET /health`, `POST /api/auth/login`, `POST /api/auth/verify-2fa`, `POST /api/auth/resend-2fa` (el control real lo hace ServiceUser) |
| Autenticada (JWT reenviado) | cualquier rol aceptado por el servicio destino | el resto de `/api/**` |
| Token interno | servicios / infra | `POST /api/internal/notificaciones/push` (`Internal:PushToken`), `POST /api/webhooks/*-service` (callbacks) |
| SignalR | cliente con JWT válido | `/hub` (validación propia del hub) |
| Solo Development | — | `GET /openapi` |

## Rutas

Todas las rutas `/api/...` se reenvían sin transformar al servicio indicado.

| Prefijo | Métodos | Proxy hacia |
| --- | --- | --- |
| `api/auth` | POST `login`, `verify-2fa`, `resend-2fa`, `change-password`, `logout`; GET `sessions/me`, `sessions/user/{id}`; DELETE `sessions/{sessionId}` | ServiceUser 8880 |
| `api/usuarios` | GET, GET `{id}`, POST, PUT `{id}`, PATCH `{id}/baja`, DELETE `{id}` | ServiceUser 8880 |
| `api/periodos` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}`, POST `{id}/desactivar` | ServiceAcademic 8881 |
| `api/periodos/{id}/…` (AcademicManagement) | POST `clonar`, `clone`, `generar-estructura`, `estructura/generar`, `generar-cursos`, `generar-horarios`, `horarios/generar`, `horarios/manual`, `generar-plan-pagos`, `plan-pagos/generar`, `activar`; GET `estado`, `readiness`, `validacion`, `validar`, `trimestres` | ServiceAcademic 8881 |
| `api/trimestres` | GET | ServiceAcademic 8881 |
| `api/horarios` | GET, POST `generar`, POST `manual` | ServiceAcademic 8881 |
| `api/mallas-curriculares` | GET, POST | ServiceAcademic 8881 |
| `api/planes-pago` | GET, POST `generar` | ServiceAcademic 8881 |
| `api/aulas` | GET, POST | ServiceAcademic 8881 |
| `api/cursos` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}` | ServiceAcademic 8881 |
| `api/grados` | GET, GET `materias`, POST `materias`, PUT `materias`, DELETE `materias/{materiaId}` | ServiceAcademic 8881 |
| `api/malla` | GET, GET `resumen`, GET `materia`, PUT `materia`, POST `tema`, PUT `tema/{id}`, DELETE `tema/{id}` | ServiceAcademic 8881 |
| `api/materias` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}` | ServiceAcademic 8881 |
| `api/seguimiento` | GET `libro`, `panel/curso`, `panel/estudiante/{id}`, `riesgo`, `umbrales` | ServiceAcademic 8881 |
| `api/cursos-periodo` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}` | ServiceEnrollment 8882 |
| `api/inscripciones` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}`, POST `solicitud`, POST `habilitar`, GET `solicitudes`, PATCH `solicitudes/{id}/aprobar`, PATCH `solicitudes/{id}/rechazar`, PATCH `{id}/retirar` | ServiceEnrollment 8882 |
| `api/asignaciones` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}` | ServiceEnrollment 8882 |
| `api/asesores` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}` | ServiceEnrollment 8882 |
| `api/materiales` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}` | ServiceHomework 8883 |
| `api/encargos` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}` | ServiceHomework 8883 |
| `api/entregas` | GET, GET `{id}`, POST, DELETE `{id}` | ServiceHomework 8883 |
| `api/calificaciones` | GET, GET `{id}`, POST, POST `bulk`, PUT `{id}`, DELETE `{id}` | ServiceHomework 8883 |
| `api/asistencia` | GET, GET `{id}`, POST, POST `bulk`, PUT `{id}`, DELETE `{id}` | ServiceHomework 8883 |
| `api/notificaciones` | GET, GET `conteo`, GET `reglas`, GET `{id}`, POST `{id}/read`, POST `leer-todas`, DELETE `{id}`, POST `emitir`, GET `estado` | ServiceNotification 8884 |
| `api/dashboard` | GET, GET `academico`, `asistencia`, `riesgo`, `economico`, `periodos`, `umbrales`; POST `cache/invalidar` | ServiceDashboard 8885 |
| `api/economia/kpis`, `api/economia/estudiantes`, `api/economia/estudiantes/{id}` | GET | ServiceBilling 8886 |
| `api/planos` | GET, GET `{id}`, POST, PUT `{id}`, DELETE `{id}` | ServiceBilling 8886 |
| `api/cuotas` | GET, PUT `{id}` | ServiceBilling 8886 |
| `api/pagos` | GET, POST | ServiceBilling 8886 |
| `api/estudiantes/{id}/deuda` | GET | ServiceBilling 8886 |
| `api/periodos/{id}/DeudaEstudiantes` | GET | ServiceBilling 8886 |
| `api/internal/notificaciones/push` | POST | token interno (`Internal:PushToken`) |
| `api/webhooks` | POST `user-service`, `academic-service`, `enrollment-service`, `homework-service`, `notification-service`, `dashboard-service` | callbacks de servicios → dispatcher |
| `hub` | WebSocket/long-polling SignalR | — |
| `health` | GET | público |

## Inicialización por consola

Requisitos: `RestApi/appsettings.json` con `Services:*Service` apuntando a cada servicio (`http://localhost:888x`), `Jwt:Secret` idéntico al de los servicios Deno y `Gateway:PublicUrl`. No necesita Postgres/Redis directos, pero para probar rutas deben estar levantados los servicios destino.

```powershell
cd RestApi
dotnet run                     # http://localhost:5141 (perfil "http")
dotnet run --launch-profile https   # opcional: https://localhost:7064 + 5141
dotnet build RestApi.csproj    # verificacion (el warning NU1903 de Microsoft.OpenApi es conocido)
```

## Inicialización por Docker

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env up -d rest-api
docker compose -p shalom_backend --env-file .env build rest-api   # tras cambiar codigo C#
docker compose -p shalom_backend --env-file .env logs -f rest-api
```

Contenedor `shalom_rest_api` (puertos 5141 y 7064). **No tiene hot reload** (sin volume): cualquier cambio de C# requiere rebuild. Dentro de la red compose lo configuran `Gateway__PublicUrl=http://rest-api:5141` y `Services__*Service=http://service-*:888x`.
