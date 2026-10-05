import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  AsignarMateriaGradoInput,
  MateriaDelGrado,
  NivelEducativo,
  TipoMateria,
} from "../models/academic.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { publicarEventoAsync } from "../utils/events.ts";
import { serialize, toId } from "../utils/serialize.ts";

// servicio -> materias por grado

export interface GradoMateria extends MateriaDelGrado {
  nivel: NivelEducativo;
  grado: string;
}

const SELECT_MATERIAS = `
  SELECT
    gm.nivel,
    gm.grado,
    m.id AS "materia_id",
    m.codigo,
    m.nombre,
    m.descripcion,
    m.peso_sintactico AS "pesoSintactico",
    gm.tipo_materia,
    gm.carga_horaria_semanal,
    gm.orden
  FROM grado_materias gm
  JOIN materias m ON m.id = gm.materia_id
`;

function mapear(fila: any): GradoMateria {
  return serialize({
    nivel: fila.nivel,
    grado: fila.grado,
    materiaId: toId(fila.materia_id),
    codigo: fila.codigo,
    nombre: fila.nombre,
    descripcion: fila.descripcion ?? null,
    pesoSintactico: Number(fila.pesoSintactico ?? 1),
    tipoMateria: fila.tipo_materia,
    cargaHorariaSemanal: Number(fila.carga_horaria_semanal),
    orden: Number(fila.orden),
  });
}

function validarTipo(tipo: TipoMateria): TipoMateria {
  if (tipo !== "principal" && tipo !== "extracurricular") {
    throw new HttpError(400, "tipoMateria inválido");
  }
  return tipo;
}

function validarCarga(valor: number | undefined): number {
  const carga = Number(valor ?? 5);
  if (!Number.isInteger(carga) || carga < 1 || carga > 40) {
    throw new HttpError(400, "cargaHorariaSemanal debe ser un entero entre 1 y 40");
  }
  return carga;
}

// evento -> publicar cambio dominio
function avisarMateriasGrado(nivel: NivelEducativo, grado: string, total: number): void {
  publicarEventoAsync("grados.materias", { nivel, grado, totalMaterias: total });
}

export async function listarMateriasGrado(
  nivel: NivelEducativo,
  grado: string,
): Promise<GradoMateria[]> {
  try {
    const res = await query(
      `${SELECT_MATERIAS}
       WHERE gm.nivel = $1 AND gm.grado = $2
       ORDER BY gm.orden, m.nombre`,
      [nivel, grado],
    );
    return res.rows.map(mapear);
  } catch (err) {
    throw mapDbError(err, "Error al listar las materias del grado");
  }
}

export async function agregarMateriaGrado(
  nivel: NivelEducativo,
  grado: string,
  input: AsignarMateriaGradoInput,
): Promise<GradoMateria[]> {
  const materiaId = toId(input.materiaId);
  const tipo = validarTipo(input.tipoMateria ?? "principal");
  const carga = validarCarga(input.cargaHorariaSemanal);

  try {
    const materia = await query<{ id: bigint }>(
      `SELECT id FROM materias WHERE id = $1 AND activo = true`,
      [materiaId],
    );
    if (materia.rows.length === 0) {
      throw new HttpError(404, "La materia no existe o está inactiva");
    }

    const orden = await query<{ siguiente: string }>(
      `SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente
       FROM grado_materias WHERE nivel = $1 AND grado = $2`,
      [nivel, grado],
    );

    await query(
      `INSERT INTO grado_materias (nivel, grado, materia_id, tipo_materia, carga_horaria_semanal, orden)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (nivel, grado, materia_id) DO UPDATE
         SET tipo_materia = EXCLUDED.tipo_materia,
             carga_horaria_semanal = EXCLUDED.carga_horaria_semanal`,
      [nivel, grado, materiaId, tipo, carga, Number(orden.rows[0]?.siguiente ?? 1)],
    );

    const materias = await listarMateriasGrado(nivel, grado);
    avisarMateriasGrado(nivel, grado, materias.length);
    return materias;
  } catch (err) {
    throw mapDbError(err, "Error al asignar la materia al grado");
  }
}

export async function quitarMateriaGrado(
  nivel: NivelEducativo,
  grado: string,
  materiaId: string,
): Promise<GradoMateria[]> {
  try {
    await query(
      `DELETE FROM grado_materias WHERE nivel = $1 AND grado = $2 AND materia_id = $3`,
      [nivel, grado, toId(materiaId)],
    );

    const materias = await listarMateriasGrado(nivel, grado);
    avisarMateriasGrado(nivel, grado, materias.length);
    return materias;
  } catch (err) {
    throw mapDbError(err, "Error al quitar la materia del grado");
  }
}

export async function reemplazarMateriasGrado(
  nivel: NivelEducativo,
  grado: string,
  materias: AsignarMateriaGradoInput[],
): Promise<GradoMateria[]> {
  const normalizadas = materias.map((item, indice) => ({
    materiaId: toId(item.materiaId),
    tipoMateria: validarTipo(item.tipoMateria ?? "principal"),
    cargaHorariaSemanal: validarCarga(item.cargaHorariaSemanal),
    orden: indice + 1,
  }));

  const repetidas = normalizadas.filter(
    (item, i) => normalizadas.findIndex((otro) => otro.materiaId === item.materiaId) !== i,
  );
  if (repetidas.length > 0) {
    throw new HttpError(400, "Hay materias repetidas en la lista");
  }

  try {
    for (const item of normalizadas) {
      const existe = await query<{ id: bigint }>(
        `SELECT id FROM materias WHERE id = $1 AND activo = true`,
        [item.materiaId],
      );
      if (existe.rows.length === 0) {
        throw new HttpError(404, `La materia ${item.materiaId} no existe o está inactiva`);
      }
    }

    await sTransaction(async (tx) => {
      await tx.queryObject(`DELETE FROM grado_materias WHERE nivel = $1 AND grado = $2`, [
        nivel,
        grado,
      ]);
      for (const item of normalizadas) {
        await tx.queryObject(
          `INSERT INTO grado_materias (nivel, grado, materia_id, tipo_materia, carga_horaria_semanal, orden)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [nivel, grado, item.materiaId, item.tipoMateria, item.cargaHorariaSemanal, item.orden],
        );
      }
    });

    const guardadas = await listarMateriasGrado(nivel, grado);
    avisarMateriasGrado(nivel, grado, guardadas.length);
    return guardadas;
  } catch (err) {
    throw mapDbError(err, "Error al guardar las materias del grado");
  }
}

// funcion -> listar grados con materias
export async function listarGradosConMaterias(nivel?: NivelEducativo) {
  const params: unknown[] = [];
  let filtro = "";
  if (nivel) {
    params.push(nivel);
    filtro = ` AND c.nivel = $1`;
  }

  const res = await query<{
    nivel: NivelEducativo;
    grado: string;
    paralelos: string[];
    totalMaterias: string;
  }>(
    `SELECT c.nivel, c.grado,
            ARRAY_AGG(c.paralelo ORDER BY c.paralelo) AS paralelos,
            (SELECT COUNT(*) FROM grado_materias gm
              WHERE gm.nivel = c.nivel AND gm.grado = c.grado) AS "totalMaterias"
     FROM cursos c
     WHERE c.activo = true${filtro}
     GROUP BY c.nivel, c.grado
     HAVING (SELECT COUNT(*) FROM grado_materias gm
             WHERE gm.nivel = c.nivel AND gm.grado = c.grado) > 0
     ORDER BY CASE c.nivel
                WHEN 'inicial' THEN 1 WHEN 'primaria' THEN 2
                WHEN 'secundaria' THEN 3 ELSE 4 END,
              c.grado`,
    params,
  );

  return res.rows.map((fila) => ({
    nivel: fila.nivel,
    grado: fila.grado,
    paralelos: fila.paralelos,
    totalMaterias: Number(fila.totalMaterias),
  }));
}

// funcion -> listar grados sin materias
export async function listarGradosSinMaterias(nivel?: NivelEducativo) {
  const params: unknown[] = [];
  let filtro = "";
  if (nivel) {
    params.push(nivel);
    filtro = ` AND c.nivel = $1`;
  }

  const res = await query<{ nivel: NivelEducativo; grado: string; paralelos: string[] }>(
    `SELECT c.nivel, c.grado, ARRAY_AGG(c.paralelo ORDER BY c.paralelo) AS paralelos
     FROM cursos c
     WHERE c.activo = true${filtro}
     GROUP BY c.nivel, c.grado
     HAVING (SELECT COUNT(*) FROM grado_materias gm
             WHERE gm.nivel = c.nivel AND gm.grado = c.grado) = 0
     ORDER BY c.nivel, c.grado`,
    params,
  );

  return res.rows.map((fila) => ({
    nivel: fila.nivel,
    grado: fila.grado,
    paralelos: fila.paralelos,
  }));
}

// funcion -> verificar materia grado
export async function gradoTieneMaterias(nivel: NivelEducativo, grado: string): Promise<boolean> {
  const res = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM grado_materias WHERE nivel = $1 AND grado = $2`,
    [nivel, grado],
  );
  return Number(res.rows[0]?.total ?? 0) > 0;
}

// funcion -> materias grado para malla
export async function obtenerMateriasPorGrado(
  nivel: NivelEducativo,
  grado: string,
): Promise<Array<{ materiaId: string; tipoMateria: TipoMateria; cargaHorariaSemanal: number }>> {
  const res = await query<{
    materia_id: bigint;
    tipo_materia: TipoMateria;
    carga_horaria_semanal: number;
  }>(
    `SELECT materia_id, tipo_materia, carga_horaria_semanal
     FROM grado_materias
     WHERE nivel = $1 AND grado = $2
     ORDER BY orden, materia_id`,
    [nivel, grado],
  );

  return res.rows.map((fila) => ({
    materiaId: toId(fila.materia_id),
    tipoMateria: fila.tipo_materia,
    cargaHorariaSemanal: Number(fila.carga_horaria_semanal),
  }));
}
