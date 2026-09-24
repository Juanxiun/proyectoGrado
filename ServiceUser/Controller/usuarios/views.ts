import { Context, RouterContext } from "@oak/oak";
import { query } from "../../connects/Database/transaction.ts";
import { serialize } from "../../utils/serialize.ts";
import { resolveMediaIn } from "../../connects/Storage/minio.ts";

/**
 * GET /usuarios
 *
 * Query params:
 *   - page     (default: 1)
 *   - limit    (default: 20, max: 100)
 *   - rolId    (filtrar por rol)
 *   - estado   (filtrar por estado: 0 | 1 | 2)
 *   - buscar   (buscar por nombre, apellido o username)
 */
export async function getUsuarios(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const pageValue = Number(params.get("page") ?? "1");
    const limitValue = Number(params.get("limit") ?? "20");
    const page = Number.isFinite(pageValue) ? Math.max(1, Math.floor(pageValue)) : 1;
    const limit = Number.isFinite(limitValue) ? Math.min(100, Math.max(1, Math.floor(limitValue))) : 20;
    const offset = (page - 1) * limit;
    const rolId = params.get("rolId");
    const estado = params.get("estado");
    const buscar = params.get("buscar");

    if (rolId && !/^\d+$/.test(rolId)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "rolId debe ser numérico" };
      return;
    }

    //Condiciones dinámicas
    const conditions: string[] = [];
    const filterParams: unknown[] = [];
    let idx = 1;
    const viewerRole = ctx.state.auth?.role;

    if (viewerRole === "control") {
      conditions.push(`LOWER(r.rol) IN ('profesor', 'profesores', 'maestro', 'maestros', 'docente', 'estudiante', 'estudiantes', 'apoderado', 'tutor', 'control', 'administrativo', 'gerencia', 'secretaria', 'secretario', 'editor')`);
    } else if (viewerRole === "profesor") {
      conditions.push(`LOWER(r.rol) IN ('estudiante', 'estudiantes', 'alumno', 'alumnos')`);
    }

    if (rolId) {
      conditions.push(`u.rol_id = $${idx++}`);
      filterParams.push(rolId);
    }
    if (estado !== null && estado !== undefined && estado !== "") {
      let estadoFiltro = estado;
      if (estado === "1") estadoFiltro = "activo";
      else if (estado === "0") estadoFiltro = "inactivo";
      else if (estado === "2") estadoFiltro = "bloqueado";
      conditions.push(`u.estado = $${idx++}`);
      filterParams.push(estadoFiltro);
    }
    if (buscar) {
      conditions.push(`(
        u.nombre ILIKE $${idx} OR
        u.apellido_paterno ILIKE $${idx} OR
        u.apellido_materno ILIKE $${idx} OR
        uc.username ILIKE $${idx}
      )`);
      filterParams.push(`%${buscar}%`);
      idx++;
    }

    const where = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    //Query principal con alias en camelCase
    const mainQuery = `
      SELECT
        u.id,
        u.nombre,
        u.apellido_paterno AS "apellidoPaterno",
        u.apellido_materno AS "apellidoMaterno",
        u.nacimiento,
        u.genero,
        u.foto_url AS "fotoUrl",
        u.estado,
        u.fecha_creacion AS "fechaCreacion",
        u.fecha_actualizacion AS "fechaActualizacion",
        r.id  AS "rolId",
        r.rol,
        uc.username,
        uc.email,
        uc.primer_login AS "primerLogin",
        uc.datos_personales_actualizados AS "datosPersonalesActualizados",
        uc.contacto_tutor_actualizado AS "contactoTutorActualizado",
        uc.password_actualizado AS "passwordActualizado",
        uc.ultimo_login AS "ultimoLogin",
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', mm.materia_id,
            'codigo', m.codigo,
            'nombre', m.nombre
          ) ORDER BY m.nombre)
          FROM maestros ma
          JOIN maestro_materias mm ON mm.maestro_id = ma.id
          JOIN materias m ON m.id = mm.materia_id
          WHERE ma.usuario_id = u.id
        ), '[]'::json) AS "materias",
        COALESCE((SELECT ma.materias_configuradas FROM maestros ma WHERE ma.usuario_id = u.id LIMIT 1), false) AS "materiasConfigurado"
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      LEFT JOIN usuario_cuenta uc ON uc.usuario_id = u.id
      ${where}
      ORDER BY u.fecha_creacion DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      LEFT JOIN usuario_cuenta uc ON uc.usuario_id = u.id
      ${where}
    `;

    const [dataRes, countRes] = await Promise.all([
      query(mainQuery, [...filterParams, limit, offset]),
      query<{ total: string }>(countQuery, filterParams),
    ]);

    // Para cada usuario, traer sus documentos relacionados formateados
    // deno-lint-ignore no-explicit-any
    const userIds = dataRes.rows.map((r: any) => r.id);
    // deno-lint-ignore no-explicit-any
    const docsByUserId: Record<string, any[]> = {};

    if (userIds.length > 0) {
      // deno-lint-ignore no-explicit-any
      const docsRes = await query<any>(
        `SELECT usuario_id, id, tipo_doc AS "tipoDoc", numero_doc AS "numeroDoc", doc_url AS "docUrl"
         FROM usuario_documentos WHERE usuario_id = ANY($1)`,
        [userIds],
      );
      for (const d of docsRes.rows) {
        const uid = String(d.usuario_id);
        if (!docsByUserId[uid]) docsByUserId[uid] = [];
        docsByUserId[uid].push({
          id: String(d.id),
          tipoDoc: d.tipoDoc,
          numeroDoc: d.numeroDoc,
          docUrl: d.docUrl,
        });
      }
    }

    // deno-lint-ignore no-explicit-any
    const formattedData = dataRes.rows.map((r: any) => ({
      ...r,
      id: String(r.id),
      rolId: String(r.rolId),
      nacimiento: r.nacimiento instanceof Date
        ? r.nacimiento.toISOString().slice(0, 10)
        : (r.nacimiento ? String(r.nacimiento).slice(0, 10) : ""),
      apellidoPaterno: r.apellidoPaterno ?? "",
      apellidoMaterno: r.apellidoMaterno ?? "",
      documentos: docsByUserId[String(r.id)] ?? [],
      materias: Array.isArray(r.materias) ? r.materias : [],
      materiasConfigurado: Boolean(r.materiasConfigurado),
    }));

    ctx.response.status = 200;
    ctx.response.body = serialize(await resolveMediaIn({
      data: formattedData,
      total: Number(countRes.rows[0].total),
      page,
      limit,
      totalPages: Math.ceil(Number(countRes.rows[0].total) / limit),
    }));
  } catch (err) {
    console.error("[getUsuarios]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}

/**
 * GET /usuarios/:id
 *
 * Retorna el usuario completo con todas sus relaciones:
 * cuenta, documentos, dirección, contactos y apoderados (si es estudiante).
 */
export async function getUsuario(
  ctx: RouterContext<"/usuarios/:id">,
): Promise<void> {
  try {
    const id = ctx.params.id;
    if (!/^\d+$/.test(id)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El id debe ser numérico" };
      return;
    }

    //Usuario base con alias camelCase
    const userRes = await query<{
      id: bigint;
      nombre: string;
      apellidoPaterno: string;
      apellidoMaterno: string;
      nacimiento: Date;
      genero: string | null;
      fotoUrl: string | null;
      estado: string | number;
      fechaCreacion: Date;
      fechaActualizacion: Date;
      rolId: bigint;
      rol: string;
      materiasConfigurado?: boolean;
    }>(
      `SELECT
         u.id, u.nombre,
         u.apellido_paterno AS "apellidoPaterno",
         u.apellido_materno AS "apellidoMaterno",
         u.nacimiento, u.genero,
         u.foto_url AS "fotoUrl",
         u.estado,
         u.fecha_creacion AS "fechaCreacion",
         u.fecha_actualizacion AS "fechaActualizacion",
         r.id AS "rolId", r.rol,
         COALESCE((SELECT ma.materias_configuradas FROM maestros ma WHERE ma.usuario_id = u.id LIMIT 1), false) AS "materiasConfigurado"
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.id = $1`,
      [id],
    );

    if (userRes.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: `Usuario con id=${id} no encontrado` };
      return;
    }

    const user = userRes.rows[0];
    const viewerRole = ctx.state.auth?.role;
    const isSelf = String(ctx.state.auth?.sub) === String(id);
    const targetRole = String(user.rol).trim().toLowerCase();
    const isOwnTutor = viewerRole === "estudiante" && await query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM estudiantes e
         JOIN estudiante_apoderado ea ON ea.estudiante_id = e.id
         JOIN apoderados a ON a.id = ea.apoderado_id
         WHERE e.usuario_id = $1 AND a.usuario_id = $2
       ) AS exists`,
      [ctx.state.auth?.sub, id],
    ).then((result) => Boolean(result.rows[0]?.exists));
    const canView = isSelf || isOwnTutor ||
      viewerRole === "director" ||
      (viewerRole === "control" && ["profesor", "maestro", "docente", "estudiante", "padre", "padres", "apoderado", "tutor"].includes(targetRole)) ||
      (viewerRole === "profesor" && ["estudiante", "padre", "padres", "apoderado", "tutor"].includes(targetRole));

    if (!canView) {
      ctx.response.status = 403;
      ctx.response.body = { error: "No tiene permisos para consultar este usuario" };
      return;
    }

    //Consultas paralelas de relaciones
    const [cuentaRes, docRes, dirRes, contRes, apodRes, materiasRes] = await Promise.all([
      query(
        `SELECT id, username, email, email_verificado AS "emailVerificado",
           primer_login AS "primerLogin",
           datos_personales_actualizados AS "datosPersonalesActualizados",
           contacto_tutor_actualizado AS "contactoTutorActualizado",
           password_actualizado AS "passwordActualizado",
           ultimo_login AS "ultimoLogin"
         FROM usuario_cuenta WHERE usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT id, tipo_doc AS "tipoDoc", numero_doc AS "numeroDoc", doc_url AS "docUrl", fecha_creacion AS "fechaCreacion"
         FROM usuario_documentos WHERE usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT id, zona, distrito, bloque, calle, numero,
                edificio, piso, referencia, fecha_actualizacion AS "fechaActualizacion"
         FROM usuario_direcciones WHERE usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT id, tipo, contenido, principal, fecha_creacion AS "fechaCreacion"
         FROM usuario_contactos WHERE usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT
           u2.id AS "apoderadoId",
           ea.parentesco,
           ea.es_principal AS "esPrincipal",
           ea.autorizado_recoger AS "autorizadoRecoger",
           u2.nombre,
           u2.apellido_paterno AS "apellidoPaterno",
           u2.apellido_materno AS "apellidoMaterno",
           uc2.username,
           (SELECT numero_doc FROM usuario_documentos WHERE usuario_id = u2.id AND tipo_doc = 'CI' LIMIT 1) AS "ci",
           (SELECT contenido FROM usuario_contactos WHERE usuario_id = u2.id AND (tipo = 'Celular' OR tipo = 'Telefono') ORDER BY principal DESC, id ASC LIMIT 1) AS "celular",
           (SELECT contenido FROM usuario_contactos WHERE usuario_id = u2.id AND (tipo = 'Celular' OR tipo = 'Telefono') ORDER BY principal DESC, id ASC LIMIT 1) AS "telefono"
         FROM estudiantes e
         JOIN estudiante_apoderado ea ON ea.estudiante_id = e.id
         JOIN apoderados a ON a.id = ea.apoderado_id
         JOIN usuarios u2 ON u2.id = a.usuario_id
         LEFT JOIN usuario_cuenta uc2 ON uc2.usuario_id = u2.id
         WHERE e.usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT mm.materia_id AS id, m.codigo, m.nombre
         FROM maestros ma
         JOIN maestro_materias mm ON mm.maestro_id = ma.id
         JOIN materias m ON m.id = mm.materia_id
         WHERE ma.usuario_id = $1
         ORDER BY m.nombre`,
        [id],
      ),
    ]);

    ctx.response.status = 200;
    ctx.response.body = serialize(await resolveMediaIn({
      ...user,
      id: String(user.id),
      rolId: String(user.rolId),
      nacimiento: user.nacimiento instanceof Date
        ? user.nacimiento.toISOString().slice(0, 10)
        : (user.nacimiento ? String(user.nacimiento).slice(0, 10) : ""),
      // deno-lint-ignore no-explicit-any
      apellidoPaterno: user.apellidoPaterno ?? (user as any).apellido_paterno ?? "",
      // deno-lint-ignore no-explicit-any
      apellidoMaterno: user.apellidoMaterno ?? (user as any).apellido_materno ?? "",
      cuenta: cuentaRes.rows[0] ?? null,
      documentos: docRes.rows,
      direccion: dirRes.rows[0] ?? null,
      contactos: contRes.rows,
      apoderados: apodRes.rows,
      materias: materiasRes.rows,
    }));
  } catch (err) {
    console.error("[getUsuario]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}

