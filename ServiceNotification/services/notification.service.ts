import { getRedis } from "../connects/Redis/redis.ts";
import { query } from "../connects/Database/transaction.ts";
import { NOTIF_TTL_SECONDS, notificationConfig } from "../config/notification.config.ts";
import type {
  NotificationCount,
  NotificationDraft,
  NotificationItem,
} from "../models/notification.ts";
import { publishNotification } from "./gateway.service.ts";

// interfaz -> contexto asignacion
export interface AsignacionInfo {
  materiaNombre: string;
  profesorNombre: string;
  cursoParalelo: string;
  cursoPeriodoId: string;
}

function buildTextoPlano(draft: NotificationDraft): string {
  if (draft.textoPlano?.trim()) return draft.textoPlano;

  const lineas: string[] = [];
  if (draft.profesorNombre && draft.cursoParalelo) {
    lineas.push(`Profesor: ${draft.profesorNombre} - ${draft.cursoParalelo}`);
  }
  if (draft.materiaNombre) lineas.push(`Materia: ${draft.materiaNombre}`);
  lineas.push(`Título: ${draft.titulo}`);
  if (draft.publicoTexto) lineas.push(`Publicó: ${draft.publicoTexto}`);
  if (draft.mensaje) lineas.push(draft.mensaje);
  if (draft.fechaLimite) {
    lineas.push(`Fecha límite: ${draft.fechaLimite.replace("T", " ").slice(0, 16)}`);
  }
  return lineas.join("\n");
}

function buildNotificationId(): string {
  return `notif_${crypto.randomUUID()}`;
}

class CentralNotificationService {
  // metodo -> construir notificacion
  private build(draft: NotificationDraft): NotificationItem {
    return {
      id: buildNotificationId(),
      tipo: draft.tipo,
      canal: draft.canal,
      prioridad: draft.prioridad,
      titulo: draft.titulo,
      mensaje: draft.mensaje,
      textoPlano: buildTextoPlano(draft),
      materiaNombre: draft.materiaNombre,
      profesorNombre: draft.profesorNombre,
      cursoParalelo: draft.cursoParalelo,
      publicoTexto: draft.publicoTexto,
      fechaLimite: draft.fechaLimite ?? null,
      asignacionId: draft.asignacionId !== undefined ? String(draft.asignacionId) : undefined,
      cursoPeriodoId: draft.cursoPeriodoId !== undefined ? String(draft.cursoPeriodoId) : undefined,
      itemId: draft.itemId !== undefined ? String(draft.itemId) : undefined,
      origen: draft.origen,
      fechaCreacion: new Date().toISOString(),
    };
  }

  private async persist(notif: NotificationItem, userIds: string[], global: boolean): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    const notifJson = JSON.stringify(notif);

    try {
      await redis.set(`notification:${notif.id}`, notifJson, "EX", NOTIF_TTL_SECONDS);

      if (global) {
        await redis.lpush("notifications:global", notif.id);
        await redis.expire("notifications:global", NOTIF_TTL_SECONDS);
      }

      for (const userId of userIds) {
        const key = `notifications:user:${userId}`;
        await redis.lpush(key, notif.id);
        await redis.expire(key, NOTIF_TTL_SECONDS);
      }
    } catch (err) {
      console.warn("[NotificationService.persist] Error en Redis:", err);
    }
  }

  // metodo -> entregar usuarios lista
  async deliverToUsers(userIds: string[], draft: NotificationDraft): Promise<NotificationItem> {
    const notif = this.build(draft);
    const unicos = [...new Set(userIds.filter(Boolean).map(String))];

    await this.persist(notif, unicos, false);

    for (const userId of unicos) {
      publishNotification(userId, notif);
    }

    return notif;
  }

  // metodo -> enviar usuario unico
  async sendToUser(userId: string | number, draft: NotificationDraft): Promise<NotificationItem> {
    return this.deliverToUsers([String(userId)], draft);
  }

  // metodo -> notificar curso
  async sendToCourse(
    cursoPeriodoId: string | number,
    draft: NotificationDraft,
    asignacionId?: string | number,
  ): Promise<NotificationItem | null> {
    const courseId = String(cursoPeriodoId);
    let enriched: NotificationDraft = { ...draft, cursoPeriodoId: courseId };

    if (asignacionId) {
      const info = await this.resolveAsignacion(asignacionId);
      if (info) {
        enriched = {
          ...enriched,
          materiaNombre: draft.materiaNombre ?? info.materiaNombre,
          profesorNombre: draft.profesorNombre ?? info.profesorNombre,
          cursoParalelo: draft.cursoParalelo ?? info.cursoParalelo,
          cursoPeriodoId: info.cursoPeriodoId || courseId,
        };
      }
    }

    const userIds = await this.resolveCursoStudents(enriched.cursoPeriodoId as string);
    return this.deliverToUsers(userIds, enriched);
  }

  // metodo -> notificar roles
  async sendToRoles(roles: string[], draft: NotificationDraft): Promise<NotificationItem> {
    const userIds = await this.resolveUsuariosPorRol(roles);
    return this.deliverToUsers(userIds, draft);
  }

  // metodo -> notificar institucion
  async sendToAll(draft: NotificationDraft): Promise<NotificationItem> {
    const notif = this.build(draft);
    await this.persist(notif, [], true);
    return notif;
  }

  // grupo -> consultas bandeja

  async list(
    userId: string | number,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<NotificationItem[]> {
    const redis = getRedis();
    if (!redis) return [];

    const uid = String(userId);
    const limit = Math.min(
      opts.limit ?? notificationConfig.maxPorConsulta,
      notificationConfig.maxPorConsulta,
    );

    try {
      const [propias, globales] = await Promise.all([
        redis.lrange(`notifications:user:${uid}`, 0, limit - 1) as Promise<string[]>,
        redis.lrange("notifications:global", 0, limit - 1) as Promise<string[]>,
      ]);

      const ids: string[] = [];
      for (const id of [...propias, ...globales]) {
        if (!ids.includes(id)) ids.push(id);
      }
      if (ids.length === 0) return [];

      const raws = await Promise.all(
        ids.map((id) => redis.get(`notification:${id}`) as Promise<string | null>),
      );

      const items: NotificationItem[] = [];
      for (const raw of raws) {
        if (!raw) continue;
        const item = JSON.parse(raw) as NotificationItem;
        const isRead = await redis.sismember(`notification:views:${item.id}`, uid);
        item.leido = Boolean(isRead);
        if (opts.unreadOnly && item.leido) continue;
        items.push(item);
      }

      return items;
    } catch (err) {
      console.warn("[NotificationService.list] Error:", err);
      return [];
    }
  }

  async count(userId: string | number): Promise<NotificationCount> {
    const total = await this.list(userId);
    return { total: total.length, noLeidas: total.filter((n) => !n.leido).length };
  }

  async getById(userId: string | number, notificationId: string): Promise<NotificationItem | null> {
    const items = await this.list(userId, { limit: notificationConfig.maxPorConsulta });
    return items.find((n) => n.id === notificationId) ?? null;
  }

  // grupo -> mutaciones estado

  async markAsRead(userId: string | number, notificationId: string): Promise<boolean> {
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

  async markAllAsRead(userId: string | number): Promise<number> {
    const items = await this.list(userId);
    let marcadas = 0;
    for (const item of items) {
      if (!item.leido && await this.markAsRead(userId, item.id)) marcadas++;
    }
    return marcadas;
  }

  // metodo -> quitar bandeja
  async removeForUser(userId: string | number, notificationId: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;

    try {
      await redis.lrem(`notifications:user:${String(userId)}`, 0, notificationId);
      return true;
    } catch (err) {
      console.warn("[NotificationService.removeForUser] Error en Redis:", err);
      return false;
    }
  }

  // grupo -> resolver destinatarios

  async resolveAsignacion(asignacionId: string | number): Promise<AsignacionInfo | null> {
    const res = await query<{
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
      [asignacionId],
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    return {
      materiaNombre: row.materia_nombre,
      profesorNombre: `${row.profesor_nombre} ${row.profesor_apellido}`.trim(),
      cursoParalelo: `${row.grado} "${row.paralelo}" ${row.nivel.toUpperCase()}`,
      cursoPeriodoId: String(row.curso_periodo_id),
    };
  }

  // query -> estudiantes curso
  async resolveCursoStudents(cursoPeriodoId: string | number): Promise<string[]> {
    const res = await query<{ usuario_id: bigint }>(
      `SELECT e.usuario_id
       FROM inscripciones i
       JOIN estudiantes e ON e.id = i.estudiante_id
       WHERE i.curso_periodo_id = $1 AND i.estado = 'activo'`,
      [cursoPeriodoId],
    );
    return res.rows.map((r) => String(r.usuario_id));
  }

  // query -> curso docentes
  async resolveCursoDocentes(cursoPeriodoId: string | number): Promise<string[]> {
    const res = await query<{ usuario_id: bigint }>(
      `SELECT DISTINCT e.usuario_id
       FROM (
         SELECT e.usuario_id
         FROM inscripciones i
         JOIN estudiantes e ON e.id = i.estudiante_id
         WHERE i.curso_periodo_id = $1 AND i.estado = 'activo'
         UNION
         SELECT u.id AS usuario_id
         FROM asignaciones_docentes ad
         JOIN maestros ma ON ma.id = ad.maestro_id
         JOIN usuarios u ON u.id = ma.usuario_id
         WHERE ad.curso_periodo_id = $1
       ) e`,
      [cursoPeriodoId],
    );
    return res.rows.map((r) => String(r.usuario_id));
  }

  // query -> usuario estudiante
  async resolveEstudianteUsuario(estudianteId: string | number): Promise<string | null> {
    const res = await query<{ usuario_id: bigint }>(
      `SELECT usuario_id FROM estudiantes WHERE id = $1`,
      [estudianteId],
    );
    return res.rows[0] ? String(res.rows[0].usuario_id) : null;
  }

  // query -> docentes materia
  async resolveMateriaDocentes(materiaId: string | number): Promise<string[]> {
    const res = await query<{ usuario_id: bigint }>(
      `SELECT DISTINCT u.id AS usuario_id
       FROM asignaciones_docentes ad
       JOIN maestros ma ON ma.id = ad.maestro_id
       JOIN usuarios u ON u.id = ma.usuario_id
       WHERE ad.materia_id = $1 AND ad.estado = 'activo'`,
      [materiaId],
    );
    return res.rows.map((r) => String(r.usuario_id));
  }

  // query -> docente asignacion
  async resolveAsignacionDocentes(asignacionId: string | number): Promise<string[]> {
    const res = await query<{ usuario_id: bigint }>(
      `SELECT u.id AS usuario_id
       FROM asignaciones_docentes ad
       JOIN maestros ma ON ma.id = ad.maestro_id
       JOIN usuarios u ON u.id = ma.usuario_id
       WHERE ad.id = $1`,
      [asignacionId],
    );
    return res.rows.map((r) => String(r.usuario_id));
  }

  // query -> docente encargo
  async resolveEncargoDocente(encargoId: string | number): Promise<string[]> {
    const res = await query<{ usuario_id: bigint }>(
      `SELECT u.id AS usuario_id
       FROM encargos e
       JOIN asignaciones_docentes ad ON ad.id = e.asignacion_id
       JOIN maestros ma ON ma.id = ad.maestro_id
       JOIN usuarios u ON u.id = ma.usuario_id
       WHERE e.id = $1`,
      [encargoId],
    );
    return res.rows.map((r) => String(r.usuario_id));
  }

  // query -> cursos con horario
  async resolveCursosDelPeriodoConHorarios(periodoId: string | number): Promise<string[]> {
    const res = await query<{ curso_periodo_id: bigint }>(
      `SELECT DISTINCT h.curso_periodo_id
       FROM horarios h
       JOIN cursos_periodo cp ON cp.id = h.curso_periodo_id
       WHERE cp.periodo_id = $1 AND h.estado = 'activo'`,
      [periodoId],
    );
    return res.rows.map((r) => String(r.curso_periodo_id));
  }

  // query -> usuarios roles
  async resolveUsuariosPorRol(roles: string[]): Promise<string[]> {
    if (roles.length === 0) return [];

    const res = await query<{ id: bigint }>(
      `SELECT u.id
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE r.rol = ANY($1) AND u.estado = 'activo'`,
      [roles],
    );
    return res.rows.map((r) => String(r.id));
  }
}

export const NotificationService = new CentralNotificationService();
