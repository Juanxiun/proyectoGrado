import { query } from "../connects/Database/transaction.ts";
import { dashboardConfig } from "../config/dashboard.config.ts";
import { filtroCursos, type Contexto } from "./alcance.service.ts";
import type { ResumenRiesgo } from "../models/dashboard.ts";

/**
 * Estudiantes en riesgo, en una sola consulta.
 *
 * Los umbrales NO se inventan acá: se leen de ServiceAcademic
 * (`/seguimiento/umbrales`), que es quien los define y los publica para que
 * todos los módulos expliquen el mismo criterio.
 *
 * NO se reutiliza `GET /seguimiento/riesgo` de ese servicio a propósito: esa
 * ruta recalcula el libro completo materia por materia y curso por curso, lo
 * que son cientos de consultas y no sirve para una página de inicio. Acá se
 * agrega de una vez con SQL, conservando el mismo criterio.
 */

export interface UmbralesRiesgo {
  notaRiesgo: number;
  asistenciaRiesgo: number;
  notaRiesgoAlto: number;
  asistenciaRiesgoAlto: number;
}

let umbralesCache: { valor: UmbralesRiesgo; expira: number } | null = null;

export async function obtenerUmbrales(): Promise<UmbralesRiesgo> {
  if (umbralesCache && umbralesCache.expira > Date.now()) {
    return umbralesCache.valor;
  }

  const porDefecto = dashboardConfig.umbralesRiesgoPorDefecto;

  try {
    const response = await fetch(
      // Ruta interna: la pública exige el JWT del usuario y este servicio no
      // tiene uno, sólo el token compartido entre procesos.
      `${dashboardConfig.academicServiceUrl.replace(/\/$/, "")}/seguimiento/internal/umbrales`,
      {
        method: "GET",
        redirect: "error",
        headers: { "X-Internal-Token": dashboardConfig.internalToken },
        signal: AbortSignal.timeout(3000),
      },
    );

    if (!response.ok) throw new Error(`respondió ${response.status}`);

    const cuerpo = await response.json() as {
      umbralNotaRiesgo?: number;
      umbralAsistenciaRiesgo?: number;
      umbralNotaRiesgoAlto?: number;
      umbralAsistenciaRiesgoAlto?: number;
    };

    const valor: UmbralesRiesgo = {
      notaRiesgo: cuerpo.umbralNotaRiesgo ?? porDefecto.notaRiesgo,
      asistenciaRiesgo: cuerpo.umbralAsistenciaRiesgo ?? porDefecto.asistenciaRiesgo,
      notaRiesgoAlto: cuerpo.umbralNotaRiesgoAlto ?? porDefecto.notaRiesgoAlto,
      asistenciaRiesgoAlto: cuerpo.umbralAsistenciaRiesgoAlto ?? porDefecto.asistenciaRiesgoAlto,
    };

    umbralesCache = { valor, expira: Date.now() + 5 * 60 * 1000 };
    return valor;
  } catch (err) {
    // Si ServiceAcademic no responde se usan los valores por defecto: es
    // preferible mostrar un número aproximado que dejar el dashboard en blanco.
    console.warn("[Riesgo] No se pudieron leer los umbrales, se usan los por defecto:", err);
    return porDefecto;
  }
}

export async function resumenRiesgo(
  contexto: Contexto,
  desde: string,
  hasta: string,
): Promise<ResumenRiesgo> {
  const umbrales = await obtenerUmbrales();
  const periodoId = contexto.periodo?.id ?? "";
  const filtro = filtroCursos(contexto, []);
  const args = [
    periodoId,
    desde,
    hasta,
    umbrales.notaRiesgo,
    umbrales.asistenciaRiesgo,
    umbrales.notaRiesgoAlto,
    umbrales.asistenciaRiesgoAlto,
    ...filtro.params,
  ];

  // Un estudiante aparece una vez: se le atribuye su peor nota y su peor
  // asistencia entre todas las materias del período.
  const consulta = `
    WITH notas AS (
      SELECT c.estudiante_id, ad.curso_periodo_id, c.nota
      FROM calificaciones c
      JOIN encargos e ON e.id = c.encargo_id
      JOIN asignaciones_docentes ad ON ad.id = e.asignacion_id
      JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
      WHERE cp.periodo_id = $1 AND ad.estado = 'activo'
        AND e.estado = 'publicado'
        AND c.fecha_calificacion BETWEEN $2 AND $3
        ${filtro.where}
    ),
    agregado AS (
      SELECT
        n.estudiante_id,
        MIN(n.nota) AS peor_nota,
        AVG(n.nota) AS promedio
      FROM notas n
      GROUP BY n.estudiante_id
    ),
    faltas AS (
      SELECT a.estudiante_id,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE a.estado = 'ausente') AS ausentes
      FROM asistencia a
      JOIN asignaciones_docentes ad ON ad.id = a.asignacion_id
      JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
      WHERE cp.periodo_id = $1 AND ad.estado = 'activo'
        AND a.fecha BETWEEN $2 AND $3 ${filtro.where}
      GROUP BY a.estudiante_id
    ),
    combinado AS (
      SELECT
        e.id AS estudiante_id,
        u.nombre, u.apellido_paterno,
        ag.promedio,
        ag.peor_nota,
        CASE WHEN f.total > 0
          THEN ROUND(((f.total - f.ausentes)::numeric / f.total) * 100, 1)
          ELSE NULL END AS asistencia,
        c.grado, c.paralelo, c.nivel
      FROM agregado ag
      JOIN estudiantes e ON e.id = ag.estudiante_id
      JOIN usuarios u ON u.id = e.usuario_id
      LEFT JOIN faltas f ON f.estudiante_id = ag.estudiante_id
      LEFT JOIN LATERAL (
        SELECT c2.grado, c2.paralelo, c2.nivel
        FROM inscripciones i2
        JOIN cursos_periodo cp2 ON cp2.id = i2.curso_periodo_id
        JOIN cursos c2 ON c2.id = cp2.curso_id
        WHERE i2.estudiante_id = e.id AND cp2.periodo_id = $1
          AND i2.estado = 'activo'
        ORDER BY c2.grado LIMIT 1
      ) c ON true
    )
    SELECT *,
      CASE
        WHEN (promedio IS NOT NULL AND promedio < $6)
          OR (asistencia IS NOT NULL AND asistencia < $7) THEN 'riesgo_alto'
        WHEN (promedio IS NOT NULL AND promedio < $4)
          OR (asistencia IS NOT NULL AND asistencia < $5) THEN 'riesgo'
        WHEN asistencia IS NOT NULL AND asistencia < 100 THEN 'observacion'
        ELSE 'sin_riesgo'
      END AS nivel,
      CASE
        WHEN (promedio IS NOT NULL AND promedio < $6)
          OR (asistencia IS NOT NULL AND asistencia < $7) THEN 0
        WHEN (promedio IS NOT NULL AND promedio < $4)
          OR (asistencia IS NOT NULL AND asistencia < $5) THEN 1
        WHEN asistencia IS NOT NULL AND asistencia < 100 THEN 2
        ELSE 3
      END AS severidad
    FROM combinado
    ORDER BY severidad, promedio ASC NULLS FIRST
    LIMIT 200`;

  const res = await query<{
    estudiante_id: bigint;
    nombre: string;
    apellido_paterno: string;
    promedio: string | null;
    asistencia: string | null;
    grado: string | null;
    paralelo: string | null;
    nivel: string;
  }>(consulta, args);

  const filas = res.rows.map((fila) => ({
    estudianteId: String(fila.estudiante_id),
    nombre: fila.nombre,
    apellidoPaterno: fila.apellido_paterno,
    cursoParalelo: fila.grado
      ? `${fila.grado} "${fila.paralelo}" ${String(fila.nivel).toUpperCase()}`
      : '—',
    promedio: fila.promedio !== null ? Math.round(Number(fila.promedio) * 100) / 100 : null,
    asistencia: fila.asistencia !== null ? Number(fila.asistencia) : null,
    nivelRiesgo: fila.nivel as "observacion" | "riesgo" | "riesgo_alto",
    motivos: motivos(fila, umbrales),
  }));

  const enRiesgo = filas.filter((f) => f.nivelRiesgo === "riesgo" || f.nivelRiesgo === "riesgo_alto");
  const enObservacion = filas.filter((f) => f.nivelRiesgo === "observacion");

  return {
    total: enRiesgo.length,
    observacion: enObservacion.length,
    riesgo: enRiesgo.length,
    riesgoAlto: enRiesgo.filter((f) => f.nivelRiesgo === "riesgo_alto").length,
    sinRiesgo: filas.length - enRiesgo.length - enObservacion.length,
    umbrales,
    top: enRiesgo
      .sort((a, b) => (a.promedio ?? 0) - (b.promedio ?? 0))
      .slice(0, 12),
  };
}

function motivos(
  fila: { promedio: string | null; asistencia: string | null },
  umbrales: UmbralesRiesgo,
): string[] {
  const lista: string[] = [];

  if (fila.promedio !== null) {
    const promedio = Math.round(Number(fila.promedio) * 100) / 100;
    if (promedio < umbrales.notaRiesgoAlto) {
      lista.push(`Promedio ${promedio} muy por debajo de ${umbrales.notaRiesgoAlto}`);
    } else if (promedio < umbrales.notaRiesgo) {
      lista.push(`Promedio ${promedio} por debajo de ${umbrales.notaRiesgo}`);
    }
  }
  if (fila.asistencia !== null) {
    const asistencia = Number(fila.asistencia);
    if (asistencia < umbrales.asistenciaRiesgoAlto) {
      lista.push(`Asistencia ${asistencia}% muy por debajo de ${umbrales.asistenciaRiesgoAlto}%`);
    } else if (asistencia < umbrales.asistenciaRiesgo) {
      lista.push(`Asistencia ${asistencia}% por debajo de ${umbrales.asistenciaRiesgo}%`);
    }
  }
  if (lista.length === 0) lista.push("Indicadores en el límite de observación");

  return lista;
}
