import { consultarPanelEstudiante } from "./academic.service.ts";
import type { PanelRiesgo } from "./academic.service.ts";
import { limpiarAvisos, marcarAvisado, yaAvisado } from "./alertaDedupe.service.ts";
import { query } from "../connects/Database/transaction.ts";
import { publicarEventoAsync } from "../utils/events.ts";

/**
 * Reevaluación del riesgo académico.
 *
 * Se dispara cada vez que se registra una nota o la asistencia, porque el
 * promedio y la tasa cambian sin aviso. Para no inundar al estudiante, el
 * mismo aviso no se repite dentro de un trimestre (ver alertaDedupe.service).
 *
 * El cálculo NO se replica aquí: se consulta a ServiceAcademic, que es el dueño
 * de periodos, trimestres y ponderaciones.
 */

function trimestreActual(periodoId: string): number {
  return Number(Deno.env.get("SEG_TRIMESTRE_ACTUAL") ?? 1);
}

/**
 * El evento de calificaciones no viaja con el período: se resuelve desde la
 * inscripción activa del estudiante. Si hubiera varias, se prioriza el
 * período que esté activo.
 */
async function resolverPeriodo(estudianteId: string): Promise<string | null> {
  try {
    const res = await query<{ periodo_id: bigint }>(
      `SELECT i.periodo_id
       FROM inscripciones i
       JOIN periodos_academicos p ON p.id = i.periodo_id
       WHERE i.estudiante_id = $1 AND i.estado = 'activo'
       ORDER BY (p.activo AND p.estado = 'activo') DESC, p.fecha_inicio DESC
       LIMIT 1`,
      [estudianteId],
    );
    return res.rows[0] ? String(res.rows[0].periodo_id) : null;
  } catch (err) {
    console.warn("[Riesgo] No se pudo resolver el período del estudiante:", err);
    return null;
  }
}

/** Publica los avisos de un panel si el riesgo es nuevo para ese trimestre. */
export async function avisarRiesgos(panel: PanelRiesgo): Promise<number> {
  const enRiesgo = panel.nivelRiesgo === "riesgo" || panel.nivelRiesgo === "riesgo_alto";
  const nombre = `${panel.nombre} ${panel.apellidoPaterno}`.trim();

  if (!enRiesgo) {
    // Mejoró: se liberan los avisos para que un deterioro futuro pueda
    // volver a notificarse.
    for (const periodo of panel.periodos) {
      await limpiarAvisos(panel.estudianteId, trimestreActual(periodo.periodoId));
    }
    return 0;
  }

  let enviados = 0;

  for (const periodo of panel.periodos) {
    const trimestre = trimestreActual(periodo.periodoId);

    if (!(await yaAvisado(panel.estudianteId, trimestre, panel.nivelRiesgo))) {
      publicarEventoAsync(
        "seguimiento.riesgo",
        {
          estudianteId: panel.estudianteId,
          nombre,
          promedio: periodo.promedio,
          asistencia: periodo.asistencia.tasa,
          nivelRiesgo: panel.nivelRiesgo,
          periodoId: periodo.periodoId,
        },
        "ServiceNotification",
      );
      await marcarAvisado(panel.estudianteId, trimestre, panel.nivelRiesgo);
      enviados += 1;
    }

    const claveEstudiante = `${panel.nivelRiesgo}:estudiante`;
    if (!(await yaAvisado(panel.estudianteId, trimestre, claveEstudiante))) {
      publicarEventoAsync(
        "seguimiento.riesgo-estudiante",
        {
          estudianteId: panel.estudianteId,
          promedio: periodo.promedio,
          asistencia: periodo.asistencia.tasa,
          nivelRiesgo: panel.nivelRiesgo,
          periodoId: periodo.periodoId,
        },
        "ServiceNotification",
      );
      await marcarAvisado(panel.estudianteId, trimestre, claveEstudiante);
      enviados += 1;
    }
  }

  return enviados;
}

/**
 * Punto de entrada del bus. Llega desde `calificaciones.*` y
 * `asistencia.bulk`, que el docente dispara sin percatarse.
 */
export async function reevaluar(
  payload: Record<string, unknown>,
): Promise<{ enviados: number }> {
  const estudianteId = String(payload.estudianteId ?? "").trim();

  // Sin estudiante no hay nada que reevaluar; no es un error.
  if (!estudianteId) return { enviados: 0 };

  const periodoId = String(payload.periodoId ?? "").trim() ||
    (await resolverPeriodo(estudianteId));

  if (!periodoId) return { enviados: 0 };

  const panel = await consultarPanelEstudiante(
    estudianteId,
    periodoId,
    trimestreActual(periodoId),
  );

  if (!panel) return { enviados: 0 };

  const enviados = await avisarRiesgos(panel);
  if (enviados > 0) {
    console.log(`[Riesgo] ${estudianteId}: ${enviados} aviso(s) — nivel ${panel.nivelRiesgo}`);
  }
  return { enviados };
}
