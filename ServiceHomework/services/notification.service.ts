import { getRedis } from "../connects/Redis/redis.ts";
import { query } from "../connects/Database/transaction.ts";

export const NOTIF_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días exactos (2,592,000 segundos)

export interface NotificationPayload {
  tipo: "material" | "actividad";
  titulo: string;
  asignacionId?: string | number;
  materiaNombre?: string;
  profesorNombre?: string;
  cursoParalelo?: string;
  publicoTexto?: string;
  fechaLimite?: string | null;
  cursoPeriodoId?: string | number;
  itemId?: string | number;
  textoPlano?: string;
}

export interface NotificationItem {
  id: string;
  tipo: "material" | "actividad";
  titulo: string;
  materiaNombre: string;
  profesorNombre: string;
  cursoParalelo: string;
  publicoTexto: string;
  fechaLimite?: string | null;
  asignacionId: string;
  cursoPeriodoId: string;
  itemId?: string;
  fechaCreacion: string;
  textoPlano: string;
  leido?: boolean;
}

class DecoupledNotificationService {
  /**
   * Envía una notificación directa a un usuario específico
   */
  async sendToUser(
    userId: string | number,
    payload: NotificationPayload,
  ): Promise<NotificationItem | null> {
    const redis = getRedis();
    const notifId = `notif_${crypto.randomUUID()}`;
    const fechaLimiteText = payload.fechaLimite
      ? payload.fechaLimite.replace("T", " ").slice(0, 16)
      : "Sin fecha límite";

    const textoPlano = payload.textoPlano || [
      `Profesor: ${payload.profesorNombre ?? "Docente"} - ${payload.cursoParalelo ?? "Curso"}`,
      `Materia: ${payload.materiaNombre ?? "Materia"}`,
      `Título: ${payload.titulo}`,
      `Publicó: ${payload.publicoTexto ?? (payload.tipo === "material" ? "Material académico" : "Actividad")}`,
      `Fecha límite: ${fechaLimiteText}`,
    ].join("\n");

    const notif: NotificationItem = {
      id: notifId,
      tipo: payload.tipo,
      titulo: payload.titulo,
      materiaNombre: payload.materiaNombre ?? "Materia",
      profesorNombre: payload.profesorNombre ?? "Docente",
      cursoParalelo: payload.cursoParalelo ?? "General",
      publicoTexto: payload.publicoTexto ?? (payload.tipo === "material" ? "Material académico" : "Actividad nueva"),
      fechaLimite: payload.fechaLimite ?? null,
      asignacionId: String(payload.asignacionId ?? "0"),
      cursoPeriodoId: String(payload.cursoPeriodoId ?? "0"),
      itemId: payload.itemId ? String(payload.itemId) : undefined,
      fechaCreacion: new Date().toISOString(),
      textoPlano,
    };

    if (redis) {
      try {
        const notifJson = JSON.stringify(notif);
        await redis.set(`notification:${notifId}`, notifJson, "EX", NOTIF_TTL_SECONDS);
        await redis.lpush(`notifications:user:${userId}`, notifId);
        await redis.expire(`notifications:user:${userId}`, NOTIF_TTL_SECONDS);
      } catch (err) {
        console.warn("[NotificationService.sendToUser] Error en Redis:", err);
      }
    }

    return notif;
  }

  /**
   * Envía una notificación a todos los estudiantes inscritos en un curso/periodo
   */
  async sendToCourse(
    courseId: string | number,
    _parallelId?: string | number,
    payload: NotificationPayload = { tipo: "material", titulo: "" },
  ): Promise<NotificationItem | null> {
    const redis = getRedis();
    const notifId = `notif_${crypto.randomUUID()}`;
    const fechaLimiteText = payload.fechaLimite
      ? payload.fechaLimite.replace("T", " ").slice(0, 16)
      : "Sin fecha límite";

    const textoPlano = payload.textoPlano || [
      `Profesor: ${payload.profesorNombre ?? "Docente"} - ${payload.cursoParalelo ?? "Curso"}`,
      `Materia: ${payload.materiaNombre ?? "Materia"}`,
      `Título: ${payload.titulo}`,
      `Publicó: ${payload.publicoTexto ?? (payload.tipo === "material" ? "Material académico" : "Actividad")}`,
      `Fecha límite: ${fechaLimiteText}`,
    ].join("\n");

    const notif: NotificationItem = {
      id: notifId,
      tipo: payload.tipo,
      titulo: payload.titulo,
      materiaNombre: payload.materiaNombre ?? "Materia",
      profesorNombre: payload.profesorNombre ?? "Docente",
      cursoParalelo: payload.cursoParalelo ?? "Curso",
      publicoTexto: payload.publicoTexto ?? (payload.tipo === "material" ? "Material académico" : "Actividad nueva"),
      fechaLimite: payload.fechaLimite ?? null,
      asignacionId: String(payload.asignacionId ?? "0"),
      cursoPeriodoId: String(courseId),
      itemId: payload.itemId ? String(payload.itemId) : undefined,
      fechaCreacion: new Date().toISOString(),
      textoPlano,
    };

    if (redis) {
      try {
        const notifJson = JSON.stringify(notif);
        await redis.set(`notification:${notifId}`, notifJson, "EX", NOTIF_TTL_SECONDS);
        await redis.lpush(`notifications:curso:${courseId}`, notifId);
        await redis.expire(`notifications:curso:${courseId}`, NOTIF_TTL_SECONDS);

        // Obtener todos los estudiantes activos inscritos en el curso_periodo
        const estRes = await query<{ usuario_id: bigint }>(
          `SELECT e.usuario_id 
           FROM inscripciones i
           JOIN estudiantes e ON e.id = i.estudiante_id
           WHERE i.curso_periodo_id = $1 AND i.estado = 'activo'`,
          [courseId],
        );

        for (const est of estRes.rows) {
          await redis.lpush(`notifications:user:${est.usuario_id}`, notifId);
          await redis.expire(`notifications:user:${est.usuario_id}`, NOTIF_TTL_SECONDS);
        }
      } catch (err) {
        console.warn("[NotificationService.sendToCourse] Error en Redis:", err);
      }
    }

    return notif;
  }

  /**
   * Marca una notificación como leída por un usuario específico (usando Redis Sets)
   */
  async markAsRead(
    userId: string | number,
    notificationId: string,
  ): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;

    try {
      await redis.sadd(`notification:views:${notificationId}`, String(userId));
      await redis.expire(`notification:views:${notificationId}`, NOTIF_TTL_SECONDS);
      return true;
    } catch (err) {
      console.warn("[NotificationService.markAsRead] Error en Redis:", err);
      return false;
    }
  }

  /**
   * Obtiene todas las notificaciones del usuario (con indicador leido/no leido)
   */
  async getUserNotifications(
    userId: string | number,
  ): Promise<NotificationItem[]> {
    const redis = getRedis();
    if (!redis) return [];

    try {
      const notifIds: string[] = await redis.lrange(`notifications:user:${userId}`, 0, 49);
      if (!notifIds || notifIds.length === 0) return [];

      const notifs: NotificationItem[] = [];
      for (const id of notifIds) {
        const raw = await redis.get(`notification:${id}`);
        if (raw) {
          const item: NotificationItem = JSON.parse(raw);
          const isRead = await redis.sismember(`notification:views:${id}`, String(userId));
          item.leido = Boolean(isRead);
          notifs.push(item);
        }
      }
      return notifs;
    } catch (err) {
      console.warn("[NotificationService.getUserNotifications] Error:", err);
      return [];
    }
  }

  /**
   * Retorna únicamente las notificaciones no leídas del usuario
   */
  async getUnread(userId: string | number): Promise<NotificationItem[]> {
    const all = await this.getUserNotifications(userId);
    return all.filter((n) => !n.leido);
  }
}

export const NotificationService = new DecoupledNotificationService();

// Funciones wrapper compatibles hacia atrás
export async function createAndDispatchNotification(params: {
  tipo: "material" | "actividad";
  titulo: string;
  asignacionId: string | number;
  itemId?: string | number;
  fechaLimite?: string | null;
}): Promise<NotificationItem | null> {
  try {
    const infoRes = await query<{
      materia_nombre: string;
      profesor_nombre: string;
      profesor_apellido: string;
      grado: string;
      paralelo: string;
      nivel: string;
      curso_periodo_id: bigint;
    }>(
      `SELECT 
         m.nombre AS materia_nombre,
         u.nombre AS profesor_nombre,
         u.apellido_paterno AS profesor_apellido,
         c.grado,
         c.paralelo,
         c.nivel,
         cp.id AS curso_periodo_id
       FROM asignaciones_docentes ad
       JOIN materias m ON m.id = ad.materia_id
       JOIN maestros ma ON ma.id = ad.maestro_id
       JOIN usuarios u ON u.id = ma.usuario_id
       JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
       JOIN cursos c ON c.id = cp.curso_id
       WHERE ad.id = $1`,
      [params.asignacionId],
    );

    if (infoRes.rows.length === 0) {
      console.warn(`[Notification] No se encontró asignación ${params.asignacionId}`);
      return null;
    }

    const row = infoRes.rows[0];
    const cursoParalelo = `${row.grado} "${row.paralelo}" ${row.nivel.toUpperCase()}`;
    const profesorNombre = `${row.profesor_nombre} ${row.profesor_apellido}`.trim();
    const materiaNombre = row.materia_nombre;
    const publicoTexto = params.tipo === "material" ? "Material académico" : "Actividad nueva";

    return await NotificationService.sendToCourse(
      String(row.curso_periodo_id),
      undefined,
      {
        tipo: params.tipo,
        titulo: params.titulo,
        asignacionId: params.asignacionId,
        materiaNombre,
        profesorNombre,
        cursoParalelo,
        publicoTexto,
        fechaLimite: params.fechaLimite ?? null,
        itemId: params.itemId,
      },
    );
  } catch (err) {
    console.warn("[Notification] Error creando notificación en curso:", err);
    return null;
  }
}

export async function getUserNotifications(
  usuarioId: string | number,
): Promise<NotificationItem[]> {
  return NotificationService.getUserNotifications(usuarioId);
}

export async function markNotificationAsRead(
  notifId: string,
  usuarioId: string | number,
): Promise<boolean> {
  return NotificationService.markAsRead(usuarioId, notifId);
}
