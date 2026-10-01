import { query } from "../connects/Database/transaction.ts";
import { filtroCursos, listarPeriodos, type Contexto } from "./alcance.service.ts";
import type { AvanceMateria, ResumenAcademico } from "../models/dashboard.ts";

/**
 * Avance académico: matrícula, cursos, materias y cuánto de la planificación
 * ya tiene notas cargadas. Sólo lectura.
 */

export async function resumenAcademico(
  contexto: Contexto,
  trimestre: number,
): Promise<ResumenAcademico> {
  const periodoId = contexto.periodo?.id ?? "";
  const periodos = await listarPeriodos(trimestre);

  if (!periodoId) {
    return {
      periodos,
      matricula: { total: 0, porNivel: [] },
      cursos: { total: 0, conDocente: 0, sinDocente: 0 },
      materias: { total: 0, conEncargos: 0, sinEncargos: 0, avanceGlobal: 0 },
      estadoGestion: {
        estructuraGenerada: false,
        horariosGenerados: false,
        planPagosGenerado: false,
        listoParaActivar: false,
      },
      _avance: [],
    };
  }

  // Rango del trimestre: el avance se mide dentro del período, no en todo el año.
  const rango = await query<{ inicio: Date; fin: Date }>(
    `SELECT inicio, fin FROM trimestres WHERE periodo_id = $1 AND numero = $2`,
    [periodoId, trimestre],
  );
  const desde = rango.rows[0] ? formatearFecha(rango.rows[0].inicio) : "1900-01-01";
  const hasta = rango.rows[0] ? formatearFecha(rango.rows[0].fin) : "2999-12-31";

  const filtro = filtroCursos(contexto, []);

  const [matricula, porNivel, cursos, materias, estadoGestion, avance] = await Promise.all([
    query<{ total: string }>(
      `SELECT COUNT(DISTINCT i.estudiante_id) AS total
       FROM inscripciones i
       JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
       WHERE i.estado = 'activo' AND cp.periodo_id = $1 ${filtro.where}`,
      [periodoId, ...filtro.params],
    ),
    query<{ nivel: string; estudiantes: string; cursos: string }>(
      `SELECT c.nivel,
              COUNT(DISTINCT i.estudiante_id) AS estudiantes,
              COUNT(DISTINCT cp.id) AS cursos
       FROM cursos_periodo cp
       JOIN cursos c ON c.id = cp.curso_id
       LEFT JOIN inscripciones i ON i.curso_periodo_id = cp.id AND i.estado = 'activo'
       WHERE cp.periodo_id = $1 ${filtro.where}
       GROUP BY c.nivel
       ORDER BY CASE c.nivel
         WHEN 'inicial' THEN 1 WHEN 'primaria' THEN 2
         WHEN 'secundaria' THEN 3 ELSE 4 END`,
      [periodoId, ...filtro.params],
    ),
    query<{ total: string; con_docente: string }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM asignaciones_docentes ad
                WHERE ad.curso_periodo_id = cp.id AND ad.estado = 'activo'
              )) AS con_docente
       FROM cursos_periodo cp
       WHERE cp.periodo_id = $1 ${filtro.where}`,
      [periodoId, ...filtro.params],
    ),
    query<{ total: string; con_encargos: string; avance: string | null }>(
      `SELECT COUNT(DISTINCT ad.materia_id) AS total,
              COUNT(DISTINCT ad.materia_id) FILTER (WHERE EXISTS (
                SELECT 1 FROM encargos e
                WHERE e.asignacion_id = ad.id AND e.estado = 'publicado'
                  AND e.fecha_publicacion BETWEEN $2 AND $3
              )) AS con_encargos,
              AVG(
                (SELECT COUNT(*) FROM encargos e
                 WHERE e.asignacion_id = ad.id AND e.estado = 'publicado'
                   AND e.fecha_publicacion BETWEEN $2 AND $3)
              ) AS avance
       FROM asignaciones_docentes ad
       JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
       WHERE cp.periodo_id = $1 AND ad.estado = 'activo' ${filtro.where}`,
      [periodoId, desde, hasta, ...filtro.params],
    ),
    query<{
      estructura_generada: boolean;
      horarios_generados: boolean;
      plan_pagos_generado: boolean;
    }>(
      `SELECT estructura_generada, horarios_generados, plan_pagos_generado
       FROM periodos_academicos WHERE id = $1`,
      [periodoId],
    ),
    listarAvanceMaterias(contexto, desde, hasta),
  ]);

  const totalCursos = Number(cursos.rows[0]?.total ?? 0);
  const conDocente = Number(cursos.rows[0]?.con_docente ?? 0);

  const totalMaterias = Number(materias.rows[0]?.total ?? 0);
  const conEncargos = Number(materias.rows[0]?.con_encargos ?? 0);

  // Avance global: porcentaje de encargos del trimestre que ya tienen nota.
  const global = await query<{ calificados: string; publicados: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM calificaciones c
         WHERE c.encargo_id = e.id
       )) AS calificados,
       COUNT(*) AS publicados
     FROM encargos e
     JOIN asignaciones_docentes ad ON ad.id = e.asignacion_id
     JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
     WHERE cp.periodo_id = $1 AND ad.estado = 'activo'
       AND e.estado = 'publicado'
       AND e.fecha_publicacion BETWEEN $2 AND $3
       ${filtro.where}`,
    [periodoId, desde, hasta, ...filtro.params],
  );

  const publicados = Number(global.rows[0]?.publicados ?? 0);
  const calificados = Number(global.rows[0]?.calificados ?? 0);

  const gestion = estadoGestion.rows[0];

  return {
    periodos,
    matricula: {
      total: Number(matricula.rows[0]?.total ?? 0),
      porNivel: porNivel.rows.map((fila) => ({
        nivel: fila.nivel,
        estudiantes: Number(fila.estudiantes),
        cursos: Number(fila.cursos),
      })),
    },
    cursos: {
      total: totalCursos,
      conDocente,
      sinDocente: Math.max(0, totalCursos - conDocente),
    },
    materias: {
      total: totalMaterias,
      conEncargos,
      sinEncargos: Math.max(0, totalMaterias - conEncargos),
      avanceGlobal: publicados > 0
        ? Math.round((calificados / publicados) * 1000) / 10
        : 0,
    },
    estadoGestion: {
      estructuraGenerada: Boolean(gestion?.estructura_generada),
      horariosGenerados: Boolean(gestion?.horarios_generados),
      planPagosGenerado: Boolean(gestion?.plan_pagos_generado),
      listoParaActivar: Boolean(
        gestion?.estructura_generada && gestion?.horarios_generados && gestion?.plan_pagos_generado,
      ),
    },
    _avance: avance,
  };
}

/** Una fila por materia/curso con su avance de calificación. */
async function listarAvanceMaterias(
  contexto: Contexto,
  desde: string,
  hasta: string,
): Promise<AvanceMateria[]> {
  const periodoId = contexto.periodo?.id ?? "";
  const filtro = filtroCursos(contexto, []);

  const res = await query<{
    materia_id: bigint;
    materia: string;
    tipo_materia: string;
    grado: string;
    paralelo: string;
    nivel: string;
    maestro: string | null;
    estudiantes: string;
    encargos: string;
    encargos_calificados: string;
    calificables: string;
    promedio: string | null;
    sin_nota: string;
  }>(
    `SELECT
       ad.materia_id,
       m.nombre AS materia,
       m.tipo_materia,
       c.grado, c.paralelo, c.nivel,
       (ma.usuario_id IS NOT NULL) AS tiene_maestro,
       u.nombre || ' ' || u.apellido_paterno AS maestro,
       (SELECT COUNT(DISTINCT i.estudiante_id) FROM inscripciones i
         WHERE i.curso_periodo_id = cp.id AND i.estado = 'activo') AS estudiantes,
       (SELECT COUNT(*) FROM encargos e
         WHERE e.asignacion_id = ad.id AND e.estado = 'publicado'
           AND e.fecha_publicacion BETWEEN $2 AND $3) AS encargos,
       (SELECT COUNT(*) FROM encargos e
         WHERE e.asignacion_id = ad.id AND e.estado = 'publicado'
           AND e.fecha_publicacion BETWEEN $2 AND $3
           AND EXISTS (SELECT 1 FROM calificaciones c WHERE c.encargo_id = e.id)) AS encargos_calificados,
       (SELECT COUNT(*) FROM calificaciones c
         JOIN encargos e2 ON e2.id = c.encargo_id
         WHERE e2.asignacion_id = ad.id AND e2.estado = 'publicado'
           AND e2.fecha_publicacion BETWEEN $2 AND $3) AS calificables,
       (SELECT AVG(c2.nota) FROM calificaciones c2
         JOIN encargos e3 ON e3.id = c2.encargo_id
         WHERE e3.asignacion_id = ad.id AND e3.estado = 'publicado'
           AND e3.fecha_publicacion BETWEEN $2 AND $3) AS promedio,
       (SELECT COUNT(*) FROM estudiantes est
         WHERE est.id IN (SELECT i2.estudiante_id FROM inscripciones i2
             WHERE i2.curso_periodo_id = cp.id AND i2.estado = 'activo')
           AND NOT EXISTS (
             SELECT 1 FROM calificaciones c3
             JOIN encargos e4 ON e4.id = c3.encargo_id
             WHERE e4.asignacion_id = ad.id AND e4.estado = 'publicado'
               AND e4.fecha_publicacion BETWEEN $2 AND $3
               AND c3.estudiante_id = est.id
           )) AS sin_nota
     FROM asignaciones_docentes ad
     JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
     JOIN cursos c ON c.id = cp.curso_id
     JOIN materias m ON m.id = ad.materia_id
     LEFT JOIN maestros ma ON ma.id = ad.maestro_id
     LEFT JOIN usuarios u ON u.id = ma.usuario_id
     WHERE cp.periodo_id = $1 AND ad.estado = 'activo' ${filtro.where}
     ORDER BY c.nivel, c.grado, c.paralelo, m.nombre`,
    [periodoId, desde, hasta, ...filtro.params],
  );

  return res.rows.map((fila) => {
    const encargos = Number(fila.encargos);
    const calificables = Number(fila.calificables);
    const posibles = calificables > 0 ? calificables : encargos * Number(fila.estudiantes);

    return {
      materiaId: String(fila.materia_id),
      materia: fila.materia,
      tipoMateria: fila.tipo_materia,
      cursoParalelo: `${fila.grado} "${fila.paralelo}" ${fila.nivel.toUpperCase()}`,
      maestro: fila.maestro,
      encargosPublicados: encargos,
      encargosCalificados: Number(fila.encargos_calificados),
      avanceCalificacion: posibles > 0
        ? Math.min(100, Math.round((calificables / posibles) * 1000) / 10)
        : 0,
      promedio: fila.promedio !== null
        ? Math.round(Number(fila.promedio) * 100) / 100
        : null,
      estudiantesSinNota: Number(fila.sin_nota),
      estudiantes: Number(fila.estudiantes),
    };
  });
}

function formatearFecha(valor: Date): string {
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor);
}
