import { query } from "../../connects/Database/transaction.ts";
import { seguimientoConfig } from "../../config/seguimiento.config.ts";
import { HttpError } from "../../utils/errors.ts";
import type { NivelRiesgo, ResumenAsistencia } from "../../models/academic.ts";

// servicio -> notas desempeno en vivo

export interface RowTrimestre {
  id: bigint;
  periodo_id: bigint;
  numero: number;
  inicio: Date;
  fin: Date;
}

export interface RowEncargo {
  id: bigint;
  titulo: string;
  tipo: string;
  ponderacion: string;
  fecha_publicacion: Date | null;
  fecha_limite: Date | null;
  estado: string;
}

export interface RowNota {
  estudiante_id: bigint;
  encargo_id: bigint;
  nota: string;
}

export interface RowAsistencia {
  estudiante_id: bigint;
  estado: string;
  total: string;
}

export interface RowEstudiante {
  estudiante_id: bigint;
  usuario_id: bigint;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
}

export function toIso(value: Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

export function esTrimestreValido(valor: string | null): valor is "1" | "2" | "3" {
  return valor === "1" || valor === "2" || valor === "3";
}

// util -> resumen asistencia efectiva
export function construirResumen(filas: Map<string, { estado: string; total: number }>): ResumenAsistencia {
  let presentes = 0;
  let ausentes = 0;
  let atrasos = 0;
  let justificadas = 0;

  for (const fila of filas.values()) {
    switch (fila.estado) {
      case "presente":
        presentes += fila.total;
        break;
      case "ausente":
        ausentes += fila.total;
        break;
      case "atraso":
        atrasos += fila.total;
        break;
      case "justificado":
        justificadas += fila.total;
        break;
    }
  }

  const total = presentes + ausentes + atrasos + justificadas;
  const efectivas = presentes + atrasos + justificadas;

  return {
    presentes,
    ausentes,
    atrasos,
    justificadas,
    total,
    tasa: total > 0 ? redondear((efectivas / total) * 100, 1) : null,
  };
}

// util -> indice desempeno mezcla
export function calcularIndice(promedio: number | null, tasaAsistencia: number | null): number | null {
  if (promedio === null) {
    return tasaAsistencia === null ? null : redondear(tasaAsistencia);
  }
  if (tasaAsistencia === null) {
    return redondear(promedio);
  }
  return redondear(
    promedio * seguimientoConfig.pesoPromedio + tasaAsistencia * seguimientoConfig.pesoAsistencia,
  );
}

export function clasificarRiesgo(
  promedio: number | null,
  tasa: number | null,
): { nivel: NivelRiesgo; observaciones: string[] } {
  const {
    umbralNotaRiesgo,
    umbralAsistenciaRiesgo,
    umbralNotaRiesgoAlto,
    umbralAsistenciaRiesgoAlto,
    umbralAsistenciaObservacion,
  } = seguimientoConfig;

  const observaciones: string[] = [];
  const notaCritica = promedio !== null && promedio < umbralNotaRiesgoAlto;
  const asistenciaCritica = tasa !== null && tasa < umbralAsistenciaRiesgoAlto;
  const fallaNota = promedio !== null && promedio < umbralNotaRiesgo;
  const fallaAsistencia = tasa !== null && tasa < umbralAsistenciaRiesgo;

  // riesgo -> nivel alto critico
  if (notaCritica || asistenciaCritica || (fallaNota && fallaAsistencia)) {
    if (notaCritica) {
      observaciones.push(`Promedio ${promedio} por debajo de ${umbralNotaRiesgoAlto}`);
    }
    if (asistenciaCritica) {
      observaciones.push(`Asistencia ${tasa}% por debajo de ${umbralAsistenciaRiesgoAlto}%`);
    }
    if (!notaCritica && !asistenciaCritica) {
      observaciones.push(`Promedio ${promedio} y asistencia ${tasa}% por debajo del mínimo`);
    }
    return { nivel: "riesgo_alto", observaciones };
  }

  // riesgo -> indicador bajo minimo
  if (fallaNota) {
    observaciones.push(`Promedio ${promedio} por debajo de ${umbralNotaRiesgo}`);
    return { nivel: "riesgo", observaciones };
  }
  if (fallaAsistencia) {
    observaciones.push(`Asistencia ${tasa}% por debajo de ${umbralAsistenciaRiesgo}%`);
    return { nivel: "riesgo", observaciones };
  }

  if (promedio === null) {
    observaciones.push("Sin promedio registrado en el período");
    return { nivel: "observacion", observaciones };
  }

  // riesgo -> observacion cerca limite
  if (tasa !== null && tasa < umbralAsistenciaObservacion) {
    observaciones.push(`Asistencia ${tasa}% en observación`);
    return { nivel: "observacion", observaciones };
  }

  return { nivel: "sin_riesgo", observaciones };
}

export async function obtenerTrimestre(
  periodoId: string,
  trimestre: number,
): Promise<RowTrimestre> {
  const res = await query<RowTrimestre>(
    `SELECT id, periodo_id, numero, inicio, fin
     FROM trimestres WHERE periodo_id = $1 AND numero = $2`,
    [periodoId, trimestre],
  );

  if (res.rows.length === 0) {
    throw new HttpError(404, `El trimestre ${trimestre} no existe en el período ${periodoId}`);
  }
  return res.rows[0];
}

// tipo -> asignacion docente seguimiento
export async function obtenerAsignacion(cursoPeriodoId: string, materiaId: string) {
  const res = await query<{
    asignacion_id: bigint;
    materia_id: bigint;
    materia_nombre: string;
    materia_codigo: string;
    materia_tipo: string;
    maestro_id: bigint;
    usuario_id: bigint;
    nombre: string;
    apellido_paterno: string;
    curso_id: bigint;
    grado: string;
    paralelo: string;
    nivel: string;
    periodo_id: bigint;
    periodo_nombre: string;
    anio: number;
  }>(
    `SELECT
       ad.id AS asignacion_id, ad.materia_id,
       m.nombre AS materia_nombre, m.codigo AS materia_codigo, m.tipo_materia AS materia_tipo,
       ad.maestro_id, u.id AS usuario_id, u.nombre, u.apellido_paterno,
       c.id AS curso_id, c.grado, c.paralelo, c.nivel,
       cp.periodo_id, p.nombre AS periodo_nombre, p.anio
     FROM asignaciones_docentes ad
     JOIN materias m ON m.id = ad.materia_id
     JOIN maestros ma ON ma.id = ad.maestro_id
     JOIN usuarios u ON u.id = ma.usuario_id
     JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
     JOIN cursos c ON c.id = cp.curso_id
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE ad.curso_periodo_id = $1 AND ad.materia_id = $2 AND ad.estado = 'activo'`,
    [cursoPeriodoId, materiaId],
  );

  if (res.rows.length === 0) {
    throw new HttpError(404, "El curso no tiene esa materia asignada a un docente activo");
  }
  return res.rows[0];
}

export interface FiltroLibro {
  cursoPeriodoId: string;
  materiaId: string;
  trimestre: number;
}

export interface FiltroPanel {
  cursoPeriodoId: string;
  trimestre: number;
}
