import { query } from "../connects/Database/transaction.ts";
import { seguimientoConfig } from "../config/seguimiento.config.ts";
import { HttpError } from "../utils/errors.ts";
import type {
  AlertaRiesgo,
  DesempenoMateria,
  DesempenoMateriaResumen,
  EncargoLibro,
  LibroNotas,
  LineaLibro,
  NivelRiesgo,
  PanelCurso,
  PanelEstudiante,
  PanelEstudiantePeriodo,
  RangoPromedio,
  ResumenAsistencia,
} from "../models/academic.ts";

// servicio -> notas desempeno en vivo

interface RowTrimestre {
  id: bigint;
  periodo_id: bigint;
  numero: number;
  inicio: Date;
  fin: Date;
}

interface RowEncargo {
  id: bigint;
  titulo: string;
  tipo: string;
  ponderacion: string;
  fecha_publicacion: Date | null;
  fecha_limite: Date | null;
  estado: string;
}

interface RowNota {
  estudiante_id: bigint;
  encargo_id: bigint;
  nota: string;
}

interface RowAsistencia {
  estudiante_id: bigint;
  estado: string;
  total: string;
}

interface RowEstudiante {
  estudiante_id: bigint;
  usuario_id: bigint;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
}

function toIso(value: Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function esTrimestreValido(valor: string | null): valor is "1" | "2" | "3" {
  return valor === "1" || valor === "2" || valor === "3";
}

// util -> resumen asistencia efectiva
function construirResumen(filas: Map<string, { estado: string; total: number }>): ResumenAsistencia {
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
function calcularIndice(promedio: number | null, tasaAsistencia: number | null): number | null {
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

function clasificarRiesgo(
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

  if (promedio === null && tasa === null) {
    return { nivel: "sin_riesgo", observaciones: [] };
  }

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

  // riesgo -> observacion cerca limite
  if (tasa !== null && tasa < umbralAsistenciaObservacion) {
    observaciones.push(`Asistencia ${tasa}% en observación`);
    return { nivel: "observacion", observaciones };
  }

  return { nivel: "sin_riesgo", observaciones };
}

async function obtenerTrimestre(
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
async function obtenerAsignacion(cursoPeriodoId: string, materiaId: string) {
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

// funcion -> libro notas trimestre
export async function obtenerLibro(filtro: FiltroLibro): Promise<LibroNotas> {
  const { cursoPeriodoId, materiaId, trimestre } = filtro;
  const asignacion = await obtenerAsignacion(cursoPeriodoId, materiaId);
  const trim = await obtenerTrimestre(String(asignacion.periodo_id), trimestre);

  const desde = toIso(trim.inicio);
  const hasta = toIso(trim.fin);

  const [encargosRes, notasRes, estudiantesRes, asistenciaRes] = await Promise.all([
    query<RowEncargo>(
      `SELECT id, titulo, tipo, ponderacion, fecha_publicacion, fecha_limite, estado
       FROM encargos
       WHERE asignacion_id = $1 AND estado = 'publicado' AND fecha_publicacion BETWEEN $2 AND $3
       ORDER BY fecha_publicacion`,
      [asignacion.asignacion_id, desde, hasta],
    ),
    query<RowNota>(
      `SELECT c.estudiante_id, c.encargo_id, c.nota
       FROM calificaciones c
       JOIN encargos e ON e.id = c.encargo_id
       WHERE e.asignacion_id = $1
         AND e.estado = 'publicado'
         AND c.fecha_calificacion BETWEEN $2 AND $3`,
      [asignacion.asignacion_id, desde, hasta],
    ),
    query<RowEstudiante>(
      `SELECT e.id AS estudiante_id, e.usuario_id, u.nombre, u.apellido_paterno, u.apellido_materno
       FROM inscripciones i
       JOIN estudiantes e ON e.id = i.estudiante_id
       JOIN usuarios u ON u.id = e.usuario_id
       WHERE i.curso_periodo_id = $1 AND i.estado = 'activo'
       ORDER BY u.apellido_paterno, u.nombre`,
      [cursoPeriodoId],
    ),
    query<RowAsistencia>(
      `SELECT a.estudiante_id, a.estado, COUNT(*) AS total
       FROM asistencia a
       JOIN encargos e ON e.asignacion_id = a.asignacion_id
       WHERE a.asignacion_id = $1 AND a.fecha BETWEEN $2 AND $3
       GROUP BY a.estudiante_id, a.estado`,
      [asignacion.asignacion_id, desde, hasta],
    ),
  ]);

  const encargos = encargosRes.rows.map((r) => ({
    id: String(r.id),
    titulo: r.titulo,
    tipo: r.tipo,
    ponderacion: Number(r.ponderacion),
    fechaPublicacion: r.fecha_publicacion ? toIso(r.fecha_publicacion) : null,
    fechaLimite: r.fecha_limite ? toIso(r.fecha_limite) : null,
    estado: r.estado,
  }));

  const pesoPorEncargo = new Map(encargos.map((e) => [e.id, e.ponderacion]));

  // mapa -> notas por estudiante
  const notas = new Map<string, Map<string, number>>();
  for (const fila of notasRes.rows) {
    const clave = String(fila.estudiante_id);
    if (!notas.has(clave)) notas.set(clave, new Map());
    notas.get(clave)!.set(String(fila.encargo_id), Number(fila.nota));
  }

  // mapa -> promedios por encargo
  const sumaPorEncargo = new Map<string, { total: number; cantidad: number }>();
  for (const fila of notasRes.rows) {
    const clave = String(fila.encargo_id);
    const actual = sumaPorEncargo.get(clave) ?? { total: 0, cantidad: 0 };
    actual.total += Number(fila.nota);
    actual.cantidad += 1;
    sumaPorEncargo.set(clave, actual);
  }

  const encargosConPromedio: EncargoLibro[] = encargos.map((e) => {
    const stat = sumaPorEncargo.get(e.id);
    return {
      ...e,
      promedioCurso: stat && stat.cantidad > 0 ? redondear(stat.total / stat.cantidad) : null,
    };
  });

  const asistenciaPorEstudiante = new Map<string, { estado: string; total: number }>();
  for (const fila of asistenciaRes.rows) {
    asistenciaPorEstudiante.set(String(fila.estudiante_id), {
      estado: fila.estado,
      total: Number(fila.total),
    });
  }

  const pesoTotal = redondear(encargos.reduce((acc, e) => acc + e.ponderacion, 0));

  const lineas: LineaLibro[] = estudiantesRes.rows.map((est) => {
    const clave = String(est.estudiante_id);
    const notasEstudiante = notas.get(clave) ?? new Map<string, number>();

    let sumaPonderada = 0;
    let pesoAcumulado = 0;
    let evaluadas = 0;

    for (const encargo of encargos) {
      const nota = notasEstudiante.get(encargo.id);
      if (nota === undefined) continue;
      sumaPonderada += nota * encargo.ponderacion;
      pesoAcumulado += encargo.ponderacion;
      evaluadas += 1;
    }

    const promedio = pesoAcumulado > 0 ? redondear(sumaPonderada / pesoAcumulado) : null;
    const desercion = pesoTotal > 0
      ? redondear(((pesoTotal - pesoAcumulado) / pesoTotal) * 100, 1)
      : null;

    const asistencia = construirResumen(asistenciaPorEstudiante);
    const { nivel, observaciones } = clasificarRiesgo(promedio, asistencia.tasa);

    if (desercion !== null && desercion > 0) {
      observaciones.push(`Sin calificar el ${desercion}% de la materia`);
    }

    return {
      estudianteId: clave,
      usuarioId: String(est.usuario_id),
      nombre: est.nombre,
      apellidoPaterno: est.apellido_paterno,
      apellidoMaterno: est.apellido_materno,

      promedio,
      pesoAcumulado: redondear(pesoAcumulado),
      pesoTotal,
      tareasCalificadas: evaluadas,
      tareasPublicadas: encargos.length,
      desercion,

      asistencia,
      indice: calcularIndice(promedio, asistencia.tasa),
      nivelRiesgo: nivel,
      observaciones,
    };
  });

  const promedios = lineas.map((l) => l.promedio).filter((p): p is number => p !== null);
  const enRiesgo = lineas.filter((l) => l.nivelRiesgo === "riesgo").length;
  const enRiesgoAlto = lineas.filter((l) => l.nivelRiesgo === "riesgo_alto").length;

  return {
    cursoPeriodoId,
    materia: {
      id: String(asignacion.materia_id),
      nombre: asignacion.materia_nombre,
      codigo: asignacion.materia_codigo,
      tipo: asignacion.materia_tipo,
    },
    trimestre: { numero: trimestre, inicio: desde, fin: hasta },
    periodo: {
      id: String(asignacion.periodo_id),
      nombre: asignacion.periodo_nombre,
      anio: asignacion.anio,
    },
    curso: {
      id: String(asignacion.curso_id),
      grado: asignacion.grado,
      paralelo: asignacion.paralelo,
      nivel: asignacion.nivel,
    },
    docente: {
      maestroId: String(asignacion.maestro_id),
      usuarioId: String(asignacion.usuario_id),
      nombre: `${asignacion.nombre} ${asignacion.apellido_paterno}`.trim(),
    },
    encargos: encargosConPromedio,
    lineas,
    resumen: {
      estudiantes: lineas.length,
      promedioCurso: promedios.length > 0
        ? redondear(promedios.reduce((a, b) => a + b, 0) / promedios.length)
        : null,
      promedioMasAlto: promedios.length > 0 ? Math.max(...promedios) : null,
      promedioMasBajo: promedios.length > 0 ? Math.min(...promedios) : null,
      enRiesgo,
      enRiesgoAlto,
    },
  };
}

export interface FiltroPanel {
  cursoPeriodoId: string;
  trimestre: number;
}

// funcion -> panel desempeno curso
export async function obtenerPanelCurso(filtro: FiltroPanel): Promise<PanelCurso> {
  const { cursoPeriodoId, trimestre } = filtro;

  const cursoRes = await query<{
    curso_id: bigint;
    grado: string;
    paralelo: string;
    nivel: string;
    periodo_id: bigint;
    periodo_nombre: string;
    anio: number;
  }>(
    `SELECT c.id AS curso_id, c.grado, c.paralelo, c.nivel,
            p.id AS periodo_id, p.nombre AS periodo_nombre, p.anio
     FROM cursos_periodo cp
     JOIN cursos c ON c.id = cp.curso_id
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1`,
    [cursoPeriodoId],
  );

  if (cursoRes.rows.length === 0) {
    throw new HttpError(404, `No existe el curso-periodo ${cursoPeriodoId}`);
  }
  const curso = cursoRes.rows[0];
  await obtenerTrimestre(String(curso.periodo_id), trimestre);

  const materiasRes = await query<{ materia_id: bigint; nombre: string; tipo_materia: string }>(
    `SELECT ad.materia_id, m.nombre, m.tipo_materia
     FROM asignaciones_docentes ad
     JOIN materias m ON m.id = ad.materia_id
     WHERE ad.curso_periodo_id = $1 AND ad.estado = 'activo'
     ORDER BY m.tipo_materia, m.nombre`,
    [cursoPeriodoId],
  );

  const materias: DesempenoMateriaResumen[] = [];
  const promediosGlobales: number[] = [];
  const tasasGlobales: number[] = [];

  let enObservacion = 0;
  let enRiesgo = 0;
  let enRiesgoAlto = 0;

  for (const materia of materiasRes.rows) {
    const libro = await obtenerLibro({
      cursoPeriodoId,
      materiaId: String(materia.materia_id),
      trimestre,
    });

    const promedios = libro.lineas.map((l) => l.promedio).filter((p): p is number => p !== null);
    const tasas = libro.lineas.map((l) => l.asistencia.tasa).filter((t): t is number => t !== null);

    promediosGlobales.push(...promedios);
    tasasGlobales.push(...tasas);

    for (const linea of libro.lineas) {
      if (linea.nivelRiesgo === "observacion") enObservacion += 1;
      if (linea.nivelRiesgo === "riesgo") enRiesgo += 1;
      if (linea.nivelRiesgo === "riesgo_alto") enRiesgoAlto += 1;
    }

    materias.push({
      materiaId: String(materia.materia_id),
      materia: materia.nombre,
      tipoMateria: materia.tipo_materia,
      promedio: promedios.length > 0
        ? redondear(promedios.reduce((a, b) => a + b, 0) / promedios.length)
        : null,
      promedioAsistencia: tasas.length > 0
        ? redondear(tasas.reduce((a, b) => a + b, 0) / tasas.length, 1)
        : null,
      estudiantesEvaluados: promedios.length,
      enRiesgo: libro.lineas.filter((l) =>
        l.nivelRiesgo === "riesgo" || l.nivelRiesgo === "riesgo_alto"
      ).length,
    });
  }

  const distribucionPromedios = construirDistribucion(promediosGlobales);

  return {
    cursoPeriodoId,
    curso: {
      id: String(curso.curso_id),
      grado: curso.grado,
      paralelo: curso.paralelo,
      nivel: curso.nivel,
    },
    periodo: {
      id: String(curso.periodo_id),
      nombre: curso.periodo_nombre,
      anio: curso.anio,
    },
    estudiantes: await contarEstudiantes(cursoPeriodoId),
    totalMaterias: materias.length,
    promedioGeneral: promediosGlobales.length > 0
      ? redondear(promediosGlobales.reduce((a, b) => a + b, 0) / promediosGlobales.length)
      : null,
    promedioAsistencia: tasasGlobales.length > 0
      ? redondear(tasasGlobales.reduce((a, b) => a + b, 0) / tasasGlobales.length, 1)
      : null,
    distribucionPromedios,
    materias,
    riesgo: {
      total: enRiesgo + enRiesgoAlto,
      observacion: enObservacion,
      alto: enRiesgoAlto,
    },
  };
}

function construirDistribucion(promedios: number[]): RangoPromedio[] {
  const rangos: RangoPromedio[] = [
    { rango: "0 - 39", minimo: 0, maximo: 39, estudiantes: 0 },
    { rango: "40 - 59", minimo: 40, maximo: 59, estudiantes: 0 },
    { rango: "60 - 69", minimo: 60, maximo: 69, estudiantes: 0 },
    { rango: "70 - 79", minimo: 70, maximo: 79, estudiantes: 0 },
    { rango: "80 - 89", minimo: 80, maximo: 89, estudiantes: 0 },
    { rango: "90 - 100", minimo: 90, maximo: 100, estudiantes: 0 },
  ];

  for (const promedio of promedios) {
    const rango = rangos.find((r) => promedio >= r.minimo && promedio <= r.maximo);
    if (rango) rango.estudiantes += 1;
  }
  return rangos;
}

async function contarEstudiantes(cursoPeriodoId: string): Promise<number> {
  const res = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM inscripciones WHERE curso_periodo_id = $1 AND estado = 'activo'`,
    [cursoPeriodoId],
  );
  return Number(res.rows[0]?.total ?? 0);
}

// funcion -> desempeno estudiante periodo
export async function obtenerPanelEstudiante(
  estudianteId: string,
  periodoId: string,
  trimestre: number,
): Promise<PanelEstudiante> {
  await obtenerTrimestre(periodoId, trimestre);

  const estRes = await query<RowEstudiante & { curso_paralelo: string }>(
    `SELECT e.id AS estudiante_id, e.usuario_id, u.nombre, u.apellido_paterno, u.apellido_materno,
            c.grado || ' "' || c.paralelo || '" ' || UPPER(c.nivel) AS curso_paralelo
     FROM estudiantes e
     JOIN usuarios u ON u.id = e.usuario_id
     JOIN inscripciones i ON i.estudiante_id = e.id AND i.periodo_id = $2 AND i.estado = 'activo'
     JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
     JOIN cursos c ON c.id = cp.curso_id
     WHERE e.id = $1`,
    [estudianteId, periodoId],
  );

  if (estRes.rows.length === 0) {
    throw new HttpError(404, "El estudiante no tiene inscripción activa en ese período");
  }
  const est = estRes.rows[0];

  const materiasRes = await query<{ curso_periodo_id: bigint; materia_id: bigint }>(
    `SELECT DISTINCT ad.curso_periodo_id, ad.materia_id
     FROM asignaciones_docentes ad
     JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
     WHERE cp.periodo_id = $1 AND ad.estado = 'activo'
       AND EXISTS (
         SELECT 1 FROM inscripciones i
         WHERE i.curso_periodo_id = ad.curso_periodo_id
           AND i.estudiante_id = $2
           AND i.estado = 'activo'
       )`,
    [periodoId, estudianteId],
  );

  const materias: DesempenoMateria[] = [];

  for (const fila of materiasRes.rows) {
    const libro = await obtenerLibro({
      cursoPeriodoId: String(fila.curso_periodo_id),
      materiaId: String(fila.materia_id),
      trimestre,
    });

    const linea = libro.lineas.find((l) => l.estudianteId === estudianteId);
    if (!linea) continue;

    const { nivel, observaciones } = clasificarRiesgo(linea.promedio, linea.asistencia.tasa);

    materias.push({
      materiaId: libro.materia.id,
      materia: libro.materia.nombre,
      tipoMateria: libro.materia.tipo,
      cursoParalelo: `${libro.curso.grado} "${libro.curso.paralelo}" ${libro.curso.nivel.toUpperCase()}`,
      promedio: linea.promedio,
      indice: linea.indice,
      asistencia: linea.asistencia,
      tareasCalificadas: linea.tareasCalificadas,
      tareasPublicadas: linea.tareasPublicadas,
      indiceDesempeno: linea.indice ?? 0,
      nivelRiesgo: nivel,
      // logica -> observaciones no viajan
    });
  }

  const promedios = materias.map((m) => m.promedio).filter((p): p is number => p !== null);
  const tasas = materias.map((m) => m.asistencia.tasa).filter((t): t is number => t !== null);
  const indices = materias.map((m) => m.indiceDesempeno);

  const periodoRes = await query<{ nombre: string; anio: number }>(
    `SELECT nombre, anio FROM periodos_academicos WHERE id = $1`,
    [periodoId],
  );
  const periodo = periodoRes.rows[0];

  const resumenAsistencia = construirResumen(
    new Map(
      materias.map((m) => [
        m.materiaId,
        { estado: "", total: m.asistencia.total },
      ]),
    ),
  );

  const promediosAcumulados = promedios.length > 0
    ? redondear(promedios.reduce((a, b) => a + b, 0) / promedios.length)
    : null;
  const tasaAcumulada = tasas.length > 0
    ? redondear(tasas.reduce((a, b) => a + b, 0) / tasas.length, 1)
    : null;

  const { nivel } = clasificarRiesgo(promediosAcumulados, tasaAcumulada);

  const periodoResumen: PanelEstudiantePeriodo = {
    periodoId,
    nombre: periodo?.nombre ?? "",
    anio: periodo?.anio ?? 0,
    promedio: promediosAcumulados,
    indice: calcularIndice(promediosAcumulados, tasaAcumulada),
    asistencia: resumenAsistencia,
    indiceDesempeno: indices.length > 0
      ? redondear(indices.reduce((a, b) => a + b, 0) / indices.length)
      : 0,
    nivelRiesgo: nivel,
    materias,
  };

  return {
    estudianteId,
    nombre: est.nombre,
    apellidoPaterno: est.apellido_paterno,
    apellidoMaterno: est.apellido_materno,
    cursoParalelo: est.curso_paralelo,
    indiceGeneral: periodoResumen.indice,
    indiceDesempeno: periodoResumen.indiceDesempeno,
    nivelRiesgo: nivel,
    periodos: [periodoResumen],
  };
}

// funcion -> estudiantes en riesgo
export async function listarRiesgo(filtro: {
  periodoId: string;
  trimestre: number;
  limite?: number;
}): Promise<AlertaRiesgo[]> {
  const { periodoId, trimestre } = filtro;
  const limite = Math.min(filtro.limite ?? 100, 300);

  const cursosRes = await query<{ id: bigint }>(
    `SELECT id FROM cursos_periodo WHERE periodo_id = $1`,
    [periodoId],
  );

  const alertas: AlertaRiesgo[] = [];

  for (const curso of cursosRes.rows) {
    const panel = await obtenerPanelCurso({
      cursoPeriodoId: String(curso.id),
      trimestre,
    });

    for (const materia of panel.materias) {
      const libro = await obtenerLibro({
        cursoPeriodoId: String(curso.id),
        materiaId: materia.materiaId,
        trimestre,
      });

      for (const linea of libro.lineas) {
        if (linea.nivelRiesgo !== "riesgo" && linea.nivelRiesgo !== "riesgo_alto") continue;

        alertas.push({
          estudianteId: linea.estudianteId,
          nombre: linea.nombre,
          apellidoPaterno: linea.apellidoPaterno,
          cursoParalelo: `${libro.curso.grado} "${libro.curso.paralelo}" ${libro.curso.nivel.toUpperCase()}`,
          materia: libro.materia.nombre,
          promedio: linea.promedio,
          asistencia: linea.asistencia.tasa,
          nivelRiesgo: linea.nivelRiesgo,
          motivos: linea.observaciones,
        });
      }
    }
  }

  const prioridad = { riesgo_alto: 0, riesgo: 1, observacion: 2, sin_riesgo: 3 } as const;
  alertas.sort((a, b) => prioridad[a.nivelRiesgo] - prioridad[b.nivelRiesgo]);
  return alertas.slice(0, limite);
}

export { esTrimestreValido, calcularIndice, clasificarRiesgo };
