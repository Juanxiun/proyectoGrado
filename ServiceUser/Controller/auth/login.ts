import { Context } from "@oak/oak";
import { query } from "../../connects/Database/transaction.ts";
import { serialize } from "../../utils/serialize.ts";
import { resolveMediaUrl } from "../../connects/Storage/minio.ts";
import { jwtConfig } from "../../config/jwt.config.ts";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import {
  extractDeviceInfo,
  extractLocationInfo,
} from "../../utils/deviceDetector.ts";
import {
  is2FARequiredForRole,
  generateAndSend2FACode,
} from "../../services/twoFactor.service.ts";
import { createSession } from "../../services/session.service.ts";

/**
 * Roles del sistema:
 *   director   → acceso total (Requiere 2FA)
 *   control    → control y auditoría (Requiere 2FA)
 *   gerencia   → gestión administrativa (Requiere 2FA)
 *   maestros   → docente (Requiere 2FA)
 *   estudiante → alumno (Múltiples dispositivos + Anti-trampa por distancia)
 *   padres     → apoderado/tutor
 */

// Cache de la clave JWT 
let _jwtSecretKey: Uint8Array | null = null;
function getSecretKey(): Uint8Array {
  if (!_jwtSecretKey) {
    _jwtSecretKey = new TextEncoder().encode(jwtConfig.secret);
  }
  return _jwtSecretKey;
}

/*
 * POST /auth/login
 */
export async function login(ctx: Context): Promise<void> {
  try {
    const body = await ctx.request.body.json();
    const { login: loginInput, password } = body ?? {};

    if (typeof loginInput !== "string" || typeof password !== "string" ||
      !loginInput.trim() || !password) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Los campos 'login' (username o email) y 'password' son obligatorios",
      };
      return;
    }

    const userRes = await query<{
      id: bigint;
      nombre: string;
      apellido_paterno: string;
      apellido_materno: string;
      foto_url: string | null;
      estado: number;
      rol_id: bigint;
      rol: string;
      username: string;
      email: string;
      password_hash: string;
    }>(
      `SELECT
         u.id,
         u.nombre,
         u.apellido_paterno,
         u.apellido_materno,
         u.foto_url,
         u.estado,
         r.id  AS rol_id,
         r.rol,
         uc.username,
         uc.email,
         uc.password_hash
       FROM usuario_cuenta uc
       JOIN usuarios u  ON u.id  = uc.usuario_id
       JOIN roles r     ON r.id  = u.rol_id
       WHERE uc.username = $1 OR uc.email = $1`,
      [loginInput],
    );

    if (userRes.rows.length === 0) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Credenciales inválidas" };
      return;
    }

    const user = userRes.rows[0];

    if (user.estado === 0) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Cuenta inactiva" };
      return;
    }
    if (user.estado === 2) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Cuenta suspendida" };
      return;
    }

    // deno-lint-ignore no-explicit-any
    const valid: boolean = await (bcrypt as any).compare(password, user.password_hash);

    if (!valid) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Credenciales inválidas" };
      return;
    }

    await query(
      `UPDATE usuario_cuenta SET ultimo_login = NOW() WHERE usuario_id = $1`,
      [user.id],
    );

    const rolNombre = user.rol.toLowerCase();
    // deno-lint-ignore no-explicit-any
    let extraInfo: Record<string, any> = {};

    switch (rolNombre) {
      case "estudiante": {
        // Inscripción en el periodo académico activo
        const inscRes = await query<{
          nivel: string;
          grado: string;
          paralelo: string;
          periodo_id: bigint;
          anio: number;
        }>(
          `SELECT
             c.nivel,
             c.grado,
             c.paralelo,
             i.periodo_id,
             pa.anio
           FROM inscripciones i
           JOIN cursos c               ON c.id  = i.curso_id
           JOIN periodos_academicos pa ON pa.id = i.periodo_id
           WHERE i.estudiante_id = $1
             AND pa.activo = TRUE
           LIMIT 1`,
          [user.id],
        );

        if (inscRes.rows.length > 0) {
          const ins = inscRes.rows[0];
          extraInfo = {
            nivel: ins.nivel,
            grado: ins.grado,
            paralelo: ins.paralelo,
            periodoId: String(ins.periodo_id),
            anio: ins.anio,
          };
        }
        break;
      }

      case "profesor":
      case "maestro":
      case "maestros": {
        const cursosRes = await query<{
          asignacion_id: bigint;
          curso_id: bigint;
          nivel: string;
          grado: string;
          paralelo: string;
          materia_id: bigint;
          materia: string;
          anio: number;
        }>(
          `SELECT
             ad.id  AS asignacion_id,
             c.id   AS curso_id,
             c.nivel,
             c.grado,
             c.paralelo,
             m.id   AS materia_id,
             m.materia,
             pa.anio
           FROM maestros ma
           JOIN asignaciones_docentes ad ON ad.maestro_id = ma.id
           JOIN cursos c                 ON c.id          = ad.curso_id
           JOIN materias m               ON m.id          = ad.materia_id
           JOIN periodos_academicos pa   ON pa.id         = ad.periodo_id
           WHERE ma.usuario_id = $1
             AND pa.activo = TRUE
           ORDER BY c.nivel, c.grado, c.paralelo`,
          [user.id],
        );

        extraInfo = {
          cursos: cursosRes.rows.map((r) => ({
            asignacionId: String(r.asignacion_id),
            cursoId: String(r.curso_id),
            nivel: r.nivel,
            grado: r.grado,
            paralelo: r.paralelo,
            materiaId: String(r.materia_id),
            materia: r.materia,
            anio: r.anio,
          })),
        };
        break;
      }
      default:
        break;
    }

    // Extraer dispositivo y geolocalización
    const deviceInfo = extractDeviceInfo(ctx);
    const locationInfo = extractLocationInfo(ctx, body);

    // Verificación de 2FA para roles privilegiados (Director, Maestros, Control)
    if (is2FARequiredForRole(user.rol)) {
      const twoFactorResult = await generateAndSend2FACode({
        userId: String(user.id),
        username: user.username,
        email: user.email,
        nombre: user.nombre,
        apellidoPaterno: user.apellido_paterno,
        apellidoMaterno: user.apellido_materno,
        fotoUrl: await resolveMediaUrl(user.foto_url),
        rol: user.rol,
        rolId: String(user.rol_id),
        extraInfo,
        deviceInfo,
        locationInfo,
      });

      ctx.response.status = 200;
      ctx.response.body = {
        requires2FA: true,
        tempToken: twoFactorResult.tempToken,
        message: "Se requiere verificación en dos pasos (2FA). Se ha enviado un código de acceso a tu correo electrónico.",
        emailMasked: twoFactorResult.emailMasked,
        expiresInSeconds: twoFactorResult.expiresInSeconds,
      };
      return;
    }

    // Para roles sin 2FA (ej. Estudiante, Padres): Creación directa de sesión en Redis
    const { session, closedPreviousSessions } = await createSession({
      usuarioId: String(user.id),
      username: user.username,
      rol: user.rol,
      deviceInfo,
      locationInfo,
    });

    const payload = {
      sub: String(user.id),
      username: user.username,
      rol: user.rol,
      role: rolNombre === "maestro" || rolNombre === "maestros" || rolNombre === "docente"
        ? "profesor"
        : rolNombre,
      roles: [rolNombre === "maestro" || rolNombre === "maestros" || rolNombre === "docente"
        ? "profesor"
        : rolNombre],
      rolId: String(user.rol_id),
      sessionId: session.sessionId,
      ...extraInfo,
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(jwtConfig.expiresIn)
      .sign(getSecretKey());

    ctx.response.status = 200;
    ctx.response.body = serialize({
      requires2FA: false,
      token,
      sessionId: session.sessionId,
      usuario: {
        id: user.id,
        username: user.username,
        email: user.email,
        nombre: user.nombre,
        apellidoPaterno: user.apellido_paterno,
        apellidoMaterno: user.apellido_materno,
        fotoUrl: await resolveMediaUrl(user.foto_url),
        rol: user.rol,
        rolId: user.rol_id,
        ...extraInfo,
      },
      session: {
        sessionId: session.sessionId,
        inicioConexion: session.inicioConexion,
        dispositivo: session.dispositivo,
        ubicacion: session.ubicacion,
        activo: session.activo,
        posibleTrampa: session.posibleTrampa,
        alertaTrampa: session.alertaTrampa,
      },
      sesionesPreviasCerradas: closedPreviousSessions.length > 0 ? closedPreviousSessions : undefined,
    });
  } catch (err) {
    console.error("[login]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor al iniciar sesión" };
  }
}
