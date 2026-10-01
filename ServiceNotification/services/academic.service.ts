/**
 * Cliente interno hacia ServiceAcademic para la reevaluación de riesgo.
 *
 * El cálculo de desempeño vive en ServiceAcademic (es el dueño de periodos y
 * trimestres) y no se replica aquí: este servicio sólo lo consulta y decide a
 * quién avisar según su catálogo.
 */
const BASE = Deno.env.get("ACADEMIC_SERVICE_URL") ?? "http://localhost:8881";
const TOKEN = Deno.env.get("INTERNAL_PUSH_TOKEN") ?? "shalom-internal-push";

export interface PanelRiesgo {
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  nivelRiesgo: "sin_riesgo" | "observacion" | "riesgo" | "riesgo_alto";
  periodos: Array<{
    periodoId: string;
    promedio: number | null;
    asistencia: { tasa: number | null };
  }>;
}

export async function consultarPanelEstudiante(
  estudianteId: string,
  periodoId: string,
  trimestre: number,
): Promise<PanelRiesgo | null> {
  const url =
    `${BASE.replace(/\/$/, "")}/seguimiento/internal/estudiante/${encodeURIComponent(estudianteId)}` +
    `?periodoId=${encodeURIComponent(periodoId)}&trimestre=${trimestre}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      headers: { "X-Internal-Token": TOKEN },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[Academic] Seguimiento respondió ${response.status} para ${estudianteId}`);
      return null;
    }

    return await response.json() as PanelRiesgo;
  } catch (err) {
    console.warn("[Academic] No se pudo consultar el desempeño:", err);
    return null;
  }
}
