import { query } from "../connects/Database/transaction.ts";
import { getRedis } from "../connects/Redis/redis.ts";

const NOTIFICATION_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function notifyStudentsOfEnrollmentOpening(periodoId: string, nombreGestion: string, anio: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const students = await query<{ usuarioId: bigint }>(
      `SELECT usuario_id AS "usuarioId"
       FROM estudiantes
       WHERE estado NOT IN ('suspendido', 'retirado')`,
    );

    for (const student of students.rows) {
      const id = `notif_${crypto.randomUUID()}`;
      const notification = {
        id,
        tipo: "actividad",
        titulo: "Inscripciones habilitadas",
        materiaNombre: "Gestión académica",
        profesorNombre: "Administración",
        cursoParalelo: nombreGestion,
        publicoTexto: "La gestión académica ya está disponible para inscripción",
        fechaLimite: null,
        asignacionId: "0",
        cursoPeriodoId: periodoId,
        itemId: periodoId,
        fechaCreacion: new Date().toISOString(),
        textoPlano: `La gestión ${nombreGestion} (${anio}) está habilitada. Ingresa al apartado Inscripciones y selecciona el grado que cursarás.`,
      };
      await redis.set(`notification:${id}`, JSON.stringify(notification), "EX", NOTIFICATION_TTL_SECONDS);
      await redis.lpush(`notifications:user:${student.usuarioId}`, id);
      await redis.expire(`notifications:user:${student.usuarioId}`, NOTIFICATION_TTL_SECONDS);
    }
  } catch (err) {
    console.warn("[GestionNotification] No se pudo notificar a los estudiantes:", err);
  }
}