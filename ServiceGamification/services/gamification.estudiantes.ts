// estudiantes -> perfil de gamificacion del usuario
import { query } from "../connects/Database/transaction.ts";
import { EstudianteGamificacion } from "../models/gamification.ts";
import { HttpError } from "../utils/errors.ts";

// repo -> info estudiante gamificacion
export async function getInfoEstudianteGamificacion(usuarioId: string): Promise<EstudianteGamificacion | null> {
  const res = await query<{
    estudiante_id: string;
    tag: string;
    usuario_id: string;
    curso_periodo_id: string;
    paralelo: "A" | "B";
    nombre: string;
    apellido_paterno: string;
    avatar_url: string | null;
  }>(
    `SELECT estudiante_id, usuario_id, tag, curso_periodo_id, paralelo, nombre, apellido_paterno, avatar_url
     FROM estudiantes_gamificacion
     WHERE usuario_id = $1 AND estado = 'activo'
     LIMIT 1`,
    [usuarioId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    estudianteId: String(row.estudiante_id),
    usuarioId: String(row.usuario_id),
    tag: row.tag,
    cursoPeriodoId: String(row.curso_periodo_id),
    paralelo: row.paralelo,
    nombre: row.nombre,
    apellidoPaterno: row.apellido_paterno,
    avatarUrl: row.avatar_url,
  };
}

// perfil -> exigir perfil inicializado
export async function requerirPerfil(usuarioId: string): Promise<EstudianteGamificacion> {
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) throw new HttpError(409, "Primero debes inicializar tu perfil de gamificación");
  return perfil;
}

// repo -> guardar estudiante gamificacion
export async function upsertEstudianteGamificacion(data: {
  usuarioId: string;
  estudianteId: string;
  cursoPeriodoId: string;
  paralelo: "A" | "B";
  nombre?: string;
  apellidoPaterno?: string;
  avatarUrl?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO estudiantes_gamificacion (
       usuario_id, estudiante_id, curso_periodo_id, paralelo, nombre, apellido_paterno, avatar_url, estado
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
     ON CONFLICT (usuario_id) DO UPDATE SET
       estudiante_id = EXCLUDED.estudiante_id,
       curso_periodo_id = EXCLUDED.curso_periodo_id,
       paralelo = EXCLUDED.paralelo,
       nombre = CASE WHEN EXCLUDED.nombre <> '' THEN EXCLUDED.nombre ELSE estudiantes_gamificacion.nombre END,
       avatar_url = COALESCE(EXCLUDED.avatar_url, estudiantes_gamificacion.avatar_url),
       estado = 'activo',
       fecha_actualizacion = NOW()`,
    [
      data.usuarioId,
      data.estudianteId,
      data.cursoPeriodoId,
      data.paralelo,
      data.nombre ?? "",
      data.apellidoPaterno ?? "",
      data.avatarUrl ?? null,
    ],
  );
}
