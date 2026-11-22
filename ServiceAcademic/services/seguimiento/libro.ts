import { query } from "../../connects/Database/transaction.ts";
import type { EncargoLibro, LibroNotas, LineaLibro } from "../../models/academic.ts";
import {
  clasificarRiesgo,
  construirResumen,
  obtenerAsignacion,
  obtenerTrimestre,
  redondear,
  toIso,
} from "./comun.ts";
import type {
  FiltroLibro,
  RowAsistencia,
  RowEncargo,
  RowEstudiante,
  RowNota,
} from "./comun.ts";

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

  const asistenciaPorEstudiante = new Map<string, Map<string, { estado: string; total: number }>>();
  for (const fila of asistenciaRes.rows) {
    const estudianteId = String(fila.estudiante_id);
    if (!asistenciaPorEstudiante.has(estudianteId)) asistenciaPorEstudiante.set(estudianteId, new Map());
    asistenciaPorEstudiante.get(estudianteId)!.set(fila.estado, {
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

    const asistencia = construirResumen(asistenciaPorEstudiante.get(clave) ?? new Map());
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
