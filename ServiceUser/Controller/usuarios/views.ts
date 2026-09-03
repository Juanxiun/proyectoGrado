import { Context, RouterContext } from "@oak/oak";
import { query } from "../../connects/Database/transaction.ts";
import { serialize } from "../../utils/serialize.ts";

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
    const page = Math.max(1, Number(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? "20")));
    const offset = (page - 1) * limit;
    const rolId = params.get("rolId");
    const estado = params.get("estado");
    const buscar = params.get("buscar");

    //Condiciones dinámicas
    const conditions: string[] = [];
    const filterParams: unknown[] = [];
    let idx = 1;

    if (rolId) {
      conditions.push(`u.rol_id = $${idx++}`);
      filterParams.push(rolId);
    }
    if (estado !== null && estado !== undefined && estado !== "") {
      conditions.push(`u.estado = $${idx++}`);
      filterParams.push(Number(estado));
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

    //Query principal
    const mainQuery = `
      SELECT
        u.id,
        u.nombre,
        u.apellido_paterno,
        u.apellido_materno,
        u.nacimiento,
        u.genero,
        u.foto_url,
        u.estado,
        u.fecha_creacion,
        u.fecha_actualizacion,
        r.id  AS rol_id,
        r.rol,
        uc.username,
        uc.email,
        uc.ultimo_login
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

    ctx.response.status = 200;
    const data = dataRes.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      apellidoPaterno: row.apellido_paterno,
      apellidoMaterno: row.apellido_materno,
      nacimiento: row.nacimiento,
      genero: row.genero,
      fotoUrl: row.foto_url,
      estado: row.estado,
      fechaCreacion: row.fecha_creacion,
      fechaActualizacion: row.fecha_actualizacion,
      rolId: row.rol_id,
      rol: row.rol,
      username: row.username,
      email: row.email,
      ultimoLogin: row.ultimo_login,
    }));

    ctx.response.body = serialize({
      data,
      total: Number(countRes.rows[0].total),
      page,
      limit,
      totalPages: Math.ceil(Number(countRes.rows[0].total) / limit),
    });
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

    //Usuario base
    const userRes = await query<{
      id: bigint;
      nombre: string;
      apellido_paterno: string;
      apellido_materno: string;
      nacimiento: Date;
      genero: string | null;
      foto_url: string | null;
      estado: number;
      fecha_creacion: Date;
      fecha_actualizacion: Date;
      rol_id: bigint;
      rol: string;
    }>(
      `SELECT
         u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
         u.nacimiento, u.genero, u.foto_url, u.estado,
         u.fecha_creacion, u.fecha_actualizacion,
         r.id AS rol_id, r.rol
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

    //Consultas paralelas de relaciones
    const [cuentaRes, docRes, dirRes, contRes, apodRes] = await Promise.all([
      query(
        `SELECT id, username, email, ultimo_login
         FROM usuario_cuenta WHERE usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT id, tipo_doc, numero_doc, doc_url
         FROM usuario_doc WHERE usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT id, zona, distrito, bloque, calle, numero,
                edificio, piso, referencia
         FROM usuario_dir WHERE usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT id, tipo, contenido FROM usuario_cont WHERE usuario_id = $1`,
        [id],
      ),
      query(
        `SELECT
           ea.apoderado_id, ea.parentesco, ea.es_principal,
           u2.nombre, u2.apellido_paterno, u2.apellido_materno,
           uc2.username
         FROM estudiante_apoderado ea
         JOIN usuarios u2 ON u2.id = ea.apoderado_id
         LEFT JOIN usuario_cuenta uc2 ON uc2.usuario_id = u2.id
         WHERE ea.estudiante_id = $1`,
        [id],
      ),
    ]);

    ctx.response.status = 200;
    const cuenta = cuentaRes.rows[0];
    const direccion = dirRes.rows[0];
    ctx.response.body = serialize({
      id: user.id,
      nombre: user.nombre,
      apellidoPaterno: user.apellido_paterno,
      apellidoMaterno: user.apellido_materno,
      nacimiento: user.nacimiento,
      genero: user.genero,
      fotoUrl: user.foto_url,
      estado: user.estado,
      fechaCreacion: user.fecha_creacion,
      fechaActualizacion: user.fecha_actualizacion,
      rolId: user.rol_id,
      rol: user.rol,
      cuenta: cuenta ? {
        id: cuenta.id,
        username: cuenta.username,
        email: cuenta.email,
        ultimoLogin: cuenta.ultimo_login,
      } : null,
      documentos: docRes.rows.map((doc) => ({
        id: doc.id,
        tipoDoc: doc.tipo_doc,
        numeroDoc: doc.numero_doc,
        docUrl: doc.doc_url,
      })),
      direccion: direccion ? {
        id: direccion.id,
        zona: direccion.zona,
        distrito: direccion.distrito,
        bloque: direccion.bloque,
        calle: direccion.calle,
        numero: direccion.numero,
        edificio: direccion.edificio,
        piso: direccion.piso,
        referencia: direccion.referencia,
      } : null,
      contactos: contRes.rows,
      apoderados: apodRes.rows.map((apoderado) => ({
        apoderadoId: apoderado.apoderado_id,
        parentesco: apoderado.parentesco,
        esPrincipal: apoderado.es_principal,
        nombre: apoderado.nombre,
        apellidoPaterno: apoderado.apellido_paterno,
        apellidoMaterno: apoderado.apellido_materno,
        username: apoderado.username,
      })),
    });
  } catch (err) {
    console.error("[getUsuario]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
