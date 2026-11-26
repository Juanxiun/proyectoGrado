import { query } from "../../connects/Database/transaction.ts";
import { HttpError } from "../../utils/errors.ts";
import type {
  DesempenoMateria,
  DesempenoMateriaResumen,
  NivelRiesgo,
  PanelCurso,
  PanelEstudiante,
  PanelEstudiantePeriodo,
  RangoPromedio,
} from "../../models/academic.ts";
import {
  calcularIndice,
  clasificarRiesgo,
  construirResumen,
  obtenerTrimestre,
  redondear,
} from "./comun.ts";
import type { FiltroPanel, RowEstudiante } from "./comun.ts";
import { obtenerLibro } from "./libro.ts";

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

  const prioridad: Record<NivelRiesgo, number> = {
    sin_riesgo: 0,
    observacion: 1,
    riesgo: 2,
    riesgo_alto: 3,
  };
  const nivelMaterias = materias.reduce<NivelRiesgo>(
    (peor, materia) => prioridad[materia.nivelRiesgo] > prioridad[peor]
      ? materia.nivelRiesgo
      : peor,
    "sin_riesgo",
  );
  const { nivel: nivelAgregado } = clasificarRiesgo(promediosAcumulados, tasaAcumulada);
  const nivel = prioridad[nivelMaterias] > prioridad[nivelAgregado] ? nivelMaterias : nivelAgregado;

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
    usuarioId: String(est.usuario_id),
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
