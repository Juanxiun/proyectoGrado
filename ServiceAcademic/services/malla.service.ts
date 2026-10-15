import { query, sTransaction } from "../connects/Database/transaction.ts";
import type {
  CrearTemaInput,
  NivelEducativo,
  TemaMalla,
} from "../models/academic.ts";
import { listarMateriasGrado } from "./gradoMateria.service.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { publicarEventoAsync } from "../utils/events.ts";
import { serialize, toId } from "../utils/serialize.ts";

// servicio -> temas malla curricular

const SELECT = `
  SELECT
    t.id, t.nivel, t.grado, t.materia_id,
    m.codigo, m.nombre, m.tipo_materia,
    t.unidad, t.titulo, t.contenidos,
    t.horas_previstas, t.es_evaluacion, t.orden
  FROM malla_temas t
  JOIN materias m ON m.id = t.materia_id
`;

function mapear(fila: any): TemaMalla {
  return serialize({
    id: toId(fila.id),
    nivel: fila.nivel,
    grado: fila.grado,
    materiaId: toId(fila.materia_id),
    materia: {
      codigo: fila.codigo,
      nombre: fila.nombre,
      tipoMateria: fila.tipo_materia,
    },
    unidad: Number(fila.unidad),
    titulo: fila.titulo,
    contenidos: fila.contenidos ?? null,
    horasPrevistas: Number(fila.horas_previstas),
    esEvaluacion: Boolean(fila.es_evaluacion),
    orden: Number(fila.orden),
  });
}

// util -> releer tema con materia
async function obtenerTema(temaId: string): Promise<TemaMalla> {
  const res = await query(
    `${SELECT} WHERE t.id = $1`,
    [temaId],
  );
  if (res.rows.length === 0) throw new HttpError(404, "Tema no encontrado");
  return mapear(res.rows[0]);
}

// funcion -> malla completa por grado
export async function obtenerMallaGrado(
  nivel: NivelEducativo,
  grado: string,
) {
  const [materias, temas] = await Promise.all([
    listarMateriasGrado(nivel, grado),
    listarTemasGrado(nivel, grado),
  ]);

  return materias.map((materia) => ({
    materia,
    temas: temas.filter((t) => t.materiaId === materia.materiaId),
  }));
}

export async function listarTemasGrado(
  nivel: NivelEducativo,
  grado: string,
): Promise<TemaMalla[]> {
  try {
    const res = await query(
      `${SELECT}
       WHERE t.nivel = $1 AND t.grado = $2
       ORDER BY m.nombre, t.unidad, t.orden`,
      [nivel, grado],
    );
    return res.rows.map(mapear);
  } catch (err) {
    throw mapDbError(err, "Error al listar la maya curricular");
  }
}

export async function listarTemasMateria(
  nivel: NivelEducativo,
  grado: string,
  materiaId: string,
): Promise<TemaMalla[]> {
  try {
    const res = await query(
      `${SELECT}
       WHERE t.nivel = $1 AND t.grado = $2 AND t.materia_id = $3
       ORDER BY t.unidad, t.orden`,
      [nivel, grado, toId(materiaId)],
    );
    return res.rows.map(mapear);
  } catch (err) {
    throw mapDbError(err, "Error al listar los temas de la materia");
  }
}

export async function crearTema(
  nivel: NivelEducativo,
  grado: string,
  input: CrearTemaInput,
): Promise<TemaMalla> {
  const titulo = String(input.titulo ?? "").trim();
  if (!titulo) throw new HttpError(400, "El título del tema es obligatorio");

  const horas = Number(input.horasPrevistas ?? 1);
  if (!Number.isInteger(horas) || horas < 1 || horas > 40) {
    throw new HttpError(400, "horasPrevistas debe ser un entero entre 1 y 40");
  }

  try {
    // valida -> materia pertenece grado
    const materia = await query<{ id: bigint }>(
      `SELECT id FROM grado_materias WHERE nivel = $1 AND grado = $2 AND materia_id = $3`,
      [nivel, grado, toId(input.materiaId)],
    );
    if (materia.rows.length === 0) {
      throw new HttpError(
        409,
        "La materia no está asignada a este grado. Asignala primero en Cursos base.",
      );
    }

    const unidad = Number(input.unidad ?? 0);
    const siguiente = unidad > 0
      ? unidad
      : await siguienteUnidad(nivel, grado, toId(input.materiaId));

    const orden = await query<{ siguiente: string }>(
      `SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente
       FROM malla_temas WHERE nivel = $1 AND grado = $2 AND materia_id = $3 AND unidad = $4`,
      [nivel, grado, toId(input.materiaId), siguiente],
    );

    const res = await query<{ id: bigint }>(
      `INSERT INTO malla_temas
         (nivel, grado, materia_id, unidad, titulo, contenidos, horas_previstas, es_evaluacion, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        nivel,
        grado,
        toId(input.materiaId),
        siguiente,
        titulo,
        input.contenidos?.trim() || null,
        horas,
        Boolean(input.esEvaluacion),
        Number(orden.rows[0]?.siguiente ?? 1),
      ],
    );

    return await obtenerTema(toId(res.rows[0].id));
  } catch (err) {
    throw mapDbError(err, "Error al crear el tema");
  }
}

async function siguienteUnidad(
  nivel: NivelEducativo,
  grado: string,
  materiaId: string,
): Promise<number> {
  const res = await query<{ maximo: string | null }>(
    `SELECT MAX(unidad) AS maximo FROM malla_temas
     WHERE nivel = $1 AND grado = $2 AND materia_id = $3`,
    [nivel, grado, materiaId],
  );
  return Number(res.rows[0]?.maximo ?? 0) + 1;
}

export async function actualizarTema(
  temaId: string,
  input: Partial<CrearTemaInput> & { titulo?: string; unidad?: number; orden?: number },
): Promise<TemaMalla> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.titulo !== undefined) {
    const titulo = String(input.titulo).trim();
    if (!titulo) throw new HttpError(400, "El título del tema es obligatorio");
    fields.push(`titulo = $${idx++}`);
    params.push(titulo);
  }
  if (input.contenidos !== undefined) {
    fields.push(`contenidos = $${idx++}`);
    params.push(input.contenidos?.trim() || null);
  }
  if (input.horasPrevistas !== undefined) {
    const horas = Number(input.horasPrevistas);
    if (!Number.isInteger(horas) || horas < 1 || horas > 40) {
      throw new HttpError(400, "horasPrevistas debe ser un entero entre 1 y 40");
    }
    fields.push(`horas_previstas = $${idx++}`);
    params.push(horas);
  }
  if (input.esEvaluacion !== undefined) {
    fields.push(`es_evaluacion = $${idx++}`);
    params.push(Boolean(input.esEvaluacion));
  }
  if (input.unidad !== undefined) {
    const unidad = Number(input.unidad);
    if (!Number.isInteger(unidad) || unidad < 1) {
      throw new HttpError(400, "unidad debe ser un entero mayor a 0");
    }
    fields.push(`unidad = $${idx++}`);
    params.push(unidad);
  }
  if (input.orden !== undefined) {
    fields.push(`orden = $${idx++}`);
    params.push(Number(input.orden));
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    params.push(temaId);
    const res = await query<{ id: bigint }>(
      `UPDATE malla_temas SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING id`,
      params,
    );
    if (res.rows.length === 0) throw new HttpError(404, "Tema no encontrado");

    return await obtenerTema(temaId);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar el tema");
  }
}

export async function eliminarTema(temaId: string): Promise<void> {
  try {
    await query(`DELETE FROM malla_temas WHERE id = $1`, [temaId]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar el tema");
  }
}

// funcion -> guardar temario completo
export async function guardarTemasMateria(
  nivel: NivelEducativo,
  grado: string,
  materiaId: string,
  temas: Array<Partial<CrearTemaInput> & { titulo: string; id?: string }>,
): Promise<TemaMalla[]> {
  const id = toId(materiaId);

  const existentes = await query<{ id: bigint; orden: number }>(
    `SELECT id, orden FROM malla_temas
     WHERE nivel = $1 AND grado = $2 AND materia_id = $3`,
    [nivel, grado, id],
  );
  const idsEnviados = new Set(
    temas.map((t) => t.id).filter(Boolean).map((t) => String(t)),
  );

  try {
    await sTransaction(async (tx) => {
      // logica -> quitar borrar actualizar temas
      for (const previa of existentes.rows) {
        if (!idsEnviados.has(String(previa.id))) {
          await tx.queryObject(`DELETE FROM malla_temas WHERE id = $1`, [previa.id]);
        }
      }

      let indice = 0;
      for (const tema of temas) {
        indice += 1;
        const titulo = String(tema.titulo ?? "").trim();
        if (!titulo) continue;

        const horas = Number(tema.horasPrevistas ?? 1);
        if (!Number.isInteger(horas) || horas < 1 || horas > 40) {
          throw new HttpError(400, "horasPrevistas debe ser un entero entre 1 y 40");
        }

        const unidad = Number(tema.unidad ?? indice);

        if (tema.id) {
          await tx.queryObject(
            `UPDATE malla_temas
             SET titulo = $1, contenidos = $2, horas_previstas = $3,
                 es_evaluacion = $4, unidad = $5, orden = $6
             WHERE id = $7`,
            [
              titulo,
              tema.contenidos?.trim() || null,
              horas,
              Boolean(tema.esEvaluacion),
              unidad,
              indice,
              toId(tema.id),
            ],
          );
        } else {
          await tx.queryObject(
            `INSERT INTO malla_temas
               (nivel, grado, materia_id, unidad, titulo, contenidos,
                horas_previstas, es_evaluacion, orden)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              nivel,
              grado,
              id,
              unidad,
              titulo,
              tema.contenidos?.trim() || null,
              horas,
              Boolean(tema.esEvaluacion),
              indice,
            ],
          );
        }
      }
    });

    const guardados = await listarTemasMateria(nivel, grado, materiaId);

    // aviso -> temario docentes estudiantes
    publicarEventoAsync("malla.tema.guardar", {
      nivel,
      grado,
      materiaId,
      materiaNombre: guardados[0]?.materia?.nombre,
      totalTemas: guardados.length,
    });

    return guardados;
  } catch (err) {
    throw mapDbError(err, "Error al guardar la malla de la materia");
  }
}

// funcion -> resumen temario cargado
export async function resumenMalla(nivel: NivelEducativo, grado: string) {
  const materias = await listarMateriasGrado(nivel, grado);
  if (materias.length === 0) {
    return { materias: 0, conTemas: 0, totalTemas: 0, horasPrevistas: 0 };
  }

  const res = await query<{ materia_id: bigint; temas: string; horas: string }>(
    `SELECT materia_id, COUNT(*) AS temas, COALESCE(SUM(horas_previstas), 0) AS horas
     FROM malla_temas WHERE nivel = $1 AND grado = $2
     GROUP BY materia_id`,
    [nivel, grado],
  );

  const porMateria = new Map(
    res.rows.map((fila) => [
      String(fila.materia_id),
      { temas: Number(fila.temas), horas: Number(fila.horas) },
    ]),
  );

  const conTemas = res.rows.filter((f) => Number(f.temas) > 0).length;

  return {
    materias: materias.length,
    conTemas,
    totalTemas: res.rows.reduce((acc, f) => acc + Number(f.temas), 0),
    horasPrevistas: res.rows.reduce((acc, f) => acc + Number(f.horas), 0),
  };
}
