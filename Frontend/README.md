# Frontend

![Expo](https://img.shields.io/badge/Expo-57-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![NativeWind](https://img.shields.io/badge/NativeWind-4-06B6D4?logo=tailwindcss&logoColor=white)

## Descripción

- **Qué hace:** app móvil/escritorio del sistema escolar construida con Expo. Ofrece login con 2FA y, según el rol, cuatro paneles (Dirección, Control, Docente, Estudiante) con sus respectivos menús: gestión de usuarios, estructura académica, inscripciones, seguimiento, aula y evaluación, horarios, economía y deuda del estudiante. Todo pasa por el gateway (SignalR `/hub` para tiempo real y `EXPO_PUBLIC_API_URL` para REST); **no consulta la base de datos directamente**.
- **Punto de entrada:** `index.ts` → `App.tsx` → `src/navigation/AppNavigator.tsx` (stack por rol) → `src/navigation/RoleShell.tsx` (menú + switch de pantallas).
- **Tablas que usa:** ninguna. Los clientes HTTP viven en `src/api/*` (re-exportados desde `src/api/index.ts`) y hablan con `RestApi` (`/api/...`).

## Roles permitidos

| Rol (base de datos / login) | Stack | Menú (navConfig) |
| --- | --- | --- |
| `director` (también aliases admin/administrador) | `Direccion` | Dashboard, Administración, Docentes, Estudiantes, Estructura Académica, Inscripciones, Seguimiento, Aula y Evaluación, Horarios, Economía |
| `control` (aliases gerencia/secretaria/administrativo/editor) | `Control` | Dashboard, Administración, Docentes, Estudiantes, Inscripciones, Aula y Evaluación, Horarios, Economía |
| `profesor` (alias maestro) | `Maestros` | Dashboard, Cursos, Materias, Evaluaciones, Horarios |
| `estudiante` (aliases alumno/apoderado; rol por defecto) | `Usuarios` | Dashboard, Cursos, Materias, Evaluaciones, Horarios, Mi Deuda |

## Rutas

Rutas globales del stack raíz (`AppNavigator.tsx`):

| Ruta | Pantalla | Quién la ve |
| --- | --- | --- |
| `Login` | `LoginScreen` | no autenticado |
| `TwoFactor` | `TwoFactorScreen` | durante el paso 2FA |
| `Direccion` | `RoleShell` + `DireccionDashboard` | director |
| `Control` | `RoleShell` + `ControlDashboard` | control / gerencia |
| `Maestros` | `RoleShell` + `MaestrosDashboard` | profesor |
| `Usuarios` | `RoleShell` + `UsuariosDashboard` | estudiante / apoderado |
| `ServerError` | `ServerErrorScreen` | todos |

Rutas internas de `RoleShell` (menú lateral/bottom nav → `handleNavigate`):

| Ruta | Pantalla |
| --- | --- |
| `Dashboard` | `DashboardScreen` (variante según rol) |
| `Profile` | `ProfileScreen` (botón de perfil) |
| `Docentes` | `DocentesManagementScreen` |
| `Estudiantes` | `EstudiantesManagementScreen` |
| `Administrativo` | `AdministrativoManagementScreen` |
| `Estructura` | `AcademicServicesScreen area="academic"` |
| `Inscripciones` | `AcademicServicesScreen area="enrollment"` |
| `Evaluaciones` | `MaestroEvaluacionesScreen` / `EstudianteEvaluacionesScreen` / `AcademicServicesScreen area="learning"` según rol |
| `Cursos` | `MaestroCursosScreen` / `EstudianteCursosScreen` / `AcademicServicesScreen` según rol |
| `Calificaciones` | `EstudianteEvaluacionesScreen` / `AcademicServicesScreen` según rol |
| `Materias` | `MaestroMateriasScreen` / `EstudianteMateriasScreen` / `AcademicServicesScreen` según rol |
| `Horarios` / `Horario` | `ScheduleScreen` |
| `Seguimiento` | `SeguimientoScreen` |
| `Economia` | `EconomyManagementScreen` |
| `Deuda` | `BillingStudentScreen` |

## Inicialización por consola

Requisitos: Node 24, el backend levantado (como mínimo `rest-api` en 5141) y un `.env` opcional con `EXPO_PUBLIC_API_URL` (por defecto `http://localhost:5141`) y `EXPO_PUBLIC_MEDIA_URL` (por defecto `http://localhost:9000`).

```powershell
cd Frontend
npm install
npm start            # npx expo start -> Expo Dev Tools
npm run android      # o: npm run ios / npm run web
npx tsc --noEmit     # verificacion: no hay lint ni tests en este proyecto
```

## Inicialización por Docker

**No está containerizado a propósito** (React Native/Expo corre en el host, contra el stack de compose `shalom_backend`). No existe servicio de compose para el frontend:

1. Levanta el backend: `docker compose -p shalom_backend --env-file .env up -d`
2. Corre la app en el host con `npm start` (o `npm run android`) y `EXPO_PUBLIC_API_URL=http://localhost:5141`.
