import { consultarPanelEstudiante } from "./academic.service.ts";
import type { PanelRiesgo } from "./academic.service.ts";
import { limpiarAvisos, marcarAvisado, yaAvisado } from "./alertaDedupe.service.ts";
import { query } from "../connects/Database/transaction.ts";
import { publicarEventoAsync } from "../utils/events.ts";

// archivo -> reevaluar riesgo academico

function trimestreActual(periodoId: string): number {
  return Number(Deno.env.get("SEG_TRIMESTRE_ACTUAL") ?? 1);
}

// funcion -> resolver periodo estudiante
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

// funcion -> publicar avisos riesgo
export async function avisarRiesgos(panel: PanelRiesgo): Promise<number> {
  const enRiesgo = panel.nivelRiesgo === "riesgo" || panel.nivelRiesgo === "riesgo_alto";
  const nombre = `${panel.nombre} ${panel.apellidoPaterno}`.trim();

  if (!enRiesgo) {
    // flujo -> liberar avisos mejora
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

// funcion -> reevaluar desde bus
export async function reevaluar(
  payload: Record<string, unknown>,
): Promise<{ enviados: number }> {
  const estudianteId = String(payload.estudianteId ?? "").trim();

  // valida -> sin estudiante
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
